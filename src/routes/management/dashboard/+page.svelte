<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { gameEventsStore } from '$lib/stores/gameEvents.svelte';
	import { playersStore } from '$lib/stores/players.svelte';
	import { withdrawalStatsStore } from '$lib/stores/withdrawalStats.svelte';
	import { fetchDashboardOverview } from '$lib/services/dashboard';
	import {
		WITHDRAWAL_STATUS_INFO,
		type DashboardOverview,
		type WithdrawalStatus
	} from '$lib/types';
	import { formatINR, formatEventDate, formatTime } from '$lib/format';
	import StatCard from '$lib/components/StatCard.svelte';
	import PhaseBadge from '$lib/components/PhaseBadge.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let contestsLoaded = false;
	$effect(() => {
		if (checkedAuth && !contestsLoaded) {
			contestsLoaded = true;
			gameEventsStore.load();
		}
	});

	let playersLoaded = false;
	$effect(() => {
		if (checkedAuth && !playersLoaded) {
			playersLoaded = true;
			playersStore.ensureLoaded();
		}
	});

	let withdrawalStatsLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeePayouts && !withdrawalStatsLoaded) {
			withdrawalStatsLoaded = true;
			withdrawalStatsStore.load();
		}
	});

	let overview = $state<DashboardOverview | null>(null);
	let overviewLoading = $state(false);
	let overviewError = $state('');

	async function loadOverview() {
		overviewLoading = true;
		overviewError = '';
		try {
			overview = await fetchDashboardOverview();
		} catch (err) {
			overviewError = err instanceof Error ? err.message : 'Failed to load dashboard.';
		} finally {
			overviewLoading = false;
		}
	}

	let overviewLoaded = false;
	$effect(() => {
		if (checkedAuth && !overviewLoaded) {
			overviewLoaded = true;
			loadOverview();
		}
	});

	// The players list is now paginated (10/page) — playersStore.list.length would only
	// ever be ≤10. playersStore.total comes from the backend's own count.
	const totalPlayers = $derived(playersStore.total);
	const liveContests = $derived(
		gameEventsStore.gameEvents.filter((e) => e.phase === 'live').length
	);

	// "Top contests by prize pool" doesn't apply pre-settlement — prize pools are only
	// known once a session settles. This ranks by locked-in entry fees instead, the
	// closest honest proxy for "money at stake" while a contest is still active.
	const topGameEvents = $derived(
		[...gameEventsStore.gameEvents]
			.map((e) => ({
				event: e,
				entryFeesLocked: gameEventsStore
					.tiersFor(e.id)
					.reduce((s, t) => s + t.entryFee * t.entriesCount, 0),
				players: gameEventsStore.tiersFor(e.id).reduce((s, t) => s + t.entriesCount, 0)
			}))
			.sort((a, b) => b.entryFeesLocked - a.entryFeesLocked)
			.slice(0, 4)
	);

	// Tiers are per-event with an arbitrary entry fee (not a fixed starter/classic/premium
	// enum backend-side), so the mix is bucketed by the distinct entry-fee amounts
	// currently in play across loaded contests.
	const tierMixColors = [
		'var(--color-tier-starter)',
		'var(--color-tier-classic)',
		'var(--color-tier-premium)',
		'var(--color-info)',
		'var(--color-elite)'
	];
	const tierMix = $derived.by(() => {
		const counts: [entryFee: number, count: number][] = [];
		for (const event of gameEventsStore.gameEvents) {
			for (const tier of gameEventsStore.tiersFor(event.id)) {
				const existing = counts.find(([fee]) => fee === tier.entryFee);
				if (existing) existing[1]++;
				else counts.push([tier.entryFee, 1]);
			}
		}
		return counts.sort((a, b) => a[0] - b[0]);
	});
	const tierMixTotal = $derived(tierMix.reduce((sum, [, count]) => sum + count, 0));

	const tierMixSegments = $derived(
		tierMix.map(([entryFee, count], i) => ({
			label: `₹${entryFee}`,
			value: count,
			color: tierMixColors[i % tierMixColors.length]
		}))
	);

	const withdrawalStatusOrder: WithdrawalStatus[] = [
		'pending',
		'approved',
		'processing',
		'success',
		'rejected',
		'failed'
	];
	const withdrawalStatusSegments = $derived(
		withdrawalStatusOrder
			.map((status) => ({
				label: WITHDRAWAL_STATUS_INFO[status].label,
				value: withdrawalStatsStore.statFor(status)?.count ?? 0,
				color: WITHDRAWAL_STATUS_INFO[status].color
			}))
			.filter((seg) => seg.value > 0)
	);
