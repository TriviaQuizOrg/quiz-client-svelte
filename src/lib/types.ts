// game_events.status is only ever written as 'scheduled' (default), 'entry_closed' (once
// FormSessions runs), or 'cancelled' (admin action) — 'entry_open'/'live'/'completed' exist
// in the DB enum but nothing in quiz-server sets them today. GameEventPhase is the same six
// values, but as a client-derived, always-current label: see deriveGameEventPhase() in
// services/gameEvents.ts, which trusts the raw status only for 'cancelled' and otherwise
// computes phase from the window timestamps against the current time.
export type GameEventPhase =
	'scheduled' | 'entry_open' | 'entry_closed' | 'live' | 'completed' | 'cancelled';

export const PHASE_INFO: Record<GameEventPhase, { label: string; color: string; bg: string }> = {
	scheduled: { label: 'Scheduled', color: 'var(--color-ink-soft)', bg: 'var(--color-field)' },
	entry_open: { label: 'Entry open', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	entry_closed: {
		label: 'Waiting room',
		color: 'var(--color-warning)',
		bg: 'var(--color-warning-bg)'
	},
	live: { label: 'Live', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	completed: { label: 'Completed', color: 'var(--color-ink-soft)', bg: 'var(--color-line)' },
	cancelled: { label: 'Cancelled', color: 'var(--color-error)', bg: 'var(--color-error-bg)' }
};

export interface GameEvent {
	id: string;
	name: string;
	eventDate: string; // ISO date, e.g. "2026-08-25"
	entryOpensAt: string;
	entryClosesAt: string;
	gameStartsAt: string;
	gameEndsAt: string;
	phase: GameEventPhase; // derived — see PHASE_INFO comment above
	cancelledReason: string | null;
}

export interface Tier {
	id: string;
	gameEventId: string;
	entryFeePaise: number;
	entryFee: number; // rupees
	prizeSplit: Record<string, number>; // percentages, sums to 100
	maxPlayers: number | null;
	entriesCount: number;
	// No dedicated commission ledger entry exists — platform earnings on this tier is
	// entryFees - prizesPaid, derived here rather than sent as its own field.
	entryFees: number; // rupees, collected from joins so far
	prizesPaid: number; // rupees, paid out by settlement so far (0 until settled)
}

export type SessionType = 'elite' | 'standard';

export interface GameSession {
	id: string;
	gameEventId: string;
	tierId: string;
	sessionType: SessionType;
	sessionLabel: string;
	rankStart: number;
	rankEnd: number;
	entriesCount: number;
	settled: boolean;
}

export interface SessionResult {
	id: string;
	sessionId: string;
	entryId: string;
	finalRank: number;
	totalPoints: number;
	prizePaise: number;
	settledAt: string | null;
}

// Questions belong to a single game_session (created only after that session exists,
// i.e. after entry closes and FormSessions has run) — there's no reusable "question
// bank", category, or difficulty column in the schema. questions doubles as an
// append-only audit log (see 00008_questions.sql), so there's no edit/delete API either.
export interface SessionQuestion {
	id: string;
	gameEventId: string;
	sessionId: string | null;
	sequenceNo: number;
	questionText: string;
	options: string[];
	correctOption: string;
	isAiGenerated: boolean;
	approvedAt: string | null;
}

export type UserStatus = 'active' | 'suspended';

export interface AdminManagedUser {
	id: string;
	name: string; // full_name if set, otherwise falls back to the phone number
	phoneNumber: string; // players authenticate by phone/OTP — there's no email on this side
	kycStatus: string;
	walletBalance: number; // rupees
	contestsPlayed: number;
	status: UserStatus;
	joinedLabel: string;
}

// Real withdrawal lifecycle (00011_withdrawals.sql): pending -> approved -> success,
// pending -> approved -> failed, or pending -> rejected. 'processing' exists in the DB
// enum but nothing in quiz-server writes it today — the actual UPI payout is a manual
// admin action (mark processed / mark failed) standing in for a payment-aggregator
// webhook that isn't integrated yet.
export type WithdrawalStatus =
	'pending' | 'approved' | 'rejected' | 'processing' | 'success' | 'failed';

export const WITHDRAWAL_STATUS_INFO: Record<
	WithdrawalStatus,
	{ label: string; color: string; bg: string }
> = {
	pending: { label: 'Pending', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	approved: { label: 'Approved', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	rejected: { label: 'Rejected', color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
	processing: {
		label: 'Processing',
		color: 'var(--color-warning)',
		bg: 'var(--color-warning-bg)'
	},
	success: { label: 'Paid out', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	failed: { label: 'Failed', color: 'var(--color-error)', bg: 'var(--color-error-bg)' }
};

export interface Withdrawal {
	id: string;
	userId: string;
	playerName: string; // full_name if set, otherwise falls back to the phone number
	playerPhone: string;
	amount: number; // rupees
	upiId: string;
	status: WithdrawalStatus;
	requestedAt: string;
	reviewedAt: string | null;
	processedAt: string | null;
	failureReason: string | null;
}

// Matches wallet_txn_type from the backend schema exactly (00004_wallet_transactions.sql)
// — 'won'/'entryFee'/'addedMoney' are gone, these are the real 5 values.
export type WalletTransactionType =
	'recharge' | 'entry_deduction' | 'prize_credit' | 'withdrawal' | 'refund';

export const TRANSACTION_TYPE_INFO: Record<
	WalletTransactionType,
	{ label: string; color: string; bg: string }
> = {
	prize_credit: {
		label: 'Contest winnings',
		color: 'var(--color-success)',
		bg: 'var(--color-success-bg)'
	},
	entry_deduction: { label: 'Entry fee', color: 'var(--color-ink-soft)', bg: 'var(--color-field)' },
	recharge: { label: 'Added money', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	withdrawal: { label: 'Withdrawal', color: 'var(--color-ink-soft)', bg: 'var(--color-field)' },
	refund: { label: 'Refund', color: 'var(--color-info)', bg: 'var(--color-info-bg)' }
};

export interface WalletTransaction {
	id: string;
	playerId: string;
	type: WalletTransactionType;
	status: 'pending' | 'success' | 'failed' | 'reversed';
	amount: number; // rupees, signed
	balanceAfter: number; // rupees
	referenceType: string | null; // e.g. "entry" / "session_result" / "withdrawal" — no human title exists backend-side
	dateLabel: string;
}

export interface AdminNotification {
	id: string;
	notificationType: string;
	title: string;
	body: string;
	/** e.g. the ticket id on a ticket_reply/ticket_assigned notification, for deep-linking. */
	ticketId: string | null;
	isRead: boolean;
	createdAt: string;
}

// GET /admin/dashboard — the platform's top-line "what does today look like" numbers.
export interface DashboardOverview {
	totalUsers: number;
	walletLiability: number; // rupees
	todaysGameEvents: GameEvent[];
	entryFeesToday: number; // rupees
	prizesPaidToday: number; // rupees
	withdrawalsPaidToday: number; // rupees
	// Neither figure has a dedicated ledger entry on the backend — both are derived as
	// entry fees collected minus prizes paid (see reports.Overview).
	platformEarningsToday: number; // rupees
	platformEarningsAllTime: number; // rupees
}

// Matches admin_role exactly (00014_admin_users.sql).
export type AdminRole = 'super_admin' | 'finance' | 'support_staff';

export const ADMIN_ROLE_INFO: Record<AdminRole, { label: string }> = {
	super_admin: { label: 'Super admin' },
	finance: { label: 'Finance' },
	support_staff: { label: 'Support staff' }
};

// GET /admin/me — the signed-in admin's own account, for the Settings screen.
export interface AdminAccount {
	id: string;
	email: string;
	role: AdminRole;
	isActive: boolean;
	mfaEnrolled: boolean;
}

// A row from GET /admin/rbac/admins — every provisioned admin account. Only visible to
// super_admin (see RequireSuperAdmin backend-side); the RBAC screen hides itself for
// anyone else.
export interface AdminUserSummary {
	id: string;
	email: string;
	role: AdminRole;
	isActive: boolean;
	mfaEnrolled: boolean;
	lastLoginAt: string | null;
	createdAt: string;
}

export interface Permission {
	key: string;
	description: string;
}

export type RolePermissionsMap = Record<AdminRole, string[]>;

// Matches support_tickets exactly (00019_support_tickets.sql).
export type TicketStatus =
	'open' | 'assigned' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
	'general' | 'payment' | 'gameplay_dispute' | 'kyc' | 'withdrawal' | 'other';
export type TicketSenderType = 'user' | 'admin' | 'system';

export const TICKET_STATUS_INFO: Record<
	TicketStatus,
	{ label: string; color: string; bg: string }
> = {
	open: { label: 'Open', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	assigned: { label: 'Assigned', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	in_progress: {
		label: 'In progress',
		color: 'var(--color-warning)',
		bg: 'var(--color-warning-bg)'
	},
	waiting_on_user: {
		label: 'Waiting on user',
		color: 'var(--color-ink-soft)',
		bg: 'var(--color-field)'
	},
	resolved: { label: 'Resolved', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	closed: { label: 'Closed', color: 'var(--color-ink-soft)', bg: 'var(--color-line)' }
};

export const TICKET_PRIORITY_INFO: Record<
	TicketPriority,
	{ label: string; color: string; bg: string }
> = {
	low: { label: 'Low', color: 'var(--color-ink-soft)', bg: 'var(--color-field)' },
	medium: { label: 'Medium', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	high: { label: 'High', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	urgent: { label: 'Urgent', color: 'var(--color-error)', bg: 'var(--color-error-bg)' }
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
	general: 'General',
	payment: 'Payment',
	gameplay_dispute: 'Gameplay dispute',
	kyc: 'KYC',
	withdrawal: 'Withdrawal',
	other: 'Other'
};

export interface SupportTicket {
	id: string;
	userId: string;
	playerName: string; // full_name if set, otherwise falls back to the phone number
	playerPhone: string;
	disputeId: string | null;
	category: TicketCategory;
	subject: string;
	status: TicketStatus;
	priority: TicketPriority;
	assignedTo: string | null; // admin_users.id
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
	closedAt: string | null;
}

export interface TicketMessage {
	id: string;
	ticketId: string;
	senderType: TicketSenderType;
	senderId: string | null;
	messageText: string;
	attachmentUrl: string | null;
	createdAt: string;
}

// --- Disputes ---
// Matches disputes exactly (00013_disputes.sql).
export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'rejected';

export const DISPUTE_STATUS_INFO: Record<
	DisputeStatus,
	{ label: string; color: string; bg: string }
> = {
	open: { label: 'Open', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	investigating: {
		label: 'Investigating',
		color: 'var(--color-warning)',
		bg: 'var(--color-warning-bg)'
	},
	resolved: { label: 'Resolved', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	rejected: { label: 'Rejected', color: 'var(--color-error)', bg: 'var(--color-error-bg)' }
};

export interface DisputeItem {
	id: string;
	userId: string;
	playerName: string; // '' when unavailable (see mapDispute) — falls back to a client lookup
	playerPhone: string;
	entryId: string | null;
	questionId: string | null;
	description: string;
	status: DisputeStatus;
	resolutionNotes: string | null;
	assignedTo: string | null;
	createdAt: string;
	resolvedAt: string | null;
}

// Server-authoritative timestamps/ranking pulled in for evidence — never the player's or
// the agent's recollection. Only present when the dispute links an entry/question.
export interface DisputeEvidenceEntry {
	id: string;
	serverReceivedAt: string;
	clientTapAt: string | null;
	speedRank: number | null;
	finalRank: number | null;
	status: string;
}

export interface DisputeEvidenceQuestion {
	id: string;
	sequenceNo: number;
	questionText: string;
	options: string[];
	correctOption: string;
}

export interface DisputeEvidenceAnswer {
	selectedOption: string | null;
	isCorrect: boolean | null;
	questionShownAt: string | null;
	answeredAt: string | null;
	responseTimeMs: number | null;
	pointsAwarded: number;
}

export interface DisputeEvidence {
	dispute: DisputeItem;
	entry: DisputeEvidenceEntry | null;
	question: DisputeEvidenceQuestion | null;
	userAnswer: DisputeEvidenceAnswer | null;
}

// --- KYC ---
// Matches kyc_documents exactly (00012_kyc_documents.sql).
export type KycDocStatus = 'pending' | 'verified' | 'rejected';

export const KYC_STATUS_INFO: Record<KycDocStatus, { label: string; color: string; bg: string }> = {
	pending: { label: 'Pending', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	verified: { label: 'Verified', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	rejected: { label: 'Rejected', color: 'var(--color-error)', bg: 'var(--color-error-bg)' }
};

export interface KycDocument {
	id: string;
	userId: string;
	playerName: string;
	playerPhone: string;
	docType: string;
	docNumberMasked: string;
	docFileUrl: string | null;
	status: KycDocStatus;
	verifiedAt: string | null;
	rejectionReason: string | null;
	createdAt: string;
}

// --- Reports ---
export interface Reconciliation {
	recharged: number; // rupees
	entryFeesCollected: number;
	prizesCredited: number;
	withdrawn: number;
	refunded: number;
	expectedWalletBalance: number;
	actualWalletBalance: number;
	reconciled: boolean;
}

// --- Audit logs ---
export interface AuditLogEntry {
	id: string;
	actorType: string;
	actorId: string | null;
	action: string;
	entityType: string;
	entityId: string | null;
	metadata: Record<string, unknown> | null;
	ipAddress: string | null;
	createdAt: string;
}
