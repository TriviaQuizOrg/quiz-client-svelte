<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { withdrawalStatsStore } from '$lib/stores/withdrawalStats.svelte';
	import {
		fetchWithdrawals,
		approveWithdrawal,
		rejectWithdrawal,
		markWithdrawalProcessed,
		markWithdrawalFailed
	} from '$lib/services/withdrawals';
	import { WITHDRAWAL_STATUS_INFO, type Withdrawal } from '$lib/types';
	import { formatINR, formatDateLabel } from '$lib/format';
	import StatCard from '$lib/components/StatCard.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PillTabs from '$lib/components/PillTabs.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	// ---------- Payouts (withdrawals) ----------
	// The real UPI transfer isn't wired to a payment aggregator yet — mark-processed /
	// mark-failed below (both real backend endpoints) are today's stand-in for that: an
	// admin manually confirms the outcome instead of a payment-gateway webhook doing it.
	let withdrawals = $state<Withdrawal[]>([]);
	let withdrawalsLoading = $state(false);
	let withdrawalsError = $state('');
	let payoutQuery = $state('');
	let payoutFilter = $state('all');
	let payoutsPage = $state(1);
	let payoutsTotal = $state(0);
	let payoutsTotalPages = $state(1);

	const payoutFilterOptions = [
		{ id: 'all', label: 'All' },
		{ id: 'pending', label: 'Pending' },
		{ id: 'approved', label: 'Approved' },
		{ id: 'processing', label: 'Processing' },
		{ id: 'success', label: 'Paid out' },
		{ id: 'rejected', label: 'Rejected' },
		{ id: 'failed', label: 'Failed' }
	];

	async function loadWithdrawals() {
		withdrawalsLoading = true;
		withdrawalsError = '';
		try {
			const result = await fetchWithdrawals(
				payoutsPage,
				payoutFilter === 'all' ? '' : payoutFilter,
				payoutQuery
			);
			withdrawals = result.items;
			payoutsTotal = result.total;
			payoutsTotalPages = result.totalPages;
		} catch (err) {
			withdrawalsError = err instanceof Error ? err.message : 'Failed to load payouts.';
		} finally {
			withdrawalsLoading = false;
		}
	}

	let withdrawalsLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeePayouts && !withdrawalsLoaded) {
			withdrawalsLoaded = true;
			loadWithdrawals();
			withdrawalStatsStore.load();
		}
	});

	function goToPayoutsPage(page: number) {
		payoutsPage = page;
		loadWithdrawals();
	}

	function onPayoutFilterChange(status: string) {
		payoutFilter = status;
		payoutsPage = 1;
		loadWithdrawals();
	}

	let payoutQueryTimer: ReturnType<typeof setTimeout> | undefined;
	function onPayoutQueryInput() {
		clearTimeout(payoutQueryTimer);
		payoutQueryTimer = setTimeout(() => {
			payoutsPage = 1;
			loadWithdrawals();
		}, 300);
	}

	let withdrawalActionBusy = $state<string | null>(null);
	let withdrawalActionError = $state<Record<string, string>>({});

	async function approvePayout(id: string) {
		withdrawalActionBusy = id;
		withdrawalActionError = { ...withdrawalActionError, [id]: '' };
		try {
			const updated = await approveWithdrawal(id);
			withdrawals = withdrawals.map((w) => (w.id === updated.id ? updated : w));
			withdrawalStatsStore.refresh();
		} catch (err) {
			withdrawalActionError = {
				...withdrawalActionError,
				[id]: err instanceof Error ? err.message : 'Failed to approve payout.'
			};
		} finally {
			withdrawalActionBusy = null;
		}
	}

	async function markProcessedPayout(id: string) {
		withdrawalActionBusy = id;
		withdrawalActionError = { ...withdrawalActionError, [id]: '' };
		try {
			const updated = await markWithdrawalProcessed(id);
			withdrawals = withdrawals.map((w) => (w.id === updated.id ? updated : w));
			withdrawalStatsStore.refresh();
		} catch (err) {
			withdrawalActionError = {
				...withdrawalActionError,
				[id]: err instanceof Error ? err.message : 'Failed to mark payout processed.'
			};
		} finally {
			withdrawalActionBusy = null;
		}
	}

	let rejectingWithdrawalId = $state<string | null>(null);
	let failingWithdrawalId = $state<string | null>(null);
	let withdrawalReasonInput = $state('');
	let withdrawalReasonError = $state('');

	function openRejectPayout(id: string) {
		rejectingWithdrawalId = id;
		withdrawalReasonInput = '';
		withdrawalReasonError = '';
	}

	function openFailPayout(id: string) {
		failingWithdrawalId = id;
		withdrawalReasonInput = '';
		withdrawalReasonError = '';
	}

	async function confirmRejectPayout(e: SubmitEvent) {
		e.preventDefault();
		if (!rejectingWithdrawalId || !withdrawalReasonInput.trim()) return;
		try {
			const updated = await rejectWithdrawal(rejectingWithdrawalId, withdrawalReasonInput.trim());
			withdrawals = withdrawals.map((w) => (w.id === updated.id ? updated : w));
			withdrawalStatsStore.refresh();
			rejectingWithdrawalId = null;
		} catch (err) {
			withdrawalReasonError = err instanceof Error ? err.message : 'Failed to reject payout.';
		}
	}

	async function confirmFailPayout(e: SubmitEvent) {
		e.preventDefault();
		if (!failingWithdrawalId || !withdrawalReasonInput.trim()) return;
		try {
			const updated = await markWithdrawalFailed(failingWithdrawalId, withdrawalReasonInput.trim());
			withdrawals = withdrawals.map((w) => (w.id === updated.id ? updated : w));
			withdrawalStatsStore.refresh();
			failingWithdrawalId = null;
		} catch (err) {
			withdrawalReasonError = err instanceof Error ? err.message : 'Failed to mark payout failed.';
		}
	}
