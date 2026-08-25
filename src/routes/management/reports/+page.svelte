<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { fetchReconciliation, downloadWalletTransactionsCSV } from '$lib/services/reports';
	import type { Reconciliation } from '$lib/types';
	import { formatINR } from '$lib/format';
	import StatCard from '$lib/components/StatCard.svelte';
	import DatePicker from '$lib/components/date-picker.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	// ---------- Reports ----------
	let reconciliation = $state<Reconciliation | null>(null);
	let reconciliationLoading = $state(false);
	let reconciliationError = $state('');
	let exportFrom = $state<Date | undefined>(undefined);
	let exportTo = $state<Date | undefined>(undefined);
	let exportBusy = $state(false);
	let exportError = $state('');

	async function loadReconciliation() {
		reconciliationLoading = true;
		reconciliationError = '';
		try {
			reconciliation = await fetchReconciliation();
		} catch (err) {
			reconciliationError = err instanceof Error ? err.message : 'Failed to load reconciliation.';
		} finally {
			reconciliationLoading = false;
		}
	}

	let reportsLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeeReports && !reportsLoaded) {
			reportsLoaded = true;
			loadReconciliation();
		}
	});

	async function exportCSV(e: SubmitEvent) {
		e.preventDefault();
		exportBusy = true;
		exportError = '';
		try {
			await downloadWalletTransactionsCSV(
				exportFrom ? exportFrom.toISOString() : undefined,
				exportTo ? exportTo.toISOString() : undefined
			);
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Failed to export CSV.';
		} finally {
			exportBusy = false;
		}
	}
</script>

{#if !adminAccount.canSeeReports}
	<div
		class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
	>
		You don't have access to reports.
	</div>
{:else}
	{#if reconciliationError}
		<p
			class="mb-4 rounded-lg px-3 py-2 text-sm"
			style="background-color: var(--color-error-bg); color: var(--color-error);"
		>
			{reconciliationError}
		</p>
	{/if}

	{#if reconciliationLoading}
		<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
	{:else if reconciliation}
		{@const r = reconciliation}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Recharged" value={formatINR(r.recharged)} />
			<StatCard label="Entry fees collected" value={formatINR(r.entryFeesCollected)} />
			<StatCard label="Prizes credited" value={formatINR(r.prizesCredited)} />
			<StatCard label="Withdrawn" value={formatINR(r.withdrawn)} />
		</div>
		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard label="Refunded" value={formatINR(r.refunded)} />
			<StatCard label="Expected wallet balance" value={formatINR(r.expectedWalletBalance)} />
			<StatCard label="Actual wallet balance" value={formatINR(r.actualWalletBalance)} />
			<div
				class="rounded-card border border-line bg-surface p-5"
				style={r.reconciled
					? ''
					: 'background-color: var(--color-error-bg); border-color: var(--color-error);'}
			>
				<p class="text-xs text-ink-soft">Ledger integrity</p>
				<p
					class="mt-1 text-lg font-semibold"
					style={r.reconciled ? 'color: var(--color-success);' : 'color: var(--color-error);'}
				>
					{r.reconciled ? 'Reconciled' : 'Mismatch!'}
				</p>
			</div>
		</div>
	{/if}

	<div class="mt-6 rounded-card border border-line bg-surface p-5">
		<h2 class="mb-1 text-sm font-semibold text-ink">Export wallet transactions</h2>
		<p class="mb-4 text-xs text-ink-soft">Defaults to the last 30 days if left blank.</p>
		<form class="flex flex-wrap items-end gap-3" onsubmit={exportCSV}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">From</span>
				<DatePicker bind:value={exportFrom} class="w-44" />
			</label>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">To</span>
				<DatePicker bind:value={exportTo} class="w-44" />
			</label>
			<button
				type="submit"
				disabled={exportBusy}
				class="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{exportBusy ? 'Exporting…' : 'Download CSV'}
			</button>
		</form>
		{#if exportError}
			<p class="mt-3 text-sm" style="color: var(--color-error);">{exportError}</p>
		{/if}
	</div>
{/if}
