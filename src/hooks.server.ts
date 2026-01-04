import * as Sentry from '@sentry/sveltekit';
import { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ENVIRONMENT } from '$env/static/public';
import type { HandleServerError } from '@sveltejs/kit';

// Initialize Sentry FIRST (only if DSN is configured)
if (PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: PUBLIC_SENTRY_DSN,
		environment: PUBLIC_SENTRY_ENVIRONMENT || 'development',
	});
}

/**
 * Custom error handler with Sentry context
 */
const myErrorHandler: HandleServerError = ({ error, event }) => {
	// Add request context for every error (only if Sentry is initialized)
	if (PUBLIC_SENTRY_DSN) {
		Sentry.setContext('request', {
			url: event.url.pathname,
			method: event.request.method,
			searchParams: Object.fromEntries(event.url.searchParams),
		});

		// Extract region from URL if present
		const region = event.url.searchParams.get('region');
		if (region) {
			Sentry.setTag('region', region);
		}
	}

	// Log the error details
	console.error('[Server Error]', {
		url: event.url.pathname,
		method: event.request.method,
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		timestamp: new Date().toISOString(),
	});

	// Return a safe error message to the client
	return {
		message: 'Внутрішня помилка сервера. Спробуйте пізніше.',
		code: 'INTERNAL_ERROR',
	};
};

export const handleError = Sentry.handleErrorWithSentry(myErrorHandler);

// Sentry request handler for tracing (only if DSN is configured)
export const handle = PUBLIC_SENTRY_DSN ? Sentry.sentryHandle() : undefined;
