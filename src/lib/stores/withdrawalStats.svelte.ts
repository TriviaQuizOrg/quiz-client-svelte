import { fetchWithdrawalStats, type WithdrawalStats } from '$lib/services/withdrawals';
import type { WithdrawalStatus } from '$lib/types';

// Platform-wide per-status withdrawal counts/amounts — independent of whatever page/filter
// is loaded in the payouts table. Shared by dashboard and payouts.
class WithdrawalStatsStore {
	stats = $state<WithdrawalStats[]>([]);
	loaded = false;

	async load() {
		if (this.loaded) return;
		this.loaded = true;
		try {
			this.stats = await fetchWithdrawalStats();
		} catch {
			// Secondary data — a failure here shouldn't block the page that requested it.
		}
	}

	// Forces a re-fetch even if already loaded — used after a mutation (approve/reject/…)
	// changes the counts.
	async refresh() {
		try {
			this.stats = await fetchWithdrawalStats();
		} catch {
			// Secondary data — a failure here shouldn't block the page that requested it.
		}
	}

	statFor(status: WithdrawalStatus) {
		return this.stats.find((s) => s.status === status);
	}

	get pendingCount() {
		return this.statFor('pending')?.count ?? 0;
	}
	get pendingAmount() {
		return this.statFor('pending')?.amount ?? 0;
	}
	get paidOutAmount() {
		return this.statFor('success')?.amount ?? 0;
	}
	get failedOrRejectedCount() {
		return (this.statFor('failed')?.count ?? 0) + (this.statFor('rejected')?.count ?? 0);
	}
	get totalRequests() {
		return this.stats.reduce((sum, s) => sum + s.count, 0);
	}
}

export const withdrawalStatsStore = new WithdrawalStatsStore();
