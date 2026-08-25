<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
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
		ADMIN_ROLE_INFO,
		type AdminUserSummary,
		type Permission,
		type RolePermissionsMap,
		type AdminRole
	} from '$lib/types';
	import { formatDateLabel } from '$lib/format';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import * as Select from '$lib/components/ui/select/index.js';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	// ---------- RBAC (super_admin only — backend enforces this independently via
	// RequireSuperAdmin; hiding the nav item and gating loads on it here is just UX) ----------
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
		if (checkedAuth && adminAccount.isSuperAdmin && !rbacLoaded) {
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
</script>

{#if !adminAccount.isSuperAdmin}
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
					{@const isSelf = admin.id === adminAccount.account?.id}
					<tr class="border-b border-line align-top last:border-0">
						<td class="px-4 py-3 font-medium text-ink">{admin.email}</td>
						<td class="px-4 py-3">
							<Select.Root
								type="single"
								value={admin.role}
								disabled={isSelf || adminActionBusy === admin.id}
								onValueChange={(v) => v && changeAdminRole(admin, v as AdminRole)}
							>
								<Select.Trigger class="w-full" size="sm">
									{ADMIN_ROLE_INFO[admin.role].label}
								</Select.Trigger>
								<Select.Content>
									{#each adminRoleOrder as role (role)}
										<Select.Item value={role} label={ADMIN_ROLE_INFO[role].label} />
									{/each}
								</Select.Content>
							</Select.Root>
						</td>
						<td class="px-4 py-3">
							{#if admin.isActive}
								<Chip label="Active" color="var(--color-success)" bg="var(--color-success-bg)" />
							{:else}
								<Chip label="Deactivated" color="var(--color-error)" bg="var(--color-error-bg)" />
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
				<Select.Root
					type="single"
					value={newAdminRole}
					onValueChange={(v) => v && (newAdminRole = v as AdminRole)}
				>
					<Select.Trigger class="w-full">
						{ADMIN_ROLE_INFO[newAdminRole].label}
					</Select.Trigger>
					<Select.Content>
						{#each adminRoleOrder as role (role)}
							<Select.Item value={role} label={ADMIN_ROLE_INFO[role].label} />
						{/each}
					</Select.Content>
				</Select.Root>
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
