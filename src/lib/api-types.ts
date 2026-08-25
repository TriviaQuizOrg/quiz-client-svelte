// Raw shapes as quiz-server actually returns them (snake_case JSON, sql.Null* wrapper
// objects — see api.ts for the unwrap helpers). Keep these separate from the UI-facing
// view models in types.ts; mapping functions colocated with each screen convert between
// the two.
import type { GoNullString, GoNullTime, GoNullInt, GoNullBool, GoNullRawMessage } from './api';

export interface ApiUser {
	id: string;
	firebase_uid: string;
	phone_number: string;
	full_name: GoNullString;
	kyc_status: string;
	is_blocked: boolean;
	blocked_reason: GoNullString;
	created_at: string;
	updated_at?: string;
	wallet_balance_paise?: number; // present on ListUsersWithStats rows only
	contests_played?: number; // present on ListUsersWithStats rows only
}

export type ApiWalletTxnType =
	'recharge' | 'entry_deduction' | 'prize_credit' | 'withdrawal' | 'refund';
export type ApiWalletTxnStatus = 'pending' | 'success' | 'failed' | 'reversed';

export interface ApiWalletTransaction {
	id: string;
	wallet_id: string;
	user_id: string;
	type: ApiWalletTxnType;
	status: ApiWalletTxnStatus;
	amount_paise: number; // signed: positive = credit, negative = debit
	balance_after_paise: number;
	reference_type: GoNullString;
	reference_id: string | null;
	gateway_txn_id: GoNullString;
	created_at: string;
}

export type ApiGameEventStatus =
	'scheduled' | 'entry_open' | 'entry_closed' | 'live' | 'completed' | 'cancelled';

export interface ApiGameEvent {
	id: string;
	name: string;
	event_date: string;
	entry_opens_at: string;
	entry_closes_at: string;
	game_starts_at: string;
	game_ends_at: string;
	status: ApiGameEventStatus;
	cancelled_reason: GoNullString;
	created_at: string;
}

export interface ApiTier {
	id: string;
	game_event_id: string;
	entry_fee_paise: number;
	prize_split_json: Record<string, number>;
	max_players: GoNullInt | null;
	created_at: string;
	entries_count: number; // present on ListTiersByGameEventWithStats rows only
	entry_fees_paise: number; // present on ListTiersByGameEventWithStats rows only
	prizes_paid_paise: number; // present on ListTiersByGameEventWithStats rows only
}

export type ApiSessionType = 'elite' | 'standard';

export interface ApiGameSession {
	id: string;
	game_event_id: string;
	tier_id: string;
	session_type: ApiSessionType;
	session_label: string;
	rank_start: number;
	rank_end: number;
	created_at: string;
	entries_count: number; // present on ListSessionsByGameEventWithStats rows only
	settled: boolean; // present on ListSessionsByGameEventWithStats rows only
}

export interface ApiSessionResult {
	id: string;
	session_id: string;
	entry_id: string;
	final_rank: number;
	total_points: number;
	prize_paise: number;
	settled_at: GoNullTime;
	created_at: string;
}

export interface ApiQuestion {
	id: string;
	game_event_id: string;
	session_id: string | null;
	sequence_no: number;
	question_text: string;
	options_json: string[];
	correct_option: string;
	is_ai_generated: boolean;
	approved_by: string | null;
	approved_at: GoNullTime;
	created_at: string;
}

export type ApiWithdrawalStatus =
	'pending' | 'approved' | 'rejected' | 'processing' | 'success' | 'failed';

export interface ApiWithdrawal {
	id: string;
	user_id: string;
	wallet_transaction_id: string | null;
	amount_paise: number;
	upi_id: string;
	status: ApiWithdrawalStatus;
	requested_at: string;
	reviewed_by: string | null;
	reviewed_at: GoNullTime;
	processed_at: GoNullTime;
	failure_reason: GoNullString;
	player_full_name: GoNullString;
	player_phone_number: string;
}

export interface ApiOverview {
	total_users: number;
	wallet_liability_paise: number;
	todays_game_events: ApiGameEvent[];
	entry_fees_collected_today_paise: number;
	prizes_paid_today_paise: number;
	withdrawals_paid_today_paise: number;
	platform_earnings_today_paise: number;
	platform_earnings_all_time_paise: number;
}

export interface ApiNotification {
	id: string;
	recipient_type: 'user' | 'admin';
	recipient_id: string;
	type: string;
	title: string;
	body: string;
	data_json: GoNullRawMessage;
	is_read: boolean;
	read_at: GoNullTime;
	delivered_push: boolean;
	created_at: string;
}

export type ApiAdminRole = 'super_admin' | 'finance' | 'support_staff';

export interface ApiAdminMe {
	id: string;
	email: string;
	role: ApiAdminRole;
	is_active: boolean;
	mfa_enrolled: boolean;
}

