<script lang="ts">
	import type { ScheduleRange, ScheduleStatus } from '$lib/types/dtek';
	import { SCHEDULE_STATUS_LABELS } from '$lib/constants/ui-text';
	import { formatTimeFloat } from '$lib/utils/schedule';

	interface Props {
		ranges: ScheduleRange[];
	}

	let { ranges }: Props = $props();

	/**
	 * Get simplified status category for coloring
	 */
	function getStatusCategory(status: ScheduleStatus): 'yes' | 'maybe' | 'no' {
		if (status === 'yes') return 'yes';
		if (status === 'maybe' || status === 'mfirst' || status === 'msecond') return 'maybe';
		return 'no';
	}
</script>

<div class="schedule-list space-y-1 py-1">
	{#each ranges as range}
		{@const category = getStatusCategory(range.status)}
		<div
			class="schedule-item rounded px-3 py-1 text-sm"
			class:status-bg-yes={category === 'yes'}
			class:status-bg-maybe={category === 'maybe'}
			class:status-bg-no={category === 'no'}
		>
			<span class="font-mono">{formatTimeFloat(range.from)}-{formatTimeFloat(range.to)}</span>
			<span
				class="ml-2"
				class:status-yes={category === 'yes'}
				class:status-maybe={category === 'maybe'}
				class:status-no={category === 'no'}
			>
				{SCHEDULE_STATUS_LABELS[range.status]}
			</span>
		</div>
	{/each}
</div>

<style>
	/* Status text colors */
	.status-yes {
		color: #22c55e;
	}

	.status-no {
		color: #ef4444;
	}

	.status-maybe {
		color: #eab308;
	}

	/* Status background with colored left border */
	.status-bg-yes {
		background: rgba(34, 197, 94, 0.1);
		border-left: 3px solid #22c55e;
	}

	.status-bg-no {
		background: rgba(239, 68, 68, 0.1);
		border-left: 3px solid #ef4444;
	}

	.status-bg-maybe {
		background: rgba(234, 179, 8, 0.1);
		border-left: 3px solid #eab308;
	}
</style>
