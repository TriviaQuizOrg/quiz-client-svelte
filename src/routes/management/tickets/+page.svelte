<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { adminAccount } from '$lib/stores/adminAccount.svelte';
	import { playersStore } from '$lib/stores/players.svelte';
	import { notifications } from '$lib/stores/notifications.svelte';
	import {
		fetchTickets,
		fetchTicketDetail,
		assignTicketToMe,
		postTicketMessage,
		resolveTicket,
		closeTicket
	} from '$lib/services/tickets';
	import {
		TICKET_STATUS_INFO,
		TICKET_PRIORITY_INFO,
		TICKET_CATEGORY_LABELS,
		type SupportTicket,
		type TicketMessage
	} from '$lib/types';
	import { formatDateLabel } from '$lib/format';
	import Chip from '$lib/components/Chip.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PillTabs from '$lib/components/PillTabs.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	const checkedAuth = $derived(!auth.initializing && auth.isAuthenticated);

	let playersLoaded = false;
	$effect(() => {
		if (checkedAuth && !playersLoaded) {
			playersLoaded = true;
			playersStore.ensureLoaded();
		}
	});

	// ---------- Support tickets ----------
	let tickets = $state<SupportTicket[]>([]);
	let ticketsLoading = $state(false);
	let ticketsError = $state('');
	let ticketQuery = $state('');
	let ticketFilter = $state('all');
	let ticketsPage = $state(1);
	let ticketsTotal = $state(0);
	let ticketsTotalPages = $state(1);

	const ticketFilterOptions = [
		{ id: 'all', label: 'All' },
		{ id: 'open', label: 'Open' },
		{ id: 'assigned', label: 'Assigned' },
		{ id: 'in_progress', label: 'In progress' },
		{ id: 'waiting_on_user', label: 'Waiting on user' },
		{ id: 'resolved', label: 'Resolved' },
		{ id: 'closed', label: 'Closed' }
	];

	async function loadTickets() {
		ticketsLoading = true;
		ticketsError = '';
		try {
			const result = await fetchTickets(
				ticketsPage,
				ticketFilter === 'all' ? '' : ticketFilter,
				ticketQuery
			);
			tickets = result.items;
			ticketsTotal = result.total;
			ticketsTotalPages = result.totalPages;
		} catch (err) {
			ticketsError = err instanceof Error ? err.message : 'Failed to load tickets.';
		} finally {
			ticketsLoading = false;
		}
	}

	function goToTicketsPage(page: number) {
		ticketsPage = page;
		loadTickets();
	}

	function onTicketFilterChange(status: string) {
		ticketFilter = status;
		ticketsPage = 1;
		loadTickets();
	}

	let ticketQueryTimer: ReturnType<typeof setTimeout> | undefined;
	function onTicketQueryInput() {
		clearTimeout(ticketQueryTimer);
		ticketQueryTimer = setTimeout(() => {
			ticketsPage = 1;
			loadTickets();
		}, 300);
	}

	let ticketsLoaded = false;
	$effect(() => {
		if (checkedAuth && adminAccount.canSeeTickets && !ticketsLoaded) {
			ticketsLoaded = true;
			loadTickets();
		}
	});

	let viewingTicketId = $state<string | null>(null);
	let viewingTicket = $state<SupportTicket | null>(null);
	let ticketMessages = $state<TicketMessage[]>([]);
	let ticketDetailLoading = $state(false);
	let ticketActionError = $state('');
	let ticketActionBusy = $state(false);
	let replyText = $state('');

	// The single-ticket detail fetch and every mutation response (assign/reply/resolve/
	// close) return the ticket without the players join the paginated list has — fill the
	// name back in from whatever's already known (the currently-open modal, the loaded
	// list row, or worst case the shared players store) rather than showing it blank.
	function withKnownPlayerName(t: SupportTicket): SupportTicket {
		if (t.playerName) return t;
		const playerName =
			viewingTicket?.playerName ||
			tickets.find((x) => x.id === t.id)?.playerName ||
			playersStore.nameFor(t.userId);
		const playerPhone =
			t.playerPhone ||
			viewingTicket?.playerPhone ||
			tickets.find((x) => x.id === t.id)?.playerPhone ||
			'';
		return { ...t, playerName, playerPhone };
	}

	async function openTicket(id: string) {
		viewingTicketId = id;
		viewingTicket = tickets.find((t) => t.id === id) ?? null;
		ticketMessages = [];
		ticketActionError = '';
		replyText = '';
		ticketDetailLoading = true;
		try {
			const detail = await fetchTicketDetail(id);
			viewingTicket = withKnownPlayerName(detail.ticket);
			ticketMessages = detail.messages;
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to load ticket.';
		} finally {
			ticketDetailLoading = false;
		}
	}

	function closeTicketModal() {
		viewingTicketId = null;
	}

	// Opens straight to a ticket when arriving via a notification click from another
	// route (see the chrome's notifications dropdown), then clears the request.
	$effect(() => {
		if (notifications.requestedTicketId && checkedAuth) {
			const ticketId = notifications.requestedTicketId;
			notifications.requestedTicketId = null;
			openTicket(ticketId);
		}
	});

	// Backstops the WS push in the chrome — e.g. a ticket_reply on a ticket nobody's
	// claimed yet notifies no one server-side by design, so polling is the only way an
	// open ticket picks up a reply without a manual refresh. Also covers a missed/dropped
	// WS push in general.
	$effect(() => {
		if (!viewingTicketId) return;
		const id = viewingTicketId;
		const interval = setInterval(() => {
			fetchTicketDetail(id)
				.then((detail) => {
					if (viewingTicketId !== id) return;
					viewingTicket = withKnownPlayerName(detail.ticket);
					ticketMessages = detail.messages;
				})
				.catch(() => {});
		}, 8000);
		return () => clearInterval(interval);
	});

	// Live push refresh — the chrome bumps notifications.lastTicketReply whenever a
	// ticket_reply notification arrives; if it's for the ticket currently open, pull the
	// reply in immediately instead of waiting for the 8s poll above.
	$effect(() => {
		const reply = notifications.lastTicketReply;
		if (!reply || !viewingTicketId || reply.ticketId !== viewingTicketId) return;
		fetchTicketDetail(viewingTicketId)
			.then((detail) => {
				viewingTicket = withKnownPlayerName(detail.ticket);
				ticketMessages = detail.messages;
			})
			.catch(() => {});
	});

	function applyTicketUpdate(updated: SupportTicket) {
		viewingTicket = withKnownPlayerName(updated);
		tickets = tickets.map((t) =>
			t.id === updated.id ? { ...updated, playerName: t.playerName, playerPhone: t.playerPhone } : t
		);
	}

	async function assignTicketAction() {
		if (!viewingTicketId) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			applyTicketUpdate(await assignTicketToMe(viewingTicketId));
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to assign ticket.';
		} finally {
			ticketActionBusy = false;
		}
	}

	async function sendReply(e: SubmitEvent) {
		e.preventDefault();
		if (!viewingTicketId || !replyText.trim()) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			const msg = await postTicketMessage(viewingTicketId, replyText.trim());
			ticketMessages = [...ticketMessages, msg];
			replyText = '';
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to send reply.';
		} finally {
			ticketActionBusy = false;
		}
	}

	async function resolveTicketAction() {
		if (!viewingTicketId) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			applyTicketUpdate(await resolveTicket(viewingTicketId));
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to resolve ticket.';
		} finally {
			ticketActionBusy = false;
		}
	}

	async function closeTicketAction() {
		if (!viewingTicketId) return;
		ticketActionBusy = true;
		ticketActionError = '';
		try {
			applyTicketUpdate(await closeTicket(viewingTicketId));
		} catch (err) {
			ticketActionError = err instanceof Error ? err.message : 'Failed to close ticket.';
		} finally {
			ticketActionBusy = false;
		}
	}
