<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, onClose, children }: { title: string; onClose: () => void; children: Snippet } =
		$props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<button
		aria-label="Close dialog"
		class="absolute inset-0 bg-black/60 backdrop-blur-sm"
		onclick={onClose}
	></button>

	<div
		class="relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<div class="mb-5 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-ink">{title}</h2>
			<button
				aria-label="Close"
				class="rounded-full p-1.5 text-ink-soft transition hover:bg-field hover:text-ink"
				onclick={onClose}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path
						d="M18 6 6 18M6 6l12 12"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
		{@render children()}
	</div>
</div>
