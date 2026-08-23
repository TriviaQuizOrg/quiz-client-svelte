<script lang="ts">
	let {
		segments,
		centerValue,
		centerLabel
	}: {
		segments: { label: string; value: number; color: string }[];
		centerValue?: string;
		centerLabel?: string;
	} = $props();

	const total = $derived(segments.reduce((sum, s) => sum + s.value, 0));

	const gradient = $derived.by(() => {
		if (total === 0) return 'var(--color-line) 0% 100%';
		let acc = 0;
		const stops: string[] = [];
		for (const s of segments) {
			const start = (acc / total) * 100;
			acc += s.value;
			const end = (acc / total) * 100;
			stops.push(`${s.color} ${start}% ${end}%`);
		}
		return stops.join(', ');
	});
</script>

<div class="flex items-center gap-5">
	<div
		class="relative h-28 w-28 shrink-0 rounded-full"
		style="background: conic-gradient({gradient});"
	>
		<div
			class="absolute inset-2.75 flex flex-col items-center justify-center rounded-full bg-surface"
		>
			{#if centerValue}
				<p class="text-lg font-bold text-ink tabular-nums">{centerValue}</p>
			{/if}
			{#if centerLabel}
				<p class="text-[10px] text-ink-soft">{centerLabel}</p>
			{/if}
		</div>
	</div>
	<div class="min-w-0 flex-1 space-y-2.5">
		{#each segments as s (s.label)}
			<div class="flex items-center justify-between gap-3 text-xs">
				<span class="flex items-center gap-1.5 truncate text-ink-soft">
					<span class="h-2 w-2 shrink-0 rounded-full" style="background-color: {s.color};"></span>
					<span class="truncate">{s.label}</span>
				</span>
				<span class="shrink-0 font-medium text-ink tabular-nums">{s.value}</span>
			</div>
		{/each}
	</div>
</div>
