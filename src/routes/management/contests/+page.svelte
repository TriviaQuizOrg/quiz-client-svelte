<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { gameEventsStore } from '$lib/stores/gameEvents.svelte';
	import { withdrawalStatsStore } from '$lib/stores/withdrawalStats.svelte';
	import {
		createGameEvent,
		updateGameEventWindow,
		cancelGameEvent,
		createTier,
		updateTier,
		formSessions,
		settleSession,
		fetchSessionResults,
		type GameEventWindowInput,
		type TierInput
	} from '$lib/services/gameEvents';
	import type { GameEvent, Tier, SessionResult } from '$lib/types';
	import { formatINR, formatEventDate, formatTime } from '$lib/format';
	import PhaseBadge from '$lib/components/PhaseBadge.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PillTabs from '$lib/components/PillTabs.svelte';
	import DatePicker from '$lib/components/date-picker.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let contestsLoaded = false;
	$effect(() => {
		if (checkedAuth && !contestsLoaded) {
			contestsLoaded = true;
			gameEventsStore.load();
		}
	});

	let withdrawalStatsLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeePayouts && !withdrawalStatsLoaded) {
			withdrawalStatsLoaded = true;
			withdrawalStatsStore.load();
		}
	});

	let contestQuery = $state('');
	let contestFilter = $state('all');
	let expandedEventId = $state<string | null>(null);

	const contestFilterOptions = [
		{ id: 'all', label: 'All' },
		{ id: 'scheduled', label: 'Scheduled' },
		{ id: 'entry_open', label: 'Entry open' },
		{ id: 'entry_closed', label: 'Waiting room' },
		{ id: 'live', label: 'Live' },
		{ id: 'completed', label: 'Completed' },
		{ id: 'cancelled', label: 'Cancelled' }
	];

	const filteredGameEvents = $derived(
		gameEventsStore.gameEvents.filter((e) => {
			const matchesQuery = formatEventDate(e.eventDate)
				.toLowerCase()
				.includes(contestQuery.trim().toLowerCase());
			const matchesFilter = contestFilter === 'all' || e.phase === contestFilter;
			return matchesQuery && matchesFilter;
		})
	);

	const activeGameEvents = $derived(
		gameEventsStore.gameEvents.filter((e) => e.phase !== 'completed' && e.phase !== 'cancelled')
	);

	// Real prize pools aren't known until a session settles — this is the locked-in
	// entry-fee total, the closest honest "money at stake" figure before then.
	const contestsEntryFeesLocked = $derived(
		activeGameEvents.reduce(
			(sum, e) =>
				sum + gameEventsStore.tiersFor(e.id).reduce((s, t) => s + t.entryFee * t.entriesCount, 0),
			0
		)
	);
	const contestsPlayersCompeting = $derived(
		activeGameEvents.reduce(
			(sum, e) => sum + gameEventsStore.tiersFor(e.id).reduce((s, t) => s + t.entriesCount, 0),
			0
		)
	);

	async function toggleExpand(eventId: string) {
		expandedEventId = expandedEventId === eventId ? null : eventId;
		if (expandedEventId) await gameEventsStore.ensureSessionsLoaded(expandedEventId);
	}

	// ---------- Add game event ----------
	let showAddGameEvent = $state(false);
	let newContestName = $state('');
	let newEventDate = $state<Date | undefined>(undefined);
	let newEntryOpensAt = $state<Date | undefined>(undefined);
	let newEntryClosesAt = $state<Date | undefined>(undefined);
	let newGameStartsAt = $state<Date | undefined>(undefined);
	let newGameEndsAt = $state<Date | undefined>(undefined);
	let addGameEventError = $state('');
	let addGameEventSaving = $state(false);

	function openAddGameEvent() {
		newContestName = '';
		newEventDate = undefined;
		newEntryOpensAt = undefined;
		newEntryClosesAt = undefined;
		newGameStartsAt = undefined;
		newGameEndsAt = undefined;
		addGameEventError = '';
		showAddGameEvent = true;
	}

	function toDateOnly(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	async function submitAddGameEvent(e: SubmitEvent) {
		e.preventDefault();
		if (
			!newContestName.trim() ||
			!newEventDate ||
			!newEntryOpensAt ||
			!newEntryClosesAt ||
			!newGameStartsAt ||
			!newGameEndsAt
		)
			return;
		addGameEventSaving = true;
		addGameEventError = '';
		try {
			const window: GameEventWindowInput = {
				name: newContestName.trim(),
				entryOpensAt: newEntryOpensAt.toISOString(),
				entryClosesAt: newEntryClosesAt.toISOString(),
				gameStartsAt: newGameStartsAt.toISOString(),
				gameEndsAt: newGameEndsAt.toISOString()
			};
			const created = await createGameEvent(toDateOnly(newEventDate), window);
			gameEventsStore.gameEvents = [created, ...gameEventsStore.gameEvents];
			gameEventsStore.tiersByEvent = { ...gameEventsStore.tiersByEvent, [created.id]: [] };
			showAddGameEvent = false;
		} catch (err) {
			addGameEventError = err instanceof Error ? err.message : 'Failed to create contest.';
		} finally {
			addGameEventSaving = false;
		}
	}

	// ---------- Edit game event window ----------
	let editingEventId = $state<string | null>(null);
	let editContestName = $state('');
	let editEntryOpensAt = $state<Date | undefined>(undefined);
	let editEntryClosesAt = $state<Date | undefined>(undefined);
	let editGameStartsAt = $state<Date | undefined>(undefined);
	let editGameEndsAt = $state<Date | undefined>(undefined);
	let editEventError = $state('');
	let editEventSaving = $state(false);

	function toLocalDate(iso: string): Date | undefined {
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? undefined : d;
	}

	function openEditGameEvent(event: GameEvent) {
		editingEventId = event.id;
		editContestName = event.name;
		editEntryOpensAt = toLocalDate(event.entryOpensAt);
		editEntryClosesAt = toLocalDate(event.entryClosesAt);
		editGameStartsAt = toLocalDate(event.gameStartsAt);
		editGameEndsAt = toLocalDate(event.gameEndsAt);
		editEventError = '';
	}

	async function submitEditGameEvent(e: SubmitEvent) {
		e.preventDefault();
		if (
			!editingEventId ||
			!editContestName.trim() ||
			!editEntryOpensAt ||
			!editEntryClosesAt ||
			!editGameStartsAt ||
			!editGameEndsAt
		)
			return;
		editEventSaving = true;
		editEventError = '';
		try {
			const updated = await updateGameEventWindow(editingEventId, {
				name: editContestName.trim(),
				entryOpensAt: editEntryOpensAt.toISOString(),
				entryClosesAt: editEntryClosesAt.toISOString(),
				gameStartsAt: editGameStartsAt.toISOString(),
				gameEndsAt: editGameEndsAt.toISOString()
			});
			gameEventsStore.gameEvents = gameEventsStore.gameEvents.map((ev) =>
				ev.id === updated.id ? updated : ev
			);
			editingEventId = null;
		} catch (err) {
			editEventError = err instanceof Error ? err.message : 'Failed to update contest window.';
		} finally {
			editEventSaving = false;
		}
	}

	// ---------- Cancel game event ----------
	let cancellingEventId = $state<string | null>(null);
	let cancelReason = $state('');
	let cancelError = $state('');

	function openCancelEvent(id: string) {
		cancelReason = '';
		cancelError = '';
		cancellingEventId = id;
	}

	async function confirmCancelEvent(e: SubmitEvent) {
		e.preventDefault();
		if (!cancellingEventId || !cancelReason.trim()) return;
		try {
			const updated = await cancelGameEvent(cancellingEventId, cancelReason.trim());
			gameEventsStore.gameEvents = gameEventsStore.gameEvents.map((ev) =>
				ev.id === updated.id ? updated : ev
			);
			cancellingEventId = null;
		} catch (err) {
			cancelError = err instanceof Error ? err.message : 'Failed to cancel contest.';
		}
	}

	// ---------- Add / edit tier ----------
	const defaultSplitRows = () => [
		{ key: 'rank_1', pct: 50 },
		{ key: 'rank_2', pct: 25 },
		{ key: 'rank_3', pct: 15 },
		{ key: 'platform_fee', pct: 10 }
	];

	let tierModalEventId = $state<string | null>(null);
	let editingTier = $state<Tier | null>(null);
	let tierEntryFee = $state(10);
	let tierMaxPlayers = $state<number | ''>('');
	let tierSplitRows = $state(defaultSplitRows());
	let tierError = $state('');
	let tierSaving = $state(false);

	const tierSplitTotal = $derived(tierSplitRows.reduce((sum, r) => sum + (Number(r.pct) || 0), 0));

	function openAddTier(eventId: string) {
		tierModalEventId = eventId;
		editingTier = null;
		tierEntryFee = 10;
		tierMaxPlayers = '';
		tierSplitRows = defaultSplitRows();
		tierError = '';
	}

	function openEditTier(tier: Tier) {
		tierModalEventId = tier.gameEventId;
		editingTier = tier;
		tierEntryFee = tier.entryFee;
		tierMaxPlayers = tier.maxPlayers ?? '';
		tierSplitRows = Object.entries(tier.prizeSplit).map(([key, pct]) => ({ key, pct }));
		tierError = '';
	}

	function closeTierModal() {
		tierModalEventId = null;
		editingTier = null;
	}

	function addSplitRow() {
		tierSplitRows = [...tierSplitRows, { key: '', pct: 0 }];
	}

	function removeSplitRow(index: number) {
		tierSplitRows = tierSplitRows.filter((_, i) => i !== index);
	}

	async function submitTier(e: SubmitEvent) {
		e.preventDefault();
		if (!tierModalEventId) return;

		const prizeSplit: Record<string, number> = {};
		for (const row of tierSplitRows) {
			if (!row.key.trim()) continue;
			prizeSplit[row.key.trim()] = Number(row.pct) || 0;
		}
		if (Math.abs(tierSplitTotal - 100) > 0.01) {
			tierError = 'Prize split percentages must sum to 100.';
			return;
		}

		tierSaving = true;
		tierError = '';
		const input: TierInput = {
			entryFeePaise: Math.round(tierEntryFee * 100),
			prizeSplit,
			maxPlayers: tierMaxPlayers === '' ? null : Number(tierMaxPlayers)
		};
		try {
			const eventId = tierModalEventId;
			if (editingTier) {
				const updated = await updateTier(editingTier.id, input);
				gameEventsStore.tiersByEvent = {
					...gameEventsStore.tiersByEvent,
					[eventId]: (gameEventsStore.tiersByEvent[eventId] ?? []).map((t) =>
						t.id === updated.id
							? {
									...updated,
									entriesCount: t.entriesCount,
									entryFees: t.entryFees,
									prizesPaid: t.prizesPaid
								}
							: t
					)
				};
			} else {
				const created = await createTier(eventId, input);
				gameEventsStore.tiersByEvent = {
					...gameEventsStore.tiersByEvent,
					[eventId]: [...(gameEventsStore.tiersByEvent[eventId] ?? []), created]
				};
			}
			closeTierModal();
		} catch (err) {
			tierError = err instanceof Error ? err.message : 'Failed to save tier.';
		} finally {
			tierSaving = false;
		}
	}

	// ---------- Form sessions & settle ----------
	let formingSessionsFor = $state<string | null>(null);
	let formSessionsErrorFor = $state<Record<string, string>>({});

	async function formSessionsAction(eventId: string) {
		formingSessionsFor = eventId;
		formSessionsErrorFor = { ...formSessionsErrorFor, [eventId]: '' };
		try {
			await formSessions(eventId);
			await gameEventsStore.refreshSessionsFor(eventId);
			await gameEventsStore.refreshGameEvents();
		} catch (err) {
			formSessionsErrorFor = {
				...formSessionsErrorFor,
				[eventId]: err instanceof Error ? err.message : 'Failed to form sessions.'
			};
		} finally {
			formingSessionsFor = null;
		}
	}

	let settlingSessionId = $state<string | null>(null);
	let sessionActionError = $state<Record<string, string>>({});
	let viewingResultsSessionId = $state<string | null>(null);
	let sessionResults = $state<SessionResult[]>([]);
	let sessionResultsLoading = $state(false);

	async function settleSessionAction(session: {
		id: string;
		gameEventId: string;
		sessionLabel: string;
	}) {
		settlingSessionId = session.id;
		sessionActionError = { ...sessionActionError, [session.id]: '' };
		try {
			const results = await settleSession(session.id);
			gameEventsStore.sessionsByEvent = {
				...gameEventsStore.sessionsByEvent,
				[session.gameEventId]: (gameEventsStore.sessionsByEvent[session.gameEventId] ?? []).map(
					(s) => (s.id === session.id ? { ...s, settled: true } : s)
				)
			};
			sessionResults = results;
			viewingResultsSessionId = session.id;
		} catch (err) {
			sessionActionError = {
				...sessionActionError,
				[session.id]: err instanceof Error ? err.message : 'Failed to settle session.'
			};
		} finally {
			settlingSessionId = null;
		}
	}

	async function viewResults(session: { id: string }) {
		viewingResultsSessionId = session.id;
		sessionResults = [];
		sessionResultsLoading = true;
		try {
			sessionResults = await fetchSessionResults(session.id);
		} catch {
			sessionResults = [];
		} finally {
			sessionResultsLoading = false;
		}
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<StatCard label="Active contests" value={activeGameEvents.length.toString()} />
	<StatCard label="Entry fees locked" value={formatINR(contestsEntryFeesLocked)} />
	<StatCard label="Players competing" value={contestsPlayersCompeting.toLocaleString()} />
	<StatCard
		label="Payouts pending"
		value={formatINR(withdrawalStatsStore.pendingAmount)}
		hintColor="var(--color-warning)"
	/>
</div>

<div class="mt-5 mb-4 flex flex-wrap items-center gap-3">
	<input
		type="search"
		bind:value={contestQuery}
		placeholder="Search by date…"
		class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
	/>
	<PillTabs options={contestFilterOptions} bind:value={contestFilter} />
	<button
		class="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white"
		style="background-color: var(--color-primary);"
		onclick={openAddGameEvent}
	>
		+ New contest
	</button>
</div>

{#if gameEventsStore.error}
	<p
		class="mb-4 rounded-lg px-3 py-2 text-sm"
		style="background-color: var(--color-error-bg); color: var(--color-error);"
	>
		{gameEventsStore.error}
	</p>
{/if}

<div class="space-y-3">
	{#each filteredGameEvents as event (event.id)}
		{@const tiers = gameEventsStore.tiersFor(event.id)}
		{@const players = tiers.reduce((s, t) => s + t.entriesCount, 0)}
		{@const sessions = gameEventsStore.sessionsByEvent[event.id] ?? []}
		{@const editable = event.phase !== 'completed' && event.phase !== 'cancelled'}
		<div class="overflow-hidden rounded-card border border-line bg-surface">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
				onclick={() => toggleExpand(event.id)}
			>
				<div class="min-w-0">
					<p class="font-medium text-ink">{event.name}</p>
					<p class="mt-0.5 text-xs text-ink-soft">
						{formatEventDate(event.eventDate)} · Entry {formatTime(event.entryOpensAt)}–{formatTime(
							event.entryClosesAt
						)} · Play
						{formatTime(event.gameStartsAt)}–{formatTime(event.gameEndsAt)}
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-3">
					<span class="hidden text-xs text-ink-soft sm:inline">
						{tiers.length} tier{tiers.length === 1 ? '' : 's'} · {players.toLocaleString()} players
					</span>
					<PhaseBadge phase={event.phase} />
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						class="text-ink-soft transition-transform"
						style={expandedEventId === event.id ? 'transform: rotate(180deg);' : ''}
					>
						<path
							d="m6 9 6 6 6-6"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</div>
			</button>

			{#if expandedEventId === event.id}
				<div class="space-y-5 border-t border-line px-4 py-4">
					{#if event.cancelledReason}
						<p
							class="rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-error-bg); color: var(--color-error);"
						>
							Cancelled: {event.cancelledReason}
						</p>
					{/if}

					<div>
						<div class="mb-2 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-ink">Tiers</h3>
							{#if editable}
								<button
									class="text-xs font-medium"
									style="color: var(--color-primary);"
									onclick={() => openAddTier(event.id)}
								>
									+ Add tier
								</button>
							{/if}
						</div>
						<div class="overflow-x-auto rounded-xl border border-line">
							<table class="w-full text-left text-sm">
								<thead>
									<tr class="border-b border-line text-xs text-ink-soft uppercase">
										<th class="px-3 py-2 font-medium">Entry fee</th>
										<th class="px-3 py-2 font-medium">Prize split</th>
										<th class="px-3 py-2 font-medium">Max players</th>
										<th class="px-3 py-2 font-medium">Entrants</th>
										<th class="px-3 py-2 font-medium">Earnings</th>
										<th class="px-3 py-2 font-medium"></th>
									</tr>
								</thead>
								<tbody>
									{#each tiers as tier (tier.id)}
										<tr class="border-b border-line last:border-0">
											<td class="px-3 py-2 font-medium text-ink tabular-nums"
												>{formatINR(tier.entryFee)}</td
											>
											<td class="px-3 py-2 text-ink-soft">
												{Object.entries(tier.prizeSplit)
													.map(([k, v]) => `${k} ${v}%`)
													.join(' · ')}
											</td>
											<td class="px-3 py-2 text-ink-soft tabular-nums"
												>{tier.maxPlayers ?? 'Unlimited'}</td
											>
											<td class="px-3 py-2 text-ink-soft tabular-nums"
												>{tier.entriesCount.toLocaleString()}</td
											>
											<td class="px-3 py-2 font-medium text-ink tabular-nums">
												{formatINR(tier.entryFees - tier.prizesPaid)}
											</td>
											<td class="px-3 py-2 text-right">
												{#if editable}
													<button
														class="text-xs font-medium text-ink-soft hover:text-ink"
														onclick={() => openEditTier(tier)}
													>
														Edit
													</button>
												{/if}
											</td>
										</tr>
									{:else}
										<tr>
											{#if gameEventsStore.tiersErrorByEvent[event.id]}
												<td colspan="5" class="px-3 py-4 text-center text-sm">
													<span class="text-error">Couldn't load tiers.</span>
													<button
														type="button"
														class="ml-1 font-medium text-primary underline"
														onclick={() => gameEventsStore.loadTiersFor(event.id)}
													>
														Retry
													</button>
												</td>
											{:else}
												<td colspan="5" class="px-3 py-4 text-center text-sm text-ink-soft">
													No tiers configured yet.
												</td>
											{/if}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div>
						<div class="mb-2 flex items-center justify-between">
							<h3 class="text-sm font-semibold text-ink">Sessions</h3>
							{#if event.phase !== 'scheduled' && event.phase !== 'entry_open' && sessions.length === 0}
								<button
									class="text-xs font-medium"
									style="color: var(--color-primary);"
									disabled={formingSessionsFor === event.id}
									onclick={() => formSessionsAction(event.id)}
								>
									{formingSessionsFor === event.id ? 'Forming…' : 'Form sessions'}
								</button>
							{/if}
						</div>
						{#if formSessionsErrorFor[event.id]}
							<p
								class="mb-2 rounded-lg px-3 py-2 text-sm"
								style="background-color: var(--color-error-bg); color: var(--color-error);"
							>
								{formSessionsErrorFor[event.id]}
							</p>
						{/if}
						{#if gameEventsStore.sessionsLoadingFor[event.id]}
							<p class="py-4 text-center text-sm text-ink-soft">Loading sessions…</p>
						{:else if sessions.length === 0}
							<p class="py-4 text-center text-sm text-ink-soft">
								No sessions yet — sessions are formed once the entry window closes.
							</p>
						{:else}
							<div class="overflow-x-auto rounded-xl border border-line">
								<table class="w-full text-left text-sm">
									<thead>
										<tr class="border-b border-line text-xs text-ink-soft uppercase">
											<th class="px-3 py-2 font-medium">Session</th>
											<th class="px-3 py-2 font-medium">Type</th>
											<th class="px-3 py-2 font-medium">Ranks</th>
											<th class="px-3 py-2 font-medium">Entrants</th>
											<th class="px-3 py-2 font-medium">Status</th>
											<th class="px-3 py-2 font-medium"></th>
										</tr>
									</thead>
									<tbody>
										{#each sessions as session (session.id)}
											<tr class="border-b border-line last:border-0">
												<td class="px-3 py-2 font-medium text-ink">{session.sessionLabel}</td>
												<td class="px-3 py-2 text-ink-soft capitalize">{session.sessionType}</td>
												<td class="px-3 py-2 text-ink-soft tabular-nums"
													>{session.rankStart}–{session.rankEnd}</td
												>
												<td class="px-3 py-2 text-ink-soft tabular-nums">{session.entriesCount}</td>
												<td class="px-3 py-2">
													{#if session.settled}
														<Chip
															label="Settled"
															color="var(--color-success)"
															bg="var(--color-success-bg)"
														/>
													{:else}
														<Chip
															label="Pending"
															color="var(--color-warning)"
															bg="var(--color-warning-bg)"
														/>
													{/if}
												</td>
												<td class="px-3 py-2 text-right">
													{#if session.settled}
														<button
															class="text-xs font-medium text-ink-soft hover:text-ink"
															onclick={() => viewResults(session)}
														>
															View results
														</button>
													{:else}
														<button
															class="text-xs font-medium text-ink-soft hover:text-ink"
															disabled={settlingSessionId === session.id}
															onclick={() => settleSessionAction(session)}
														>
															{settlingSessionId === session.id ? 'Settling…' : 'Settle'}
														</button>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							{#each sessions as session (session.id)}
								{#if sessionActionError[session.id]}
									<p
										class="mt-2 rounded-lg px-3 py-2 text-sm"
										style="background-color: var(--color-error-bg); color: var(--color-error);"
									>
										{sessionActionError[session.id]}
									</p>
								{/if}
							{/each}
						{/if}
					</div>

					{#if editable}
						<div class="flex justify-end gap-4 border-t border-line pt-3">
							<button
								class="text-xs font-medium text-ink-soft hover:text-ink"
								onclick={() => openEditGameEvent(event)}
							>
								Edit window
							</button>
							<button
								class="text-xs font-medium text-ink-soft hover:text-error"
								onclick={() => openCancelEvent(event.id)}
							>
								Cancel contest
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			{gameEventsStore.loading ? 'Loading contests…' : 'No contests match your search.'}
		</div>
	{/each}
</div>

{#if showAddGameEvent}
	<Modal title="New contest" onClose={() => (showAddGameEvent = false)}>
		<form class="space-y-4" onsubmit={submitAddGameEvent}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Contest name</span>
				<input
					required
					type="text"
					placeholder="e.g. Evening Trivia Special"
					bind:value={newContestName}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Event date</span>
				<DatePicker bind:value={newEventDate} class="w-full" />
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry opens</span>
					<DatePicker bind:value={newEntryOpensAt} showTime class="w-full" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry closes</span>
					<DatePicker bind:value={newEntryClosesAt} showTime class="w-full" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play starts</span>
					<DatePicker bind:value={newGameStartsAt} showTime class="w-full" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play ends</span>
					<DatePicker bind:value={newGameEndsAt} showTime class="w-full" />
				</label>
			</div>

			{#if addGameEventError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{addGameEventError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={addGameEventSaving}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{addGameEventSaving ? 'Creating…' : 'Create contest'}
			</button>
		</form>
	</Modal>
{/if}

{#if editingEventId}
	<Modal title="Edit contest" onClose={() => (editingEventId = null)}>
		<form class="space-y-4" onsubmit={submitEditGameEvent}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Contest name</span>
				<input
					required
					type="text"
					bind:value={editContestName}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry opens</span>
					<DatePicker bind:value={editEntryOpensAt} showTime class="w-full" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry closes</span>
					<DatePicker bind:value={editEntryClosesAt} showTime class="w-full" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play starts</span>
					<DatePicker bind:value={editGameStartsAt} showTime class="w-full" />
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play ends</span>
					<DatePicker bind:value={editGameEndsAt} showTime class="w-full" />
				</label>
			</div>

			{#if editEventError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{editEventError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={editEventSaving}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{editEventSaving ? 'Saving…' : 'Save window'}
			</button>
		</form>
	</Modal>
{/if}

{#if cancellingEventId}
	<Modal title="Cancel contest" onClose={() => (cancellingEventId = null)}>
		<form class="space-y-4" onsubmit={confirmCancelEvent}>
			<p class="text-sm text-ink-soft">
				Players who already joined but haven't played this contest yet will be automatically
				refunded their entry fee. Players whose session already ran are unaffected.
			</p>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Reason</span>
				<textarea
					required
					bind:value={cancelReason}
					rows="3"
					placeholder="e.g. Insufficient entrants"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>
			{#if cancelError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{cancelError}
				</p>
			{/if}
			<button
				type="submit"
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-error);"
			>
				Cancel contest
			</button>
		</form>
	</Modal>
{/if}

{#if tierModalEventId}
	<Modal title={editingTier ? 'Edit tier' : 'Add tier'} onClose={closeTierModal}>
		<form class="space-y-4" onsubmit={submitTier}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry fee (₹)</span>
				<input
					required
					type="number"
					min="1"
					step="1"
					bind:value={tierEntryFee}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft"
					>Max players (blank = unlimited)</span
				>
				<input
					type="number"
					min="1"
					bind:value={tierMaxPlayers}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<span class="text-sm font-medium text-ink-soft">Prize split (%, must total 100)</span>
					<button
						type="button"
						class="text-xs font-medium"
						style="color: var(--color-primary);"
						onclick={addSplitRow}
					>
						+ Row
					</button>
				</div>
				<div class="space-y-2">
					{#each tierSplitRows as row, i (i)}
						<div class="flex items-center gap-2">
							<input
								bind:value={row.key}
								placeholder="e.g. rank_1"
								class="w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
							/>
							<input
								type="number"
								min="0"
								bind:value={row.pct}
								class="w-20 rounded-lg border border-line bg-field px-2.5 py-2 text-right text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
							/>
							<button
								type="button"
								aria-label="Remove row"
								class="text-ink-soft hover:text-error"
								onclick={() => removeSplitRow(i)}
							>
								×
							</button>
						</div>
					{/each}
				</div>
				<p
					class="mt-1.5 text-xs"
					style={Math.abs(tierSplitTotal - 100) > 0.01
						? 'color: var(--color-error);'
						: 'color: var(--color-ink-soft);'}
				>
					Total: {tierSplitTotal}%
				</p>
			</div>

			{#if tierError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{tierError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={tierSaving}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{tierSaving ? 'Saving…' : editingTier ? 'Save tier' : 'Add tier'}
			</button>
		</form>
	</Modal>
{/if}

{#if viewingResultsSessionId}
	<Modal title="Session results" onClose={() => (viewingResultsSessionId = null)}>
		{#if sessionResultsLoading}
			<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
		{:else}
			<div class="max-h-96 overflow-y-auto">
				<table class="w-full text-left text-sm">
					<thead>
						<tr class="border-b border-line text-xs text-ink-soft uppercase">
							<th class="py-2 pr-3 font-medium">Rank</th>
							<th class="py-2 pr-3 font-medium">Points</th>
							<th class="py-2 pr-3 font-medium">Prize</th>
						</tr>
					</thead>
					<tbody>
						{#each sessionResults as result (result.id)}
							<tr class="border-b border-line last:border-0">
								<td class="py-2 pr-3 font-medium text-ink tabular-nums">#{result.finalRank}</td>
								<td class="py-2 pr-3 text-ink-soft tabular-nums">{result.totalPoints}</td>
								<td class="py-2 pr-3 text-ink tabular-nums">{formatINR(result.prizePaise / 100)}</td
								>
							</tr>
						{:else}
							<tr>
								<td colspan="3" class="py-8 text-center text-sm text-ink-soft">No results yet.</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Modal>
{/if}
