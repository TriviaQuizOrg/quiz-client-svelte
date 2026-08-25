import { fetchAdminMe } from '$lib/services/dashboard';
import type { AdminAccount } from '$lib/types';

class AdminAccountStore {
	account = $state<AdminAccount | null>(null);
	loading = $state(false);
	error = $state('');
	loaded = false;

	get isSuperAdmin() {
		return this.account?.role === 'super_admin';
	}

	// wallet.view (Payouts) is granted to finance and super_admin by default.
	// questions.preview_approve (Question bank) is granted to super_admin only.
	// disputes.resolve, sessions.monitor, kyc.verify are granted to support_staff and
	// super_admin by default. reports.view/export and audit_log.view are granted to
	// finance and super_admin by default. notifications.broadcast is super_admin only.
	// tickets.view/assign/respond are granted to support_staff and super_admin by
	// default (see 00018_rbac.sql seed).
	// Every gate below is UX only — the backend enforces the real permission check
	// independently (RequireSuperAdmin for RBAC, RequirePermission for everything else),
	// so hiding a nav item here just avoids showing a screen whose own GET would 403.
	// All of them are hardcoded to the default role_permissions seed rather than fetched
	// live, since only super_admin can call the endpoint that would tell a non-super-admin
	// what they're actually allowed to do — if that seed is edited later, this can drift
	// until the code catches up.
	get canSeePayouts() {
		return this.account?.role === 'finance' || this.account?.role === 'super_admin';
	}
	get canSeeQuestions() {
		return this.account?.role === 'super_admin';
	}
	get canSeeDisputes() {
		return this.account?.role === 'support_staff' || this.account?.role === 'super_admin';
	}
	get canSeeSessionMonitor() {
		return this.account?.role === 'support_staff' || this.account?.role === 'super_admin';
	}
	get canSeeKyc() {
		return this.account?.role === 'support_staff' || this.account?.role === 'super_admin';
	}
	get canSeeReports() {
		return this.account?.role === 'finance' || this.account?.role === 'super_admin';
	}
	get canSeeAuditLog() {
		return this.account?.role === 'finance' || this.account?.role === 'super_admin';
	}
	get canSeeTickets() {
		return this.account?.role === 'support_staff' || this.account?.role === 'super_admin';
	}
	get canBroadcast() {
		return this.account?.role === 'super_admin';
	}

	async load() {
		if (this.loaded) return;
		this.loaded = true;
		this.loading = true;
		this.error = '';
		try {
			this.account = await fetchAdminMe();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load account.';
		} finally {
			this.loading = false;
		}
	}
}

export const adminAccount = new AdminAccountStore();
