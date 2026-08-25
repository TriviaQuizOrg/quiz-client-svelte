import { api, unwrapStr, paiseToRupees, type GoNullInt } from '$lib/api';
import type { ApiGameEvent, ApiTier, ApiGameSession, ApiSessionResult } from '$lib/api-types';
import type { GameEvent, GameEventPhase, Tier, GameSession, SessionResult } from '$lib/types';

// game_events.status is only ever written as 'scheduled', 'entry_closed', or 'cancelled' by
// quiz-server today (see internal/entry/sessions.go) — 'entry_open'/'live'/'completed' exist
// in the DB enum but nothing sets them. So phase is derived from the window timestamps
// instead of trusted from status, except for 'cancelled' which is always authoritative.
export function deriveGameEventPhase(
	event: Pick<
		ApiGameEvent,
		'status' | 'entry_opens_at' | 'entry_closes_at' | 'game_starts_at' | 'game_ends_at'
	>,
	now: Date = new Date()
): GameEventPhase {
	if (event.status === 'cancelled') return 'cancelled';
	const t = now.getTime();
	if (t < new Date(event.entry_opens_at).getTime()) return 'scheduled';
	if (t < new Date(event.entry_closes_at).getTime()) return 'entry_open';
	if (t < new Date(event.game_starts_at).getTime()) return 'entry_closed';
	if (t < new Date(event.game_ends_at).getTime()) return 'live';
	return 'completed';
}

export function mapGameEvent(raw: ApiGameEvent): GameEvent {
	return {
		id: raw.id,
		name: raw.name,
		eventDate: raw.event_date,
		entryOpensAt: raw.entry_opens_at,
		entryClosesAt: raw.entry_closes_at,
		gameStartsAt: raw.game_starts_at,
		gameEndsAt: raw.game_ends_at,
		phase: deriveGameEventPhase(raw),
		cancelledReason: unwrapStr(raw.cancelled_reason)
	};
}

function unwrapMaxPlayers(n: GoNullInt | null): number | null {
	if (!n?.Valid) return null;
	return n.Int32 ?? null;
}

function mapTier(raw: ApiTier): Tier {
	return {
		id: raw.id,
		gameEventId: raw.game_event_id,
		entryFeePaise: raw.entry_fee_paise,
		entryFee: paiseToRupees(raw.entry_fee_paise),
		prizeSplit: raw.prize_split_json,
		maxPlayers: unwrapMaxPlayers(raw.max_players),
		entriesCount: raw.entries_count,
		entryFees: paiseToRupees(raw.entry_fees_paise),
		prizesPaid: paiseToRupees(raw.prizes_paid_paise)
	};
}

function mapSession(raw: ApiGameSession): GameSession {
	return {
		id: raw.id,
		gameEventId: raw.game_event_id,
		tierId: raw.tier_id,
		sessionType: raw.session_type,
		sessionLabel: raw.session_label,
		rankStart: raw.rank_start,
		rankEnd: raw.rank_end,
		entriesCount: raw.entries_count,
		settled: raw.settled
	};
}

function mapSessionResult(raw: ApiSessionResult): SessionResult {
	return {
		id: raw.id,
		sessionId: raw.session_id,
		entryId: raw.entry_id,
		finalRank: raw.final_rank,
		totalPoints: raw.total_points,
		prizePaise: raw.prize_paise,
		settledAt: raw.settled_at.Valid ? raw.settled_at.Time : null
	};
}

// Deliberately unpaginated (/all, not the paginated /admin/game-events) — this page's
// phase filter/date search and its "top contests"/"entry fees locked"/"live" stats all
// need the complete list, and admin-created event volume here is small (a handful a day
// at most), so a real paginated table wouldn't pull its weight here the way it does on
// the higher-volume Players/Tickets/Disputes/KYC/Payouts pages.
export async function fetchGameEvents(): Promise<GameEvent[]> {
	const raw = await api.get<ApiGameEvent[]>('/admin/game-events/all');
	return (raw ?? []).map(mapGameEvent);
}

export interface GameEventWindowInput {
	name: string;
	entryOpensAt: string; // RFC3339
	entryClosesAt: string;
	gameStartsAt: string;
	gameEndsAt: string;
}

export async function createGameEvent(
	eventDate: string,
	window: GameEventWindowInput
): Promise<GameEvent> {
	const raw = await api.post<ApiGameEvent>('/admin/game-events', {
		name: window.name,
		event_date: eventDate,
		entry_opens_at: window.entryOpensAt,
		entry_closes_at: window.entryClosesAt,
		game_starts_at: window.gameStartsAt,
		game_ends_at: window.gameEndsAt
	});
	return mapGameEvent(raw);
}

export async function updateGameEventWindow(
	id: string,
	window: GameEventWindowInput
): Promise<GameEvent> {
	const raw = await api.patch<ApiGameEvent>(`/admin/game-events/${id}`, {
		name: window.name,
		entry_opens_at: window.entryOpensAt,
		entry_closes_at: window.entryClosesAt,
		game_starts_at: window.gameStartsAt,
		game_ends_at: window.gameEndsAt
	});
	return mapGameEvent(raw);
}

export async function cancelGameEvent(id: string, reason: string): Promise<GameEvent> {
	const raw = await api.post<ApiGameEvent>(`/admin/game-events/${id}/cancel`, { reason });
	return mapGameEvent(raw);
}

export async function fetchTiers(gameEventId: string): Promise<Tier[]> {
	const raw = await api.get<ApiTier[]>(`/admin/game-events/${gameEventId}/tiers`);
	return (raw ?? []).map(mapTier);
}

export interface TierInput {
	entryFeePaise: number;
	prizeSplit: Record<string, number>;
	maxPlayers: number | null;
}

export async function createTier(gameEventId: string, input: TierInput): Promise<Tier> {
	const raw = await api.post<ApiTier>(`/admin/game-events/${gameEventId}/tiers`, {
		entry_fee_paise: input.entryFeePaise,
		prize_split_json: input.prizeSplit,
		max_players: input.maxPlayers
	});
	// CreateTier :one returns raw tier columns without the stats columns — a brand new
	// tier always has zero entries/fees/prizes, so default them rather than re-fetching.
	return { ...mapTier(raw), entriesCount: 0, entryFees: 0, prizesPaid: 0 };
}

export async function updateTier(tierId: string, input: TierInput): Promise<Tier> {
	const raw = await api.patch<ApiTier>(`/admin/tiers/${tierId}`, {
		entry_fee_paise: input.entryFeePaise,
		prize_split_json: input.prizeSplit,
		max_players: input.maxPlayers
	});
	return mapTier(raw);
}

export async function fetchSessions(gameEventId: string): Promise<GameSession[]> {
	const raw = await api.get<ApiGameSession[]>(`/admin/game-events/${gameEventId}/sessions`);
	return (raw ?? []).map(mapSession);
}

/** Ranks entrants and forms game_sessions — only callable once entry_closes_at has passed. */
export async function formSessions(gameEventId: string): Promise<void> {
	await api.post(`/admin/game-events/${gameEventId}/form-sessions`);
}

export async function settleSession(sessionId: string): Promise<SessionResult[]> {
	const raw = await api.post<ApiSessionResult[]>(`/admin/sessions/${sessionId}/settle`);
	return (raw ?? []).map(mapSessionResult);
}

export async function fetchSessionResults(sessionId: string): Promise<SessionResult[]> {
	const raw = await api.get<ApiSessionResult[]>(`/admin/sessions/${sessionId}/results`);
	return (raw ?? []).map(mapSessionResult);
}
