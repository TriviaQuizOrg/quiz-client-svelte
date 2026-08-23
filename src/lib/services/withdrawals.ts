import { api, unwrapStr, unwrapTime, paiseToRupees } from '$lib/api';
import type { ApiWithdrawal } from '$lib/api-types';
import type { Withdrawal } from '$lib/types';

function mapWithdrawal(w: ApiWithdrawal): Withdrawal {
	const fullName = unwrapStr(w.player_full_name);
	return {
		id: w.id,
		userId: w.user_id,
		playerName: fullName || w.player_phone_number,
		playerPhone: w.player_phone_number,
		amount: paiseToRupees(w.amount_paise),
		upiId: w.upi_id,
		status: w.status,
		requestedAt: w.requested_at,
		reviewedAt: unwrapTime(w.reviewed_at),
		processedAt: unwrapTime(w.processed_at),
		failureReason: unwrapStr(w.failure_reason)
	};
}

export async function fetchWithdrawals(): Promise<Withdrawal[]> {
	const rows = await api.get<ApiWithdrawal[]>('/admin/withdrawals');
	return (rows ?? []).map(mapWithdrawal);
}

export async function approveWithdrawal(id: string): Promise<Withdrawal> {
	const w = await api.post<ApiWithdrawal>(`/admin/withdrawals/${id}/approve`);
	return mapWithdrawal(w);
}

export async function rejectWithdrawal(id: string, reason: string): Promise<Withdrawal> {
	const w = await api.post<ApiWithdrawal>(`/admin/withdrawals/${id}/reject`, { reason });
	return mapWithdrawal(w);
}

export async function markWithdrawalProcessed(id: string): Promise<Withdrawal> {
	const w = await api.post<ApiWithdrawal>(`/admin/withdrawals/${id}/mark-processed`);
	return mapWithdrawal(w);
}

export async function markWithdrawalFailed(id: string, reason: string): Promise<Withdrawal> {
	const w = await api.post<ApiWithdrawal>(`/admin/withdrawals/${id}/mark-failed`, { reason });
	return mapWithdrawal(w);
}
