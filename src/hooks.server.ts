import type { HandleServerError } from '@sveltejs/kit';

/**
 * Global error handler for server-side errors
 * Prevents server crashes and logs errors properly
 */
export const handleError: HandleServerError = ({ error, event }) => {
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
