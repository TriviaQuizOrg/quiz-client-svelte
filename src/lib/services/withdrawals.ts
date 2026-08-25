import {
	api,
	unwrapStr,
	unwrapTime,
	paiseToRupees,
	mapPaged,
	type ApiPaged,
	type Paged
} from '$lib/api';
import type { ApiWithdrawal, ApiWithdrawalStatus } from '$lib/api-types';
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

export async function fetchWithdrawals(
	page: number,
	status = '',
	q = ''
): Promise<Paged<Withdrawal>> {
	const params = new URLSearchParams({ page: String(page) });
	if (status) params.set('status', status);
	if (q.trim()) params.set('q', q.trim());
	const raw = await api.get<ApiPaged<ApiWithdrawal>>(`/admin/withdrawals?${params}`);
	return mapPaged(raw, mapWithdrawal);
}

export interface WithdrawalStats {
	status: ApiWithdrawalStatus;
	count: number;
	amount: number; // rupees
}

// Platform-wide per-status counts/amounts, independent of whichever page of the list is
// loaded — backs the Payouts page's stat cards and status donut.
export async function fetchWithdrawalStats(): Promise<WithdrawalStats[]> {
	const rows = await api.get<
		{ status: ApiWithdrawalStatus; count: number; amount_paise: number }[]
	>('/admin/withdrawals/stats');
	return (rows ?? []).map((r) => ({
		status: r.status,
		count: r.count,
		amount: paiseToRupees(r.amount_paise)
	}));
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
