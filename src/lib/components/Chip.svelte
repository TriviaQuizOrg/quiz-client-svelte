<script lang="ts">
	let { label, color, bg }: { label: string; color: string; bg: string } = $props();
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
	style="background-color: {bg}; color: {color};"
>
	{label}
</span>
