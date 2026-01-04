import { json } from '@sveltejs/kit';
import type { DtekError } from '$lib/types';
import { errorToHttpStatus, errorToUserMessage, formatErrorForLog } from '$lib/types';
import type { RetryError } from '$lib/utils/retry';
import { captureDtekError } from './sentry';

/**
 * Handle service error and return appropriate JSON response
 * @param logPrefix - Prefix for console.error log message
 * @param error - DtekError from service result
 * @returns JSON response with error details and appropriate HTTP status
 */
export function handleServiceError(logPrefix: string, error: DtekError) {
	console.error(logPrefix, formatErrorForLog(error));

	// Capture to Sentry with full context
	captureDtekError(error, { logPrefix });

	return json(
		{ error: error.code, message: errorToUserMessage(error) },
		{ status: errorToHttpStatus(error) }
	);
}

/**
 * Unwrap RetryError to get the underlying DtekError
 *
 * When retry exhausts all attempts, it wraps the last error in RetryError.
 * This helper extracts the original DtekError for proper error handling.
 *
 * @param error - Either a DtekError or RetryError from withRetry
 * @returns The underlying DtekError
 */
export function unwrapRetryError(error: DtekError | RetryError): DtekError {
	if ('lastError' in error && error.code === 'RETRY_EXHAUSTED') {
		return error.lastError as DtekError;
	}
	return error as DtekError;
}
