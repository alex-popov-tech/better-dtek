import { writable, get } from 'svelte/store';
import type { SavedAddress, BuildingStatus } from '$lib/types/address';
import type { ScheduleRange } from '$lib/types/dtek';
import { fetchBuildingStatuses } from '$lib/utils/api-client';

/**
 * Cached schedule data from API responses
 */
export interface ScheduleCache {
	/** Schedules by group ID, then by day (1-7) */
	schedules: Record<string, Record<string, ScheduleRange[]>>;
	/** Unix timestamp when schedules were last updated */
	fetchedAt: number;
}

/**
 * Cache entry for a single address status
 */
export interface StatusCacheEntry {
	/** Building status */
	status: BuildingStatus | null;
	/** Unix timestamp when status was fetched */
	fetchedAt: number;
	/** Loading state for this address */
	loading: boolean;
	/** Error message if fetch failed */
	error: string | null;
}

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Check if a cache entry is stale
 */
function isStale(entry: StatusCacheEntry): boolean {
	return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

/**
 * Schedule cache store - shared across all addresses
 */
const scheduleCacheStore = writable<ScheduleCache | null>(null);

/**
 * Create the address status store
 */
function createAddressStatusStore() {
	const { subscribe, set, update } = writable<Map<string, StatusCacheEntry>>(new Map());

	/**
	 * Fetch status for a single address
	 */
	async function fetchStatus(address: SavedAddress): Promise<void> {
		const { id, city, street, building } = address;

		// Check cache first
		const currentCache = get({ subscribe });
		const cachedEntry = currentCache.get(id);
		if (cachedEntry && !isStale(cachedEntry) && !cachedEntry.error) {
			// Cache hit and not stale - skip fetch
			return;
		}

		// Set loading state
		update((cache) => {
			const newCache = new Map(cache);
			newCache.set(id, {
				status: cachedEntry?.status || null,
				fetchedAt: cachedEntry?.fetchedAt || 0,
				loading: true,
				error: null,
			});
			return newCache;
		});

		try {
			const response = await fetchBuildingStatuses(city, street);

			// Extract status for this specific building
			const buildingStatus = response.buildings[building] || null;

			// Update schedule cache if schedules are present (merge with existing)
			if (response.schedules && Object.keys(response.schedules).length > 0) {
				scheduleCacheStore.update((cache) => ({
					schedules: { ...cache?.schedules, ...response.schedules },
					fetchedAt: response.fetchedAt,
				}));
			}

			// Update cache with fetched status
			update((cache) => {
				const newCache = new Map(cache);
				newCache.set(id, {
					status: buildingStatus,
					fetchedAt: response.fetchedAt,
					loading: false,
					error: null,
				});
				return newCache;
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Невідома помилка';

			// Update cache with error
			update((cache) => {
				const newCache = new Map(cache);
				newCache.set(id, {
					status: cachedEntry?.status || null,
					fetchedAt: cachedEntry?.fetchedAt || 0,
					loading: false,
					error: errorMessage,
				});
				return newCache;
			});
		}
	}

	/**
	 * Fetch statuses for multiple addresses in parallel
	 */
	async function fetchAllStatuses(addresses: SavedAddress[]): Promise<void> {
		const promises = addresses.map((address) => fetchStatus(address));
		await Promise.allSettled(promises);
	}

	/**
	 * Force refresh status for a single address (ignoring cache TTL, but keeping old data visible)
	 */
	async function refreshStatus(addressId: string, address: SavedAddress): Promise<void> {
		const { city, street, building } = address;

		// Get current cached entry to preserve old data
		const currentCache = get({ subscribe });
		const cachedEntry = currentCache.get(addressId);

		// Set loading state while keeping old data visible (optimistic UI)
		update((cache) => {
			const newCache = new Map(cache);
			newCache.set(addressId, {
				status: cachedEntry?.status || null,
				fetchedAt: cachedEntry?.fetchedAt || 0,
				loading: true,
				error: null,
			});
			return newCache;
		});

		try {
			const response = await fetchBuildingStatuses(city, street);
			const buildingStatus = response.buildings[building] || null;

			// Update schedule cache if schedules are present (merge with existing)
			if (response.schedules && Object.keys(response.schedules).length > 0) {
				scheduleCacheStore.update((cache) => ({
					schedules: { ...cache?.schedules, ...response.schedules },
					fetchedAt: response.fetchedAt,
				}));
			}

			update((cache) => {
				const newCache = new Map(cache);
				newCache.set(addressId, {
					status: buildingStatus,
					fetchedAt: response.fetchedAt,
					loading: false,
					error: null,
				});
				return newCache;
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Невідома помилка';

			update((cache) => {
				const newCache = new Map(cache);
				newCache.set(addressId, {
					status: cachedEntry?.status || null,
					fetchedAt: cachedEntry?.fetchedAt || 0,
					loading: false,
					error: errorMessage,
				});
				return newCache;
			});
		}
	}

	/**
	 * Force refresh all statuses (ignoring cache TTL, but keeping old data visible)
	 */
	async function refreshAllStatuses(addresses: SavedAddress[]): Promise<void> {
		const promises = addresses.map((address) => refreshStatus(address.id, address));
		await Promise.allSettled(promises);
	}

	/**
	 * Clear all cached statuses
	 */
	function clearCache(): void {
		set(new Map());
	}

	/**
	 * Get status for a specific address ID
	 */
	function getStatus(addressId: string): StatusCacheEntry | undefined {
		const currentCache = get({ subscribe });
		return currentCache.get(addressId);
	}

	return {
		subscribe,
		fetchStatus,
		fetchAllStatuses,
		refreshStatus,
		refreshAllStatuses,
		clearCache,
		getStatus,
		/** Subscribe to schedule cache updates */
		scheduleCache: {
			subscribe: scheduleCacheStore.subscribe,
		},
	};
}

/**
 * Global address status store instance
 */
export const addressStatusStore = createAddressStatusStore();

/**
 * Export schedule cache store directly for easier subscription
 */
export { scheduleCacheStore };
