<script lang="ts">
	import type { ScheduleRange } from '$lib/types/dtek';
	import { getStatusCategory, getCurrentTimeAsFloat } from '$lib/utils/schedule';

	interface Props {
		ranges: ScheduleRange[];
		/** Show "now" triangle marker (only for today's schedule) */
		showNow?: boolean;
	}

	let { ranges, showNow = false }: Props = $props();

	const HOUR_TICKS = [0, 6, 12, 18, 24];
	const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

	let nowTime = $state(getCurrentTimeAsFloat());

	$effect(() => {
		if (!showNow) return;

		const update = () => {
			nowTime = getCurrentTimeAsFloat();
		};

		const intervalId = setInterval(update, UPDATE_INTERVAL_MS);

		// PWA / backgrounded tab: timers are throttled, so recalculate
		// immediately when the app becomes visible again.
		const onVisibilityChange = () => {
			if (!document.hidden) update();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	const nowPosition = $derived(showNow ? (nowTime / 24) * 100 : null);

	/**
	 * Build a CSS linear-gradient with soft transitions between segments.
	 * Each boundary gets a ~1% transition zone (0.5% from each side ≈ 14min of 24h).
	 * Day start (0%) and end (100%) stay hard-edged.
	 */
	const TRANSITION = 0.25; // percentage to pull inward from each boundary
	const gradient = $derived.by(() => {
		const stops = ranges.map((range) => {
			const category = getStatusCategory(range.status);
			const colorVar = `var(--color-${category})`;
			const startPct = (range.from / 24) * 100;
			const endPct = (range.to / 24) * 100;
			const adjStart = startPct === 0 ? 0 : startPct + TRANSITION;
			const adjEnd = endPct >= 100 ? 100 : endPct - TRANSITION;
			return `${colorVar} ${adjStart}% ${adjEnd}%`;
		});
		return `linear-gradient(to right, ${stops.join(', ')})`;
	});
</script>

<div class="timeline-container">
	<!-- Hour labels -->
	<div class="tick-labels">
		{#each HOUR_TICKS as hour (hour)}
			<span class="tick-label" style="left: {(hour / 24) * 100}%">{hour}</span>
		{/each}
	</div>

	<!-- Bar with gradient fill (single element = no inter-segment seams) -->
	<div class="timeline-bar">
		<div class="timeline-bar-fill" style="background: {gradient}"></div>

		<!-- Tick marks overlaid on the bar (interior hours only) -->
		{#each HOUR_TICKS as hour (hour)}
			{#if hour > 0 && hour < 24}
				<div class="tick-mark" style="left: {(hour / 24) * 100}%"></div>
			{/if}
		{/each}
	</div>

	<!-- Now marker (below bar) -->
	{#if nowPosition !== null}
		<div class="now-row">
			<div class="now-marker" style="left: {nowPosition}%">
				<div class="now-triangle"></div>
			</div>
		</div>
	{/if}
</div>

<style>
	.timeline-container {
		position: relative;
		padding: 2px 12px 4px;
		margin-bottom: 6px;
	}

	/* Hour labels row */
	.tick-labels {
		position: relative;
		height: 14px;
		margin-bottom: 2px;
	}

	.tick-label {
		position: absolute;
		transform: translateX(-50%);
		font-size: 10px;
		line-height: 1;
		color: rgba(148, 163, 184, 0.7); /* slate-400 with some transparency */
		font-variant-numeric: tabular-nums;
	}

	/* The colored bar */
	.timeline-bar {
		position: relative;
		height: 18px;
		border-radius: 4px;
		overflow: hidden;

		/* Segment colors as custom properties (used by gradient in template) */
		--color-yes: #43ce76;
		--color-no: #f37373;
		--color-maybe: #e39944;
	}

	:global(.dark) .timeline-bar {
		--color-yes: #219654;
		--color-no: #a63b41;
		--color-maybe: #985c19;
	}

	.timeline-bar-fill {
		width: 100%;
		height: 100%;
	}

	/* Tick marks on the bar */
	.tick-mark {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1.5px;
		background: rgba(255, 255, 255, 0.3);
		pointer-events: none;
	}

	/* Now marker row (below bar) */
	.now-row {
		position: relative;
		height: 8px;
	}

	.now-marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.now-triangle {
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-bottom: 6px solid #f8fafc; /* slate-50, points up */
	}

	:global(.dark) .now-triangle {
		border-bottom-color: #e2e8f0; /* slate-200 */
	}
</style>