</script>

{#if overviewError}
	<p
		class="mb-4 rounded-lg px-3 py-2 text-sm"
		style="background-color: var(--color-error-bg); color: var(--color-error);"
	>
		{overviewError}
	</p>
{/if}

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<StatCard label="Total players" value={(overview?.totalUsers ?? totalPlayers).toString()} />
	<StatCard label="Live contests" value={liveContests.toString()} />
	<StatCard label="Wallet liability" value={overview ? formatINR(overview.walletLiability) : '—'} />
	<StatCard
		label="Platform earnings (all-time)"
		value={overview ? formatINR(overview.platformEarningsAllTime) : '—'}
	/>
</div>

<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div class="rounded-card border border-line bg-surface p-5 lg:col-span-2">
		<h2 class="mb-4 text-sm font-semibold text-ink">Today's contests</h2>
		{#if overviewLoading}
			<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
		{:else if overview?.todaysGameEvents.length}
			<div class="space-y-3">
				{#each overview.todaysGameEvents as event (event.id)}
					<div class="flex items-center justify-between gap-4">
						<div>
							<p class="font-medium text-ink">{event.name}</p>
							<p class="mt-1 text-sm text-ink-soft">
								{formatEventDate(event.eventDate)} · Entry {formatTime(
									event.entryOpensAt
								)}–{formatTime(event.entryClosesAt)} · Play
								{formatTime(event.gameStartsAt)}–{formatTime(event.gameEndsAt)}
							</p>
						</div>
						<PhaseBadge phase={event.phase} />
					</div>
				{/each}
			</div>
		{:else}
			<p class="py-8 text-center text-sm text-ink-soft">No contests scheduled for today.</p>
		{/if}
	</div>

	<div class="rounded-card border border-line bg-surface p-5">
		<h2 class="mb-4 text-sm font-semibold text-ink">Today at a glance</h2>
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-sm text-ink-soft">Entry fees collected</span>
				<span class="text-sm font-semibold text-ink tabular-nums"
					>{overview ? formatINR(overview.entryFeesToday) : '—'}</span
				>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-ink-soft">Prizes paid</span>
				<span class="text-sm font-semibold text-ink tabular-nums"
					>{overview ? formatINR(overview.prizesPaidToday) : '—'}</span
				>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-ink-soft">Withdrawals paid</span>
				<span class="text-sm font-semibold text-ink tabular-nums"
					>{overview ? formatINR(overview.withdrawalsPaidToday) : '—'}</span
				>
			</div>
			<div class="flex items-center justify-between border-t border-line pt-3">
				<span class="text-sm text-ink-soft">Platform earned today</span>
				<span class="text-sm font-semibold text-ink tabular-nums"
					>{overview ? formatINR(overview.platformEarningsToday) : '—'}</span
				>
			</div>
		</div>
	</div>
</div>

<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div class="rounded-card border border-line bg-surface p-5">
		<h2 class="mb-4 text-sm font-semibold text-ink">Top contests by entry fees locked</h2>
		<div class="space-y-3">
			{#each topGameEvents as row, i (row.event.id)}
				<div class="flex items-center gap-3">
					<span
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
						style={i === 0
							? 'background-color: var(--color-warning-bg); color: var(--color-warning);'
							: 'background-color: var(--color-field); color: var(--color-ink-soft);'}
					>
						{i + 1}
					</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-ink">
							{formatEventDate(row.event.eventDate)}
						</p>
						<p class="text-xs text-ink-soft">
							{row.players.toLocaleString()} players
						</p>
					</div>
					<span class="shrink-0 text-sm font-semibold text-ink tabular-nums">
						{formatINR(row.entryFeesLocked)}
					</span>
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-ink-soft">No contests yet.</p>
			{/each}
		</div>
	</div>

	<div class="rounded-card border border-line bg-surface p-5">
		<h2 class="mb-4 text-sm font-semibold text-ink">Tiers in play</h2>
		<DonutChart
			segments={tierMixSegments}
			centerValue={tierMixTotal.toString()}
			centerLabel="tiers"
		/>
	</div>

	<div class="rounded-card border border-line bg-surface p-5">
		<h2 class="mb-4 text-sm font-semibold text-ink">Payout status</h2>
		<DonutChart
			segments={withdrawalStatusSegments}
			centerValue={withdrawalStatsStore.totalRequests.toString()}
			centerLabel="requests"
		/>
	</div>
</div>
