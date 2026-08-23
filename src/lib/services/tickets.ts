import { api, unwrapStr, unwrapTime } from '$lib/api';
import type { ApiSupportTicket, ApiSupportMessage, ApiTicketDetail } from '$lib/api-types';
import type { SupportTicket, TicketMessage } from '$lib/types';

function mapTicket(t: ApiSupportTicket): SupportTicket {
	return {
		id: t.id,
		userId: t.user_id,
		disputeId: t.dispute_id,
		category: t.category,
		subject: t.subject,
		status: t.status,
		priority: t.priority,
		assignedTo: t.assigned_to,
		createdAt: t.created_at,
		updatedAt: t.updated_at,
		resolvedAt: unwrapTime(t.resolved_at),
		closedAt: unwrapTime(t.closed_at)
	};
}

function mapMessage(m: ApiSupportMessage): TicketMessage {
	return {
		id: m.id,
		ticketId: m.ticket_id,
		senderType: m.sender_type,
		senderId: m.sender_id,
		messageText: m.message_text,
		attachmentUrl: unwrapStr(m.attachment_url),
		createdAt: m.created_at
	};
}

export async function fetchTickets(): Promise<SupportTicket[]> {
	const rows = await api.get<ApiSupportTicket[]>('/admin/tickets');
	return (rows ?? []).map(mapTicket);
}

export interface TicketDetail {
	ticket: SupportTicket;
	messages: TicketMessage[];
}

export async function fetchTicketDetail(id: string): Promise<TicketDetail> {
	const raw = await api.get<ApiTicketDetail>(`/admin/tickets/${id}`);
	return { ticket: mapTicket(raw.ticket), messages: (raw.messages ?? []).map(mapMessage) };
}

// Claims the ticket for the calling admin — there's no "assign to X" concept, only
// "assign to me" (adminID comes from the auth token server-side, not a request body).
export async function assignTicketToMe(id: string): Promise<SupportTicket> {
	const t = await api.post<ApiSupportTicket>(`/admin/tickets/${id}/assign`);
	return mapTicket(t);
}

export async function postTicketMessage(id: string, messageText: string): Promise<TicketMessage> {
	const m = await api.post<ApiSupportMessage>(`/admin/tickets/${id}/messages`, {
		message_text: messageText
	});
	return mapMessage(m);
}

export async function resolveTicket(id: string): Promise<SupportTicket> {
	const t = await api.post<ApiSupportTicket>(`/admin/tickets/${id}/resolve`);
	return mapTicket(t);
}

export async function closeTicket(id: string): Promise<SupportTicket> {
	const t = await api.post<ApiSupportTicket>(`/admin/tickets/${id}/close`);
	return mapTicket(t);
}
