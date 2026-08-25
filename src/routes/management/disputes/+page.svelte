<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { playersStore } from '$lib/stores/players.svelte';
	import {
		fetchDisputes,
		fetchDisputeEvidence,
		assignDisputeToMe,
		investigateDispute,
		resolveDispute,
		rejectDispute
	} from '$lib/services/disputes';
	import { DISPUTE_STATUS_INFO, type DisputeItem, type DisputeEvidence } from '$lib/types';
	import { formatDateLabel } from '$lib/format';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PillTabs from '$lib/components/PillTabs.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let playersLoaded = false;
	$effect(() => {
		if (checkedAuth && !playersLoaded) {
			playersLoaded = true;
			playersStore.ensureLoaded();
		}
	});

	// ---------- Disputes ----------
	let disputes = $state<DisputeItem[]>([]);
	let disputesLoading = $state(false);
	let disputesError = $state('');
	let disputeFilter = $state('all');
	let disputesPage = $state(1);
	let disputesTotal = $state(0);
	let disputesTotalPages = $state(1);

	const disputeFilterOptions = [
		{ id: 'all', label: 'All' },
		{ id: 'open', label: 'Open' },
		{ id: 'investigating', label: 'Investigating' },
		{ id: 'resolved', label: 'Resolved' },
		{ id: 'rejected', label: 'Rejected' }
	];

	async function loadDisputes() {
		disputesLoading = true;
		disputesError = '';
		try {
			const result = await fetchDisputes(
				disputesPage,
				disputeFilter === 'all' ? '' : disputeFilter
			);
			disputes = result.items;
			disputesTotal = result.total;
			disputesTotalPages = result.totalPages;
		} catch (err) {
			disputesError = err instanceof Error ? err.message : 'Failed to load disputes.';
		} finally {
			disputesLoading = false;
		}
	}

	function goToDisputesPage(page: number) {
		disputesPage = page;
		loadDisputes();
	}

	function onDisputeFilterChange(status: string) {
		disputeFilter = status;
		disputesPage = 1;
		loadDisputes();
	}

	let disputesLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeeDisputes && !disputesLoaded) {
			disputesLoaded = true;
			loadDisputes();
		}
	});

	let viewingDisputeId = $state<string | null>(null);
	let viewingDisputeEvidence = $state<DisputeEvidence | null>(null);
	let disputeDetailLoading = $state(false);
	let disputeActionError = $state('');
	let disputeActionBusy = $state(false);
	let disputeNotes = $state('');

	// The evidence fetch and every mutation response (assign/investigate/resolve/reject)
	// return the dispute without the players join the paginated list has — fill the name
	// back in from whatever's already known, same pattern as tickets' withKnownPlayerName.
	function withKnownDisputePlayerName(d: DisputeItem): DisputeItem {
		if (d.playerName) return d;
		const known =
			viewingDisputeEvidence?.dispute.userId === d.userId
				? viewingDisputeEvidence.dispute
				: disputes.find((x) => x.id === d.id);
		const playerName = known?.playerName || playersStore.nameFor(d.userId);
		const playerPhone = d.playerPhone || known?.playerPhone || '';
		return { ...d, playerName, playerPhone };
	}

	async function openDispute(id: string) {
		viewingDisputeId = id;
		viewingDisputeEvidence = null;
		disputeActionError = '';
		disputeNotes = '';
		disputeDetailLoading = true;
		try {
			const evidence = await fetchDisputeEvidence(id);
			viewingDisputeEvidence = {
				...evidence,
				dispute: withKnownDisputePlayerName(evidence.dispute)
			};
		} catch (err) {
			disputeActionError = err instanceof Error ? err.message : 'Failed to load dispute.';
		} finally {
			disputeDetailLoading = false;
		}
	}

	function closeDisputeModal() {
		viewingDisputeId = null;
	}

	function applyDisputeUpdate(updated: DisputeItem) {
		updated = withKnownDisputePlayerName(updated);
		if (viewingDisputeEvidence) {
			viewingDisputeEvidence = { ...viewingDisputeEvidence, dispute: updated };
		}
		disputes = disputes.map((d) =>
			d.id === updated.id ? { ...updated, playerName: d.playerName, playerPhone: d.playerPhone } : d
		);
	}

	async function assignDisputeAction() {
		if (!viewingDisputeId) return;
		disputeActionBusy = true;
		disputeActionError = '';
		try {
			applyDisputeUpdate(await assignDisputeToMe(viewingDisputeId));
		} catch (err) {
			disputeActionError = err instanceof Error ? err.message : 'Failed to assign dispute.';
		} finally {
			disputeActionBusy = false;
		}
	}

	async function investigateDisputeAction() {
		if (!viewingDisputeId) return;
		disputeActionBusy = true;
		disputeActionError = '';
		try {
			applyDisputeUpdate(await investigateDispute(viewingDisputeId));
		} catch (err) {
			disputeActionError = err instanceof Error ? err.message : 'Failed to update dispute.';
		} finally {
			disputeActionBusy = false;
		}
	}

	async function resolveDisputeAction() {
		if (!viewingDisputeId) return;
		disputeActionBusy = true;
		disputeActionError = '';
		try {
			applyDisputeUpdate(await resolveDispute(viewingDisputeId, disputeNotes.trim()));
		} catch (err) {
			disputeActionError = err instanceof Error ? err.message : 'Failed to resolve dispute.';
		} finally {
			disputeActionBusy = false;
		}
	}

	async function rejectDisputeAction() {
		if (!viewingDisputeId) return;
		disputeActionBusy = true;
		disputeActionError = '';
		try {
			applyDisputeUpdate(await rejectDispute(viewingDisputeId, disputeNotes.trim()));
		} catch (err) {
			disputeActionError = err instanceof Error ? err.message : 'Failed to reject dispute.';
		} finally {
			disputeActionBusy = false;
		}
	}
