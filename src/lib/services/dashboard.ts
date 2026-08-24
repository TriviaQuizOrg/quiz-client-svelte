import { api, paiseToRupees } from '$lib/api';
import type { ApiOverview, ApiAdminMe } from '$lib/api-types';
import type { DashboardOverview, AdminAccount } from '$lib/types';
import { mapGameEvent } from './gameEvents';

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
	const raw = await api.get<ApiOverview>('/admin/dashboard');
	return {
		totalUsers: raw.total_users,
		walletLiability: paiseToRupees(raw.wallet_liability_paise),
		todaysGameEvents: (raw.todays_game_events ?? []).map(mapGameEvent),
		entryFeesToday: paiseToRupees(raw.entry_fees_collected_today_paise),
		prizesPaidToday: paiseToRupees(raw.prizes_paid_today_paise),
		withdrawalsPaidToday: paiseToRupees(raw.withdrawals_paid_today_paise)
	};
}

export async function fetchAdminMe(): Promise<AdminAccount> {
	const raw = await api.get<ApiAdminMe>('/admin/me');
	return {
		id: raw.id,
		email: raw.email,
		role: raw.role,
		isActive: raw.is_active,
		mfaEnrolled: raw.mfa_enrolled
	};
}
