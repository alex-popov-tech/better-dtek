import { writable, get } from 'svelte/store';
import { fetchCities } from '$lib/utils/api-client';

interface CitiesState {
	cities: string[];
	loading: boolean;
	error: string | null;
	fetched: boolean;
}

const initialState: CitiesState = {
	cities: [],
	loading: false,
	error: null,
	fetched: false,
};

function createCitiesStore() {
	const { subscribe, set, update } = writable<CitiesState>(initialState);

	return {
		subscribe,

		/**
		 * Pre-fetch cities (call on app load)
		 * Only fetches once - subsequent calls are no-ops if already fetched
		 */
		async prefetch(): Promise<void> {
			const state = get({ subscribe });

			// Skip if already fetched or currently loading
			if (state.fetched || state.loading) {
				return;
			}

			update((s) => ({ ...s, loading: true, error: null }));

			try {
				const cities = await fetchCities();
				set({ cities, loading: false, error: null, fetched: true });
			} catch (err) {
				update((s) => ({
					...s,
					loading: false,
					error: err instanceof Error ? err.message : 'Failed to fetch cities',
				}));
			}
		},

		/**
		 * Force refresh cities (bypasses cache)
		 */
		async refresh(): Promise<void> {
			update((s) => ({ ...s, loading: true, error: null }));

			try {
				const cities = await fetchCities();
				set({ cities, loading: false, error: null, fetched: true });
			} catch (err) {
				update((s) => ({
					...s,
					loading: false,
					error: err instanceof Error ? err.message : 'Failed to fetch cities',
				}));
			}
		},

		/**
		 * Get cities synchronously (returns empty array if not yet fetched)
		 */
		getCities(): string[] {
			return get({ subscribe }).cities;
		},
	};
}

export const citiesStore = createCitiesStore();
