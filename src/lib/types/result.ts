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

/**
 * Type guard for success Result
 */
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => result.ok;

/**
 * Type guard for failure Result
 */
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => !result.ok;

/**
 * Transform the success value
 */
export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
	result.ok ? ok(fn(result.value)) : result;

/**
 * Transform the error value
 */
export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
	result.ok ? result : err(fn(result.error));

/**
 * Chain Results (flatMap)
 */
export const andThen = <T, U, E>(
	result: Result<T, E>,
	fn: (value: T) => Result<U, E>
): Result<U, E> => (result.ok ? fn(result.value) : result);

/**
 * Unwrap with default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
	result.ok ? result.value : defaultValue;

/**
 * Unwrap with error handler
 */
export const unwrapOrElse = <T, E>(result: Result<T, E>, fn: (error: E) => T): T =>
	result.ok ? result.value : fn(result.error);
