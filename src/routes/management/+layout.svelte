<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { notifications } from '$lib/stores/notifications.svelte';
	import { connectAdminNotifications } from '$lib/services/notifications';
	import { formatDateLabel } from '$lib/format';
	import { allSections, visibleSections, type Section } from '$lib/management-sections';
	import NavIcon from '$lib/components/NavIcon.svelte';

	let { children } = $props();

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	$effect(() => {
		if (!auth.initializing && !auth.isAuthenticated) {
			goto(resolve('/login'), { replaceState: true });
		}
	});

	let accountLoaded = false;
	$effect(() => {
		if (checkedAuth && !accountLoaded) {
			accountLoaded = true;
			adminAccount.load();
		}
	});

	let notificationsLoaded = false;
	$effect(() => {
		if (checkedAuth && !notificationsLoaded) {
			notificationsLoaded = true;
			notifications.load();
		}
	});

	// Live push for notifications — connects once authenticated, reconnects on drop, and
	// tears down cleanly if the admin logs out.
	$effect(() => {
		if (!checkedAuth) return;
		const stop = connectAdminNotifications((n) => notifications.applyIncoming(n));
		return stop;
	});

	// Backstops the WS push above — e.g. a ticket_reply on a ticket nobody's claimed yet
	// notifies no one server-side by design, so polling is the only way the bell picks
	// that up without a manual page refresh.
	$effect(() => {
		if (!checkedAuth) return;
		const interval = setInterval(() => notifications.load(), 20000);
		return () => clearInterval(interval);
	});

	const sections = $derived(visibleSections());

	const currentSectionId = $derived(page.url.pathname.split('/')[2] as Section | undefined);
	const currentSection = $derived(
		allSections.find((s) => s.id === currentSectionId) ?? allSections[0]
	);

	async function handleLogout() {
		await auth.logout();
		goto(resolve('/login'), { replaceState: true });
	}

	let showNotifications = $state(false);
	let showProfileMenu = $state(false);
	let mobileNavOpen = $state(false);

	function toggleNotifications() {
		showProfileMenu = false;
		showNotifications = !showNotifications;
	}

	function toggleProfileMenu() {
		showNotifications = false;
		showProfileMenu = !showProfileMenu;
	}

	function openNotificationTicket(ticketId: string) {
		showNotifications = false;
		notifications.requestedTicketId = ticketId;
		goto(resolve('/management/tickets'));
	}
</script>

<svelte:head>
	<title>Management · QuizPlay Admin</title>
</svelte:head>

