<script lang="ts">
	import type { ScheduleRange } from '$lib/types/dtek';
	import CollapsibleSection from './CollapsibleSection.svelte';
	import ScheduleList from './ScheduleList.svelte';
	import { getUkrainianDayOfWeek, getTomorrowDayOfWeek } from '$lib/utils/schedule';
	import { DAY_NAMES_SHORT } from '$lib/constants/ui-text';

	interface Props {
		/** Schedule data for a group (day -> ranges) */
		groupSchedule: Record<string, ScheduleRange[]>;
	}

	let { groupSchedule }: Props = $props();

	const today = $derived(getUkrainianDayOfWeek());
	const tomorrow = $derived(getTomorrowDayOfWeek());

	const todayRanges = $derived(groupSchedule[today] || []);
	const tomorrowRanges = $derived(groupSchedule[tomorrow] || []);

	// Today expanded by default, tomorrow collapsed
	let todayExpanded = $state(true);
	let tomorrowExpanded = $state(false);
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
			bind:expanded={tomorrowExpanded}
		>
			<ScheduleList ranges={tomorrowRanges} />
		</CollapsibleSection>
	{/if}

	{#if todayRanges.length === 0 && tomorrowRanges.length === 0}
		<p class="text-xs text-surface-500-400-token">Розклад недоступний</p>
	{/if}
</div>
