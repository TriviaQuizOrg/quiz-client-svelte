import { api, unwrapStr, paiseToRupees } from '$lib/api';
import type { ApiUser, ApiWalletTransaction } from '$lib/api-types';
import type { AdminManagedUser, WalletTransaction } from '$lib/types';
import { formatDateLabel, formatMonthYear } from '$lib/format';

function mapUser(u: ApiUser): AdminManagedUser {
	const fullName = unwrapStr(u.full_name);
	return {
		id: u.id,
		name: fullName || u.phone_number,
		phoneNumber: u.phone_number,
		kycStatus: u.kyc_status,
		walletBalance: paiseToRupees(u.wallet_balance_paise ?? 0),
		contestsPlayed: u.contests_played ?? 0,
		status: u.is_blocked ? 'suspended' : 'active',
		joinedLabel: formatMonthYear(u.created_at)
	};
}

export async function fetchUsers(): Promise<AdminManagedUser[]> {
	const rows = await api.get<ApiUser[]>('/admin/users');
	return (rows ?? []).map(mapUser);
}

export async function blockUser(id: string, reason: string): Promise<AdminManagedUser> {
	const u = await api.post<ApiUser>(`/admin/users/${id}/block`, { reason });
	return mapUser(u);
}

export async function unblockUser(id: string): Promise<AdminManagedUser> {
	const u = await api.post<ApiUser>(`/admin/users/${id}/unblock`);
	return mapUser(u);
}

function mapTransaction(t: ApiWalletTransaction): WalletTransaction {
	return {
		id: t.id,
		playerId: t.user_id,
		type: t.type,
		status: t.status,
		amount: paiseToRupees(t.amount_paise),
		balanceAfter: paiseToRupees(t.balance_after_paise),
		referenceType: unwrapStr(t.reference_type),
		dateLabel: formatDateLabel(t.created_at)
	};
}

export async function fetchUserTransactions(userId: string): Promise<WalletTransaction[]> {
	const rows = await api.get<ApiWalletTransaction[]>(`/admin/users/${userId}/transactions`);
	return (rows ?? []).map(mapTransaction);
}