</script>

{#if !adminAccount.canSeeDisputes}
	<div
		class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
	>
		You don't have access to disputes.
	</div>
{:else}
	{#if disputesError}
		<p
			class="mb-4 rounded-lg px-3 py-2 text-sm"
			style="background-color: var(--color-error-bg); color: var(--color-error);"
		>
			{disputesError}
		</p>
	{/if}

	<div class="mb-4">
		<PillTabs
			options={disputeFilterOptions}
			bind:value={disputeFilter}
			onChange={onDisputeFilterChange}
		/>
	</div>

	<div class="overflow-x-auto rounded-card border border-line bg-surface">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-line text-xs text-ink-soft uppercase">
					<th class="px-4 py-3 font-medium">Player</th>
					<th class="px-4 py-3 font-medium">Description</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Filed</th>
				</tr>
			</thead>
			<tbody>
				{#each disputes as dispute (dispute.id)}
					<tr
						class="cursor-pointer border-b border-line last:border-0 hover:bg-field"
						onclick={() => openDispute(dispute.id)}
					>
						<td class="px-4 py-3 font-medium text-ink">{dispute.playerName}</td>
						<td class="max-w-md truncate px-4 py-3 text-ink">{dispute.description}</td>
						<td class="px-4 py-3">
							<Chip
								label={DISPUTE_STATUS_INFO[dispute.status].label}
								color={DISPUTE_STATUS_INFO[dispute.status].color}
								bg={DISPUTE_STATUS_INFO[dispute.status].bg}
							/>
						</td>
						<td class="px-4 py-3 text-ink-soft">{formatDateLabel(dispute.createdAt)}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="px-4 py-8 text-center text-sm text-ink-soft">
							{disputesLoading ? 'Loading disputes…' : 'No disputes match this filter.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination
		page={disputesPage}
		totalPages={disputesTotalPages}
		total={disputesTotal}
		onChange={goToDisputesPage}
	/>
{/if}

{#if viewingDisputeId}
	<Modal title="Dispute" onClose={closeDisputeModal}>
		{#if disputeDetailLoading}
			<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
		{:else if viewingDisputeEvidence}
			{@const ev = viewingDisputeEvidence}
			{@const d = ev.dispute}
			{@const isOpenForAction = d.status !== 'resolved' && d.status !== 'rejected'}

			<div class="mb-3 flex flex-wrap items-center gap-2">
				<Chip
					label={DISPUTE_STATUS_INFO[d.status].label}
					color={DISPUTE_STATUS_INFO[d.status].color}
					bg={DISPUTE_STATUS_INFO[d.status].bg}
				/>
				<span class="text-xs text-ink-faint">· {d.playerName}</span>
			</div>

			<p class="mb-4 text-sm text-ink">{d.description}</p>

			{#if disputeActionError}
				<p
					class="mb-4 rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{disputeActionError}
				</p>
			{/if}

			{#if ev.entry || ev.question || ev.userAnswer}
				<div class="mb-4 space-y-2 rounded-xl bg-field p-4">
					<p class="text-xs font-semibold text-ink-soft uppercase">
						Server-side evidence — never the player's or agent's recollection
					</p>
					{#if ev.entry}
						{@const entry = ev.entry}
						<p class="text-xs text-ink-soft">
							Speed rank #{entry.speedRank ?? '—'} · Final rank #{entry.finalRank ?? '—'} · {entry.status}
							· joined {formatDateLabel(entry.serverReceivedAt)}
						</p>
					{/if}
					{#if ev.question}
						{@const question = ev.question}
						<p class="text-xs text-ink-soft">
							Q{question.sequenceNo}: {question.questionText} — correct answer:
							<strong>{question.correctOption}</strong>
						</p>
					{/if}
					{#if ev.userAnswer}
						{@const answer = ev.userAnswer}
						<p class="text-xs text-ink-soft">
							Player answered <strong>{answer.selectedOption ?? '—'}</strong>
							({answer.isCorrect ? 'correct' : 'incorrect'}) in {answer.responseTimeMs ?? '—'}ms · {answer.pointsAwarded}
							pts awarded
						</p>
					{/if}
				</div>
			{/if}

			{#if d.resolutionNotes}
				<p class="mb-4 text-sm text-ink-soft">
					<strong>Resolution notes:</strong>
					{d.resolutionNotes}
				</p>
			{/if}

			{#if isOpenForAction}
				<div class="mb-4 flex flex-wrap gap-2 border-t border-line pt-4">
					{#if !d.assignedTo}
						<button
							class="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
							style="background-color: var(--color-primary);"
							disabled={disputeActionBusy}
							onclick={assignDisputeAction}
						>
							Assign to me
						</button>
					{/if}
					{#if d.status === 'open'}
						<button
							class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
							disabled={disputeActionBusy}
							onclick={investigateDisputeAction}
						>
							Start investigating
						</button>
					{/if}
				</div>

				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Resolution notes</span>
					<textarea
						bind:value={disputeNotes}
						rows="3"
						placeholder="What was found and decided"
						class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					></textarea>
				</label>
				<div class="mt-3 flex gap-2">
					<button
						class="rounded-xl px-4 py-2 text-sm font-semibold text-white"
						style="background-color: var(--color-primary);"
						disabled={disputeActionBusy}
						onclick={resolveDisputeAction}
					>
						Resolve
					</button>
					<button
						class="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:text-error"
						disabled={disputeActionBusy}
						onclick={rejectDisputeAction}
					>
						Reject
					</button>
				</div>
			{/if}
		{/if}
	</Modal>
{/if}
