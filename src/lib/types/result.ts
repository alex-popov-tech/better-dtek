/**
 * Result type for explicit error handling
 *
 * Provides a type-safe alternative to exceptions for representing
 * success/failure outcomes with rich error context.
 */

/**
 * Result discriminated union - either success with value or failure with error
 */
export type Result<T, E> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E };

/**
 * Create a success Result
 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/**
 * Create a failure Result
 */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
