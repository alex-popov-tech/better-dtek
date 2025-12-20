/**
 * Check if we're in browser environment (SSR-safe)
 */
export function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
