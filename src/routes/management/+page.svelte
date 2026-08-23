<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { fetchUsers, blockUser, unblockUser, fetchUserTransactions } from '$lib/services/users';
	import {
		fetchGameEvents,
		createGameEvent,
		updateGameEventWindow,
		cancelGameEvent,
		fetchTiers,
		createTier,
		updateTier,
		fetchSessions,
		formSessions,
		settleSession,
		fetchSessionResults,
		type GameEventWindowInput,
		type TierInput
	} from '$lib/services/gameEvents';
	import {
		fetchSessionQuestions,
		createSessionQuestion,
		type SessionQuestionInput
	} from '$lib/services/questions';
	import {
		fetchWithdrawals,
		approveWithdrawal,
		rejectWithdrawal,
		markWithdrawalProcessed,
		markWithdrawalFailed
	} from '$lib/services/withdrawals';
	import { fetchDashboardOverview, fetchAdminMe } from '$lib/services/dashboard';
	import {
		fetchNotifications,
		markNotificationRead,
		connectAdminNotifications,
		broadcastNotification
	} from '$lib/services/notifications';
	import {
		fetchAdminUsers,
		createAdminUser,
		setAdminUserRole,
		activateAdminUser,
		deactivateAdminUser,
		fetchPermissions,
		fetchRolePermissions,
		setRolePermission,
		type CreateAdminUserInput
	} from '$lib/services/rbac';
	import {
		fetchTickets,
		fetchTicketDetail,
		assignTicketToMe,
		postTicketMessage,
		resolveTicket,
		closeTicket
	} from '$lib/services/tickets';
	import {
		fetchDisputes,
		fetchDisputeEvidence,
		assignDisputeToMe,
		investigateDispute,
		resolveDispute,
		rejectDispute
	} from '$lib/services/disputes';
	import { fetchKycDocuments, verifyKycDocument, rejectKycDocument } from '$lib/services/kyc';
	import { fetchReconciliation, downloadWalletTransactionsCSV } from '$lib/services/reports';
	import { fetchAuditLogs } from '$lib/services/auditLogs';
	import {
		WITHDRAWAL_STATUS_INFO,
		TRANSACTION_TYPE_INFO,
		ADMIN_ROLE_INFO,
		TICKET_STATUS_INFO,
		TICKET_PRIORITY_INFO,
		TICKET_CATEGORY_LABELS,
		DISPUTE_STATUS_INFO,
		KYC_STATUS_INFO,
		type GameEvent,
		type Tier,
		type GameSession,
		type SessionResult,
		type SessionQuestion,
		type AdminManagedUser,
		type WalletTransaction,
		type Withdrawal,
		type WithdrawalStatus,
		type DashboardOverview,
		type AdminAccount,
		type AdminNotification,
		type AdminUserSummary,
		type Permission,
		type RolePermissionsMap,
		type AdminRole,
		type SupportTicket,
		type TicketMessage,
		type DisputeItem,
		type DisputeEvidence,
		type KycDocument,
		type Reconciliation,
		type AuditLogEntry
	} from '$lib/types';
	import {
		formatINR,
		formatSignedINR,
		formatEventDate,
		formatTime,
		formatDateLabel
	} from '$lib/format';
	import PhaseBadge from '$lib/components/PhaseBadge.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PillTabs from '$lib/components/PillTabs.svelte';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import NavIcon from '$lib/components/NavIcon.svelte';

	type Section =
		| 'dashboard'
		| 'contests'
		| 'questions'
		| 'players'
		| 'payouts'
		| 'tickets'
		| 'disputes'
		| 'session-monitor'
		| 'kyc'
		| 'reports'
		| 'audit-log'
		| 'admin-roles'
		| 'settings';

	const allSections: { id: Section; label: string }[] = [
		{ id: 'dashboard', label: 'Dashboard' },
		{ id: 'contests', label: 'Contests' },
		{ id: 'questions', label: 'Question bank' },
		{ id: 'players', label: 'Players' },
		{ id: 'payouts', label: 'Payouts' },
		{ id: 'tickets', label: 'Support tickets' },
		{ id: 'disputes', label: 'Disputes' },
		{ id: 'session-monitor', label: 'Session monitor' },
		{ id: 'kyc', label: 'KYC verification' },
		{ id: 'reports', label: 'Reports' },
		{ id: 'audit-log', label: 'Audit log' },
		{ id: 'admin-roles', label: 'Admin roles' },
		{ id: 'settings', label: 'Settings' }
	];

	// Every gate below is UX only — the backend enforces the real permission check
	// independently (RequireSuperAdmin for RBAC, RequirePermission for everything else),
	// so hiding a nav item here just avoids showing a screen whose own GET would 403.
	// All of them are hardcoded to the default role_permissions seed rather than fetched
	// live, since only super_admin can call the endpoint that would tell a non-super-admin
	// what they're actually allowed to do — if that seed is edited later, this can drift
	// until the code catches up, same as the super_admin/tickets gates already did.
	const sections = $derived(
		allSections.filter((s) => {
			if (s.id === 'admin-roles') return isSuperAdmin;
			if (s.id === 'tickets') return canSeeTickets;
			if (s.id === 'payouts') return canSeePayouts;
			if (s.id === 'questions') return canSeeQuestions;
			if (s.id === 'disputes') return canSeeDisputes;
			if (s.id === 'session-monitor') return canSeeSessionMonitor;
			if (s.id === 'kyc') return canSeeKyc;
			if (s.id === 'reports') return canSeeReports;
			if (s.id === 'audit-log') return canSeeAuditLog;
			return true;
		})
	);

	let activeSection = $state<Section>('dashboard');

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	$effect(() => {
		if (!auth.initializing && !auth.isAuthenticated) {
			goto(resolve('/login'), { replaceState: true });
		}
	});

	let playersLoaded = false;
	$effect(() => {
		if (checkedAuth && !playersLoaded) {
			playersLoaded = true;
			loadPlayers();
		}
	});

	let contestsLoaded = false;
	$effect(() => {
		if (checkedAuth && !contestsLoaded) {
			contestsLoaded = true;
			loadGameEvents();
		}
	});

	let withdrawalsLoaded = false;
	$effect(() => {
		if (checkedAuth && canSeePayouts && !withdrawalsLoaded) {
			withdrawalsLoaded = true;
			loadWithdrawals();
		}
	});

	let overviewLoaded = false;
	$effect(() => {
		if (checkedAuth && !overviewLoaded) {
			overviewLoaded = true;
			loadOverview();
		}
	});

	let accountLoaded = false;
	$effect(() => {
		if (checkedAuth && !accountLoaded) {
			accountLoaded = true;
			loadAccount();
		}
	});

	let notificationsLoaded = false;
	$effect(() => {
		if (checkedAuth && !notificationsLoaded) {
			notificationsLoaded = true;
			loadNotifications();
		}
	});

	// Live push for notifications — connects once authenticated, reconnects on drop,
	// and tears down cleanly if the admin logs out or navigates away.
	$effect(() => {
		if (!checkedAuth) return;
		const stop = connectAdminNotifications((n) => {
			notifications = [n, ...notifications];
			// If a reply lands on the ticket currently open in the modal, pull it in live
			// instead of making the admin close and reopen the ticket to see it.
			if (n.notificationType === 'ticket_reply' && viewingTicketId) {
				fetchTicketDetail(viewingTicketId)
					.then((detail) => {
						viewingTicket = detail.ticket;
						ticketMessages = detail.messages;
					})
					.catch(() => {});
			}
		});
		return stop;
	});

	// Backstops the WS push above — e.g. a ticket_reply on a ticket nobody's claimed
	// yet notifies no one server-side by design (see notifyOtherParty backend-side), so
	// polling is the only way the bell picks that up without a manual page refresh.
	$effect(() => {
		if (!checkedAuth) return;
		const interval = setInterval(() => loadNotifications(), 20000);
		return () => clearInterval(interval);
	});

	async function handleLogout() {
		await auth.logout();
		goto(resolve('/login'), { replaceState: true });
	}

	// ---------- Contests (game events -> tiers -> sessions) ----------
	let gameEvents = $state<GameEvent[]>([]);
	let gameEventsLoading = $state(false);
	let gameEventsError = $state('');
	let contestQuery = $state('');
	let contestFilter = $state('all');
	let expandedEventId = $state<string | null>(null);

	// Tiers are cheap (2-3 per event) and drive the aggregate stats below, so they're
	// loaded eagerly for every event rather than only when a card is expanded.
	let tiersByEvent = $state<Record<string, Tier[]>>({});
	// True for an event whose tier fetch just failed (network blip, expired session,
	// etc). Tracked separately from an empty tiersByEvent entry so a transient error
	// never gets misread as "this contest genuinely has no tiers yet".
	let tiersErrorByEvent = $state<Record<string, boolean>>({});
	// Sessions only exist once entry has closed and are heavier (entrant lists per
	// session), so they're loaded lazily the first time a card is expanded.
	let sessionsByEvent = $state<Record<string, GameSession[]>>({});
	let sessionsLoadingFor = $state<Record<string, boolean>>({});

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
		gameEvents.filter((e) => {
			const matchesQuery = formatEventDate(e.eventDate)
				.toLowerCase()
				.includes(contestQuery.trim().toLowerCase());
			const matchesFilter = contestFilter === 'all' || e.phase === contestFilter;
			return matchesQuery && matchesFilter;
		})
	);

	const activeGameEvents = $derived(
		gameEvents.filter((e) => e.phase !== 'completed' && e.phase !== 'cancelled')
	);

	function tiersFor(eventId: string): Tier[] {
		return tiersByEvent[eventId] ?? [];
	}

	// Real prize pools aren't known until a session settles — this is the locked-in
	// entry-fee total, the closest honest "money at stake" figure before then.
	const contestsEntryFeesLocked = $derived(
		activeGameEvents.reduce(
			(sum, e) => sum + tiersFor(e.id).reduce((s, t) => s + t.entryFee * t.entriesCount, 0),
			0
		)
	);
	const contestsPlayersCompeting = $derived(
		activeGameEvents.reduce(
			(sum, e) => sum + tiersFor(e.id).reduce((s, t) => s + t.entriesCount, 0),
			0
		)
	);

	async function loadGameEvents() {
		gameEventsLoading = true;
		gameEventsError = '';
		try {
			gameEvents = await fetchGameEvents();
			await Promise.all(gameEvents.map((e) => loadTiersFor(e.id)));
		} catch (err) {
			gameEventsError = err instanceof Error ? err.message : 'Failed to load contests.';
		} finally {
			gameEventsLoading = false;
		}
	}

	// A failed fetch never blanks out tiers that were already known-good — it only
	// flips tiersErrorByEvent so the card can show a retry affordance instead of
	// silently rendering "no tiers configured yet" for a contest that actually has some.
	async function loadTiersFor(eventId: string) {
		try {
			const tiers = await fetchTiers(eventId);
			tiersByEvent = { ...tiersByEvent, [eventId]: tiers };
			tiersErrorByEvent = { ...tiersErrorByEvent, [eventId]: false };
		} catch {
			tiersByEvent = { ...tiersByEvent, [eventId]: tiersByEvent[eventId] ?? [] };
			tiersErrorByEvent = { ...tiersErrorByEvent, [eventId]: true };
		}
	}

	// Shared by the Contests card expand and the Question bank's session picker — both
	// need a game event's sessions and neither should re-fetch once loaded.
	async function ensureSessionsLoaded(eventId: string) {
		if (sessionsByEvent[eventId]) return;
		sessionsLoadingFor = { ...sessionsLoadingFor, [eventId]: true };
		try {
			sessionsByEvent = { ...sessionsByEvent, [eventId]: await fetchSessions(eventId) };
		} catch {
			sessionsByEvent = { ...sessionsByEvent, [eventId]: [] };
		} finally {
			sessionsLoadingFor = { ...sessionsLoadingFor, [eventId]: false };
		}
	}

	async function toggleExpand(eventId: string) {
		expandedEventId = expandedEventId === eventId ? null : eventId;
		if (expandedEventId) await ensureSessionsLoaded(expandedEventId);
	}

	// ---------- Add game event ----------
	let showAddGameEvent = $state(false);
	let newContestName = $state('');
	let newEventDate = $state('');
	let newEntryOpensAt = $state('');
	let newEntryClosesAt = $state('');
	let newGameStartsAt = $state('');
	let newGameEndsAt = $state('');
	let addGameEventError = $state('');
	let addGameEventSaving = $state(false);

	function openAddGameEvent() {
		newContestName = '';
		newEventDate = '';
		newEntryOpensAt = '';
		newEntryClosesAt = '';
		newGameStartsAt = '';
		newGameEndsAt = '';
		addGameEventError = '';
		showAddGameEvent = true;
	}

	// datetime-local inputs have no timezone — treated as the admin's local time.
	function toRfc3339(localDateTime: string): string {
		return new Date(localDateTime).toISOString();
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
				entryOpensAt: toRfc3339(newEntryOpensAt),
				entryClosesAt: toRfc3339(newEntryClosesAt),
				gameStartsAt: toRfc3339(newGameStartsAt),
				gameEndsAt: toRfc3339(newGameEndsAt)
			};
			const created = await createGameEvent(newEventDate, window);
			gameEvents = [created, ...gameEvents];
			tiersByEvent = { ...tiersByEvent, [created.id]: [] };
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
	let editEntryOpensAt = $state('');
	let editEntryClosesAt = $state('');
	let editGameStartsAt = $state('');
	let editGameEndsAt = $state('');
	let editEventError = $state('');
	let editEventSaving = $state(false);

	function toLocalInputValue(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function openEditGameEvent(event: GameEvent) {
		editingEventId = event.id;
		editContestName = event.name;
		editEntryOpensAt = toLocalInputValue(event.entryOpensAt);
		editEntryClosesAt = toLocalInputValue(event.entryClosesAt);
		editGameStartsAt = toLocalInputValue(event.gameStartsAt);
		editGameEndsAt = toLocalInputValue(event.gameEndsAt);
		editEventError = '';
	}

	async function submitEditGameEvent(e: SubmitEvent) {
		e.preventDefault();
		if (!editingEventId || !editContestName.trim()) return;
		editEventSaving = true;
		editEventError = '';
		try {
			const updated = await updateGameEventWindow(editingEventId, {
				name: editContestName.trim(),
				entryOpensAt: toRfc3339(editEntryOpensAt),
				entryClosesAt: toRfc3339(editEntryClosesAt),
				gameStartsAt: toRfc3339(editGameStartsAt),
				gameEndsAt: toRfc3339(editGameEndsAt)
			});
			gameEvents = gameEvents.map((ev) => (ev.id === updated.id ? updated : ev));
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
			gameEvents = gameEvents.map((ev) => (ev.id === updated.id ? updated : ev));
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
				tiersByEvent = {
					...tiersByEvent,
					[eventId]: (tiersByEvent[eventId] ?? []).map((t) =>
						t.id === updated.id ? { ...updated, entriesCount: t.entriesCount } : t
					)
				};
			} else {
				const created = await createTier(eventId, input);
				tiersByEvent = { ...tiersByEvent, [eventId]: [...(tiersByEvent[eventId] ?? []), created] };
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
			sessionsByEvent = { ...sessionsByEvent, [eventId]: await fetchSessions(eventId) };
			const refreshed = await fetchGameEvents();
			const updated = refreshed.find((e) => e.id === eventId);
			if (updated) gameEvents = gameEvents.map((e) => (e.id === eventId ? updated : e));
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

	async function settleSessionAction(session: GameSession) {
		settlingSessionId = session.id;
		sessionActionError = { ...sessionActionError, [session.id]: '' };
		try {
			const results = await settleSession(session.id);
			sessionsByEvent = {
				...sessionsByEvent,
				[session.gameEventId]: (sessionsByEvent[session.gameEventId] ?? []).map((s) =>
					s.id === session.id ? { ...s, settled: true } : s
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

	async function viewResults(session: GameSession) {
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

	// ---------- Question bank (session-scoped authoring) ----------
	// Questions belong to a single game_session — pick a contest, then a session within
	// it, then author/view that session's questions. Reuses the same gameEvents /
	// sessionsByEvent state as the Contests screen.
	let questionEventId = $state('');
	let questionSessionId = $state('');
	let sessionQuestions = $state<SessionQuestion[]>([]);
	let sessionQuestionsLoading = $state(false);
	let sessionQuestionsError = $state('');

	const questionEventSessions = $derived(sessionsByEvent[questionEventId] ?? []);

	async function selectQuestionEvent(eventId: string) {
		questionEventId = eventId;
		questionSessionId = '';
		sessionQuestions = [];
		sessionQuestionsError = '';
		if (eventId) await ensureSessionsLoaded(eventId);
	}

	async function selectQuestionSession(sessionId: string) {
		questionSessionId = sessionId;
		sessionQuestions = [];
		sessionQuestionsError = '';
		if (!sessionId) return;
		sessionQuestionsLoading = true;
		try {
			sessionQuestions = await fetchSessionQuestions(sessionId);
		} catch (err) {
			sessionQuestionsError =
				err instanceof Error ? err.message : 'Failed to load session questions.';
		} finally {
			sessionQuestionsLoading = false;
		}
	}

	let showAddQuestion = $state(false);
	let newSequenceNo = $state(1);
	let newQuestionText = $state('');
	let newOptions = $state(['', '', '', '']);
	let newCorrectIndex = $state(0);
	let addQuestionError = $state('');
	let addQuestionSaving = $state(false);

	function openAddQuestion() {
		newSequenceNo = sessionQuestions.length + 1;
		newQuestionText = '';
		newOptions = ['', '', '', ''];
		newCorrectIndex = 0;
		addQuestionError = '';
		showAddQuestion = true;
	}

	async function submitAddQuestion(e: SubmitEvent) {
		e.preventDefault();
		if (!questionSessionId || !newQuestionText.trim() || newOptions.some((o) => !o.trim())) return;
		addQuestionSaving = true;
		addQuestionError = '';
		const input: SessionQuestionInput = {
			sequenceNo: newSequenceNo,
			questionText: newQuestionText.trim(),
			options: newOptions.map((o) => o.trim()),
			correctOption: newOptions[newCorrectIndex].trim()
		};
		try {
			const created = await createSessionQuestion(questionSessionId, input);
			sessionQuestions = [...sessionQuestions, created].sort((a, b) => a.sequenceNo - b.sequenceNo);
			showAddQuestion = false;
		} catch (err) {
			addQuestionError = err instanceof Error ? err.message : 'Failed to add question.';
		} finally {
			addQuestionSaving = false;
		}
	}

	// ---------- Players ----------
	let players = $state<AdminManagedUser[]>([]);
	let playersLoading = $state(false);
	let playersError = $state('');
	let playerQuery = $state('');

	async function loadPlayers() {
		playersLoading = true;
		playersError = '';
		try {
			players = await fetchUsers();
		} catch (err) {
			playersError = err instanceof Error ? err.message : 'Failed to load players.';
		} finally {
			playersLoading = false;
		}
	}

	const filteredPlayers = $derived(
		players.filter(
			(p) =>
				p.name.toLowerCase().includes(playerQuery.trim().toLowerCase()) ||
				p.phoneNumber.toLowerCase().includes(playerQuery.trim().toLowerCase())
		)
	);

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
			players = players.map((p) => (p.id === updated.id ? updated : p));
			blockingPlayerId = null;
		} catch (err) {
			playerActionError = err instanceof Error ? err.message : 'Failed to suspend player.';
		}
	}

	async function reactivatePlayer(id: string) {
		playerActionError = '';
		try {
			const updated = await unblockUser(id);
			players = players.map((p) => (p.id === updated.id ? updated : p));
		} catch (err) {
			playerActionError = err instanceof Error ? err.message : 'Failed to reactivate player.';
		}
	}

	let viewingWalletPlayerId = $state<string | null>(null);
	let viewingTransactions = $state<WalletTransaction[]>([]);
	let viewingTransactionsLoading = $state(false);

	const viewingPlayer = $derived(players.find((p) => p.id === viewingWalletPlayerId) ?? null);

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

	// ---------- Payouts (withdrawals) ----------
	// The real UPI transfer isn't wired to a payment aggregator yet — mark-processed /
	// mark-failed below (both real backend endpoints) are today's stand-in for that: an
	// admin manually confirms the outcome instead of a payment-gateway webhook doing it.
	let withdrawals = $state<Withdrawal[]>([]);
	let withdrawalsLoading = $state(false);
	let withdrawalsError = $state('');
	let payoutQuery = $state('');
	let payoutFilter = $state('all');

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
			withdrawals = await fetchWithdrawals();
		} catch (err) {
			withdrawalsError = err instanceof Error ? err.message : 'Failed to load payouts.';
		} finally {
			withdrawalsLoading = false;
		}
	}

	const filteredWithdrawals = $derived(
		withdrawals.filter((w) => {
			const q = payoutQuery.trim().toLowerCase();
			const matchesQuery = w.playerName.toLowerCase().includes(q) || w.playerPhone.includes(q);
			const matchesFilter = payoutFilter === 'all' || w.status === payoutFilter;
			return matchesQuery && matchesFilter;
		})
	);

	const pendingWithdrawals = $derived(withdrawals.filter((w) => w.status === 'pending'));
	const pendingWithdrawalAmount = $derived(
		pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0)
	);
	const paidOutAmount = $derived(
		withdrawals.filter((w) => w.status === 'success').reduce((sum, w) => sum + w.amount, 0)
	);
	const failedOrRejectedCount = $derived(
		withdrawals.filter((w) => w.status === 'failed' || w.status === 'rejected').length
	);

	let withdrawalActionBusy = $state<string | null>(null);
	let withdrawalActionError = $state<Record<string, string>>({});

	async function approvePayout(id: string) {
		withdrawalActionBusy = id;
		withdrawalActionError = { ...withdrawalActionError, [id]: '' };
		try {
			const updated = await approveWithdrawal(id);
			withdrawals = withdrawals.map((w) => (w.id === updated.id ? updated : w));
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
			failingWithdrawalId = null;
		} catch (err) {
			withdrawalReasonError = err instanceof Error ? err.message : 'Failed to mark payout failed.';
		}
	}

	// ---------- Dashboard ----------
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

	const totalPlayers = $derived(players.length);
	const liveContests = $derived(gameEvents.filter((e) => e.phase === 'live').length);

	// "Top contests by prize pool" doesn't apply pre-settlement — prize pools are only
	// known once a session settles. This ranks by locked-in entry fees instead, the
	// closest honest proxy for "money at stake" while a contest is still active.
	const topGameEvents = $derived(
		[...gameEvents]
			.map((e) => ({
				event: e,
				entryFeesLocked: tiersFor(e.id).reduce((s, t) => s + t.entryFee * t.entriesCount, 0),
				players: tiersFor(e.id).reduce((s, t) => s + t.entriesCount, 0)
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
		for (const event of gameEvents) {
			for (const tier of tiersFor(event.id)) {
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
				value: withdrawals.filter((w) => w.status === status).length,
				color: WITHDRAWAL_STATUS_INFO[status].color
			}))
			.filter((seg) => seg.value > 0)
	);

	// ---------- Topbar: notifications & profile ----------
	let notifications = $state<AdminNotification[]>([]);
	let showNotifications = $state(false);
	let showProfileMenu = $state(false);

	async function loadNotifications() {
		try {
			notifications = await fetchNotifications();
		} catch {
			notifications = [];
		}
	}

	const unreadCount = $derived(notifications.filter((n) => !n.isRead).length);

	function toggleNotifications() {
		showProfileMenu = false;
		showNotifications = !showNotifications;
	}

	function toggleProfileMenu() {
		showNotifications = false;
		showProfileMenu = !showProfileMenu;
	}

	let mobileNavOpen = $state(false);

	async function markAllNotificationsRead() {
		const unread = notifications.filter((n) => !n.isRead);
		notifications = notifications.map((n) => ({ ...n, isRead: true }));
		await Promise.all(unread.map((n) => markNotificationRead(n.id).catch(() => {})));
	}

	function openSettings() {
		activeSection = 'settings';
		showNotifications = false;
		showProfileMenu = false;
	}

	// ---------- Settings ----------
	let account = $state<AdminAccount | null>(null);
	let accountLoading = $state(false);
	let accountError = $state('');

	async function loadAccount() {
		accountLoading = true;
		accountError = '';
		try {
			account = await fetchAdminMe();
		} catch (err) {
			accountError = err instanceof Error ? err.message : 'Failed to load account.';
		} finally {
			accountLoading = false;
		}
	}

	// ---------- RBAC (super_admin only — backend enforces this independently via
	// RequireSuperAdmin; hiding the nav item and gating loads on it here is just UX) ----------
	const isSuperAdmin = $derived(account?.role === 'super_admin');

	let adminUsers = $state<AdminUserSummary[]>([]);
	let permissions = $state<Permission[]>([]);
	let rolePermissions = $state<RolePermissionsMap>({
		super_admin: [],
		finance: [],
		support_staff: []
	});
	let rbacLoading = $state(false);
	let rbacError = $state('');

	async function loadRbac() {
		rbacLoading = true;
		rbacError = '';
		try {
			const [admins, perms, rolePerms] = await Promise.all([
				fetchAdminUsers(),
				fetchPermissions(),
				fetchRolePermissions()
			]);
			adminUsers = admins;
			permissions = perms;
			rolePermissions = rolePerms;
		} catch (err) {
			rbacError = err instanceof Error ? err.message : 'Failed to load admin roles.';
		} finally {
			rbacLoading = false;
		}
	}

	let rbacLoaded = false;
	$effect(() => {
		if (checkedAuth && isSuperAdmin && !rbacLoaded) {
			rbacLoaded = true;
			loadRbac();
		}
	});

	let showAddAdmin = $state(false);
	let newAdminEmail = $state('');
	let newAdminPassword = $state('');
	let newAdminRole = $state<AdminRole>('support_staff');
	let addAdminError = $state('');
	let addAdminSaving = $state(false);

	function openAddAdmin() {
		newAdminEmail = '';
		newAdminPassword = '';
		newAdminRole = 'support_staff';
		addAdminError = '';
		showAddAdmin = true;
	}

	async function submitAddAdmin(e: SubmitEvent) {
		e.preventDefault();
		if (!newAdminEmail.trim() || !newAdminPassword) return;
		addAdminSaving = true;
		addAdminError = '';
		const input: CreateAdminUserInput = {
			email: newAdminEmail.trim(),
			password: newAdminPassword,
			role: newAdminRole
		};
		try {
			const created = await createAdminUser(input);
			adminUsers = [created, ...adminUsers];
			showAddAdmin = false;
		} catch (err) {
			addAdminError = err instanceof Error ? err.message : 'Failed to create admin.';
		} finally {
			addAdminSaving = false;
		}
	}

	let adminActionBusy = $state<string | null>(null);
	let adminActionError = $state<Record<string, string>>({});

	async function changeAdminRole(admin: AdminUserSummary, role: AdminRole) {
		if (role === admin.role) return;
		adminActionBusy = admin.id;
		adminActionError = { ...adminActionError, [admin.id]: '' };
		try {
			const updated = await setAdminUserRole(admin.id, role);
			adminUsers = adminUsers.map((a) => (a.id === updated.id ? updated : a));
		} catch (err) {
			adminActionError = {
				...adminActionError,
				[admin.id]: err instanceof Error ? err.message : 'Failed to change role.'
			};
		} finally {
			adminActionBusy = null;
		}
	}

	async function toggleAdminActive(admin: AdminUserSummary) {
		adminActionBusy = admin.id;
		adminActionError = { ...adminActionError, [admin.id]: '' };
		try {
			const updated = admin.isActive
				? await deactivateAdminUser(admin.id)
				: await activateAdminUser(admin.id);
			adminUsers = adminUsers.map((a) => (a.id === updated.id ? updated : a));
		} catch (err) {
			adminActionError = {
				...adminActionError,
				[admin.id]: err instanceof Error ? err.message : 'Failed to update admin status.'
			};
		} finally {
			adminActionBusy = null;
		}
	}

	const adminRoleOrder: AdminRole[] = ['super_admin', 'finance', 'support_staff'];

	function hasPermission(role: AdminRole, key: string): boolean {
		return rolePermissions[role]?.includes(key) ?? false;
	}

	let permissionBusyKey = $state<string | null>(null);

	async function togglePermission(role: AdminRole, key: string) {
		const granted = !hasPermission(role, key);
		const busyKey = `${role}:${key}`;
		permissionBusyKey = busyKey;
		rbacError = '';
		try {
			await setRolePermission(role, key, granted);
			const current = rolePermissions[role] ?? [];
			rolePermissions = {
				...rolePermissions,
				[role]: granted ? [...current, key] : current.filter((k) => k !== key)
			};
		} catch (err) {
			rbacError = err instanceof Error ? err.message : 'Failed to update permission.';
		} finally {
			permissionBusyKey = null;
		}
	}

	// wallet.view (Payouts) is granted to finance and super_admin by default.
	// questions.preview_approve (Question bank) is granted to super_admin only.
	// See the sections-filter comment above for why these are hardcoded.
	const canSeePayouts = $derived(account?.role === 'finance' || account?.role === 'super_admin');
	const canSeeQuestions = $derived(account?.role === 'super_admin');
	// disputes.resolve, sessions.monitor, kyc.verify are granted to support_staff and
	// super_admin by default. reports.view/export and audit_log.view are granted to
	// finance and super_admin by default. notifications.broadcast is super_admin only.
	const canSeeDisputes = $derived(
		account?.role === 'support_staff' || account?.role === 'super_admin'
	);
	const canSeeSessionMonitor = $derived(
		account?.role === 'support_staff' || account?.role === 'super_admin'
	);
	const canSeeKyc = $derived(account?.role === 'support_staff' || account?.role === 'super_admin');
	const canSeeReports = $derived(account?.role === 'finance' || account?.role === 'super_admin');
	const canSeeAuditLog = $derived(account?.role === 'finance' || account?.role === 'super_admin');
	const canBroadcast = $derived(account?.role === 'super_admin');

	// ---------- Support tickets ----------
	// tickets.view/assign/respond are granted to support_staff and super_admin by
	// default (see 00018_rbac.sql seed) — see the sections-filter comment above for why
	// this is hardcoded rather than fetched.
	const canSeeTickets = $derived(
		account?.role === 'support_staff' || account?.role === 'super_admin'
	);

	let tickets = $state<SupportTicket[]>([]);
	let ticketsLoading = $state(false);
	let ticketsError = $state('');
	let ticketQuery = $state('');
	let ticketFilter = $state('all');

	const ticketFilterOptions = [
		{ id: 'all', label: 'All' },
		{ id: 'open', label: 'Open' },
		{ id: 'assigned', label: 'Assigned' },
		{ id: 'in_progress', label: 'In progress' },
		{ id: 'waiting_on_user', label: 'Waiting on user' },
		{ id: 'resolved', label: 'Resolved' },
		{ id: 'closed', label: 'Closed' }
	];

	function playerNameFor(userId: string): string {
		return players.find((p) => p.id === userId)?.name ?? 'Unknown player';
	}

	const filteredTickets = $derived(
		tickets.filter((t) => {
			const q = ticketQuery.trim().toLowerCase();
			const matchesQuery =
				t.subject.toLowerCase().includes(q) || playerNameFor(t.userId).toLowerCase().includes(q);
			const matchesFilter = ticketFilter === 'all' || t.status === ticketFilter;
			return matchesQuery && matchesFilter;
		})
	);

	async function loadTickets() {
		ticketsLoading = true;
		ticketsError = '';
		try {
			tickets = await fetchTickets();
		} catch (err) {
			ticketsError = err instanceof Error ? err.message : 'Failed to load tickets.';
		} finally {
			ticketsLoading = false;
		}
	}

	let ticketsLoaded = false;
	$effect(() => {
		if (checkedAuth && canSeeTickets && !ticketsLoaded) {
			ticketsLoaded = true;
			loadTickets();
		}
	});

	let viewingTicketId = $state<string | null>(null);
	let viewingTicket = $state<SupportTicket | null>(null);
	let ticketMessages = $state<TicketMessage[]>([]);
	let ticketDetailLoading = $state(false);
	let ticketActionError = $state('');
	let ticketActionBusy = $state(false);
	let replyText = $state('');

	async function openTicket(id: string) {
		viewingTicketId = id;
		viewingTicket = null;
		ticketMessages = [];
		ticketActionError = '';
		replyText = '';
		ticketDetailLoading = true;
		try {
			const detail = await fetchTicketDetail(id);
			viewingTicket = detail.ticket;
			ticketMessages = detail.messages;
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to load ticket.';
		} finally {
			ticketDetailLoading = false;
		}
	}

	function closeTicketModal() {
		viewingTicketId = null;
	}

	// Fallback poll while a ticket is open. The live WS push above only fires for a
	// ticket that's already been claimed (see notifyOtherParty in the backend — an
	// unassigned ticket has no single admin to notify), so a reply on an unclaimed
	// ticket would otherwise never show up without this. Also covers a missed/dropped
	// WS push in general.
	$effect(() => {
		if (!viewingTicketId) return;
		const id = viewingTicketId;
		const interval = setInterval(() => {
			fetchTicketDetail(id)
				.then((detail) => {
					if (viewingTicketId !== id) return;
					viewingTicket = detail.ticket;
					ticketMessages = detail.messages;
				})
				.catch(() => {});
		}, 8000);
		return () => clearInterval(interval);
	});

	function applyTicketUpdate(updated: SupportTicket) {
		viewingTicket = updated;
		tickets = tickets.map((t) => (t.id === updated.id ? updated : t));
	}

	async function assignTicketAction() {
		if (!viewingTicketId) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			applyTicketUpdate(await assignTicketToMe(viewingTicketId));
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to assign ticket.';
		} finally {
			ticketActionBusy = false;
		}
	}

	async function sendReply(e: SubmitEvent) {
		e.preventDefault();
		if (!viewingTicketId || !replyText.trim()) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			const msg = await postTicketMessage(viewingTicketId, replyText.trim());
			ticketMessages = [...ticketMessages, msg];
			replyText = '';
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to send reply.';
		} finally {
			ticketActionBusy = false;
		}
	}

	async function resolveTicketAction() {
		if (!viewingTicketId) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			applyTicketUpdate(await resolveTicket(viewingTicketId));
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to resolve ticket.';
		} finally {
			ticketActionBusy = false;
		}
	}

	async function closeTicketAction() {
		if (!viewingTicketId) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			applyTicketUpdate(await closeTicket(viewingTicketId));
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to close ticket.';
		} finally {
			ticketActionBusy = false;
		}
	}

	// ---------- Disputes ----------
	let disputes = $state<DisputeItem[]>([]);
	let disputesLoading = $state(false);
	let disputesError = $state('');
	let disputeFilter = $state('all');

	const disputeFilterOptions = [
		{ id: 'all', label: 'All' },
		{ id: 'open', label: 'Open' },
		{ id: 'investigating', label: 'Investigating' },
		{ id: 'resolved', label: 'Resolved' },
		{ id: 'rejected', label: 'Rejected' }
	];

	const filteredDisputes = $derived(
		disputes.filter((d) => disputeFilter === 'all' || d.status === disputeFilter)
	);

	async function loadDisputes() {
		disputesLoading = true;
		disputesError = '';
		try {
			disputes = await fetchDisputes();
		} catch (err) {
			disputesError = err instanceof Error ? err.message : 'Failed to load disputes.';
		} finally {
			disputesLoading = false;
		}
	}

	let disputesLoaded = false;
	$effect(() => {
		if (checkedAuth && canSeeDisputes && !disputesLoaded) {
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

	async function openDispute(id: string) {
		viewingDisputeId = id;
		viewingDisputeEvidence = null;
		disputeActionError = '';
		disputeNotes = '';
		disputeDetailLoading = true;
		try {
			viewingDisputeEvidence = await fetchDisputeEvidence(id);
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
		if (viewingDisputeEvidence) {
			viewingDisputeEvidence = { ...viewingDisputeEvidence, dispute: updated };
		}
		disputes = disputes.map((d) => (d.id === updated.id ? updated : d));
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

	// ---------- Session monitor ----------
	// Read-only view of a session's standing — reuses the same event/session picker and
	// fetchSessionResults() already built for Contests/Question bank, just without any of
	// the management actions (settle, edit, etc.) those screens gate behind game.manage.
	let monitorEventId = $state('');
	let monitorSessionId = $state('');
	let monitorResults = $state<SessionResult[]>([]);
	let monitorResultsLoading = $state(false);
	let monitorError = $state('');

	const monitorEventSessions = $derived(sessionsByEvent[monitorEventId] ?? []);
	const monitorSelectedSession = $derived(
		monitorEventSessions.find((s) => s.id === monitorSessionId) ?? null
	);

	async function selectMonitorEvent(eventId: string) {
		monitorEventId = eventId;
		monitorSessionId = '';
		monitorResults = [];
		monitorError = '';
		if (eventId) await ensureSessionsLoaded(eventId);
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

	// ---------- KYC verification ----------
	let kycDocuments = $state<KycDocument[]>([]);
	let kycLoading = $state(false);
	let kycError = $state('');
	let kycStatusFilter = $state('pending');

	const kycFilterOptions = [
		{ id: 'pending', label: 'Pending' },
		{ id: 'verified', label: 'Verified' },
		{ id: 'rejected', label: 'Rejected' }
	];

	const filteredKycDocuments = $derived(kycDocuments.filter((d) => d.status === kycStatusFilter));

	async function loadKycDocuments() {
		kycLoading = true;
		kycError = '';
		try {
			kycDocuments = await fetchKycDocuments();
		} catch (err) {
			kycError = err instanceof Error ? err.message : 'Failed to load KYC documents.';
		} finally {
			kycLoading = false;
		}
	}

	let kycLoaded = false;
	$effect(() => {
		if (checkedAuth && canSeeKyc && !kycLoaded) {
			kycLoaded = true;
			loadKycDocuments();
		}
	});

	let kycActionBusy = $state<string | null>(null);
	let kycActionError = $state<Record<string, string>>({});

	async function verifyKycAction(id: string) {
		kycActionBusy = id;
		kycActionError = { ...kycActionError, [id]: '' };
		try {
			const updated = await verifyKycDocument(id);
			kycDocuments = kycDocuments.map((d) => (d.id === updated.id ? updated : d));
		} catch (err) {
			kycActionError = {
				...kycActionError,
				[id]: err instanceof Error ? err.message : 'Failed to verify document.'
			};
		} finally {
			kycActionBusy = null;
		}
	}

	let rejectingKycId = $state<string | null>(null);
	let kycRejectReason = $state('');
	let kycRejectError = $state('');

	function openRejectKyc(id: string) {
		rejectingKycId = id;
		kycRejectReason = '';
		kycRejectError = '';
	}

	async function confirmRejectKyc(e: SubmitEvent) {
		e.preventDefault();
		if (!rejectingKycId || !kycRejectReason.trim()) return;
		try {
			const updated = await rejectKycDocument(rejectingKycId, kycRejectReason.trim());
			kycDocuments = kycDocuments.map((d) => (d.id === updated.id ? updated : d));
			rejectingKycId = null;
		} catch (err) {
			kycRejectError = err instanceof Error ? err.message : 'Failed to reject document.';
		}
	}

	// ---------- Reports ----------
	let reconciliation = $state<Reconciliation | null>(null);
	let reconciliationLoading = $state(false);
	let reconciliationError = $state('');
	let exportFrom = $state('');
	let exportTo = $state('');
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
		if (checkedAuth && canSeeReports && !reportsLoaded) {
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
				exportFrom ? new Date(exportFrom).toISOString() : undefined,
				exportTo ? new Date(exportTo).toISOString() : undefined
			);
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Failed to export CSV.';
		} finally {
			exportBusy = false;
		}
	}

	// ---------- Audit log ----------
	let auditLogs = $state<AuditLogEntry[]>([]);
	let auditLogsLoading = $state(false);
	let auditLogsError = $state('');
	let auditLogOffset = $state(0);
	const auditLogPageSize = 50;

	async function loadAuditLogs() {
		auditLogsLoading = true;
		auditLogsError = '';
		try {
			auditLogs = await fetchAuditLogs(auditLogPageSize, auditLogOffset);
		} catch (err) {
			auditLogsError = err instanceof Error ? err.message : 'Failed to load audit log.';
		} finally {
			auditLogsLoading = false;
		}
	}

	let auditLogsLoaded = false;
	$effect(() => {
		if (checkedAuth && canSeeAuditLog && !auditLogsLoaded) {
			auditLogsLoaded = true;
			loadAuditLogs();
		}
	});

	function nextAuditLogPage() {
		auditLogOffset += auditLogPageSize;
		loadAuditLogs();
	}

	function prevAuditLogPage() {
		auditLogOffset = Math.max(0, auditLogOffset - auditLogPageSize);
		loadAuditLogs();
	}

	// ---------- Broadcast notification (Settings screen, super_admin only) ----------
	let broadcastTitle = $state('');
	let broadcastBody = $state('');
	let broadcastSending = $state(false);
	let broadcastError = $state('');
	let broadcastSentCount = $state<number | null>(null);

	async function sendBroadcast(e: SubmitEvent) {
		e.preventDefault();
		if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
		broadcastSending = true;
		broadcastError = '';
		broadcastSentCount = null;
		try {
			broadcastSentCount = await broadcastNotification(broadcastTitle.trim(), broadcastBody.trim());
			broadcastTitle = '';
			broadcastBody = '';
		} catch (err) {
			broadcastError = err instanceof Error ? err.message : 'Failed to send broadcast.';
		} finally {
			broadcastSending = false;
		}
	}
</script>

<svelte:head>
	<title>Management · QuizPlay Admin</title>
</svelte:head>

{#if checkedAuth}
	<div class="flex h-screen overflow-hidden">
		{#if mobileNavOpen}
			<button
				class="fixed inset-0 z-40 bg-black/50 lg:hidden"
				aria-label="Close menu"
				onclick={() => (mobileNavOpen = false)}
			></button>
		{/if}

		<aside
			class="fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-nav px-4 py-6 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:translate-x-0"
			class:translate-x-0={mobileNavOpen}
			class:-translate-x-full={!mobileNavOpen}
		>
			<div class="mb-8 flex items-center gap-2.5 px-2">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl text-base font-extrabold text-white"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
				>
					Q
				</div>
				<div>
					<p class="text-sm leading-tight font-semibold text-white">QuizPlay</p>
					<p class="text-xs leading-tight text-nav-ink-soft">Admin panel</p>
				</div>
				<button
					aria-label="Close menu"
					class="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-nav-ink-soft hover:text-white lg:hidden"
					onclick={() => (mobileNavOpen = false)}
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							d="M18 6 6 18M6 6l12 12"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>

			<nav class="flex flex-1 flex-col gap-1">
				{#each sections as section (section.id)}
					<button
						class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition"
						class:text-white={activeSection === section.id}
						class:text-nav-ink={activeSection !== section.id}
						style={activeSection === section.id ? 'background-color: var(--color-primary);' : ''}
						onclick={() => {
							activeSection = section.id;
							mobileNavOpen = false;
						}}
					>
						<NavIcon name={section.id} />
						{section.label}
					</button>
				{/each}
			</nav>

			<div class="mt-6 border-t pt-4" style="border-color: var(--color-nav-elevated);">
				<button
					class="w-full rounded-xl px-3 py-2 text-sm font-medium text-nav-ink transition hover:text-white"
					style="background-color: var(--color-nav-elevated);"
					onclick={handleLogout}
				>
					Log out
				</button>
			</div>
		</aside>

		<main class="h-full flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-7">
			<header class="mb-7 flex items-start justify-between gap-4">
				<div class="flex min-w-0 items-start gap-3">
					<button
						aria-label="Open menu"
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition hover:text-ink lg:hidden"
						onclick={() => (mobileNavOpen = true)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								d="M4 6h16M4 12h16M4 18h16"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<div class="min-w-0">
						<h1 class="text-2xl font-semibold text-ink">
							{sections.find((s) => s.id === activeSection)?.label}
						</h1>
						<p class="mt-1 text-sm text-ink-soft">
							{#if activeSection === 'dashboard'}
								Platform overview and recent activity.
							{:else if activeSection === 'contests'}
								Manage contest schedules, entry fees and prize pools.
							{:else if activeSection === 'questions'}
								Author questions for a session, once its entry window has closed.
							{:else if activeSection === 'players'}
								View player accounts and moderate access.
							{:else if activeSection === 'payouts'}
								Review and release player wallet payout requests.
							{:else if activeSection === 'tickets'}
								View and respond to player support tickets.
							{:else if activeSection === 'disputes'}
								Investigate and resolve gameplay/ranking complaints.
							{:else if activeSection === 'session-monitor'}
								Check standings for any session, live or settled.
							{:else if activeSection === 'kyc'}
								Review and verify player KYC documents.
							{:else if activeSection === 'reports'}
								Wallet ledger reconciliation and CSV export.
							{:else if activeSection === 'audit-log'}
								Trail of every sensitive admin action.
							{:else if activeSection === 'admin-roles'}
								Manage admin accounts and role permissions.
							{:else}
								Configure app details, contest tiers and alerts.
							{/if}
						</p>
					</div>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<div class="relative">
						<button
							aria-label="Notifications"
							class="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition hover:text-ink"
							onclick={toggleNotifications}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path
									d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M13.73 21a2 2 0 0 1-3.46 0"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							{#if unreadCount > 0}
								<span
									class="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
									style="background-color: var(--color-error);"
								>
									{unreadCount}
								</span>
							{/if}
						</button>

						{#if showNotifications}
							<button
								class="fixed inset-0 z-40 cursor-default"
								aria-label="Close notifications"
								onclick={() => (showNotifications = false)}
							></button>
							<div
								class="absolute top-12 right-0 z-50 w-80 rounded-card border border-line bg-surface p-2 shadow-xl"
							>
								<div class="flex items-center justify-between px-2 py-1.5">
									<p class="text-sm font-semibold text-ink">Notifications</p>
									<button
										class="text-xs font-medium text-ink-soft hover:text-ink"
										onclick={markAllNotificationsRead}
									>
										Mark all read
									</button>
								</div>
								<div class="max-h-80 space-y-0.5 overflow-y-auto">
									{#each notifications as notification (notification.id)}
										<button
											type="button"
											class="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-field"
											onclick={() => {
												if (!notification.isRead) {
													notifications = notifications.map((n) =>
														n.id === notification.id ? { ...n, isRead: true } : n
													);
													markNotificationRead(notification.id).catch(() => {});
												}
												if (notification.ticketId) {
													showNotifications = false;
													openTicket(notification.ticketId);
												}
											}}
										>
											<span
												class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
												style={notification.isRead
													? 'background-color: transparent;'
													: 'background-color: var(--color-primary);'}
											></span>
											<div class="min-w-0">
												<p class="text-sm font-medium text-ink">{notification.title}</p>
												<p class="mt-0.5 truncate text-xs text-ink-soft">{notification.body}</p>
												<p class="mt-0.5 text-xs text-ink-faint">
													{formatDateLabel(notification.createdAt)}
												</p>
											</div>
										</button>
									{:else}
										<p class="px-2 py-6 text-center text-sm text-ink-soft">You're all caught up.</p>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<button
						aria-label="Settings"
						class="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition hover:text-ink"
						class:border-transparent={activeSection === 'settings'}
						style={activeSection === 'settings'
							? 'background-color: var(--color-primary); color: white;'
							: ''}
						onclick={openSettings}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle cx="12" cy="12" r="3" stroke-width="2" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>

					<div class="relative">
						<button
							aria-label="Profile"
							class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white transition"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
							onclick={toggleProfileMenu}
						>
							{(auth.displayName || 'A').charAt(0)}
						</button>

						{#if showProfileMenu}
							<button
								class="fixed inset-0 z-40 cursor-default"
								aria-label="Close profile menu"
								onclick={() => (showProfileMenu = false)}
							></button>
							<div
								class="absolute top-12 right-0 z-50 w-64 rounded-card border border-line bg-surface p-2 shadow-xl"
							>
								<div class="flex items-center gap-2.5 px-2 py-2">
									<div
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
										style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
									>
										{(auth.displayName || 'A').charAt(0)}
									</div>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-ink">
											{auth.displayName || 'Admin'}
										</p>
										<p class="truncate text-xs text-ink-soft">{auth.email}</p>
									</div>
								</div>
								<div class="my-1 border-t border-line"></div>
								<button
									class="w-full rounded-lg px-2 py-2 text-left text-sm text-ink-soft hover:bg-field hover:text-ink"
									onclick={openSettings}
								>
									Account settings
								</button>
								<button
									class="w-full rounded-lg px-2 py-2 text-left text-sm text-ink-soft hover:bg-field hover:text-error"
									onclick={handleLogout}
								>
									Log out
								</button>
							</div>
						{/if}
					</div>
				</div>
			</header>

			{#if activeSection === 'dashboard'}
				{#if overviewError}
					<p
						class="mb-4 rounded-lg px-3 py-2 text-sm"
						style="background-color: var(--color-error-bg); color: var(--color-error);"
					>
						{overviewError}
					</p>
				{/if}

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label="Total players"
						value={(overview?.totalUsers ?? totalPlayers).toString()}
					/>
					<StatCard label="Live contests" value={liveContests.toString()} />
					<StatCard
						label="Wallet liability"
						value={overview ? formatINR(overview.walletLiability) : '—'}
					/>
					<StatCard
						label="Pending payouts"
						value={pendingWithdrawals.length.toString()}
						hint={pendingWithdrawals.length
							? `${formatINR(pendingWithdrawalAmount)} awaiting review`
							: undefined}
						hintColor="var(--color-warning)"
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
							centerValue={withdrawals.length.toString()}
							centerLabel="requests"
						/>
					</div>
				</div>
			{:else if activeSection === 'contests'}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard label="Active contests" value={activeGameEvents.length.toString()} />
					<StatCard label="Entry fees locked" value={formatINR(contestsEntryFeesLocked)} />
					<StatCard label="Players competing" value={contestsPlayersCompeting.toLocaleString()} />
					<StatCard
						label="Payouts pending"
						value={formatINR(pendingWithdrawalAmount)}
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

				{#if gameEventsError}
					<p
						class="mb-4 rounded-lg px-3 py-2 text-sm"
						style="background-color: var(--color-error-bg); color: var(--color-error);"
					>
						{gameEventsError}
					</p>
				{/if}

				<div class="space-y-3">
					{#each filteredGameEvents as event (event.id)}
						{@const tiers = tiersFor(event.id)}
						{@const players = tiers.reduce((s, t) => s + t.entriesCount, 0)}
						{@const sessions = sessionsByEvent[event.id] ?? []}
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
										{formatEventDate(event.eventDate)} · Entry {formatTime(
											event.entryOpensAt
										)}–{formatTime(event.entryClosesAt)} · Play
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
															{#if tiersErrorByEvent[event.id]}
																<td colspan="5" class="px-3 py-4 text-center text-sm">
																	<span class="text-error">Couldn't load tiers.</span>
																	<button
																		type="button"
																		class="ml-1 font-medium text-primary underline"
																		onclick={() => loadTiersFor(event.id)}
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
										{#if sessionsLoadingFor[event.id]}
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
																<td class="px-3 py-2 font-medium text-ink"
																	>{session.sessionLabel}</td
																>
																<td class="px-3 py-2 text-ink-soft capitalize"
																	>{session.sessionType}</td
																>
																<td class="px-3 py-2 text-ink-soft tabular-nums"
																	>{session.rankStart}–{session.rankEnd}</td
																>
																<td class="px-3 py-2 text-ink-soft tabular-nums"
																	>{session.entriesCount}</td
																>
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
							{gameEventsLoading ? 'Loading contests…' : 'No contests match your search.'}
						</div>
					{/each}
				</div>
			{:else if activeSection === 'questions'}
				{#if !canSeeQuestions}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						You don't have access to the question bank.
					</div>
				{:else}
					<div class="mb-4 flex flex-wrap items-end gap-3">
						<label class="block">
							<span class="mb-1.5 block text-sm font-medium text-ink-soft">Contest</span>
							<select
								value={questionEventId}
								onchange={(e) => selectQuestionEvent(e.currentTarget.value)}
								class="w-56 rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
							>
								<option value="">Select a contest…</option>
								{#each gameEvents as event (event.id)}
									<option value={event.id}>{event.name} — {formatEventDate(event.eventDate)}</option
									>
								{/each}
							</select>
						</label>

						<label class="block">
							<span class="mb-1.5 block text-sm font-medium text-ink-soft">Session</span>
							<select
								value={questionSessionId}
								disabled={!questionEventId}
								onchange={(e) => selectQuestionSession(e.currentTarget.value)}
								class="w-56 rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none disabled:opacity-50"
							>
								<option value="">Select a session…</option>
								{#each questionEventSessions as session (session.id)}
									<option value={session.id}
										>{session.sessionLabel} ({session.entriesCount} players)</option
									>
								{/each}
							</select>
						</label>

						{#if questionSessionId}
							<button
								class="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white"
								style="background-color: var(--color-primary);"
								onclick={openAddQuestion}
							>
								+ New question
							</button>
						{/if}
					</div>

					{#if !questionEventId}
						<div
							class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
						>
							Pick a contest to see its sessions.
						</div>
					{:else if sessionsLoadingFor[questionEventId]}
						<div
							class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
						>
							Loading sessions…
						</div>
					{:else if questionEventSessions.length === 0}
						<div
							class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
						>
							This contest has no sessions yet — sessions are formed once the entry window closes.
						</div>
					{:else if !questionSessionId}
						<div
							class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
						>
							Pick a session to view or author its questions.
						</div>
					{:else}
						{#if sessionQuestionsError}
							<p
								class="mb-4 rounded-lg px-3 py-2 text-sm"
								style="background-color: var(--color-error-bg); color: var(--color-error);"
							>
								{sessionQuestionsError}
							</p>
						{/if}
						<div class="overflow-x-auto rounded-card border border-line bg-surface">
							<table class="w-full text-left text-sm">
								<thead>
									<tr class="border-b border-line text-xs text-ink-soft uppercase">
										<th class="px-4 py-3 font-medium">#</th>
										<th class="px-4 py-3 font-medium">Question</th>
										<th class="px-4 py-3 font-medium">Options</th>
										<th class="px-4 py-3 font-medium">Status</th>
									</tr>
								</thead>
								<tbody>
									{#each sessionQuestions as question (question.id)}
										<tr class="border-b border-line align-top last:border-0">
											<td class="px-4 py-3 text-ink-soft tabular-nums">{question.sequenceNo}</td>
											<td class="max-w-md px-4 py-3 font-medium text-ink"
												>{question.questionText}</td
											>
											<td class="px-4 py-3 text-ink-soft">
												{#each question.options as option (option)}
													<p class:font-semibold={option === question.correctOption}>
														{option === question.correctOption ? '✓ ' : ''}{option}
													</p>
												{/each}
											</td>
											<td class="px-4 py-3">
												{#if question.isAiGenerated}
													<Chip
														label="AI-generated"
														color="var(--color-info)"
														bg="var(--color-info-bg)"
													/>
												{:else}
													<Chip
														label="Admin-authored"
														color="var(--color-success)"
														bg="var(--color-success-bg)"
													/>
												{/if}
											</td>
										</tr>
									{:else}
										<tr>
											<td colspan="4" class="px-4 py-8 text-center text-sm text-ink-soft">
												{sessionQuestionsLoading
													? 'Loading questions…'
													: 'No questions authored for this session yet.'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			{:else if activeSection === 'players'}
				<div class="mb-4 flex items-center gap-3">
					<input
						type="search"
						bind:value={playerQuery}
						placeholder="Search players…"
						class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
					{#if playersLoading}
						<span class="text-xs text-ink-soft">Loading…</span>
					{/if}
				</div>

				{#if playersError}
					<p
						class="mb-4 rounded-lg px-3 py-2 text-sm"
						style="background-color: var(--color-error-bg); color: var(--color-error);"
					>
						{playersError}
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
							{#each filteredPlayers as player (player.id)}
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
											<Chip
												label="Active"
												color="var(--color-success)"
												bg="var(--color-success-bg)"
											/>
										{:else}
											<Chip
												label="Suspended"
												color="var(--color-error)"
												bg="var(--color-error-bg)"
											/>
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
										{playersLoading ? 'Loading players…' : 'No players match your search.'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if activeSection === 'payouts'}
				{#if !canSeePayouts}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						You don't have access to payouts.
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<StatCard label="Pending amount" value={formatINR(pendingWithdrawalAmount)} />
						<StatCard label="Pending requests" value={pendingWithdrawals.length.toString()} />
						<StatCard label="Paid out" value={formatINR(paidOutAmount)} />
						<StatCard label="Failed / rejected" value={failedOrRejectedCount.toString()} />
					</div>

					<div class="mt-5 mb-4 flex flex-wrap items-center gap-3">
						<input
							type="search"
							bind:value={payoutQuery}
							placeholder="Search by player or phone…"
							class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
						/>
						<PillTabs options={payoutFilterOptions} bind:value={payoutFilter} />
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
								{#each filteredWithdrawals as payout (payout.id)}
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
											{withdrawalsLoading
												? 'Loading payouts…'
												: 'No payout requests match your search.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:else if activeSection === 'tickets'}
				{#if !canSeeTickets}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						You don't have access to support tickets.
					</div>
				{:else}
					<div class="mb-4 flex flex-wrap items-center gap-3">
						<input
							type="search"
							bind:value={ticketQuery}
							placeholder="Search by subject or player…"
							class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
						/>
						<PillTabs options={ticketFilterOptions} bind:value={ticketFilter} />
					</div>

					{#if ticketsError}
						<p
							class="mb-4 rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-error-bg); color: var(--color-error);"
						>
							{ticketsError}
						</p>
					{/if}

					<div class="overflow-x-auto rounded-card border border-line bg-surface">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-b border-line text-xs text-ink-soft uppercase">
									<th class="px-4 py-3 font-medium">Player</th>
									<th class="px-4 py-3 font-medium">Subject</th>
									<th class="px-4 py-3 font-medium">Category</th>
									<th class="px-4 py-3 font-medium">Priority</th>
									<th class="px-4 py-3 font-medium">Status</th>
									<th class="px-4 py-3 font-medium">Updated</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredTickets as ticket (ticket.id)}
									<tr
										class="cursor-pointer border-b border-line last:border-0 hover:bg-field"
										onclick={() => openTicket(ticket.id)}
									>
										<td class="px-4 py-3 font-medium text-ink">{playerNameFor(ticket.userId)}</td>
										<td class="px-4 py-3 text-ink">{ticket.subject}</td>
										<td class="px-4 py-3 text-ink-soft"
											>{TICKET_CATEGORY_LABELS[ticket.category]}</td
										>
										<td class="px-4 py-3">
											<Chip
												label={TICKET_PRIORITY_INFO[ticket.priority].label}
												color={TICKET_PRIORITY_INFO[ticket.priority].color}
												bg={TICKET_PRIORITY_INFO[ticket.priority].bg}
											/>
										</td>
										<td class="px-4 py-3">
											<Chip
												label={TICKET_STATUS_INFO[ticket.status].label}
												color={TICKET_STATUS_INFO[ticket.status].color}
												bg={TICKET_STATUS_INFO[ticket.status].bg}
											/>
										</td>
										<td class="px-4 py-3 text-ink-soft">{formatDateLabel(ticket.updatedAt)}</td>
									</tr>
								{:else}
									<tr>
										<td colspan="6" class="px-4 py-8 text-center text-sm text-ink-soft">
											{ticketsLoading ? 'Loading tickets…' : 'No tickets match your search.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:else if activeSection === 'disputes'}
				{#if !canSeeDisputes}
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
						<PillTabs options={disputeFilterOptions} bind:value={disputeFilter} />
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
								{#each filteredDisputes as dispute (dispute.id)}
									<tr
										class="cursor-pointer border-b border-line last:border-0 hover:bg-field"
										onclick={() => openDispute(dispute.id)}
									>
										<td class="px-4 py-3 font-medium text-ink">{playerNameFor(dispute.userId)}</td>
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
				{/if}
			{:else if activeSection === 'session-monitor'}
				{#if !canSeeSessionMonitor}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						You don't have access to the session monitor.
					</div>
				{:else}
					<div class="mb-4 flex flex-wrap items-end gap-3">
						<label class="block">
							<span class="mb-1.5 block text-sm font-medium text-ink-soft">Contest</span>
							<select
								value={monitorEventId}
								onchange={(e) => selectMonitorEvent(e.currentTarget.value)}
								class="w-56 rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
							>
								<option value="">Select a contest…</option>
								{#each gameEvents as event (event.id)}
									<option value={event.id}>{event.name} — {formatEventDate(event.eventDate)}</option
									>
								{/each}
							</select>
						</label>

						<label class="block">
							<span class="mb-1.5 block text-sm font-medium text-ink-soft">Session</span>
							<select
								value={monitorSessionId}
								disabled={!monitorEventId}
								onchange={(e) => selectMonitorSession(e.currentTarget.value)}
								class="w-56 rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none disabled:opacity-50"
							>
								<option value="">Select a session…</option>
								{#each monitorEventSessions as session (session.id)}
									<option value={session.id}>{session.sessionLabel}</option>
								{/each}
							</select>
						</label>
					</div>

					{#if !monitorEventId}
						<div
							class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
						>
							Pick a contest to see its sessions.
						</div>
					{:else if sessionsLoadingFor[monitorEventId]}
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
								<StatCard label="Rank range" value={`${ms.rankStart}\u2013${ms.rankEnd}`} />
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
												<td class="px-4 py-3 font-medium text-ink tabular-nums"
													>#{result.finalRank}</td
												>
												<td class="px-4 py-3 text-ink-soft tabular-nums">{result.totalPoints}</td>
												<td class="px-4 py-3 text-ink tabular-nums"
													>{formatINR(result.prizePaise / 100)}</td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{/if}
				{/if}
			{:else if activeSection === 'kyc'}
				{#if !canSeeKyc}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						You don't have access to KYC verification.
					</div>
				{:else}
					{#if kycError}
						<p
							class="mb-4 rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-error-bg); color: var(--color-error);"
						>
							{kycError}
						</p>
					{/if}

					<div class="mb-4">
						<PillTabs options={kycFilterOptions} bind:value={kycStatusFilter} />
					</div>

					<div class="overflow-x-auto rounded-card border border-line bg-surface">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-b border-line text-xs text-ink-soft uppercase">
									<th class="px-4 py-3 font-medium">Player</th>
									<th class="px-4 py-3 font-medium">Document</th>
									<th class="px-4 py-3 font-medium">Status</th>
									<th class="px-4 py-3 font-medium">Submitted</th>
									<th class="px-4 py-3 font-medium"></th>
								</tr>
							</thead>
							<tbody>
								{#each filteredKycDocuments as doc (doc.id)}
									<tr class="border-b border-line align-top last:border-0">
										<td class="px-4 py-3 font-medium text-ink">{doc.playerName}</td>
										<td class="px-4 py-3 text-ink-soft">
											<p class="uppercase">{doc.docType}</p>
											<p class="text-xs text-ink-faint">{doc.docNumberMasked}</p>
										</td>
										<td class="px-4 py-3">
											<Chip
												label={KYC_STATUS_INFO[doc.status].label}
												color={KYC_STATUS_INFO[doc.status].color}
												bg={KYC_STATUS_INFO[doc.status].bg}
											/>
											{#if doc.rejectionReason}
												<p class="mt-1 max-w-48 text-xs text-ink-faint">{doc.rejectionReason}</p>
											{/if}
											{#if kycActionError[doc.id]}
												<p class="mt-1 max-w-48 text-xs" style="color: var(--color-error);">
													{kycActionError[doc.id]}
												</p>
											{/if}
										</td>
										<td class="px-4 py-3 text-ink-soft">{formatDateLabel(doc.createdAt)}</td>
										<td class="px-4 py-3 text-right">
											{#if doc.status === 'pending'}
												<div class="flex justify-end gap-2">
													<button
														class="rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
														style="background-color: var(--color-primary);"
														disabled={kycActionBusy === doc.id}
														onclick={() => verifyKycAction(doc.id)}
													>
														{kycActionBusy === doc.id ? '…' : 'Verify'}
													</button>
													<button
														class="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-error"
														onclick={() => openRejectKyc(doc.id)}
													>
														Reject
													</button>
												</div>
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="5" class="px-4 py-8 text-center text-sm text-ink-soft">
											{kycLoading ? 'Loading…' : 'No documents in this state.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:else if activeSection === 'reports'}
				{#if !canSeeReports}
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
							<StatCard
								label="Expected wallet balance"
								value={formatINR(r.expectedWalletBalance)}
							/>
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
									style={r.reconciled
										? 'color: var(--color-success);'
										: 'color: var(--color-error);'}
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
								<input
									type="date"
									bind:value={exportFrom}
									class="rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
								/>
							</label>
							<label class="block">
								<span class="mb-1.5 block text-sm font-medium text-ink-soft">To</span>
								<input
									type="date"
									bind:value={exportTo}
									class="rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
								/>
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
			{:else if activeSection === 'audit-log'}
				{#if !canSeeAuditLog}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						You don't have access to the audit log.
					</div>
				{:else}
					{#if auditLogsError}
						<p
							class="mb-4 rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-error-bg); color: var(--color-error);"
						>
							{auditLogsError}
						</p>
					{/if}

					<div class="overflow-x-auto rounded-card border border-line bg-surface">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-b border-line text-xs text-ink-soft uppercase">
									<th class="px-4 py-3 font-medium">Action</th>
									<th class="px-4 py-3 font-medium">Entity</th>
									<th class="px-4 py-3 font-medium">Actor</th>
									<th class="px-4 py-3 font-medium">IP</th>
									<th class="px-4 py-3 font-medium">When</th>
								</tr>
							</thead>
							<tbody>
								{#each auditLogs as entry (entry.id)}
									<tr class="border-b border-line last:border-0">
										<td class="px-4 py-3 font-medium text-ink">{entry.action}</td>
										<td class="px-4 py-3 text-ink-soft">
											{entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ''}
										</td>
										<td class="px-4 py-3 text-ink-soft">
											{entry.actorType}{entry.actorId ? ` · ${entry.actorId.slice(0, 8)}` : ''}
										</td>
										<td class="px-4 py-3 text-ink-soft">{entry.ipAddress ?? '—'}</td>
										<td class="px-4 py-3 text-ink-soft">{formatDateLabel(entry.createdAt)}</td>
									</tr>
								{:else}
									<tr>
										<td colspan="5" class="px-4 py-8 text-center text-sm text-ink-soft">
											{auditLogsLoading ? 'Loading…' : 'No audit log entries.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="mt-3 flex items-center justify-between">
						<button
							class="text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-40"
							disabled={auditLogOffset === 0}
							onclick={prevAuditLogPage}
						>
							Previous
						</button>
						<span class="text-xs text-ink-faint">
							Showing {auditLogOffset + 1}–{auditLogOffset + auditLogs.length}
						</span>
						<button
							class="text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-40"
							disabled={auditLogs.length < auditLogPageSize}
							onclick={nextAuditLogPage}
						>
							Next
						</button>
					</div>
				{/if}
			{:else if activeSection === 'admin-roles'}
				{#if !isSuperAdmin}
					<div
						class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
					>
						Only super admins can manage admin roles.
					</div>
				{:else}
					{#if rbacError}
						<p
							class="mb-4 rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-error-bg); color: var(--color-error);"
						>
							{rbacError}
						</p>
					{/if}

					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-sm font-semibold text-ink">Admin accounts</h2>
						<button
							class="rounded-xl px-4 py-2 text-sm font-semibold text-white"
							style="background-color: var(--color-primary);"
							onclick={openAddAdmin}
						>
							+ New admin
						</button>
					</div>

					<div class="overflow-x-auto rounded-card border border-line bg-surface">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-b border-line text-xs text-ink-soft uppercase">
									<th class="px-4 py-3 font-medium">Email</th>
									<th class="px-4 py-3 font-medium">Role</th>
									<th class="px-4 py-3 font-medium">Status</th>
									<th class="px-4 py-3 font-medium">Last login</th>
									<th class="px-4 py-3 font-medium"></th>
								</tr>
							</thead>
							<tbody>
								{#each adminUsers as admin (admin.id)}
									{@const isSelf = admin.id === account?.id}
									<tr class="border-b border-line align-top last:border-0">
										<td class="px-4 py-3 font-medium text-ink">{admin.email}</td>
										<td class="px-4 py-3">
											<select
												value={admin.role}
												disabled={isSelf || adminActionBusy === admin.id}
												onchange={(e) => changeAdminRole(admin, e.currentTarget.value as AdminRole)}
												class="rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none disabled:opacity-50"
											>
												{#each adminRoleOrder as role (role)}
													<option value={role}>{ADMIN_ROLE_INFO[role].label}</option>
												{/each}
											</select>
										</td>
										<td class="px-4 py-3">
											{#if admin.isActive}
												<Chip
													label="Active"
													color="var(--color-success)"
													bg="var(--color-success-bg)"
												/>
											{:else}
												<Chip
													label="Deactivated"
													color="var(--color-error)"
													bg="var(--color-error-bg)"
												/>
											{/if}
											{#if adminActionError[admin.id]}
												<p class="mt-1 max-w-48 text-xs" style="color: var(--color-error);">
													{adminActionError[admin.id]}
												</p>
											{/if}
										</td>
										<td class="px-4 py-3 text-ink-soft">
											{admin.lastLoginAt ? formatDateLabel(admin.lastLoginAt) : 'Never'}
										</td>
										<td class="px-4 py-3 text-right">
											{#if isSelf}
												<span class="text-xs text-ink-faint">You</span>
											{:else if admin.isActive}
												<button
													class="text-xs font-medium text-ink-soft hover:text-error"
													disabled={adminActionBusy === admin.id}
													onclick={() => toggleAdminActive(admin)}
												>
													Deactivate
												</button>
											{:else}
												<button
													class="text-xs font-medium text-ink-soft hover:text-ink"
													disabled={adminActionBusy === admin.id}
													onclick={() => toggleAdminActive(admin)}
												>
													Activate
												</button>
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="5" class="px-4 py-8 text-center text-sm text-ink-soft">
											{rbacLoading ? 'Loading…' : 'No admin accounts yet.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<h2 class="mt-6 mb-4 text-sm font-semibold text-ink">Role permissions</h2>
					<div class="overflow-x-auto rounded-card border border-line bg-surface">
						<table class="w-full text-left text-sm">
							<thead>
								<tr class="border-b border-line text-xs text-ink-soft uppercase">
									<th class="px-4 py-3 font-medium">Permission</th>
									{#each adminRoleOrder as role (role)}
										<th class="px-4 py-3 text-center font-medium">{ADMIN_ROLE_INFO[role].label}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each permissions as permission (permission.key)}
									<tr class="border-b border-line last:border-0">
										<td class="px-4 py-3">
											<p class="font-medium text-ink">{permission.key}</p>
											<p class="text-xs text-ink-soft">{permission.description}</p>
										</td>
										{#each adminRoleOrder as role (role)}
											<td class="px-4 py-3 text-center">
												<input
													type="checkbox"
													checked={hasPermission(role, permission.key)}
													disabled={permissionBusyKey === `${role}:${permission.key}`}
													onchange={() => togglePermission(role, permission.key)}
													class="h-4 w-4 accent-primary"
												/>
											</td>
										{/each}
									</tr>
								{:else}
									<tr>
										<td colspan="4" class="px-4 py-8 text-center text-sm text-ink-soft">
											{rbacLoading ? 'Loading…' : 'No permissions found.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:else}
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div class="rounded-card border border-line bg-surface p-5">
						<h2 class="mb-4 text-sm font-semibold text-ink">Account</h2>
						{#if accountLoading}
							<p class="py-4 text-center text-sm text-ink-soft">Loading…</p>
						{:else if accountError}
							<p
								class="rounded-lg px-3 py-2 text-sm"
								style="background-color: var(--color-error-bg); color: var(--color-error);"
							>
								{accountError}
							</p>
						{:else if account}
							<div class="divide-y divide-line">
								<div class="flex items-center justify-between gap-4 py-3 first:pt-0">
									<span class="text-sm text-ink-soft">Email</span>
									<span class="text-sm font-medium text-ink">{account.email}</span>
								</div>
								<div class="flex items-center justify-between gap-4 py-3">
									<span class="text-sm text-ink-soft">Role</span>
									<span class="text-sm font-medium text-ink capitalize">{account.role}</span>
								</div>
								<div class="flex items-center justify-between gap-4 py-3">
									<span class="text-sm text-ink-soft">Two-factor auth</span>
									{#if account.mfaEnrolled}
										<Chip
											label="Enrolled"
											color="var(--color-success)"
											bg="var(--color-success-bg)"
										/>
									{:else}
										<Chip
											label="Not enrolled"
											color="var(--color-warning)"
											bg="var(--color-warning-bg)"
										/>
									{/if}
								</div>
								<div class="flex items-center justify-between gap-4 py-3 last:pb-0">
									<span class="text-sm text-ink-soft">Status</span>
									{#if account.isActive}
										<Chip
											label="Active"
											color="var(--color-success)"
											bg="var(--color-success-bg)"
										/>
									{:else}
										<Chip label="Disabled" color="var(--color-error)" bg="var(--color-error-bg)" />
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<div class="rounded-card border border-line bg-surface p-5">
						<h2 class="mb-1 text-sm font-semibold text-ink">Platform configuration</h2>
						<p class="text-sm text-ink-soft">
							App name, support contact details and per-admin notification preferences aren't
							backend-supported yet — there's no settings table to persist them to. This section
							will return once that's built.
						</p>
					</div>

					{#if canBroadcast}
						<div class="rounded-card border border-line bg-surface p-5 lg:col-span-2">
							<h2 class="mb-1 text-sm font-semibold text-ink">Broadcast notification</h2>
							<p class="mb-4 text-xs text-ink-soft">
								Sends one notification to every active player, right now — there's no scheduling or
								undo.
							</p>
							<form class="space-y-3" onsubmit={sendBroadcast}>
								<input
									required
									bind:value={broadcastTitle}
									placeholder="Title"
									class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
								/>
								<textarea
									required
									bind:value={broadcastBody}
									rows="3"
									placeholder="Message"
									class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
								></textarea>
								{#if broadcastError}
									<p class="text-sm" style="color: var(--color-error);">{broadcastError}</p>
								{/if}
								{#if broadcastSentCount !== null}
									<p class="text-sm" style="color: var(--color-success);">
										Sent to {broadcastSentCount} player{broadcastSentCount === 1 ? '' : 's'}.
									</p>
								{/if}
								<button
									type="submit"
									disabled={broadcastSending}
									class="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
									style="background-color: var(--color-primary);"
								>
									{broadcastSending ? 'Sending…' : 'Send broadcast'}
								</button>
							</form>
						</div>
					{/if}
				</div>
			{/if}
		</main>
	</div>
{/if}

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
				<input
					required
					type="date"
					bind:value={newEventDate}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry opens</span>
					<input
						required
						type="datetime-local"
						bind:value={newEntryOpensAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry closes</span>
					<input
						required
						type="datetime-local"
						bind:value={newEntryClosesAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play starts</span>
					<input
						required
						type="datetime-local"
						bind:value={newGameStartsAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play ends</span>
					<input
						required
						type="datetime-local"
						bind:value={newGameEndsAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
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
					<input
						required
						type="datetime-local"
						bind:value={editEntryOpensAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Entry closes</span>
					<input
						required
						type="datetime-local"
						bind:value={editEntryClosesAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play starts</span>
					<input
						required
						type="datetime-local"
						bind:value={editGameStartsAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="mb-1.5 block text-sm font-medium text-ink-soft">Play ends</span>
					<input
						required
						type="datetime-local"
						bind:value={editGameEndsAt}
						class="w-full rounded-xl border border-line bg-field px-3 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
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

{#if showAddAdmin}
	<Modal title="New admin" onClose={() => (showAddAdmin = false)}>
		<form class="space-y-4" onsubmit={submitAddAdmin}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Email</span>
				<input
					required
					type="email"
					bind:value={newAdminEmail}
					placeholder="admin@example.com"
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Password</span>
				<input
					required
					type="password"
					minlength="6"
					bind:value={newAdminPassword}
					placeholder="At least 6 characters"
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Role</span>
				<select
					bind:value={newAdminRole}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				>
					{#each adminRoleOrder as role (role)}
						<option value={role}>{ADMIN_ROLE_INFO[role].label}</option>
					{/each}
				</select>
			</label>

			{#if addAdminError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{addAdminError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={addAdminSaving}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{addAdminSaving ? 'Creating…' : 'Create admin'}
			</button>
		</form>
	</Modal>
{/if}

{#if showAddQuestion}
	<Modal title="Add question" onClose={() => (showAddQuestion = false)}>
		<form class="space-y-4" onsubmit={submitAddQuestion}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Sequence no.</span>
				<input
					required
					type="number"
					min="1"
					bind:value={newSequenceNo}
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Question</span>
				<textarea
					required
					bind:value={newQuestionText}
					rows="2"
					placeholder="Question text"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>

			<div class="space-y-2">
				<span class="block text-sm font-medium text-ink-soft">Options — select the correct one</span
				>
				{#each [0, 1, 2, 3] as i (i)}
					<label class="flex items-center gap-2.5">
						<input
							type="radio"
							name="correct-option"
							checked={newCorrectIndex === i}
							onchange={() => (newCorrectIndex = i)}
							class="accent-primary"
						/>
						<input
							required
							bind:value={newOptions[i]}
							placeholder={`Option ${i + 1}`}
							class="w-full rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
						/>
					</label>
				{/each}
			</div>

			{#if addQuestionError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{addQuestionError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={addQuestionSaving}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-primary);"
			>
				{addQuestionSaving ? 'Adding…' : 'Add question'}
			</button>
		</form>
	</Modal>
{/if}

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

{#if viewingTicketId}
	<Modal title={viewingTicket?.subject ?? 'Ticket'} onClose={closeTicketModal}>
		{#if ticketDetailLoading}
			<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
		{:else if viewingTicket}
			{@const t = viewingTicket}
			{@const isOpenForAction = t.status !== 'resolved' && t.status !== 'closed'}
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<Chip
					label={TICKET_STATUS_INFO[t.status].label}
					color={TICKET_STATUS_INFO[t.status].color}
					bg={TICKET_STATUS_INFO[t.status].bg}
				/>
				<Chip
					label={TICKET_PRIORITY_INFO[t.priority].label}
					color={TICKET_PRIORITY_INFO[t.priority].color}
					bg={TICKET_PRIORITY_INFO[t.priority].bg}
				/>
				<span class="text-xs text-ink-soft">{TICKET_CATEGORY_LABELS[t.category]}</span>
				<span class="text-xs text-ink-faint">· {playerNameFor(t.userId)}</span>
			</div>

			{#if ticketActionError}
				<p
					class="mb-4 rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{ticketActionError}
				</p>
			{/if}

			<div class="mb-4 flex flex-wrap gap-2">
				{#if !t.assignedTo && isOpenForAction}
					<button
						class="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
						style="background-color: var(--color-primary);"
						disabled={ticketActionBusy}
						onclick={assignTicketAction}
					>
						Assign to me
					</button>
				{/if}
				{#if isOpenForAction}
					<button
						class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
						disabled={ticketActionBusy}
						onclick={resolveTicketAction}
					>
						Resolve
					</button>
				{/if}
				{#if t.status !== 'closed'}
					<button
						class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-error"
						disabled={ticketActionBusy}
						onclick={closeTicketAction}
					>
						Close
					</button>
				{/if}
			</div>

			<div class="max-h-80 space-y-3 overflow-y-auto border-t border-line pt-4">
				{#each ticketMessages as msg (msg.id)}
					{@const isAdmin = msg.senderType === 'admin'}
					<div class="flex flex-col" class:items-end={isAdmin}>
						<span class="mb-1 text-xs text-ink-faint">
							{msg.senderType === 'user'
								? playerNameFor(t.userId)
								: msg.senderType === 'admin'
									? 'Support'
									: 'System'}
							· {formatDateLabel(msg.createdAt)}
						</span>
						<p
							class="max-w-[80%] rounded-xl px-3 py-2 text-sm"
							style={isAdmin
								? 'background-color: var(--color-primary); color: white;'
								: 'background-color: var(--color-field); color: var(--color-ink);'}
						>
							{msg.messageText}
						</p>
					</div>
				{:else}
					<p class="py-4 text-center text-sm text-ink-soft">No messages yet.</p>
				{/each}
			</div>

			{#if t.status !== 'closed'}
				<form class="mt-4 flex items-center gap-2 border-t border-line pt-4" onsubmit={sendReply}>
					<input
						required
						bind:value={replyText}
						placeholder="Type a reply…"
						class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
					<button
						type="submit"
						disabled={ticketActionBusy}
						class="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
						style="background-color: var(--color-primary);"
					>
						Send
					</button>
				</form>
			{:else}
				<p class="mt-4 border-t border-line pt-4 text-center text-sm text-ink-soft">
					This ticket is closed.
				</p>
			{/if}
		{/if}
	</Modal>
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
				<span class="text-xs text-ink-faint">· {playerNameFor(d.userId)}</span>
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

{#if rejectingKycId}
	<Modal title="Reject KYC document" onClose={() => (rejectingKycId = null)}>
		<form class="space-y-4" onsubmit={confirmRejectKyc}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Reason</span>
				<textarea
					required
					bind:value={kycRejectReason}
					rows="3"
					placeholder="e.g. Document image is illegible"
					class="w-full resize-none rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				></textarea>
			</label>
			{#if kycRejectError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{kycRejectError}
				</p>
			{/if}
			<button
				type="submit"
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white"
				style="background-color: var(--color-error);"
			>
				Reject document
			</button>
		</form>
	</Modal>
{/if}
