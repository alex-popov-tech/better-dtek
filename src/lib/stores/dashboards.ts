/**
 * Remembered dashboards - the public dashboards this device has opened
 *
 * Persisted to localStorage so the home page can offer them again.
 * Forgetting a dashboard only affects this device.
 */

import { writable } from 'svelte/store';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';
import { dashboardIdSchema } from '$lib/schemas';

const STORAGE_KEY = 'dtek-dashboards';
const SCHEMA_VERSION = 1;

export interface RememberedDashboard {
	id: string;
	name: string;
	/** Unix timestamp (ms) of the last visit on this device */
	lastVisitedAt: number;
}

interface StoredData {
	version: number;
	data: RememberedDashboard[];
}

function isRememberedDashboard(value: unknown): value is RememberedDashboard {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		dashboardIdSchema.safeParse(entry.id).success &&
		typeof entry.name === 'string' &&
		typeof entry.lastVisitedAt === 'number'
	);
}

/** Most recently visited first */
function sortByLastVisit(dashboards: RememberedDashboard[]): RememberedDashboard[] {
	return [...dashboards].sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
}

/**
 * Load remembered dashboards; anything that is not a version-1 envelope
 * loads as an empty list, and malformed entries are dropped.
 */
function load(): RememberedDashboard[] {
	return loadFromStorage<RememberedDashboard[]>(STORAGE_KEY, [], (parsed) => {
		if (typeof parsed !== 'object' || parsed === null) return null;

		const stored = parsed as Partial<StoredData>;
		if (stored.version !== SCHEMA_VERSION || !Array.isArray(stored.data)) {
			console.warn('[DashboardsStore] Unknown storage format, ignoring.');
			return null;
		}

		return sortByLastVisit(stored.data.filter(isRememberedDashboard));
	});
}

function save(dashboards: RememberedDashboard[]): void {
	saveToStorage<StoredData>(STORAGE_KEY, { version: SCHEMA_VERSION, data: dashboards });
}

function createDashboardsStore() {
	const { subscribe, update } = writable<RememberedDashboard[]>(load());

	return {
		subscribe,

		/**
		 * Record a visit: add the dashboard or refresh its name and visit time
		 */
		remember: ({ id, name }: { id: string; name: string }): void => {
			update((dashboards) => {
				const updated = sortByLastVisit([
					{ id, name, lastVisitedAt: Date.now() },
					...dashboards.filter((d) => d.id !== id),
				]);
				save(updated);
				return updated;
			});
		},

		/**
		 * Remove a dashboard from this device's list (the dashboard itself stays)
		 */
		forget: (id: string): void => {
			update((dashboards) => {
				const updated = dashboards.filter((d) => d.id !== id);
				save(updated);
				return updated;
			});
		},
	};
}

export const dashboardsStore = createDashboardsStore();