</script>

{#if !adminAccount.canSeePayouts}
	<div
		class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
	>
		You don't have access to payouts.
	</div>
{:else}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard label="Pending amount" value={formatINR(withdrawalStatsStore.pendingAmount)} />
		<StatCard label="Pending requests" value={withdrawalStatsStore.pendingCount.toString()} />
		<StatCard label="Paid out" value={formatINR(withdrawalStatsStore.paidOutAmount)} />
		<StatCard
			label="Failed / rejected"
			value={withdrawalStatsStore.failedOrRejectedCount.toString()}
		/>
	</div>

	<div class="mt-5 mb-4 flex flex-wrap items-center gap-3">
		<input
			type="search"
			bind:value={payoutQuery}
			oninput={onPayoutQueryInput}
			placeholder="Search by player or phone…"
			class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
		/>
		<PillTabs
			options={payoutFilterOptions}
			bind:value={payoutFilter}
			onChange={onPayoutFilterChange}
		/>
	</div>

	{#if withdrawalsError}
		<p
			class="mb-4 rounded-lg px-3 py-2 text-sm"
			style="background-color: var(--color-error-bg); color: var(--color-error);"
		>
			{withdrawalsError}
		</p>
	{/if}

	<div class="overflow-x-auto rounded-card border border-line bg-surface">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-line text-xs text-ink-soft uppercase">
					<th class="px-4 py-3 font-medium">Player</th>
					<th class="px-4 py-3 font-medium">Amount</th>
					<th class="px-4 py-3 font-medium">UPI ID</th>
					<th class="px-4 py-3 font-medium">Requested</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium"></th>
				</tr>
			</thead>
			<tbody>
				{#each withdrawals as payout (payout.id)}
					<tr class="border-b border-line align-top last:border-0">
						<td class="px-4 py-3">
							<p class="font-medium text-ink">{payout.playerName}</p>
							<p class="text-xs text-ink-soft">{payout.playerPhone}</p>
						</td>
						<td class="px-4 py-3 text-ink tabular-nums">{formatINR(payout.amount)}</td>
						<td class="px-4 py-3 text-ink-soft">{payout.upiId}</td>
						<td class="px-4 py-3 text-ink-soft">{formatDateLabel(payout.requestedAt)}</td>
						<td class="px-4 py-3">
							<Chip
								label={WITHDRAWAL_STATUS_INFO[payout.status].label}
								color={WITHDRAWAL_STATUS_INFO[payout.status].color}
								bg={WITHDRAWAL_STATUS_INFO[payout.status].bg}
							/>
							{#if payout.failureReason}
								<p class="mt-1 max-w-48 text-xs text-ink-faint">{payout.failureReason}</p>
							{/if}
							{#if withdrawalActionError[payout.id]}
								<p class="mt-1 max-w-48 text-xs" style="color: var(--color-error);">
									{withdrawalActionError[payout.id]}
								</p>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							{#if payout.status === 'pending'}
								<div class="flex justify-end gap-2">
									<button
										class="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
										style="background-color: var(--color-primary);"
										disabled={withdrawalActionBusy === payout.id}
										onclick={() => approvePayout(payout.id)}
									>
										{withdrawalActionBusy === payout.id ? '…' : 'Approve'}
									</button>
									<button
										class="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-error"
										onclick={() => openRejectPayout(payout.id)}
									>
										Reject
									</button>
								</div>
							{:else if payout.status === 'approved'}
								<div class="flex justify-end gap-2">
									<button
										class="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
										style="background-color: var(--color-primary);"
										disabled={withdrawalActionBusy === payout.id}
										onclick={() => markProcessedPayout(payout.id)}
									>
										{withdrawalActionBusy === payout.id ? '…' : 'Mark processed'}
									</button>
									<button
										class="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-error"
										onclick={() => openFailPayout(payout.id)}
									>
										Mark failed
									</button>
								</div>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="px-4 py-8 text-center text-sm text-ink-soft">
							{withdrawalsLoading ? 'Loading payouts…' : 'No payout requests match your search.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination
		page={payoutsPage}
		totalPages={payoutsTotalPages}
		total={payoutsTotal}
		onChange={goToPayoutsPage}
	/>
{/if}

{#if rejectingWithdrawalId}
	<Modal title="Reject payout" onClose={() => (rejectingWithdrawalId = null)}>
		<form class="space-y-4" onsubmit={confirmRejectPayout}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Reason</span>
				<textarea
					required
					bind:value={withdrawalReasonInput}
					rows="3"
					placeholder="e.g. Failed KYC verification"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>
			{#if withdrawalReasonError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{withdrawalReasonError}
				</p>
			{/if}
			<p class="text-xs text-ink-soft">
				The debited amount will be refunded to the player's wallet.
			</p>
			<button
				type="submit"
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-error);"
			>
				Reject payout
			</button>
		</form>
	</Modal>
{/if}

{#if failingWithdrawalId}
	<Modal title="Mark payout failed" onClose={() => (failingWithdrawalId = null)}>
		<form class="space-y-4" onsubmit={confirmFailPayout}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Reason</span>
				<textarea
					required
					bind:value={withdrawalReasonInput}
					rows="3"
					placeholder="e.g. UPI transfer bounced"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>
			{#if withdrawalReasonError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{withdrawalReasonError}
				</p>
			{/if}
			<p class="text-xs text-ink-soft">
				The debited amount will be refunded to the player's wallet.
			</p>
			<button
				type="submit"
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-error);"
			>
				Mark failed
			</button>
		</form>
	</Modal>
{/if}
