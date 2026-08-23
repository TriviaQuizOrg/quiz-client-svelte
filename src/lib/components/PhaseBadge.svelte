<script lang="ts">
	import { PHASE_INFO, type GameEventPhase } from '$lib/types';

	let { phase }: { phase: GameEventPhase } = $props();
	const info = $derived(PHASE_INFO[phase]);
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
	style="background-color: {info.bg}; color: {info.color};"
>
	{#if phase === 'live'}
		<span class="h-1.5 w-1.5 animate-pulse rounded-full" style="background-color: {info.color};"
		></span>
	{/if}
	{info.label}
</span>
