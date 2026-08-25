import {
	api,
	unwrapStr,
	unwrapTime,
	unwrapInt,
	unwrapBool,
	mapPaged,
	type ApiPaged,
	type Paged
} from '$lib/api';
import type { ApiDispute, ApiDisputeEvidence } from '$lib/api-types';
import type { DisputeItem, DisputeEvidence } from '$lib/types';

function mapDispute(d: ApiDispute): DisputeItem {
	const fullName = d.user_full_name ? unwrapStr(d.user_full_name) : null;
	return {
		id: d.id,
		userId: d.user_id,
		playerName: fullName || d.user_phone_number || '',
		playerPhone: d.user_phone_number ?? '',
		entryId: d.entry_id,
		questionId: d.question_id,
		description: d.description,
		status: d.status,
		resolutionNotes: unwrapStr(d.resolution_notes),
		assignedTo: d.assigned_to,
		createdAt: d.created_at,
		resolvedAt: unwrapTime(d.resolved_at)
	};
}

function mapEvidence(raw: ApiDisputeEvidence): DisputeEvidence {
	return {
		dispute: mapDispute(raw.dispute),
		entry: raw.entry
			? {
					id: raw.entry.id,
					serverReceivedAt: raw.entry.server_received_at,
					clientTapAt: unwrapTime(raw.entry.client_tap_at),
					speedRank: unwrapInt(raw.entry.speed_rank),
					finalRank: unwrapInt(raw.entry.final_rank),
					status: raw.entry.status
				}
			: null,
		question: raw.question
			? {
					id: raw.question.id,
					sequenceNo: raw.question.sequence_no,
					questionText: raw.question.question_text,
					options: raw.question.options_json,
					correctOption: raw.question.correct_option
				}
			: null,
		userAnswer: raw.user_answer
			? {
					selectedOption: unwrapStr(raw.user_answer.selected_option),
					isCorrect: unwrapBool(raw.user_answer.is_correct),
					questionShownAt: unwrapTime(raw.user_answer.question_shown_at),
					answeredAt: unwrapTime(raw.user_answer.answered_at),
					responseTimeMs: unwrapInt(raw.user_answer.response_time_ms),
					pointsAwarded: raw.user_answer.points_awarded
				}
			: null
	};
}

export async function fetchDisputes(page: number, status = ''): Promise<Paged<DisputeItem>> {
	const params = new URLSearchParams({ page: String(page) });
	if (status) params.set('status', status);
	const raw = await api.get<ApiPaged<ApiDispute>>(`/admin/disputes?${params}`);
	return mapPaged(raw, mapDispute);
}

export async function fetchDisputeEvidence(id: string): Promise<DisputeEvidence> {
	const raw = await api.get<ApiDisputeEvidence>(`/admin/disputes/${id}`);
	return mapEvidence(raw);
}

export async function assignDisputeToMe(id: string): Promise<DisputeItem> {
	const d = await api.post<ApiDispute>(`/admin/disputes/${id}/assign`);
	return mapDispute(d);
}

export async function investigateDispute(id: string): Promise<DisputeItem> {
	const d = await api.post<ApiDispute>(`/admin/disputes/${id}/investigate`);
	return mapDispute(d);
}

export async function resolveDispute(id: string, notes: string): Promise<DisputeItem> {
	const d = await api.post<ApiDispute>(`/admin/disputes/${id}/resolve`, { notes });
	return mapDispute(d);
}

export async function rejectDispute(id: string, notes: string): Promise<DisputeItem> {
	const d = await api.post<ApiDispute>(`/admin/disputes/${id}/reject`, { notes });
	return mapDispute(d);
}
