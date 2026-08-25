<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { playersStore } from '$lib/stores/players.svelte';
	import { blockUser, unblockUser, fetchUserTransactions } from '$lib/services/users';
	import { TRANSACTION_TYPE_INFO, type WalletTransaction } from '$lib/types';
	import { formatINR, formatSignedINR } from '$lib/format';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let playerQuery = $state('');
	let playersPage = $state(1);

	let playersLoaded = false;
	$effect(() => {
		if (checkedAuth && !playersLoaded) {
			playersLoaded = true;
			playersStore.load(playersPage, playerQuery);
		}
	});

	function goToPlayersPage(page: number) {
		playersPage = page;
		playersStore.load(playersPage, playerQuery);
	}

	// Debounced re-fetch on search — resets to page 1 since the result set changes.
	let playerQueryTimer: ReturnType<typeof setTimeout> | undefined;
	function onPlayerQueryInput() {
		clearTimeout(playerQueryTimer);
		playerQueryTimer = setTimeout(() => {
			playersPage = 1;
			playersStore.load(playersPage, playerQuery);
		}, 300);
	}

	let blockingPlayerId = $state<string | null>(null);
	let blockReason = $state('');
	let playerActionError = $state('');

	function openBlockPlayer(id: string) {
		blockReason = '';
		playerActionError = '';
		blockingPlayerId = id;
	}

	async function confirmBlockPlayer(e: SubmitEvent) {
		e.preventDefault();
		if (!blockingPlayerId || !blockReason.trim()) return;
		try {
			const updated = await blockUser(blockingPlayerId, blockReason.trim());
			playersStore.applyUpdated(updated);
			blockingPlayerId = null;
		} catch (err) {
			playerActionError = err instanceof Error ? err.message : 'Failed to suspend player.';
		}
	}

	async function reactivatePlayer(id: string) {
		playerActionError = '';
		try {
			const updated = await unblockUser(id);
			playersStore.applyUpdated(updated);
		} catch (err) {
			playerActionError = err instanceof Error ? err.message : 'Failed to reactivate player.';
		}
	}

	let viewingWalletPlayerId = $state<string | null>(null);
	let viewingTransactions = $state<WalletTransaction[]>([]);
	let viewingTransactionsLoading = $state(false);

	const viewingPlayer = $derived(
		playersStore.list.find((p) => p.id === viewingWalletPlayerId) ?? null
	);

	async function openWallet(id: string) {
		viewingWalletPlayerId = id;
		viewingTransactions = [];
		viewingTransactionsLoading = true;
		try {
			viewingTransactions = await fetchUserTransactions(id);
		} catch {
			viewingTransactions = [];
		} finally {
			viewingTransactionsLoading = false;
		}
	}
</script>

