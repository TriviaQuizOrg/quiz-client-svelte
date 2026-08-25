import { adminAccount } from '$lib/stores/adminAccount.svelte';

export type Section =
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

export const allSections: { id: Section; label: string; description: string }[] = [
	{ id: 'dashboard', label: 'Dashboard', description: 'Platform overview and recent activity.' },
	{
		id: 'contests',
		label: 'Contests',
		description: 'Manage contest schedules, entry fees and prize pools.'
	},
	{
		id: 'questions',
		label: 'Question bank',
		description: 'Author questions for a session, once its entry window has closed.'
	},
	{ id: 'players', label: 'Players', description: 'View player accounts and moderate access.' },
	{
		id: 'payouts',
		label: 'Payouts',
		description: 'Review and release player wallet payout requests.'
	},
	{
		id: 'tickets',
		label: 'Support tickets',
		description: 'View and respond to player support tickets.'
	},
	{
		id: 'disputes',
		label: 'Disputes',
		description: 'Investigate and resolve gameplay/ranking complaints.'
	},
	{
		id: 'session-monitor',
		label: 'Session monitor',
		description: 'Check standings for any session, live or settled.'
	},
	{ id: 'kyc', label: 'KYC verification', description: 'Review and verify player KYC documents.' },
	{ id: 'reports', label: 'Reports', description: 'Wallet ledger reconciliation and CSV export.' },
	{
		id: 'audit-log',
		label: 'Audit log',
		description: 'Trail of every sensitive admin action.'
	},
	{
		id: 'admin-roles',
		label: 'Admin roles',
		description: 'Manage admin accounts and role permissions.'
	},
	{
		id: 'settings',
		label: 'Settings',
		description: 'Configure app details, contest tiers and alerts.'
	}
];

// Every gate below is UX only — see the comment in adminAccount.svelte.ts. Hiding a nav
// item here just avoids linking to a screen whose own GET would 403.
export function visibleSections(): { id: Section; label: string; description: string }[] {
	return allSections.filter((s) => {
		if (s.id === 'admin-roles') return adminAccount.isSuperAdmin;
		if (s.id === 'tickets') return adminAccount.canSeeTickets;
		if (s.id === 'payouts') return adminAccount.canSeePayouts;
		if (s.id === 'questions') return adminAccount.canSeeQuestions;
		if (s.id === 'disputes') return adminAccount.canSeeDisputes;
		if (s.id === 'session-monitor') return adminAccount.canSeeSessionMonitor;
		if (s.id === 'kyc') return adminAccount.canSeeKyc;
		if (s.id === 'reports') return adminAccount.canSeeReports;
		if (s.id === 'audit-log') return adminAccount.canSeeAuditLog;
		return true;
	});
}
