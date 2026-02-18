/**
 * Mobile phone detection utility (SSR-safe)
 *
 * Detects touch-capable devices with narrow viewports (phones only, not tablets).
 * Uses navigator.maxTouchPoints + viewport width check matching Tailwind's `sm` breakpoint.
 */

const MOBILE_MAX_WIDTH = '(max-width: 639px)';

/**
 * Check if the current device is a mobile phone.
 * Returns false on server, tablets, and desktops.
 */
export function isMobilePhone(): boolean {
	if (typeof window === 'undefined') return false;

	const hasTouch = navigator.maxTouchPoints > 0;
	const isNarrowViewport = window.matchMedia(MOBILE_MAX_WIDTH).matches;

	return hasTouch && isNarrowViewport;
}

/**
 * Subscribe to mobile phone detection changes (e.g. device rotation).
 * Calls the callback immediately with current state, then on every change.
 * Returns an unsubscribe function.
 */
export function onMobilePhoneChange(callback: (isMobile: boolean) => void): () => void {
	if (typeof window === 'undefined') {
		callback(false);
		return () => {};
	}

	const mql = window.matchMedia(MOBILE_MAX_WIDTH);

	function update() {
		const hasTouch = navigator.maxTouchPoints > 0;
		callback(hasTouch && mql.matches);
	}

	update();
	mql.addEventListener('change', update);

	return () => mql.removeEventListener('change', update);
}
