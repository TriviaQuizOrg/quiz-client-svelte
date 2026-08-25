import { fetchNotifications, markNotificationRead } from '$lib/services/notifications';
import type { AdminNotification } from '$lib/types';

class NotificationsStore {
	list = $state<AdminNotification[]>([]);
	// Bumped whenever a `ticket_reply` push notification arrives, so the tickets route can
	// refresh an already-open ticket without the chrome reaching into that route's state.
	lastTicketReply = $state<{ ticketId: string; at: number } | null>(null);
	// Set by the chrome when a notification for a ticket is clicked from any route; the
	// tickets route watches this and opens the ticket, then clears it.
	requestedTicketId = $state<string | null>(null);

	get unreadCount() {
		return this.list.filter((n) => !n.isRead).length;
	}

	async load() {
		try {
			this.list = await fetchNotifications();
		} catch {
			this.list = [];
		}
	}

	applyIncoming(n: AdminNotification) {
		this.list = [n, ...this.list];
		if (n.notificationType === 'ticket_reply' && n.ticketId) {
			this.lastTicketReply = { ticketId: n.ticketId, at: Date.now() };
		}
	}

	markRead(id: string) {
		this.list = this.list.map((n) => (n.id === id ? { ...n, isRead: true } : n));
		markNotificationRead(id).catch(() => {});
	}

	async markAllRead() {
		const unread = this.list.filter((n) => !n.isRead);
		this.list = this.list.map((n) => ({ ...n, isRead: true }));
		await Promise.all(unread.map((n) => markNotificationRead(n.id).catch(() => {})));
	}
}

export const notifications = new NotificationsStore();
