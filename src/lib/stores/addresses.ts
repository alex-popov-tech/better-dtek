import { writable } from 'svelte/store';
import type { SavedAddress } from '$lib/types/address.js';
import type { RegionCode } from '$lib/constants/regions';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';

const STORAGE_KEY = 'dtek-addresses';
const INTERACTED_KEY = 'dtek-has-interacted';
const SCHEMA_VERSION = 2; // Version 2 adds region field

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
 * Versioned storage format
 */
interface StoredData {
	version: number;
	data: SavedAddress[];
}

/**
 * Load addresses from localStorage with schema validation
 * Clears data if schema version doesn't match
 */
function loadAddresses(): SavedAddress[] {
	return loadFromStorage<SavedAddress[]>(STORAGE_KEY, [], (parsed) => {
		// Check if it's the new versioned format
		if (typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
			const stored = parsed as StoredData;
			if (stored.version !== SCHEMA_VERSION) {
				console.warn(
					`[AddressStore] Schema version mismatch: expected ${SCHEMA_VERSION}, got ${stored.version}. Clearing data.`
				);
				return null; // Return null to use default (empty array)
			}
			return Array.isArray(stored.data) ? stored.data : null;
		}
		// Old format (array directly) - version 1 without region, clear it
		console.warn('[AddressStore] Old schema format detected (missing version), clearing data.');
		return null;
	});
}

/**
 * Save addresses to localStorage with version
 */
function saveAddresses(addresses: SavedAddress[]): void {
	const data: StoredData = { version: SCHEMA_VERSION, data: addresses };
	saveToStorage(STORAGE_KEY, data);
}

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
 * Create the addresses store
 */
function createAddressesStore() {
	const { subscribe, update } = writable<SavedAddress[]>(loadAddresses());

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
				saveAddresses(updated);
				return updated;
			});
		},

		/**
		 * Update an existing address
		 */
		update: (id: string, address: Omit<SavedAddress, 'id' | 'createdAt'>): void => {
			update((addresses) => {
				const updated = addresses.map((a) => (a.id === id ? { ...a, ...address } : a));
				saveAddresses(updated);
				return updated;
			});
		},

		/**
		 * Remove an address by ID
		 */
		remove: (id: string): void => {
			update((addresses) => {
				const updated = addresses.filter((a) => a.id !== id);
				saveAddresses(updated);
				return updated;
			});
		},

		/**
		 * Clear all addresses (for testing)
		 */
		_reset: (): void => {
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

	const addresses = loadAddresses();
	if (addresses.length === 0) {
		// First time user - inject sample address
		addressesStore.add(SAMPLE_ADDRESS);
	}
}