{#if checkedAuth}
	<div class="flex h-screen overflow-hidden">
		{#if mobileNavOpen}
			<button
				class="fixed inset-0 z-40 bg-black/50 lg:hidden"
				aria-label="Close menu"
				onclick={() => (mobileNavOpen = false)}
			></button>
		{/if}

		<aside
			class="fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-nav px-4 py-6 transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:translate-x-0"
			class:translate-x-0={mobileNavOpen}
			class:-translate-x-full={!mobileNavOpen}
		>
			<div class="mb-8 flex items-center gap-2.5 px-2">
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
				<button
					aria-label="Close menu"
					class="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-nav-ink-soft hover:text-white lg:hidden"
					onclick={() => (mobileNavOpen = false)}
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

			<nav class="flex flex-1 flex-col gap-1">
				{#each sections as section (section.id)}
					<a
						href={resolve(`/management/${section.id}`)}
						class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition"
						class:text-white={currentSectionId === section.id}
						class:text-nav-ink={currentSectionId !== section.id}
						style={currentSectionId === section.id ? 'background-color: var(--color-primary);' : ''}
						onclick={() => (mobileNavOpen = false)}
					>
						<NavIcon name={section.id} />
						{section.label}
					</a>
				{/each}
			</nav>

			<div class="mt-6 border-t pt-4" style="border-color: var(--color-nav-elevated);">
				<button
					class="w-full rounded-xl px-3 py-2 text-sm font-medium text-nav-ink transition hover:text-white"
					style="background-color: var(--color-nav-elevated);"
					onclick={handleLogout}
				>
					Log out
				</button>
			</div>
		</aside>

		<main class="h-full flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-7">
			<header class="mb-7 flex items-start justify-between gap-4">
				<div class="flex min-w-0 items-start gap-3">
					<button
						aria-label="Open menu"
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition hover:text-ink lg:hidden"
						onclick={() => (mobileNavOpen = true)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								d="M4 6h16M4 12h16M4 18h16"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<div class="min-w-0">
						<h1 class="text-2xl font-semibold text-ink">{currentSection.label}</h1>
						<p class="mt-1 text-sm text-ink-soft">{currentSection.description}</p>
					</div>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<div class="relative">
						<button
							aria-label="Notifications"
							class="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition hover:text-ink"
							onclick={toggleNotifications}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path
									d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<path
									d="M13.73 21a2 2 0 0 1-3.46 0"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							{#if notifications.unreadCount > 0}
								<span
									class="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
									style="background-color: var(--color-error);"
								>
									{notifications.unreadCount}
								</span>
							{/if}
						</button>

						{#if showNotifications}
							<button
								class="fixed inset-0 z-40 cursor-default"
								aria-label="Close notifications"
								onclick={() => (showNotifications = false)}
							></button>
							<div
								class="absolute top-12 right-0 z-50 w-80 rounded-card border border-line bg-surface p-2 shadow-xl"
							>
								<div class="flex items-center justify-between px-2 py-1.5">
									<p class="text-sm font-semibold text-ink">Notifications</p>
									<button
										class="text-xs font-medium text-ink-soft hover:text-ink"
										onclick={() => notifications.markAllRead()}
									>
										Mark all read
									</button>
								</div>
								<div class="max-h-80 space-y-0.5 overflow-y-auto">
									{#each notifications.list as notification (notification.id)}
										<button
											type="button"
											class="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-field"
											onclick={() => {
												if (!notification.isRead) {
													notifications.markRead(notification.id);
												}
												if (notification.ticketId) {
													openNotificationTicket(notification.ticketId);
												}
											}}
										>
											<span
												class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
												style={notification.isRead
													? 'background-color: transparent;'
													: 'background-color: var(--color-primary);'}
											></span>
											<div class="min-w-0">
												<p class="text-sm font-medium text-ink">{notification.title}</p>
												<p class="mt-0.5 truncate text-xs text-ink-soft">{notification.body}</p>
												<p class="mt-0.5 text-xs text-ink-faint">
													{formatDateLabel(notification.createdAt)}
												</p>
											</div>
										</button>
									{:else}
										<p class="px-2 py-6 text-center text-sm text-ink-soft">You're all caught up.</p>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<a
						aria-label="Settings"
						href={resolve('/management/settings')}
						class="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition hover:text-ink"
						class:border-transparent={currentSectionId === 'settings'}
						style={currentSectionId === 'settings'
							? 'background-color: var(--color-primary); color: white;'
							: ''}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle cx="12" cy="12" r="3" stroke-width="2" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</a>

					<div class="relative">
						<button
							aria-label="Profile"
							class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white transition"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
							onclick={toggleProfileMenu}
						>
							{(auth.displayName || 'A').charAt(0)}
						</button>

						{#if showProfileMenu}
							<button
								class="fixed inset-0 z-40 cursor-default"
								aria-label="Close profile menu"
								onclick={() => (showProfileMenu = false)}
							></button>
							<div
								class="absolute top-12 right-0 z-50 w-64 rounded-card border border-line bg-surface p-2 shadow-xl"
							>
								<div class="flex items-center gap-2.5 px-2 py-2">
									<div
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
										style="background: linear-gradient(135deg, var(--color-primary), var(--color-elite));"
									>
										{(auth.displayName || 'A').charAt(0)}
									</div>
									<div class="min-w-0">
										<p class="truncate text-sm font-medium text-ink">
											{auth.displayName || 'Admin'}
										</p>
										<p class="truncate text-xs text-ink-soft">{auth.email}</p>
									</div>
								</div>
								<div class="my-1 border-t border-line"></div>
								<a
									href={resolve('/management/settings')}
									class="block w-full rounded-lg px-2 py-2 text-left text-sm text-ink-soft hover:bg-field hover:text-ink"
									onclick={() => (showProfileMenu = false)}
								>
									Account settings
								</a>
								<button
									class="w-full rounded-lg px-2 py-2 text-left text-sm text-ink-soft hover:bg-field hover:text-error"
									onclick={handleLogout}
								>
									Log out
								</button>
							</div>
						{/if}
					</div>
				</div>
			</header>

			{@render children()}
		</main>
	</div>
{/if}
