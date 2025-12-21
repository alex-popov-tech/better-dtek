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
	{#each ranges as range, i (i)}
		{@const category = getStatusCategory(range.status)}
		<div
			class="schedule-item rounded px-3 py-1.5 text-sm"
			class:status-bg-yes={category === 'yes'}
			class:status-bg-maybe={category === 'maybe'}
			class:status-bg-no={category === 'no'}
		>
			<span class="font-mono font-semibold"
				>{formatTimeFloat(range.from)}-{formatTimeFloat(range.to)}</span
			>
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
	/* Status text colors - using darker shades for better contrast */
	.status-yes {
		color: #16a34a; /* green-600 */
	}

	.status-no {
		color: #dc2626; /* red-600 */
	}

	.status-maybe {
		color: #d97706; /* amber-600 for better contrast than yellow */
	}

	/* Status background with colored left border */
	.status-bg-yes {
		background: rgba(34, 197, 94, 0.15);
		border-left: 3px solid #22c55e;
	}

	.status-bg-no {
		background: rgba(239, 68, 68, 0.15);
		border-left: 3px solid #ef4444;
	}

	.status-bg-maybe {
		background: rgba(217, 119, 6, 0.15);
		border-left: 3px solid #d97706;
	}

	/* Dark mode - increase background opacity for better visibility */
	:global(.dark) .status-bg-yes {
		background: rgba(34, 197, 94, 0.2);
	}

	:global(.dark) .status-bg-no {
		background: rgba(239, 68, 68, 0.2);
	}

	:global(.dark) .status-bg-maybe {
		background: rgba(217, 119, 6, 0.2);
	}
</style>
