import { api, downloadFile, paiseToRupees } from '$lib/api';
import type { ApiReconciliation } from '$lib/api-types';
import type { Reconciliation } from '$lib/types';

export async function fetchReconciliation(): Promise<Reconciliation> {
	const raw = await api.get<ApiReconciliation>('/admin/reports/reconciliation');
	return {
		recharged: paiseToRupees(raw.recharged_paise),
		entryFeesCollected: paiseToRupees(raw.entry_fees_collected_paise),
		prizesCredited: paiseToRupees(raw.prizes_credited_paise),
		withdrawn: paiseToRupees(raw.withdrawn_paise),
		refunded: paiseToRupees(raw.refunded_paise),
		expectedWalletBalance: paiseToRupees(raw.expected_wallet_balance_paise),
		actualWalletBalance: paiseToRupees(raw.actual_wallet_balance_paise),
		reconciled: raw.reconciled
	};
}

/** from/to are RFC3339; omit either to use the backend's default (last 30 days). */
export async function downloadWalletTransactionsCSV(from?: string, to?: string): Promise<void> {
	const params = new URLSearchParams();
	if (from) params.set('from', from);
	if (to) params.set('to', to);
	const query = params.toString() ? `?${params.toString()}` : '';
	const stamp = new Date().toISOString().slice(0, 10);
	await downloadFile(
		`/admin/reports/wallet-transactions/export${query}`,
		`wallet_transactions_${stamp}.csv`
	);
}
