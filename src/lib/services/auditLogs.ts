import { api } from '$lib/api';
import type { ApiAuditLog } from '$lib/api-types';
import type { AuditLogEntry } from '$lib/types';

function mapEntry(a: ApiAuditLog): AuditLogEntry {
	return {
		id: a.id,
		actorType: a.actor_type,
		actorId: a.actor_id,
		action: a.action,
		entityType: a.entity_type,
		entityId: a.entity_id,
		metadata: a.metadata ?? null,
		ipAddress: a.ip_address ?? null,
		createdAt: a.created_at
	};
}

export async function fetchAuditLogs(limit = 50, offset = 0): Promise<AuditLogEntry[]> {
	const rows = await api.get<ApiAuditLog[]>(`/admin/audit-logs?limit=${limit}&offset=${offset}`);
	return (rows ?? []).map(mapEntry);
}
