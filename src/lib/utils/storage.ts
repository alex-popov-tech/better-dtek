import { isBrowser } from './browser';

/**
 * Load a value from localStorage with optional validation
 * @param key - localStorage key
 * @param defaultValue - Value to return if not found or invalid
 * @param validate - Optional validation function that returns the validated value or null if invalid
 * @returns The stored value, validated value, or default value
 */
export function loadFromStorage<T>(
	key: string,
	defaultValue: T,
	validate?: (parsed: unknown) => T | null
): T {
	if (!isBrowser()) return defaultValue;

	try {
		const stored = localStorage.getItem(key);
		if (stored === null) return defaultValue;

		const parsed = JSON.parse(stored);

		if (validate) {
			const validated = validate(parsed);
			return validated !== null ? validated : defaultValue;
		}

		return parsed as T;
	} catch (error) {
		console.error(`Failed to load ${key} from localStorage:`, error);
		return defaultValue;
	}
}

/**
 * Save a value to localStorage
 * @param key - localStorage key
 * @param value - Value to store (will be JSON stringified)
 */
export function saveToStorage<T>(key: string, value: T): void {
	if (!isBrowser()) return;

	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error(`Failed to save ${key} to localStorage:`, error);
	}
}
