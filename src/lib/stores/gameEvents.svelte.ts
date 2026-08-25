import { fetchGameEvents, fetchTiers, fetchSessions } from '$lib/services/gameEvents';
import type { GameEvent, Tier, GameSession } from '$lib/types';

// Shared contests/tiers/sessions data — loaded once on first authenticated visit to any
// management route and read by dashboard, contests, questions and session-monitor.
class GameEventsStore {
	gameEvents = $state<GameEvent[]>([]);
	loading = $state(false);
	error = $state('');
	loaded = false;

	// Tiers are cheap (2-3 per event) and drive aggregate stats across several screens, so
	// they're loaded eagerly for every event rather than only when a card is expanded.
	tiersByEvent = $state<Record<string, Tier[]>>({});
	// True for an event whose tier fetch just failed (network blip, expired session, etc).
	// Tracked separately from an empty tiersByEvent entry so a transient error never gets
	// misread as "this contest genuinely has no tiers yet".
	tiersErrorByEvent = $state<Record<string, boolean>>({});
	// Sessions only exist once entry has closed and are heavier (entrant lists per
	// session), so they're loaded lazily the first time they're needed.
	sessionsByEvent = $state<Record<string, GameSession[]>>({});
	sessionsLoadingFor = $state<Record<string, boolean>>({});

	tiersFor(eventId: string): Tier[] {
		return this.tiersByEvent[eventId] ?? [];
	}

	async load() {
		if (this.loaded) return;
		this.loaded = true;
		this.loading = true;
		this.error = '';
		try {
			this.gameEvents = await fetchGameEvents();
			await Promise.all(this.gameEvents.map((e) => this.loadTiersFor(e.id)));
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load contests.';
		} finally {
			this.loading = false;
		}
	}

	async refreshGameEvents() {
		this.gameEvents = await fetchGameEvents();
	}

	// A failed fetch never blanks out tiers that were already known-good — it only flips
	// tiersErrorByEvent so the card can show a retry affordance instead of silently
	// rendering "no tiers configured yet" for a contest that actually has some.
	async loadTiersFor(eventId: string) {
		try {
			const tiers = await fetchTiers(eventId);
			this.tiersByEvent = { ...this.tiersByEvent, [eventId]: tiers };
			this.tiersErrorByEvent = { ...this.tiersErrorByEvent, [eventId]: false };
		} catch {
			this.tiersByEvent = { ...this.tiersByEvent, [eventId]: this.tiersByEvent[eventId] ?? [] };
			this.tiersErrorByEvent = { ...this.tiersErrorByEvent, [eventId]: true };
		}
	}

	// Shared by the Contests card expand, the Question bank's session picker, and the
	// session monitor's session picker — none of them should re-fetch once loaded.
	async ensureSessionsLoaded(eventId: string) {
		if (this.sessionsByEvent[eventId]) return;
		this.sessionsLoadingFor = { ...this.sessionsLoadingFor, [eventId]: true };
		try {
			this.sessionsByEvent = { ...this.sessionsByEvent, [eventId]: await fetchSessions(eventId) };
		} catch {
			this.sessionsByEvent = { ...this.sessionsByEvent, [eventId]: [] };
		} finally {
			this.sessionsLoadingFor = { ...this.sessionsLoadingFor, [eventId]: false };
		}
	}

	async refreshSessionsFor(eventId: string) {
		this.sessionsByEvent = { ...this.sessionsByEvent, [eventId]: await fetchSessions(eventId) };
	}
}

export const gameEventsStore = new GameEventsStore();
