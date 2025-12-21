import { writable, get } from 'svelte/store';
import { fetchCities } from '$lib/utils/api-client';
import { showError } from '$lib/stores/toast';
import type { RegionCode } from '$lib/constants/regions';
import { DEFAULT_REGION } from '$lib/constants/regions';

interface CitiesState {
	region: RegionCode;
	cities: string[];
	loading: boolean;
	error: string | null;
	regionError: string | null; // Specific error for region unavailable
	fetched: boolean;
}

const initialState: CitiesState = {
	region: DEFAULT_REGION,
	cities: [],
	loading: false,
	error: null,
	regionError: null,
	fetched: false,
};

function createCitiesStore() {
	const { subscribe, set, update } = writable<CitiesState>(initialState);

	return {
		subscribe,

		/**
		 * Pre-fetch cities for a specific region
		 * Only fetches if region changed or not yet fetched
		 * @param region - Region code to fetch cities for
		 */
		async prefetch(region: RegionCode): Promise<void> {
			const state = get({ subscribe });

			// Skip if same region and already fetched, loading, or has error
			if (
				state.region === region &&
				(state.fetched || state.loading || state.error || state.regionError)
			) {
				return;
			}

			update((s) => ({ ...s, region, loading: true, error: null, regionError: null }));

			const result = await fetchCities(region);

			if (!result.ok) {
				showError(result.error.message);
				// Check if this is a region unavailable error
				if (result.error.code === 'REGION_UNAVAILABLE') {
					update((s) => ({
						...s,
						loading: false,
						error: null,
						regionError: result.error.message,
					}));
				} else {
					update((s) => ({
						...s,
						loading: false,
						error: result.error.message,
						regionError: null,
					}));
				}
				return;
			}

			set({
				region,
				cities: result.value,
				loading: false,
				error: null,
				regionError: null,
				fetched: true,
			});
		},

		/**
		 * Force refresh cities for the current region (bypasses cache)
		 * @param region - Region code to refresh cities for
		 */
		async refresh(region: RegionCode): Promise<void> {
			update((s) => ({ ...s, region, loading: true, error: null, regionError: null }));

			const result = await fetchCities(region);

			if (!result.ok) {
				showError(result.error.message);
				// Check if this is a region unavailable error
				if (result.error.code === 'REGION_UNAVAILABLE') {
					update((s) => ({
						...s,
						loading: false,
						error: null,
						regionError: result.error.message,
					}));
				} else {
					update((s) => ({
						...s,
						loading: false,
						error: result.error.message,
						regionError: null,
					}));
				}
				return;
			}

			set({
				region,
				cities: result.value,
				loading: false,
				error: null,
				regionError: null,
				fetched: true,
			});
		},

		/**
		 * Get cities synchronously (returns empty array if not yet fetched)
		 */
		getCities(): string[] {
			return get({ subscribe }).cities;
		},

		/**
		 * Get current region
		 */
		getRegion(): RegionCode {
			return get({ subscribe }).region;
		},

		/**
		 * Reset error state (call when modal closes)
		 */
		reset(): void {
			update((s) => ({
				...s,
				error: null,
				regionError: null,
			}));
		},
	};
}

export const citiesStore = createCitiesStore();
