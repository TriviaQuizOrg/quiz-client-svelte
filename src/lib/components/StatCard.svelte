<script lang="ts">
	let {
		label,
		value,
		hint,
		hintColor = 'var(--color-ink-soft)'
	}: { label: string; value: string; hint?: string; hintColor?: string } = $props();
</script>

<div class="rounded-card border border-line bg-surface p-5">
	<p class="text-sm text-ink-soft">{label}</p>
	<p class="mt-2 text-2xl font-bold text-ink tabular-nums">{value}</p>
	{#if hint}
		<p class="mt-1 text-xs font-medium" style="color: {hintColor};">{hint}</p>
	{/if}
</div>
