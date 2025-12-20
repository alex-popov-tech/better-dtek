import { json } from '@sveltejs/kit';
import type { DtekError } from '$lib/types';
import { errorToHttpStatus, errorToUserMessage, formatErrorForLog } from '$lib/types';

/**
 * Handle service error and return appropriate JSON response
 * @param logPrefix - Prefix for console.error log message
 * @param error - DtekError from service result
 * @returns JSON response with error details and appropriate HTTP status
 */
export function handleServiceError(logPrefix: string, error: DtekError) {
	console.error(logPrefix, formatErrorForLog(error));
	return json(
		{ error: error.code, message: errorToUserMessage(error) },
		{ status: errorToHttpStatus(error) }
	);
}
