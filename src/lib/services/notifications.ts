import { PUBLIC_API_BASE_URL } from '$env/static/public';
import { api, unwrapRawMessage } from '$lib/api';
import { auth } from '$lib/stores/auth.svelte';
import type { ApiNotification } from '$lib/api-types';
import type { AdminNotification } from '$lib/types';

function ticketIdFromData(data: unknown): string | null {
	if (!data || typeof data !== 'object') return null;
	const ticketId = (data as Record<string, unknown>).ticket_id;
	return typeof ticketId === 'string' ? ticketId : null;
}

function mapNotification(n: ApiNotification): AdminNotification {
	return {
		id: n.id,
		notificationType: n.type,
		title: n.title,
		body: n.body,
		ticketId: ticketIdFromData(unwrapRawMessage(n.data_json)),
		isRead: n.is_read,
		createdAt: n.created_at
	};
}

export async function fetchNotifications(): Promise<AdminNotification[]> {
	const rows = await api.get<ApiNotification[]>('/admin/notifications');
	return (rows ?? []).map(mapNotification);
}

export async function markNotificationRead(id: string): Promise<AdminNotification> {
	const n = await api.post<ApiNotification>(`/admin/notifications/${id}/read`);
	return mapNotification(n);
}

/** Sends one notification to every active (non-blocked) player. Returns how many got one. */
export async function broadcastNotification(title: string, body: string): Promise<number> {
	const res = await api.post<{ recipient_count: number }>('/admin/notifications/broadcast', {
		title,
		body
	});
	return res.recipient_count;
}

interface AdminWsMessage {
	type: string;
	id: string;
	notification_type: string;
	title: string;
	body: string;
	data?: unknown;
}

/**
 * Opens a live WebSocket connection for push notifications and reconnects (fixed 3s
 * backoff) if it drops. Browsers can't set custom headers on a WS handshake, so the ID
 * token goes in a query param instead — see RequireAdminAuthWS backend-side, which only
 * accepts that fallback on this one route.
 *
 * Returns a cleanup function that closes the connection and stops reconnecting.
 */
export function connectAdminNotifications(
	onNotification: (n: AdminNotification) => void
): () => void {
	let socket: WebSocket | null = null;
	let closed = false;

	async function connect() {
		if (closed) return;
		const token = await auth.getIdToken();
		if (!token || closed) return;

		const wsBase = PUBLIC_API_BASE_URL.replace(/^http/, 'ws');
		socket = new WebSocket(`${wsBase}/admin/ws?token=${encodeURIComponent(token)}`);

		socket.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data) as AdminWsMessage;
				if (msg.type !== 'notification') return;
				onNotification({
					id: msg.id,
					notificationType: msg.notification_type,
					title: msg.title,
					body: msg.body,
					ticketId: ticketIdFromData(msg.data),
					isRead: false,
					createdAt: new Date().toISOString()
				});
			} catch {
				// ignore malformed frames
			}
		};

		socket.onclose = () => {
			if (!closed) setTimeout(connect, 3000);
		};
	}

	connect();

	return () => {
		closed = true;
		socket?.close();
	};
}
