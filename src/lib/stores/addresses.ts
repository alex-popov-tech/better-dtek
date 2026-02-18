import { writable } from 'svelte/store';
import type { SavedAddress } from '$lib/types/address.js';
import type { RegionCode } from '$lib/constants/regions';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';

const STORAGE_KEY = 'dtek-addresses';
const INTERACTED_KEY = 'dtek-has-interacted';
const SCHEMA_VERSION = 3; // Version 3 adds uiState for schedule expand/collapse

/**
 * Sample address shown to first-time users
 */
const SAMPLE_ADDRESS: Omit<SavedAddress, 'id' | 'createdAt'> = {
	region: 'kem' as RegionCode,
	city: 'м. Київ',
	street: 'вул. Хрещатик',
	building: '1',
	label: 'Приклад',
};

/**
 * Per-address schedule section expand/collapse state
 */
export interface ScheduleExpandState {
	todayExpanded: boolean;
	tomorrowExpanded: boolean;
}

const DEFAULT_EXPAND_STATE: ScheduleExpandState = {
	todayExpanded: true,
	tomorrowExpanded: false,
};

/**
 * Versioned storage envelope — single source of truth for all address-related data
 */
interface StoredData {
	version: number;
	data: SavedAddress[];
	uiState: Record<string, ScheduleExpandState>;
}

const DEFAULT_ENVELOPE: StoredData = {
	version: SCHEMA_VERSION,
	data: [],
	uiState: {},
};

/**
 * Load the full envelope from localStorage with schema migration
 *
 * Migration chain:
 *   v1 (raw array, no version) → wipe (no region field, can't salvage)
 *   v2 { version: 2, data }    → v3: add uiState: {}
 *   v3 { version: 3, data, uiState } → current, use as-is
 *   v4+ (future unknown)       → wipe with warning
 */
function loadEnvelope(): StoredData {
	return loadFromStorage<StoredData>(STORAGE_KEY, DEFAULT_ENVELOPE, (parsed) => {
		if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
			console.warn('[AddressStore] Old schema format detected (missing version), clearing data.');
			return null;
		}

		const stored = parsed as { version: number; data?: unknown; uiState?: unknown };

		if (!Array.isArray(stored.data)) {
			console.warn('[AddressStore] Invalid data format, clearing.');
			return null;
		}

		// Migrate v2 → v3: add empty uiState
		if (stored.version === 2) {
			return { version: SCHEMA_VERSION, data: stored.data, uiState: {} };
		}

		// Current version
		if (stored.version === SCHEMA_VERSION) {
			const uiState =
				typeof stored.uiState === 'object' && stored.uiState !== null
					? (stored.uiState as Record<string, ScheduleExpandState>)
					: {};
			return { version: SCHEMA_VERSION, data: stored.data, uiState };
		}

		// Unknown future version
		console.warn(`[AddressStore] Schema version ${stored.version} not supported, clearing data.`);
		return null;
	});
}

/**
 * Save the full envelope to localStorage
 */
function saveEnvelope(envelope: StoredData): void {
	saveToStorage(STORAGE_KEY, envelope);
}

// Module-level state: loaded once, mutated in place, saved as a whole
let currentEnvelope: StoredData = loadEnvelope();
// Eagerly persist migration (no-op on SSR via isBrowser guard in saveToStorage)
saveEnvelope(currentEnvelope);

/**
 * Check if user has ever added an address
 */
function hasUserInteracted(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(INTERACTED_KEY) === 'true';
}

/**
 * Mark that user has interacted (added an address)
 */
function markUserInteracted(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(INTERACTED_KEY, 'true');
}

/**
 * Generate a simple UUID v4
 */
function generateId(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Get persisted schedule expand/collapse state for an address
 */
export function getScheduleExpandState(addressId: string): ScheduleExpandState {
	return currentEnvelope.uiState[addressId] ?? { ...DEFAULT_EXPAND_STATE };
}

/**
 * Persist schedule expand/collapse state for an address
 * Includes dirty check — skips save if state is unchanged
 */
export function setScheduleExpandState(addressId: string, state: ScheduleExpandState): void {
	const current = currentEnvelope.uiState[addressId];
	if (
		current &&
		current.todayExpanded === state.todayExpanded &&
		current.tomorrowExpanded === state.tomorrowExpanded
	) {
		return; // No change, skip save
	}

	currentEnvelope = {
		...currentEnvelope,
		uiState: { ...currentEnvelope.uiState, [addressId]: state },
	};
	saveEnvelope(currentEnvelope);
}

/**
 * Create the addresses store
 */
function createAddressesStore() {
	const { subscribe, update } = writable<SavedAddress[]>(currentEnvelope.data);

	return {
		subscribe,

		/**
		 * Add a new address
		 */
		add: (address: Omit<SavedAddress, 'id' | 'createdAt'>): void => {
			markUserInteracted();
			update((addresses) => {
				const newAddress: SavedAddress = {
					...address,
					id: generateId(),
					createdAt: Date.now(),
				};
				const updated = [...addresses, newAddress];
				currentEnvelope = { ...currentEnvelope, data: updated };
				saveEnvelope(currentEnvelope);
				return updated;
			});
		},

		/**
		 * Update an existing address
		 */
		update: (id: string, address: Omit<SavedAddress, 'id' | 'createdAt'>): void => {
			update((addresses) => {
				const updated = addresses.map((a) => (a.id === id ? { ...a, ...address } : a));
				currentEnvelope = { ...currentEnvelope, data: updated };
				saveEnvelope(currentEnvelope);
				return updated;
			});
		},

		/**
		 * Remove an address by ID
		 */
		remove: (id: string): void => {
			update((addresses) => {
				const updated = addresses.filter((a) => a.id !== id);
				const remainingUIState = { ...currentEnvelope.uiState };
				delete remainingUIState[id];
				currentEnvelope = { ...currentEnvelope, data: updated, uiState: remainingUIState };
				saveEnvelope(currentEnvelope);
				return updated;
			});
		},

		/**
		 * Clear all addresses and UI state (for testing)
		 */
		_reset: (): void => {
			currentEnvelope = { version: SCHEMA_VERSION, data: [], uiState: {} };
			update(() => []);
		},
	};
}

export const addressesStore = createAddressesStore();

/**
 * Initialize sample address for first-time users
 * Should be called once on app load
 */
export function initializeForFirstTimeUser(): void {
	if (hasUserInteracted()) return;

	if (currentEnvelope.data.length === 0) {
		// First time user - inject sample address
		addressesStore.add(SAMPLE_ADDRESS);
	}
}
