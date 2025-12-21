/**
 * Retry utility for async operations with Result pattern support
 *
 * Provides automatic retry with stepped delays for transient failures.
 * Works with both exception-throwing functions and Result-returning functions.
 */

import type { Result } from '$lib/types/result';
import { ok, err } from '$lib/types/result';

/** Default retry delays in ms (3 retries after initial attempt) */
export const DEFAULT_RETRY_DELAYS = [500, 1000, 2000];

/**
 * Error returned when all retry attempts are exhausted
 */
export interface RetryError {
	readonly code: 'RETRY_EXHAUSTED';
	readonly message: string;
	readonly attempts: number;
	readonly lastError: unknown;
	readonly timestamp: number;
}

/**
 * Create a RetryError
 */
export const retryError = (attempts: number, lastError: unknown): RetryError => ({
	code: 'RETRY_EXHAUSTED',
	message: `All ${attempts} attempts failed`,
	attempts,
	lastError,
	timestamp: Date.now(),
});

/**
 * Options for retry behavior
 */
export interface RetryOptions {
	/** Delays in ms between attempts. Array length determines max retries. */
	delays?: number[];
	/** Callback before each retry sleep. Useful for logging. */
	onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Type guard to detect Result objects via duck typing
 */
function isResult<T, E>(value: unknown): value is Result<T, E> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'ok' in value &&
		typeof (value as { ok: unknown }).ok === 'boolean'
	);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with stepped delays
 *
 * Handles both thrown errors and Result<T, E> failures.
 * Attempts the operation once, then retries up to delays.length times.
 *
 * @param fn - Async function to retry. Can return T or Result<T, E>.
 * @param options - Retry configuration
 * @returns Result wrapping success value or RetryError with lastError
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => service.getStatus(city, street),
 *   {
 *     delays: [500, 1000, 2000],
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt}, waiting ${delay}ms`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T, E = unknown>(
	fn: () => Promise<T | Result<T, E>>,
	options?: RetryOptions
): Promise<Result<T, E | RetryError>> {
	const delays = options?.delays ?? DEFAULT_RETRY_DELAYS;
	const maxAttempts = delays.length + 1; // Initial + retries

	let lastError: unknown = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const result = await fn();

			// Handle Result type returns
			if (isResult<T, E>(result)) {
				if (result.ok) {
					return result;
				}
				// Result failed - store error and potentially retry
				lastError = result.error;
			} else {
				// Non-Result return - wrap as success
				return ok(result as T);
			}
		} catch (thrown) {
			// Exception thrown - store and potentially retry
			lastError = thrown;
		}

		// If not last attempt, sleep before retry
		if (attempt < maxAttempts) {
			const delayMs = delays[attempt - 1];
			options?.onRetry?.(attempt, lastError, delayMs);
			await sleep(delayMs);
		}
	}

	// All attempts exhausted - wrap last error in RetryError
	return err(retryError(maxAttempts, lastError));
}
