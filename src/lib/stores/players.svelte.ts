import { fetchUsers } from '$lib/services/users';
import type { AdminManagedUser } from '$lib/types';

// Shared players data. The players route owns pagination/search and calls load()
// directly on every visit; dashboard/tickets/disputes only need a best-effort total count
// or name lookup, so they call ensureLoaded() to reuse whatever's already been fetched
// instead of triggering their own fetch.
class PlayersStore {
	list = $state<AdminManagedUser[]>([]);
	total = $state(0);
	totalPages = $state(1);
	loading = $state(false);
	error = $state('');
	loaded = false;

	async load(page: number, query: string) {
		this.loading = true;
		this.error = '';
		try {
			const result = await fetchUsers(page, query);
			this.list = result.items;
			this.total = result.total;
			this.totalPages = result.totalPages;
			this.loaded = true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load players.';
		} finally {
			this.loading = false;
		}
	}

	async ensureLoaded() {
		if (this.loaded) return;
		await this.load(1, '');
	}

	// Fallback only — used where a ticket/dispute detail view lacks the joined player name
	// (mutation responses and the single-item detail fetch don't carry it, only the
	// paginated lists do). Since the list is itself paginated, this can miss for a player
	// outside whatever page happens to be loaded.
	nameFor(userId: string): string {
		return this.list.find((p) => p.id === userId)?.name ?? 'Unknown player';
	}

	applyUpdated(updated: AdminManagedUser) {
		this.list = this.list.map((p) => (p.id === updated.id ? updated : p));
	}
}

export const playersStore = new PlayersStore();
