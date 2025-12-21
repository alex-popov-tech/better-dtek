<script lang="ts">
	import type { SavedAddress, BuildingStatus } from '$lib/types/address';
	import type { ScheduleRange } from '$lib/types/dtek';
	import { UI_TEXT, TRAFFIC_LIGHT_LABELS, SCHEDULE_INFO_PREFIX } from '$lib/constants/ui-text';
	import { REGIONS } from '$lib/constants/regions';
	import { formatRelativeTime } from '$lib/utils/date-formatter';
	import {
		getUkrainianDayOfWeek,
		getTrafficLightFromSchedule,
		getCurrentRangeInfo,
		type TrafficLightStatus,
	} from '$lib/utils/schedule';
	import TrafficLight from '../atomic/TrafficLight.svelte';
	import RefreshButton from '../atomic/RefreshButton.svelte';
	import ScheduleDisplay from '../atomic/ScheduleDisplay.svelte';

	interface Props {
		address: SavedAddress;
		status: BuildingStatus | null;
		loading?: boolean;
		error?: string | null;
		fetchedAt?: number;
		/** Schedule data by group ID */
		schedules?: Record<string, Record<string, ScheduleRange[]>> | null;
		onrefresh: () => void;
		onedit: () => void;
		ondelete: () => void;
	}

	let {
		address,
		status,
		loading = false,
		error = null,
		fetchedAt,
		schedules = null,
		onrefresh,
		onedit,
		ondelete,
	}: Props = $props();

	const displayLabel = $derived(address.label || address.street);
	const lastUpdated = $derived(fetchedAt ? formatRelativeTime(fetchedAt) : UI_TEXT.loading);
	const regionName = $derived(REGIONS[address.region]?.name || address.region);

	// Get schedule for this building's group
	const groupId = $derived(status?.group);
	const groupSchedule = $derived(groupId && schedules ? schedules[groupId] : null);

	// Get today's ranges for traffic light calculation
	const today = $derived(getUkrainianDayOfWeek());
	const todayRanges = $derived(groupSchedule ? groupSchedule[today] || [] : []);

	// Determine traffic light status
	// Priority: API outage → Schedule → Default 'on'
	const trafficLightStatus = $derived.by((): TrafficLightStatus => {
		// Active outage from API takes precedence
		if (status?.outage) {
			// Only emergency gets pulsing animation, others show solid red
			return status.outage.type === 'emergency' ? 'emergency' : 'off';
		}
		// Use schedule to determine status
		if (todayRanges.length > 0) {
			return getTrafficLightFromSchedule(todayRanges);
		}
		// Default to on if no data
		return 'on';
	});

	// Get current range info for display
	const currentRangeInfo = $derived(
		todayRanges.length > 0 ? getCurrentRangeInfo(todayRanges) : null
	);

	// Format queue number for display (GPV5.2 -> Черга 5.2)
	const queueDisplay = $derived(groupId ? `Черга ${groupId.replace(/^GPV/, '')}` : null);

	// Format outage time range for display (works for all outage types)
	// Same day: "08:00 — 18:00 20.12"
	// Different days: "08:00 20.12 — 18:00 21.12"
	const outageTimeRange = $derived.by(() => {
		if (!status?.outage) return null;
		const { from, to } = status.outage;
		// Parse time and date parts
		const parseDateTime = (dateStr: string) => {
			const match = dateStr.match(/^(\d{2}:\d{2})\s+(\d{2}\.\d{2})/);
			return match ? { time: match[1], date: match[2] } : null;
		};
		const fromParsed = parseDateTime(from);
		const toParsed = parseDateTime(to);
		if (!fromParsed || !toParsed) return `${from} — ${to}`;
		// Same day: show "08:00 — 18:00 20.12"
		if (fromParsed.date === toParsed.date) {
			return `${fromParsed.time} — ${toParsed.time} ${fromParsed.date}`;
		}
		// Different days: show "08:00 20.12 — 18:00 21.12"
		return `${fromParsed.time} ${fromParsed.date} — ${toParsed.time} ${toParsed.date}`;
	});

	// Status text color class - using darker shades for WCAG 4.5:1 contrast
	const statusColorClass = $derived.by(() => {
		switch (trafficLightStatus) {
			case 'on':
				return 'text-green-700 dark:text-green-500';
			case 'maybe':
				return 'text-amber-700 dark:text-amber-500';
			case 'off':
			case 'emergency':
				return 'text-red-600 dark:text-red-400';
		}
	});
