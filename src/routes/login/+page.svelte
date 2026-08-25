<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/stores/auth.svelte';
	import { firebaseConfigured } from '$lib/firebase';
	import Modal from '$lib/components/Modal.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	let showResetModal = $state(false);
	let resetEmail = $state('');
	let resetError = $state('');
	let resetSuccess = $state('');
	let resetLoading = $state(false);

	function openResetModal() {
		resetEmail = email;
		resetError = '';
		resetSuccess = '';
		showResetModal = true;
	}

	async function handleResetSubmit(e: SubmitEvent) {
		e.preventDefault();
		resetError = '';
		resetLoading = true;
		try {
			await auth.sendPasswordReset(resetEmail);
			resetSuccess = `Password reset email sent to ${resetEmail.trim()}.`;
		} catch (err) {
			resetError = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
		} finally {
			resetLoading = false;
		}
	}

	// Firebase restores a persisted session asynchronously, so redirecting-if-already-
	// authenticated has to wait for auth.initializing to resolve rather than checking once
	// on mount.
	$effect(() => {
		if (!auth.initializing && auth.isAuthenticated) {
			goto(resolve('/management/dashboard'), { replaceState: true });
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			await auth.login(email, password);
			goto(resolve('/management/dashboard'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
		} finally {
			loading = false;
		}
	}

	const highlights = [
		{ label: 'Live contests managed', value: '48' },
		{ label: 'Registered players', value: '18,204' },
		{ label: 'Payouts processed', value: '₹8.4L+' }
	];
</script>

<svelte:head>
	<title>Sign in · QuizPlay Admin</title>
</svelte:head>

<div class="flex min-h-screen">
	<div class="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-nav p-10 lg:flex">
		<div
			class="pointer-events-none absolute inset-0"
			style="background:
				radial-gradient(40rem 24rem at 10% -10%, color-mix(in srgb, var(--color-primary) 45%, transparent), transparent),
				radial-gradient(30rem 20rem at 100% 100%, color-mix(in srgb, var(--color-elite) 35%, transparent), transparent);"
		></div>

		<div class="relative flex items-center gap-2.5">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-xl text-base font-extrabold text-white"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
			>
				Q
			</div>
			<div>
				<p class="text-sm leading-tight font-semibold text-white">QuizPlay</p>
				<p class="text-xs leading-tight text-nav-ink-soft">Admin panel</p>
			</div>
		</div>

		<div class="relative">
			<h1 class="text-3xl leading-tight font-bold text-white">Run the platform from one place.</h1>
			<p class="mt-3 max-w-sm text-sm text-nav-ink-soft">
				Schedule contests, curate the question bank, moderate players and release payouts — all from
				a single dashboard.
			</p>

			<div class="mt-8 grid grid-cols-3 gap-3">
				{#each highlights as h (h.label)}
					<div class="rounded-xl p-3" style="background-color: var(--color-nav-elevated);">
						<p class="text-lg font-bold text-white tabular-nums">{h.value}</p>
						<p class="mt-1 text-[11px] leading-tight text-nav-ink-soft">{h.label}</p>
					</div>
				{/each}
			</div>
		</div>

		<p class="relative text-xs text-nav-ink-soft">© 2026 QuizPlay. All rights reserved.</p>
	</div>

	<div class="flex flex-1 items-center justify-center bg-canvas px-4 py-12">
		<div class="w-full max-w-sm">
			<div class="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-extrabold text-white"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
				>
					Q
				</div>
				<div>
					<h1 class="text-xl font-semibold text-ink">QuizPlay Admin</h1>
					<p class="text-sm text-ink-soft">Sign in to manage contests, questions & players</p>
				</div>
			</div>

			<div class="mb-6 hidden text-center lg:block">
				<h2 class="text-xl font-semibold text-ink">Welcome back</h2>
				<p class="mt-1 text-sm text-ink-soft">Sign in to your admin account</p>
			</div>

			<form
				class="rounded-card border border-line bg-surface p-6"
				onsubmit={handleSubmit}
				novalidate
			>
				<div class="space-y-4">
					<label class="block">
						<span class="mb-1.5 block text-sm font-medium text-ink-soft">Email</span>
						<input
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							placeholder="you@quizplay.com"
							class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
						/>
					</label>

					<label class="block">
						<div class="mb-1.5 flex items-center justify-between">
							<span class="text-sm font-medium text-ink-soft">Password</span>
							<button
								type="button"
								class="text-xs font-medium text-primary hover:underline"
								onclick={openResetModal}
							>
								Forgot password?
							</button>
						</div>
						<input
							type="password"
							autocomplete="current-password"
							required
							bind:value={password}
							placeholder="••••••••"
							class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
						/>
					</label>

					{#if !firebaseConfigured}
						<p
							class="rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-warning-bg); color: var(--color-warning);"
						>
							Firebase isn't configured yet — set PUBLIC_FIREBASE_* in .env (see .env.example).
						</p>
					{/if}

					{#if error}
						<p
							class="rounded-lg px-3 py-2 text-sm"
							style="background-color: var(--color-error-bg); color: var(--color-error);"
						>
							{error}
						</p>
					{/if}

					<button
						type="submit"
						disabled={loading || !firebaseConfigured}
						class="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
						style="background-color: var(--color-primary);"
					>
						{#if loading}
							<span
								class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
							></span>
						{/if}
						{loading ? 'Signing in…' : 'Sign in'}
					</button>
				</div>
			</form>

			<p class="mt-6 text-center text-xs text-ink-faint">
				Sign in with an admin account provisioned in the admin console Firebase project.
			</p>
		</div>
	</div>
</div>

{#if showResetModal}
	<Modal title="Reset password" onClose={() => (showResetModal = false)}>
		<form class="space-y-4" onsubmit={handleResetSubmit}>
			<label class="block">
				<span class="mb-1.5 block text-sm font-medium text-ink-soft">Email</span>
				<input
					type="email"
					autocomplete="email"
					required
					bind:value={resetEmail}
					placeholder="you@quizplay.com"
					class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
				/>
			</label>

			{#if resetSuccess}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-success-bg); color: var(--color-success);"
				>
					{resetSuccess}
				</p>
			{/if}

			{#if resetError}
				<p
					class="rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{resetError}
				</p>
			{/if}

			<button
				type="submit"
				disabled={resetLoading}
				class="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
				style="background-color: var(--color-primary);"
			>
				{resetLoading ? 'Sending…' : 'Send reset link'}
			</button>
		</form>
	</Modal>
{/if}
