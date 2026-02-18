<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { onMobilePhoneChange } from '$lib/utils/mobile';
	import { UI_TEXT } from '$lib/constants/ui-text';

	// --- Configuration ---
	const TOP_THRESHOLD = 50; // visual px needed to trigger top refresh
	const RESISTANCE = 1.5; // finger distance / visual distance ratio
	const MAX_PULL = 100; // cap on visual displacement in px
	const SPINNER_SIZE = 56; // spinner container height during active refresh
	const SNAP_BACK_MS = 300; // snap-back animation duration
	const DEADZONE = 8; // ignore movement below this in px

	// --- Props ---
	interface Props {
		/** Callback to trigger refresh. Must return a Promise that resolves when done. */
		onRefresh: () => Promise<void>;
		/** Whether a refresh is currently in progress */
		isRefreshing: boolean;
		/** Slot content */
		children: Snippet;
	}

	let { onRefresh, isRefreshing, children }: Props = $props();

	// --- Reactive state ---
	let isMobile = $state(false);
	let pulling = $state(false);
	let topHeight = $state(0);
	let animating = $state(false); // true during snap-back CSS transition
	let triggered = $state(false); // true once onRefresh has been called for this gesture

	// Non-reactive touch tracking
	let startY = 0;
	let tracking = false;
	let scrollEl: HTMLElement | null = null;

	// --- Derived ---
	const topProgress = $derived(pulling ? Math.min(topHeight / TOP_THRESHOLD, 1) : 0);

	// --- Effects ---

	// Subscribe to mobile phone detection
	onMount(() => {
		return onMobilePhoneChange((mobile) => {
			isMobile = mobile;
		});
	});

	// Attach/detach touch listeners reactively
	$effect(() => {
		if (!isMobile) return;

		const el = document.getElementById('page');
		if (!el) return;
		scrollEl = el;

		el.addEventListener('touchstart', onTouchStart, { passive: true });
		el.addEventListener('touchmove', onTouchMove, { passive: false });
		el.addEventListener('touchend', onTouchEnd, { passive: true });

		return () => {
			el.removeEventListener('touchstart', onTouchStart);
			el.removeEventListener('touchmove', onTouchMove);
			el.removeEventListener('touchend', onTouchEnd);
			scrollEl = null;
		};
	});

	// Snap back when refresh completes
	$effect(() => {
		if (!isRefreshing && triggered) {
			snapBack();
		}
	});

	// --- Touch handlers ---
	function onTouchStart(e: TouchEvent) {
		if (isRefreshing || animating) return;

		startY = e.touches[0].clientY;
		tracking = false;
		pulling = false;
		topHeight = 0;
		triggered = false;
	}

	function onTouchMove(e: TouchEvent) {
		if (!scrollEl || isRefreshing || animating) return;

		const currentY = e.touches[0].clientY;
		const rawDelta = currentY - startY; // positive = finger moving down

		const atTop = scrollEl.scrollTop <= 0;

		// Determine direction on first significant movement
		if (!tracking) {
			if (Math.abs(rawDelta) < DEADZONE) return;

			if (rawDelta > 0 && atTop) {
				pulling = true;
				tracking = true;
				// Reset reference point so pull distance starts from 0
				startY = currentY;
				return;
			}

			// Not a top-pull gesture — don't interfere with normal scrolling
			return;
		}

		// Update visual displacement
		const pullDelta = currentY - startY;
		if (pulling && pullDelta > 0 && atTop) {
			e.preventDefault();
			topHeight = Math.min(pullDelta / RESISTANCE, MAX_PULL);
		} else if (tracking) {
			// User reversed direction or scrolled away from top
			tracking = false;
			pulling = false;
			topHeight = 0;
		}
	}

	function onTouchEnd() {
		if (!tracking || isRefreshing) return;
		tracking = false;

		if (pulling && topHeight >= TOP_THRESHOLD) {
			triggered = true;
			topHeight = SPINNER_SIZE;
			onRefresh();
		} else {
			snapBack();
		}
	}

	// --- Helpers ---
	function snapBack() {
		// Frame 1: apply transition class (height still at current value)
		animating = true;

		// Frame 2: set height to 0 — CSS transition animates the change
		requestAnimationFrame(() => {
			topHeight = 0;

			setTimeout(() => {
				animating = false;
				pulling = false;
				triggered = false;
			}, SNAP_BACK_MS);
		});
	}
</script>

<!-- Top pull indicator (always rendered, height 0 when inactive) -->
<div
	class="ptr-indicator"
	class:ptr-indicator--animating={animating}
	style:height="{topHeight}px"
	aria-hidden="true"
>
	<div
		class="ptr-spinner"
		class:ptr-spinner--spinning={isRefreshing && pulling}
		style:opacity={isRefreshing && pulling ? 1 : topProgress}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-6 h-6"
			aria-label={UI_TEXT.refreshing}
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
			/>
		</svg>
	</div>
</div>

<!-- Slotted content -->
{@render children()}

<style>
	.ptr-indicator {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		overflow: hidden;
		width: 100%;
		height: 0;
		padding-bottom: 12px;
	}

	.ptr-indicator--animating {
		transition: height 300ms cubic-bezier(0, 0, 0.2, 1);
	}

	.ptr-spinner {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: rgb(var(--color-surface-500));
	}

	.ptr-spinner--spinning {
		animation: ptr-spin 1s linear infinite;
	}

	@keyframes ptr-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
