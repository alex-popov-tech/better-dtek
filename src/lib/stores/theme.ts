import { writable, get } from 'svelte/store';
import { isBrowser } from '$lib/utils/browser';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';

const STORAGE_KEY = 'dtek-theme';

export type Theme = 'light' | 'dark';

/**
 * Get system preference for theme
 */
function getSystemTheme(): Theme {
	if (!isBrowser()) return 'light';

	if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
}

/**
 * Load theme from localStorage, fallback to system preference
 */
function loadTheme(): Theme {
	const systemTheme = getSystemTheme();
	return loadFromStorage<Theme>(STORAGE_KEY, systemTheme, (parsed) =>
		parsed === 'light' || parsed === 'dark' ? parsed : null
	);
}

/**
 * Save theme to localStorage
 */
function saveTheme(theme: Theme): void {
	saveToStorage(STORAGE_KEY, theme);
}

/**
 * Create the theme store
 */
function createThemeStore() {
	const { subscribe, set } = writable<Theme>(loadTheme());

	return {
		subscribe,

		/**
		 * Toggle between light and dark themes
		 */
		toggle: (): void => {
			const currentTheme = get({ subscribe });
			const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';
			set(newTheme);
			saveTheme(newTheme);
		},
	};
}

export const theme = createThemeStore();