</script>

<div
	class="card card-hover p-4 shadow-lg ring-1 ring-surface-200-700-token relative h-full flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5"
>
	{#if loading && !status}
		<!-- Skeleton placeholder (only on initial load, no cached data) -->
		<div class="animate-pulse space-y-3">
			<div class="h-4 bg-surface-300-600-token rounded w-3/4"></div>
			<div class="h-3 bg-surface-300-600-token rounded w-1/2"></div>
			<div class="h-6 bg-surface-300-600-token rounded w-2/3"></div>
		</div>
	{:else}
		<!-- Content (with subtle opacity when refreshing) -->
		<div class="flex-grow" class:opacity-60={loading}>
			<!-- Header: Left content + Right traffic light -->
			<div class="flex justify-between gap-4 mb-4">
				<!-- Left: Title, Address, Status -->
				<div class="flex flex-col">
					<h3 class="h4 font-bold mb-1">{displayLabel}</h3>
					<p class="text-sm text-surface-700-200-token mb-3">
						{regionName}, {address.city}, {address.street}, {address.building}
					</p>

					{#if error}
						<div class="text-red-500 text-sm">
							<p>{error}</p>
							<button class="btn btn-sm variant-ghost-error mt-2" onclick={onrefresh}>
								{UI_TEXT.retry}
							</button>
						</div>
					{:else}
						<!-- Status text group - tighter spacing -->
						<div class="space-y-0.5">
							<div class="text-lg font-medium {statusColorClass}">
								{TRAFFIC_LIGHT_LABELS[trafficLightStatus]}
							</div>
							{#if status?.outage}
								<!-- Active outage from API - show time range -->
								<div class="text-xs text-surface-600-300-token">
									{#if outageTimeRange}{outageTimeRange}{:else}Відключення{/if}
									{#if queueDisplay}
										({queueDisplay}){/if}
								</div>
							{:else if currentRangeInfo}
								<!-- Schedule-based status - show schedule info -->
								<div class="text-xs text-surface-600-300-token">
									{SCHEDULE_INFO_PREFIX}
									{currentRangeInfo}
									{#if queueDisplay}
										({queueDisplay}){/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Right: Traffic Light -->
				{#if !error}
					<div class="self-start">
						<TrafficLight status={trafficLightStatus} />
					</div>
				{/if}
			</div>

			<!-- Schedule -->
			{#if groupSchedule && !error}
				<div>
					<ScheduleDisplay {groupSchedule} />
				</div>
			{/if}
		</div>

		<!-- Footer (outside flex-grow to stick to bottom) -->
		<div
			class="flex items-center justify-between text-xs text-surface-600-300-token mt-3 pt-3 border-t border-surface-200-700-token"
		>
			<span>
				{UI_TEXT.lastUpdated}: {lastUpdated}
			</span>
			<div class="flex gap-2">
				<!-- Edit button -->
				<button
					type="button"
					class="btn-icon btn-icon-sm variant-ghost-surface"
					onclick={onedit}
					aria-label="Редагувати адресу {displayLabel}"
					title="Редагувати"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-4 h-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
						/>
					</svg>
				</button>

				<!-- Delete button -->
				<button
					type="button"
					class="btn-icon btn-icon-sm variant-ghost-error"
					onclick={ondelete}
					aria-label="Видалити адресу {displayLabel}"
					title="Видалити"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-4 h-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
						/>
					</svg>
				</button>

				<!-- Refresh button -->
				<RefreshButton onclick={onrefresh} {loading} icon={true} />
			</div>
		</div>
	{/if}
</div>
