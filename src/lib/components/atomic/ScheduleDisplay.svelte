<script lang="ts">
	import type { ScheduleRange } from '$lib/types/dtek';
	import CollapsibleSection from './CollapsibleSection.svelte';
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
		/** Whether tomorrow's schedule came from real-time fact data or static preset */
		tomorrowSource?: 'fact' | 'preset';
	}

	let {
		groupSchedule,
		todayExpanded = $bindable(true),
		tomorrowExpanded = $bindable(false),
		tomorrowSource = 'preset',
	}: Props = $props();

	const today = $derived(getUkrainianDayOfWeek());
	const tomorrow = $derived(getTomorrowDayOfWeek());

	const todayRanges = $derived(groupSchedule[today] || []);
	const tomorrowRanges = $derived(groupSchedule[tomorrow] || []);

	const tomorrowBadge = $derived(
		tomorrowSource === 'fact'
			? {
					text: 'Оновлений',
					class: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
				}
			: {
					text: 'Звичайний',
					class: 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400',
				}
	);
</script>

<div class="schedule-display space-y-2">
	{#if todayRanges.length > 0}
		<CollapsibleSection title="Сьогодні ({DAY_NAMES_SHORT[today]})" bind:expanded={todayExpanded}>
			<ScheduleList ranges={todayRanges} />
		</CollapsibleSection>
	{/if}

	{#if tomorrowRanges.length > 0}
		<CollapsibleSection
			title="Завтра ({DAY_NAMES_SHORT[tomorrow]})"
			badge={tomorrowBadge}
			bind:expanded={tomorrowExpanded}
		>
			<ScheduleList ranges={tomorrowRanges} />
		</CollapsibleSection>
	{/if}

	{#if todayRanges.length === 0 && tomorrowRanges.length === 0}
		<p class="text-xs text-surface-500-400-token">Розклад недоступний</p>
	{/if}
</div>
