<script lang="ts">
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { broadcastNotification } from '$lib/services/notifications';
	import Chip from '$lib/components/Chip.svelte';

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

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	<div class="rounded-card border border-line bg-surface p-5">
		<h2 class="mb-4 text-sm font-semibold text-ink">Account</h2>
		{#if adminAccount.loading}
			<p class="py-4 text-center text-sm text-ink-soft">Loading…</p>
		{:else if adminAccount.error}
			<p
				class="rounded-lg px-3 py-2 text-sm"
				style="background-color: var(--color-error-bg); color: var(--color-error);"
			>
				{adminAccount.error}
			</p>
		{:else if adminAccount.account}
			{@const account = adminAccount.account}
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
						<Chip label="Enrolled" color="var(--color-success)" bg="var(--color-success-bg)" />
					{:else}
						<Chip label="Not enrolled" color="var(--color-warning)" bg="var(--color-warning-bg)" />
					{/if}
				</div>
				<div class="flex items-center justify-between gap-4 py-3 last:pb-0">
					<span class="text-sm text-ink-soft">Status</span>
					{#if account.isActive}
						<Chip label="Active" color="var(--color-success)" bg="var(--color-success-bg)" />
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
			backend-supported yet — there's no settings table to persist them to. This section will return
			once that's built.
		</p>
	</div>

	{#if adminAccount.canBroadcast}
		<div class="rounded-card border border-line bg-surface p-5 lg:col-span-2">
			<h2 class="mb-1 text-sm font-semibold text-ink">Broadcast notification</h2>
			<p class="mb-4 text-xs text-ink-soft">
				Sends one notification to every active player, right now — there's no scheduling or undo.
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
