import * as Sentry from '@sentry/sveltekit';
import type { HandleClientError } from '@sveltejs/kit';
import { PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ENVIRONMENT } from '$env/static/public';

// Only initialize Sentry if DSN is configured
if (PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: PUBLIC_SENTRY_DSN,
		environment: PUBLIC_SENTRY_ENVIRONMENT || 'development',
		release: 'dtek@1.0.0', // Required for sessions to work
		debug: true, // Enable debug mode to see what's happening

		// Session Replay - captures user interactions on error
		replaysSessionSampleRate: 0.1, // 10% of sessions
		replaysOnErrorSampleRate: 1.0, // 100% when error occurs

		integrations: [
			Sentry.replayIntegration({
				maskAllText: false, // Ukrainian text is useful for context
				blockAllMedia: false,
			}),
			Sentry.feedbackIntegration({
				colorScheme: 'system',
				// Position in bottom-left to avoid overlap with FAB button
				triggerLabel: 'Помилка?',
				formTitle: 'Повідомити про проблему',
				submitButtonLabel: 'Надіслати',
				cancelButtonLabel: 'Скасувати',
				nameLabel: "Ім'я",
				namePlaceholder: "Ваше ім'я",
				emailLabel: 'Email',
				emailPlaceholder: 'your@email.com',
				messageLabel: 'Опис проблеми',
				messagePlaceholder: 'Що сталося?',
				successMessageText: 'Дякуємо за повідомлення!',
			}),
		],
	});

	// Expose Sentry globally for testing in browser console
	// @ts-expect-error - intentionally adding to window for debugging
	window.Sentry = Sentry;

	console.log('[Sentry] Initialized with DSN:', PUBLIC_SENTRY_DSN.substring(0, 30) + '...');
	console.log('[Sentry] You can test with: Sentry.captureMessage("test")');
}

const myErrorHandler: HandleClientError = ({ error, event }) => {
	console.error('[Client Error]', {
		url: event.url.pathname,
		error: error instanceof Error ? error.message : String(error),
	});
};

export const handleError = Sentry.handleErrorWithSentry(myErrorHandler);