</script>

{#if !adminAccount.canSeeTickets}
	<div
		class="rounded-card border border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft"
	>
		You don't have access to support tickets.
	</div>
{:else}
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<input
			type="search"
			bind:value={ticketQuery}
			oninput={onTicketQueryInput}
			placeholder="Search by subject or player…"
			class="w-full max-w-xs rounded-xl border border-line bg-field px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
		/>
		<PillTabs
			options={ticketFilterOptions}
			bind:value={ticketFilter}
			onChange={onTicketFilterChange}
		/>
	</div>

	{#if ticketsError}
		<p
			class="mb-4 rounded-lg px-3 py-2 text-sm"
			style="background-color: var(--color-error-bg); color: var(--color-error);"
		>
			{ticketsError}
		</p>
	{/if}

	<div class="overflow-x-auto rounded-card border border-line bg-surface">
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-b border-line text-xs text-ink-soft uppercase">
					<th class="px-4 py-3 font-medium">Player</th>
					<th class="px-4 py-3 font-medium">Subject</th>
					<th class="px-4 py-3 font-medium">Category</th>
					<th class="px-4 py-3 font-medium">Priority</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Updated</th>
				</tr>
			</thead>
			<tbody>
				{#each tickets as ticket (ticket.id)}
					<tr
						class="cursor-pointer border-b border-line last:border-0 hover:bg-field"
						onclick={() => openTicket(ticket.id)}
					>
						<td class="px-4 py-3 font-medium text-ink">{ticket.playerName}</td>
						<td class="px-4 py-3 text-ink">{ticket.subject}</td>
						<td class="px-4 py-3 text-ink-soft">{TICKET_CATEGORY_LABELS[ticket.category]}</td>
						<td class="px-4 py-3">
							<Chip
								label={TICKET_PRIORITY_INFO[ticket.priority].label}
								color={TICKET_PRIORITY_INFO[ticket.priority].color}
								bg={TICKET_PRIORITY_INFO[ticket.priority].bg}
							/>
						</td>
						<td class="px-4 py-3">
							<Chip
								label={TICKET_STATUS_INFO[ticket.status].label}
								color={TICKET_STATUS_INFO[ticket.status].color}
								bg={TICKET_STATUS_INFO[ticket.status].bg}
							/>
						</td>
						<td class="px-4 py-3 text-ink-soft">{formatDateLabel(ticket.updatedAt)}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="px-4 py-8 text-center text-sm text-ink-soft">
							{ticketsLoading ? 'Loading tickets…' : 'No tickets match your search.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination
		page={ticketsPage}
		totalPages={ticketsTotalPages}
		total={ticketsTotal}
		onChange={goToTicketsPage}
	/>
{/if}

{#if viewingTicketId}
	<Modal title={viewingTicket?.subject ?? 'Ticket'} onClose={closeTicketModal}>
		{#if ticketDetailLoading}
			<p class="py-8 text-center text-sm text-ink-soft">Loading…</p>
		{:else if viewingTicket}
			{@const t = viewingTicket}
			{@const isOpenForAction = t.status !== 'resolved' && t.status !== 'closed'}
			<div class="mb-4 flex flex-wrap items-center gap-2">
				<Chip
					label={TICKET_STATUS_INFO[t.status].label}
					color={TICKET_STATUS_INFO[t.status].color}
					bg={TICKET_STATUS_INFO[t.status].bg}
				/>
				<Chip
					label={TICKET_PRIORITY_INFO[t.priority].label}
					color={TICKET_PRIORITY_INFO[t.priority].color}
					bg={TICKET_PRIORITY_INFO[t.priority].bg}
				/>
				<span class="text-xs text-ink-soft">{TICKET_CATEGORY_LABELS[t.category]}</span>
				<span class="text-xs text-ink-faint">· {t.playerName}</span>
			</div>

			{#if ticketActionError}
				<p
					class="mb-4 rounded-lg px-3 py-2 text-sm"
					style="background-color: var(--color-error-bg); color: var(--color-error);"
				>
					{ticketActionError}
				</p>
			{/if}

			<div class="mb-4 flex flex-wrap gap-2">
				{#if !t.assignedTo && isOpenForAction}
					<button
						class="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
						style="background-color: var(--color-primary);"
						disabled={ticketActionBusy}
						onclick={assignTicketAction}
					>
						Assign to me
					</button>
				{/if}
				{#if isOpenForAction}
					<button
						class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
						disabled={ticketActionBusy}
						onclick={resolveTicketAction}
					>
						Resolve
					</button>
				{/if}
				{#if t.status !== 'closed'}
					<button
						class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-error"
						disabled={ticketActionBusy}
						onclick={closeTicketAction}
					>
						Close
					</button>
				{/if}
			</div>

			<div class="max-h-80 space-y-3 overflow-y-auto border-t border-line pt-4">
				{#each ticketMessages as msg (msg.id)}
					{@const isAdmin = msg.senderType === 'admin'}
					<div class="flex flex-col" class:items-end={isAdmin}>
						<span class="mb-1 text-xs text-ink-faint">
							{msg.senderType === 'user'
								? t.playerName
								: msg.senderType === 'admin'
									? 'Support'
									: 'System'}
							· {formatDateLabel(msg.createdAt)}
						</span>
						<p
							class="max-w-[80%] rounded-xl px-3 py-2 text-sm"
							style={isAdmin
								? 'background-color: var(--color-primary); color: white;'
								: 'background-color: var(--color-field); color: var(--color-ink);'}
						>
							{msg.messageText}
						</p>
					</div>
				{:else}
					<p class="py-4 text-center text-sm text-ink-soft">No messages yet.</p>
				{/each}
			</div>

			{#if t.status !== 'closed'}
				<form class="mt-4 flex items-center gap-2 border-t border-line pt-4" onsubmit={sendReply}>
					<input
						required
						bind:value={replyText}
						placeholder="Type a reply…"
						class="w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:ring-2 focus:ring-primary-light focus:outline-none"
					/>
					<button
						type="submit"
						disabled={ticketActionBusy}
						class="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
						style="background-color: var(--color-primary);"
					>
						Send
					</button>
				</form>
			{:else}
				<p class="mt-4 border-t border-line pt-4 text-center text-sm text-ink-soft">
					This ticket is closed.
				</p>
			{/if}
		{/if}
	</Modal>
{/if}
