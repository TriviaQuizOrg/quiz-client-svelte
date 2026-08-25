<script lang="ts">
	let {
		options,
		value = $bindable(),
		onChange
	}: {
		options: { id: string; label: string }[];
		value: string;
		onChange?: (value: string) => void;
	} = $props();

	function select(id: string) {
		value = id;
		onChange?.(id);
	}
</script>

<div class="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
	{#each options as option (option.id)}
		<button
			type="button"
			class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
			class:text-white={value === option.id}
			class:text-ink-soft={value !== option.id}
			style={value === option.id ? 'background-color: var(--color-ink);' : ''}
			onclick={() => select(option.id)}
		>
			{option.label}
		</button>
	{/each}
</div>
