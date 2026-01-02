import { writable } from 'svelte/store';
import type { SavedAddress } from '$lib/types/address.js';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';

const STORAGE_KEY = 'dtek-addresses';
const SCHEMA_VERSION = 2; // Version 2 adds region field

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
