/**
 * Toast notification utilities
 *
 * Provides helper functions for showing toast notifications using Skeleton's toast store.
 * The toast store reference is captured during app initialization.
 */

import type { ToastStore } from '@skeletonlabs/skeleton';

/** Cached toast store reference */
let toastStoreRef: ToastStore | null = null;

/**
 * Initialize the toast store reference.
 * Must be called once from the root layout component after initializeStores().
 */
export function initToastStore(store: ToastStore): void {
	toastStoreRef = store;
}

/**
 * Show an error toast notification
 * @param message - The error message to display (Ukrainian)
 */
export function showError(message: string): void {
	if (!toastStoreRef) {
		console.error('[Toast] Store not initialized. Call initToastStore() first.');
		return;
	}
	toastStoreRef.trigger({
		message,
		background: 'variant-filled-error',
	});
}
