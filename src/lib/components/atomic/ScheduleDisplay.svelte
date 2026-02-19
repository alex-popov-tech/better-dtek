<script lang="ts">
	import type { ScheduleRange } from '$lib/types/dtek';
	import CollapsibleSection from './CollapsibleSection.svelte';
	import ScheduleTimeline from './ScheduleTimeline.svelte';
	import ScheduleList from './ScheduleList.svelte';
	import { getUkrainianDayOfWeek, getTomorrowDayOfWeek } from '$lib/utils/schedule';
	import { DAY_NAMES_SHORT } from '$lib/constants/ui-text';

	interface Props {
		/** Schedule data for a group (day -> ranges) */
		groupSchedule: Record<string, ScheduleRange[]>;
		/** Whether today's section is expanded (bindable, default true) */
		todayExpanded?: boolean;
		/** Whether tomorrow's section is expanded (bindable, default false) */
		tomorrowExpanded?: boolean;
		/** Whether tomorrow's schedule has real outage data (controls 'Оновлений' badge) */
		isTomorrowUpdated?: boolean;
	}

	let {
		groupSchedule,
		todayExpanded = $bindable(true),
		tomorrowExpanded = $bindable(false),
		isTomorrowUpdated = false,
	}: Props = $props();

	const today = $derived(getUkrainianDayOfWeek());
	const tomorrow = $derived(getTomorrowDayOfWeek());

	const todayRanges = $derived(groupSchedule[today] || []);
	const tomorrowRanges = $derived(groupSchedule[tomorrow] || []);

	const tomorrowBadge = $derived(
		isTomorrowUpdated
			? {
					text: 'Оновлений',
					class: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
				}
			: undefined
	);
</script>

<div class="schedule-display space-y-2">
	{#if todayRanges.length > 0}
		<CollapsibleSection title="Сьогодні ({DAY_NAMES_SHORT[today]})" bind:expanded={todayExpanded}>
			<ScheduleTimeline ranges={todayRanges} showNow={true} />
			<ScheduleList ranges={todayRanges} />
		</CollapsibleSection>
	{/if}

	{#if tomorrowRanges.length > 0}
		<CollapsibleSection
			title="Завтра ({DAY_NAMES_SHORT[tomorrow]})"
			badge={tomorrowBadge}
			bind:expanded={tomorrowExpanded}
		>
			<ScheduleTimeline ranges={tomorrowRanges} />
			<ScheduleList ranges={tomorrowRanges} />
		</CollapsibleSection>
	{/if}

	{#if todayRanges.length === 0 && tomorrowRanges.length === 0}
		<p class="text-xs text-surface-500-400-token">Розклад недоступний</p>
	{/if}
</div>
