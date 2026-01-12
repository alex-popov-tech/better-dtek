import { writable, get } from 'svelte/store';
import type { SavedAddress, BuildingStatus } from '$lib/types/address';
import type { ScheduleRange } from '$lib/types/dtek';
import { fetchBuildingStatuses } from '$lib/utils/api-client';
import { showError } from '$lib/stores/toast';

/**
 * Prefix schedule keys with region to avoid collisions.
 * Same group IDs exist across regions with different schedules.
 */
function prefixSchedulesWithRegion(
	schedules: Record<string, Record<string, ScheduleRange[]>>,
	region: string
): Record<string, Record<string, ScheduleRange[]>> {
	const prefixed: Record<string, Record<string, ScheduleRange[]>> = {};
	for (const [groupId, daySchedules] of Object.entries(schedules)) {
		prefixed[`${region}:${groupId}`] = daySchedules;
	}
	return prefixed;
}

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
 * Schedule cache store - shared across all addresses
 */
const scheduleCacheStore = writable<ScheduleCache | null>(null);

/**
 * Create the address status store
 */
function createAddressStatusStore() {
	const { subscribe, update } = writable<Map<string, StatusCacheEntry>>(new Map());

	/**
	 * Fetch status for a single address
	 */
	async function fetchStatus(address: SavedAddress): Promise<void> {
		const { id, region, city, street, building } = address;

		// Get current entry for preserving status during loading
		const currentCache = get({ subscribe });
		const cachedEntry = currentCache.get(id);

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

		const result = await fetchBuildingStatuses(region, city, street);

		if (!result.ok) {
			showError(result.error.message);

			// Update cache with error
			update((cache) => {
				const newCache = new Map(cache);
				newCache.set(id, {
					status: cachedEntry?.status || null,
					fetchedAt: cachedEntry?.fetchedAt || 0,
					loading: false,
					error: result.error.message,
				});
				return newCache;
			});
			return;
		}

		const response = result.value;

		// Extract status for this specific building
		const buildingStatus = response.buildings[building] || null;

		// Update schedule cache if schedules are present (merge with existing)
		// Prefix with region to avoid collisions (same group IDs exist across regions)
		if (response.schedules && Object.keys(response.schedules).length > 0) {
			const prefixedSchedules = prefixSchedulesWithRegion(response.schedules, region);
			scheduleCacheStore.update((cache) => ({
				schedules: { ...cache?.schedules, ...prefixedSchedules },
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
	}

	/**
	 * Fetch statuses for multiple addresses in parallel
	 */
	async function fetchAllStatuses(addresses: SavedAddress[]): Promise<void> {
		const promises = addresses.map((address) => fetchStatus(address));
		await Promise.allSettled(promises);
	}

	/**
	 * Refresh all address statuses (alias for fetchAllStatuses)
	 */
	const refreshAllStatuses = fetchAllStatuses;

	/**
	 * Invalidate cache for a specific address (forces re-fetch on next access)
	 */
	function invalidate(addressId: string): void {
		update((cache) => {
			const newCache = new Map(cache);
			newCache.delete(addressId);
			return newCache;
		});
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
		refreshAllStatuses,
		invalidate,
		getStatus,
		/** Subscribe to schedule cache updates */
		scheduleCache: {
			subscribe: scheduleCacheStore.subscribe,
		},
		/**
		 * Reset store state (for testing)
		 */
		_reset: (): void => {
			update(() => new Map());
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
