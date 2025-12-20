/**
 * Natural sort utility for Ukrainian text
 * Uses Intl.Collator for proper locale-aware sorting
 */

const ukrainianCollator = new Intl.Collator('uk', {
	numeric: true,
	sensitivity: 'base',
});

/**
 * Sort an array of strings naturally (locale-aware, numeric-aware)
 * @param items - Array of strings to sort
 * @returns New sorted array
 */
export function naturalSort(items: string[]): string[] {
	return [...items].sort(ukrainianCollator.compare);
}

/**
 * Sort object keys naturally and return a new object with sorted keys
 * @param obj - Object with string keys
 * @returns New object with naturally sorted keys
 */
export function naturalSortKeys<T>(obj: Record<string, T>): Record<string, T> {
	const sortedKeys = naturalSort(Object.keys(obj));
	const result: Record<string, T> = {};
	for (const key of sortedKeys) {
		result[key] = obj[key];
	}
	return result;
}
