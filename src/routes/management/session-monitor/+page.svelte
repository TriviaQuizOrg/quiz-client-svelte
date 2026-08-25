<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { gameEventsStore } from '$lib/stores/gameEvents.svelte';
	import { fetchSessionResults } from '$lib/services/gameEvents';
	import type { SessionResult } from '$lib/types';
	import { formatINR, formatEventDate } from '$lib/format';
	import StatCard from '$lib/components/StatCard.svelte';
	import * as Select from '$lib/components/ui/select/index.js';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let contestsLoaded = false;
	$effect(() => {
		if (checkedAuth && !contestsLoaded) {
			contestsLoaded = true;
			gameEventsStore.load();
		}
	});

	function eventPickerLabel(eventId: string) {
		const event = gameEventsStore.gameEvents.find((e) => e.id === eventId);
		return event ? `${event.name} — ${formatEventDate(event.eventDate)}` : '';
	}

	// ---------- Session monitor ----------
	// Read-only view of a session's standing — reuses the same event/session picker and
	// fetchSessionResults() already built for Contests/Question bank, just without any of
	// the management actions (settle, edit, etc.) those screens gate behind game.manage.
	let monitorEventId = $state('');
	let monitorSessionId = $state('');
	let monitorResults = $state<SessionResult[]>([]);
	let monitorResultsLoading = $state(false);
	let monitorError = $state('');

	const monitorEventSessions = $derived(gameEventsStore.sessionsByEvent[monitorEventId] ?? []);
	const monitorSelectedSession = $derived(
		monitorEventSessions.find((s) => s.id === monitorSessionId) ?? null
	);

	async function selectMonitorEvent(eventId: string) {
		monitorEventId = eventId;
		monitorSessionId = '';
		monitorResults = [];
		monitorError = '';
		if (eventId) await gameEventsStore.ensureSessionsLoaded(eventId);
	}

	async function selectMonitorSession(sessionId: string) {
		monitorSessionId = sessionId;
		monitorResults = [];
		monitorError = '';
		if (!sessionId) return;
		monitorResultsLoading = true;
		try {
			monitorResults = await fetchSessionResults(sessionId);
		} catch (err) {
			monitorError = err instanceof Error ? err.message : 'Failed to load results.';
		} finally {
			monitorResultsLoading = false;
		}
	}
</script>

{#if !adminAccount.canSeeSessionMonitor}
	<div
		class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
	>
		You don't have access to the session monitor.
	</div>
{:else}
	<div class="mb-4 flex flex-wrap items-end gap-3">
		<label class="block">
			<span class="mb-1.5 block text-sm font-medium text-ink-soft">Contest</span>
			<Select.Root
				type="single"
				value={monitorEventId}
				onValueChange={(v) => selectMonitorEvent(v ?? '')}
			>
				<Select.Trigger class="w-56">
					<span class="min-w-0 flex-1 truncate text-left">
						{monitorEventId ? eventPickerLabel(monitorEventId) : 'Select a contest…'}
					</span>
				</Select.Trigger>
				<Select.Content>
					{#each gameEventsStore.gameEvents as event (event.id)}
						<Select.Item value={event.id} label={eventPickerLabel(event.id)} />
					{/each}
				</Select.Content>
			</Select.Root>
		</label>

		<label class="block">
			<span class="mb-1.5 block text-sm font-medium text-ink-soft">Session</span>
			<Select.Root
				type="single"
				value={monitorSessionId}
				disabled={!monitorEventId}
				onValueChange={(v) => selectMonitorSession(v ?? '')}
			>
				<Select.Trigger class="w-56">
					<span class="min-w-0 flex-1 truncate text-left">
						{monitorSessionId
							? (monitorEventSessions.find((s) => s.id === monitorSessionId)?.sessionLabel ?? '')
							: 'Select a session…'}
					</span>
				</Select.Trigger>
				<Select.Content>
					{#each monitorEventSessions as session (session.id)}
						<Select.Item value={session.id} label={session.sessionLabel} />
					{/each}
				</Select.Content>
			</Select.Root>
		</label>
	</div>

	{#if !monitorEventId}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			Pick a contest to see its sessions.
		</div>
	{:else if gameEventsStore.sessionsLoadingFor[monitorEventId]}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			Loading sessions…
		</div>
	{:else if monitorEventSessions.length === 0}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			This contest has no sessions yet.
		</div>
	{:else if !monitorSessionId}
		<div
			class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
		>
			Pick a session to view its standing.
		</div>
	{:else}
		{#if monitorSelectedSession}
			{@const ms = monitorSelectedSession}
			<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard label="Type" value={ms.sessionType} />
				<StatCard label="Rank range" value={`${ms.rankStart}–${ms.rankEnd}`} />
				<StatCard label="Entrants" value={ms.entriesCount.toString()} />
				<StatCard label="Settled" value={ms.settled ? 'Yes' : 'Not yet'} />
			</div>
		{/if}

		{#if monitorError}
			<p
				class="mb-4 rounded-lg px-3 py-2 text-sm"
				style="background-color: var(--color-error-bg); color: var(--color-error);"
			>
				{monitorError}
			</p>
		{/if}

		{#if monitorResultsLoading}
			<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
		{:else if monitorResults.length === 0}
			<p class="py-8 text-center text-sm text-ink-soft">
				This session hasn't been settled yet — no standings to show.
			</p>
		{:else}
			<div class="overflow-x-auto rounded-card border border-line bg-surface">
				<table class="w-full text-left text-sm">
					<thead>
						<tr class="border-b border-line text-xs text-ink-soft uppercase">
							<th class="px-4 py-3 font-medium">Rank</th>
							<th class="px-4 py-3 font-medium">Points</th>
							<th class="px-4 py-3 font-medium">Prize</th>
						</tr>
					</thead>
					<tbody>
						{#each monitorResults as result (result.id)}
							<tr class="border-b border-line last:border-0">
								<td class="px-4 py-3 font-medium text-ink tabular-nums">#{result.finalRank}</td>
								<td class="px-4 py-3 text-ink-soft tabular-nums">{result.totalPoints}</td>
								<td class="px-4 py-3 text-ink tabular-nums">{formatINR(result.prizePaise / 100)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
{/if}
