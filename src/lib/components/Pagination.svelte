<script lang="ts">
	let {
		page,
		totalPages,
		total,
		onChange
	}: { page: number; totalPages: number; total: number; onChange: (page: number) => void } =
		$props();
</script>

<div class="flex items-center justify-between gap-3 pt-3 text-sm">
	<span class="text-ink-soft">{total.toLocaleString()} total</span>
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
			disabled={page <= 1}
			onclick={() => onChange(page - 1)}
		>
			Previous
		</button>
		<span class="px-1 text-ink-soft">Page {page} of {totalPages}</span>
		<button
			type="button"
			class="rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
			disabled={page >= totalPages}
			onclick={() => onChange(page + 1)}
		>
			Next
		</button>
	</div>
</div>
