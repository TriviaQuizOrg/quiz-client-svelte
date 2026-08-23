import { api, unwrapTime } from '$lib/api';
import type { ApiAdminUser, ApiPermission, ApiRolePermissionsMap } from '$lib/api-types';
import type { AdminUserSummary, Permission, RolePermissionsMap, AdminRole } from '$lib/types';

// Every function here calls a route gated by RequireSuperAdmin backend-side (a hard role
// check, not the editable role_permissions table these functions manage) — a non-super
// admin gets a 403 from the backend regardless of what the frontend shows.

function mapAdminUser(a: ApiAdminUser): AdminUserSummary {
	return {
		id: a.id,
		email: a.email,
		role: a.role,
		isActive: a.is_active,
		mfaEnrolled: a.mfa_enrolled,
		lastLoginAt: unwrapTime(a.last_login_at),
		createdAt: a.created_at
	};
}

export async function fetchAdminUsers(): Promise<AdminUserSummary[]> {
	const rows = await api.get<ApiAdminUser[]>('/admin/rbac/admins');
	return (rows ?? []).map(mapAdminUser);
}

export interface CreateAdminUserInput {
	email: string;
	password: string;
	role: AdminRole;
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUserSummary> {
	const a = await api.post<ApiAdminUser>('/admin/rbac/admins', input);
	return mapAdminUser(a);
}

export async function setAdminUserRole(id: string, role: AdminRole): Promise<AdminUserSummary> {
	const a = await api.patch<ApiAdminUser>(`/admin/rbac/admins/${id}/role`, { role });
	return mapAdminUser(a);
}

export async function activateAdminUser(id: string): Promise<AdminUserSummary> {
	const a = await api.post<ApiAdminUser>(`/admin/rbac/admins/${id}/activate`);
	return mapAdminUser(a);
}

export async function deactivateAdminUser(id: string): Promise<AdminUserSummary> {
	const a = await api.post<ApiAdminUser>(`/admin/rbac/admins/${id}/deactivate`);
	return mapAdminUser(a);
}

export async function fetchPermissions(): Promise<Permission[]> {
	const rows = await api.get<ApiPermission[]>('/admin/rbac/permissions');
	return rows ?? [];
}

const emptyRolePermissions: RolePermissionsMap = {
	super_admin: [],
	finance: [],
	support_staff: []
};

export async function fetchRolePermissions(): Promise<RolePermissionsMap> {
	const raw = await api.get<ApiRolePermissionsMap>('/admin/rbac/role-permissions');
	return raw ?? emptyRolePermissions;
}

export async function setRolePermission(
	role: AdminRole,
	permissionKey: string,
	granted: boolean
): Promise<void> {
	await api.put('/admin/rbac/role-permissions', {
		role,
		permission_key: permissionKey,
		granted
	});
}
