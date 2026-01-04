/**
 * Sentry integration utilities
 *
 * Helpers for capturing DtekErrors with full context to Sentry.
 */

import * as Sentry from '@sentry/sveltekit';
import { PUBLIC_SENTRY_DSN } from '$env/static/public';
import type { DtekError } from '$lib/types/errors';
import { formatErrorForLog } from '$lib/types/errors';

/**
 * Check if Sentry is configured
 */
export const isSentryEnabled = (): boolean => !!PUBLIC_SENTRY_DSN;

/**
 * Capture a DtekError with full context to Sentry
 */
export function captureDtekError(error: DtekError, extra?: Record<string, unknown>): void {
	if (!isSentryEnabled()) return;

	Sentry.setTag('error_code', error.code);

	// Add error-specific context
	Sentry.setContext('dtek_error', {
		code: error.code,
		message: error.message,
		timestamp: new Date(error.timestamp).toISOString(),
		formatted: formatErrorForLog(error),
		...getErrorSpecificContext(error),
	});

	if (extra) {
		Sentry.setContext('extra', extra);
	}

	// Capture with original cause if available
	const captureError =
		error.cause instanceof Error ? error.cause : new Error(`[${error.code}] ${error.message}`);

	Sentry.captureException(captureError);
}

/**
 * Extract error-specific context based on error type
 */
function getErrorSpecificContext(error: DtekError): Record<string, unknown> {
	switch (error.code) {
		case 'NETWORK_ERROR':
			return { url: error.url, httpStatus: error.httpStatus };
		case 'PARSE_ERROR':
			return { parseType: error.parseType, expected: error.expected, found: error.found };
		case 'SESSION_ERROR':
			return { reason: error.reason, httpStatus: error.httpStatus };
		case 'VALIDATION_ERROR':
			return { field: error.field, constraint: error.constraint };
		case 'REGION_UNAVAILABLE':
			return { region: error.region };
		case 'KV_ERROR':
			return {};
		default:
			return {};
	}
}

/**
 * Add breadcrumb for API operations
 */
export function addApiBreadcrumb(action: string, data: Record<string, unknown>): void {
	if (!isSentryEnabled()) return;

	Sentry.addBreadcrumb({
		category: 'api',
		message: action,
		data,
		level: 'info',
	});
}

/**
 * Set region tag for error filtering
 */
export function setRegionTag(region: string): void {
	if (!isSentryEnabled()) return;

	Sentry.setTag('region', region);
}
