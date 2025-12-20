import { writable } from 'svelte/store';
import type { SavedAddress } from '$lib/types/address.js';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';

const STORAGE_KEY = 'dtek-addresses';

/**
 * Load addresses from localStorage
 */
function loadAddresses(): SavedAddress[] {
	return loadFromStorage<SavedAddress[]>(STORAGE_KEY, [], (parsed) =>
		Array.isArray(parsed) ? parsed : null
	);
}

/**
 * Save addresses to localStorage
 */
function saveAddresses(addresses: SavedAddress[]): void {
	saveToStorage(STORAGE_KEY, addresses);
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
	const { subscribe, set, update } = writable<SavedAddress[]>(loadAddresses());

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
		 * Clear all addresses
		 */
		clear: (): void => {
			set([]);
			saveAddresses([]);
		},
	};
}

export const addressesStore = createAddressesStore();
