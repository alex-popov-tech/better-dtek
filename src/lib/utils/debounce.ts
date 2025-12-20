/**
 * Creates a debounced version of a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
	fn: T,
	delay: number
): T & { cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const debounced = ((...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, delay);
	}) as T & { cancel: () => void };

	debounced.cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	};

	return debounced;
}
