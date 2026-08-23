<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';

	onMount(() => {
		goto(resolve(auth.isAuthenticated ? '/management' : '/login'), { replaceState: true });
	});
</script>