export interface ApiAdminUser {
	id: string;
	firebase_uid: string;
	email: string;
	role: ApiAdminRole;
	mfa_enrolled: boolean;
	is_active: boolean;
	last_login_at: GoNullTime;
	created_at: string;
}

export interface ApiPermission {
	key: string;
	description: string;
}

export type ApiRolePermissionsMap = Record<ApiAdminRole, string[]>;

export interface ApiUserPayinSummary {
	user_id: string;
	total_payin_paise: number;
	payin_today_paise: number;
	payin_7d_paise: number;
	payin_30d_paise: number;
	total_payout_paise: number;
	recharge_count: number;
	last_recharge_at: string | null; // plain nullable — this one column was deliberately cast to avoid the sql.Null* wart
}

export type ApiTicketStatus =
	'open' | 'assigned' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
export type ApiTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ApiTicketCategory =
	'general' | 'payment' | 'gameplay_dispute' | 'kyc' | 'withdrawal' | 'other';
export type ApiTicketSenderType = 'user' | 'admin' | 'system';

export interface ApiSupportTicket {
	id: string;
	user_id: string;
	// Only present on the paginated list (ListSupportTicketsFiltered joins users) — the
	// single-ticket detail fetch doesn't carry these, see mapTicket's fallback.
	user_full_name?: GoNullString;
	user_phone_number?: string;
	dispute_id: string | null;
	category: ApiTicketCategory;
	subject: string;
	status: ApiTicketStatus;
	priority: ApiTicketPriority;
	assigned_to: string | null;
	created_at: string;
	updated_at: string;
	resolved_at: GoNullTime;
	closed_at: GoNullTime;
}

export interface ApiSupportMessage {
	id: string;
	ticket_id: string;
	sender_type: ApiTicketSenderType;
	sender_id: string | null;
	message_text: string;
	attachment_url: GoNullString;
	read_at: GoNullTime;
	created_at: string;
}

export interface ApiTicketDetail {
	ticket: ApiSupportTicket;
	messages: ApiSupportMessage[];
}

// --- Disputes ---

export type ApiDisputeStatus = 'open' | 'investigating' | 'resolved' | 'rejected';

export interface ApiDispute {
	id: string;
	user_id: string;
	// Only present on the paginated list (ListDisputesPaged/ByStatusPaged join users) —
	// the evidence/detail fetch doesn't carry these, see mapDispute's fallback.
	user_full_name?: GoNullString;
	user_phone_number?: string;
	entry_id: string | null;
	question_id: string | null;
	description: string;
	status: ApiDisputeStatus;
	resolution_notes: GoNullString;
	assigned_to: string | null;
	created_at: string;
	resolved_at: GoNullTime;
}

export type ApiEntryStatus = 'joined' | 'in_session' | 'completed' | 'disqualified';

export interface ApiEvidenceEntry {
	id: string;
	server_received_at: string;
	client_tap_at: GoNullTime;
	speed_rank: GoNullInt;
	final_rank: GoNullInt;
	status: ApiEntryStatus;
}

export interface ApiEvidenceQuestion {
	id: string;
	sequence_no: number;
	question_text: string;
	options_json: string[];
	correct_option: string;
}

export interface ApiEvidenceUserAnswer {
	selected_option: GoNullString;
	is_correct: GoNullBool;
	question_shown_at: GoNullTime;
	answered_at: GoNullTime;
	response_time_ms: GoNullInt;
	points_awarded: number;
}

export interface ApiDisputeEvidence {
	dispute: ApiDispute;
	entry?: ApiEvidenceEntry;
	question?: ApiEvidenceQuestion;
	user_answer?: ApiEvidenceUserAnswer;
}

// --- KYC ---

export type ApiKycDocStatus = 'pending' | 'verified' | 'rejected';

export interface ApiKycDocument {
	id: string;
	user_id: string;
	doc_type: string;
	doc_number_masked: string;
	doc_file_url: GoNullString;
	status: ApiKycDocStatus;
	verified_by: string | null;
	verified_at: GoNullTime;
	rejection_reason: GoNullString;
	created_at: string;
	user_full_name: GoNullString;
	user_phone_number: string;
}

// --- Reports ---

export interface ApiReconciliation {
	recharged_paise: number;
	entry_fees_collected_paise: number;
	prizes_credited_paise: number;
	withdrawn_paise: number;
	refunded_paise: number;
	expected_wallet_balance_paise: number;
	actual_wallet_balance_paise: number;
	reconciled: boolean;
}

// --- Audit logs ---
// Already reshaped server-side (see toAuditLogResponse) — ip_address is a plain string
// and actor_id/entity_id are plain nullable strings, not the sql.Null*/pqtype wrappers
// the raw DB rows would otherwise carry.

export interface ApiAuditLog {
	id: string;
	actor_type: string;
	actor_id: string | null;
	action: string;
	entity_type: string;
	entity_id: string | null;
	metadata?: Record<string, unknown>;
	ip_address?: string;
	created_at: string;
}