<div class="mb-4 flex items-center gap-3">
	<input
		type="search"
		bind:value={playerQuery}
		oninput={onPlayerQueryInput}
		placeholder="Search players…"
		class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
	/>
	{#if playersStore.loading}
		<span class="text-xs text-ink-soft">Loading…</span>
	{/if}
</div>

{#if playersStore.error}
	<p
		class="mb-4 rounded-lg px-3 py-2 text-sm"
		style="background-color: var(--color-error-bg); color: var(--color-error);"
	>
		{playersStore.error}
	</p>
{/if}
{#if playerActionError}
	<p
		class="mb-4 rounded-lg px-3 py-2 text-sm"
		style="background-color: var(--color-error-bg); color: var(--color-error);"
	>
		{playerActionError}
	</p>
{/if}

<div class="overflow-x-auto rounded-card border border-line bg-surface">
	<table class="w-full text-left text-sm">
		<thead>
			<tr class="border-b border-line text-xs text-ink-soft uppercase">
				<th class="px-4 py-3 font-medium">Player</th>
				<th class="px-4 py-3 font-medium">Wallet</th>
				<th class="px-4 py-3 font-medium">Contests played</th>
				<th class="px-4 py-3 font-medium">Joined</th>
				<th class="px-4 py-3 font-medium">Status</th>
				<th class="px-4 py-3 font-medium"></th>
			</tr>
		</thead>
		<tbody>
			{#each playersStore.list as player (player.id)}
				<tr class="border-b border-line last:border-0">
					<td class="px-4 py-3">
						<p class="font-medium text-ink">{player.name}</p>
						<p class="text-xs text-ink-soft">{player.phoneNumber}</p>
					</td>
					<td class="px-4 py-3">
						<button
							class="font-medium text-ink tabular-nums underline decoration-line decoration-dotted underline-offset-4 hover:decoration-primary"
							onclick={() => openWallet(player.id)}
						>
							{formatINR(player.walletBalance)}
						</button>
					</td>
					<td class="px-4 py-3 text-ink-soft tabular-nums">{player.contestsPlayed}</td>
					<td class="px-4 py-3 text-ink-soft">{player.joinedLabel}</td>
					<td class="px-4 py-3">
						{#if player.status === 'active'}
							<Chip label="Active" color="var(--color-success)" bg="var(--color-success-bg)" />
						{:else}
							<Chip label="Suspended" color="var(--color-error)" bg="var(--color-error-bg)" />
						{/if}
					</td>
					<td class="px-4 py-3 text-right">
						<div class="flex justify-end gap-3">
							<button
								class="text-xs font-medium text-ink-soft hover:text-ink"
								onclick={() => openWallet(player.id)}
							>
								View wallet
							</button>
							{#if player.status === 'active'}
								<button
									class="text-xs font-medium text-ink-soft hover:text-error"
									onclick={() => openBlockPlayer(player.id)}
								>
									Suspend
								</button>
							{:else}
								<button
									class="text-xs font-medium text-ink-soft hover:text-ink"
									onclick={() => reactivatePlayer(player.id)}
								>
									Reactivate
								</button>
							{/if}
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="px-4 py-8 text-center text-sm text-ink-soft">
						{playersStore.loading ? 'Loading players…' : 'No players match your search.'}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<Pagination
	page={playersPage}
	totalPages={playersStore.totalPages}
	total={playersStore.total}
	onChange={goToPlayersPage}
/>

{#if viewingPlayer}
	<Modal title={`${viewingPlayer.name}'s wallet`} onClose={() => (viewingWalletPlayerId = null)}>
		<div
			class="mb-4 flex items-center justify-between rounded-xl p-4"
			style="background-color: var(--color-field);"
		>
			<div>
				<p class="text-xs text-ink-soft">Current balance</p>
				<p class="text-2xl font-bold text-ink tabular-nums">
					{formatINR(viewingPlayer.walletBalance)}
				</p>
			</div>
			<div class="text-right">
				<p class="text-xs text-ink-soft">Player</p>
				<p class="max-w-40 truncate text-sm font-medium text-ink">{viewingPlayer.phoneNumber}</p>
			</div>
		</div>

		<p class="mb-2 text-sm font-semibold text-ink">Transaction history</p>
		<div class="max-h-80 space-y-1 overflow-y-auto">
			{#if viewingTransactionsLoading}
				<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
			{:else}
				{#each viewingTransactions as tx (tx.id)}
					<div
						class="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-field"
					>
						<div class="min-w-0">
							<Chip
								label={TRANSACTION_TYPE_INFO[tx.type].label}
								color={TRANSACTION_TYPE_INFO[tx.type].color}
								bg={TRANSACTION_TYPE_INFO[tx.type].bg}
							/>
							<p class="mt-1 truncate text-sm text-ink capitalize">
								{tx.referenceType ?? tx.type.replace('_', ' ')}
							</p>
							<p class="text-xs text-ink-faint">{tx.dateLabel}</p>
						</div>
						<span
							class="shrink-0 text-sm font-semibold tabular-nums"
							style={tx.amount >= 0
								? 'color: var(--color-success);'
								: 'color: var(--color-ink-soft);'}
						>
							{formatSignedINR(tx.amount)}
						</span>
					</div>
				{:else}
					<p class="py-8 text-center text-sm text-ink-soft">No transactions yet.</p>
				{/each}
			{/if}
		</div>
	</Modal>
{/if}

{#if blockingPlayerId}
	<Modal title="Suspend player" onClose={() => (blockingPlayerId = null)}>
		<form class="space-y-4" onsubmit={confirmBlockPlayer}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Reason</span>
				<textarea
					required
					bind:value={blockReason}
					rows="3"
					placeholder="e.g. Suspicious multi-accounting activity"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>
			<button
				type="submit"
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-error);"
			>
				Suspend player
			</button>
		</form>
	</Modal>
{/if}
