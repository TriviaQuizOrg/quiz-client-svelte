<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { fetchAuditLogs } from '$lib/services/auditLogs';
	import type { AuditLogEntry } from '$lib/types';
	import { formatDateLabel } from '$lib/format';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

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
		if (checkedAuth && adminAccount.canSeeAuditLog && !auditLogsLoaded) {
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
</script>

{#if !adminAccount.canSeeAuditLog}
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
