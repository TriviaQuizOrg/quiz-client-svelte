<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { fetchKycDocuments, verifyKycDocument, rejectKycDocument } from '$lib/services/kyc';
	import { KYC_STATUS_INFO, type KycDocument } from '$lib/types';
	import { formatDateLabel } from '$lib/format';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PillTabs from '$lib/components/PillTabs.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	// ---------- KYC verification ----------
	let kycDocuments = $state<KycDocument[]>([]);
	let kycLoading = $state(false);
	let kycError = $state('');
	let kycStatusFilter = $state('pending');
	let kycPage = $state(1);
	let kycTotal = $state(0);
	let kycTotalPages = $state(1);

	const kycFilterOptions = [
		{ id: 'pending', label: 'Pending' },
		{ id: 'verified', label: 'Verified' },
		{ id: 'rejected', label: 'Rejected' }
	];

	async function loadKycDocuments() {
		kycLoading = true;
		kycError = '';
		try {
			const result = await fetchKycDocuments(kycPage, kycStatusFilter);
			kycDocuments = result.items;
			kycTotal = result.total;
			kycTotalPages = result.totalPages;
		} catch (err) {
			kycError = err instanceof Error ? err.message : 'Failed to load KYC documents.';
		} finally {
			kycLoading = false;
		}
	}

	function goToKycPage(page: number) {
		kycPage = page;
		loadKycDocuments();
	}

	function onKycFilterChange(status: string) {
		kycStatusFilter = status;
		kycPage = 1;
		loadKycDocuments();
	}

	let kycLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeeKyc && !kycLoaded) {
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
</script>

{#if !adminAccount.canSeeKyc}
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
		<PillTabs
			options={kycFilterOptions}
			bind:value={kycStatusFilter}
			onChange={onKycFilterChange}
		/>
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
				{#each kycDocuments as doc (doc.id)}
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
	<Pagination page={kycPage} totalPages={kycTotalPages} total={kycTotal} onChange={goToKycPage} />
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
