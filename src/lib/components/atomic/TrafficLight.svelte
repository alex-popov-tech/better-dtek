<script lang="ts">
	import type { TrafficLightStatus } from '$lib/utils/schedule';

	interface Props {
		status: TrafficLightStatus;
	}

	let { status }: Props = $props();

	const isGreen = $derived(status === 'on');
	const isYellow = $derived(status === 'maybe');
	const isRed = $derived(status === 'off' || status === 'emergency');
	const isEmergency = $derived(status === 'emergency');
</script>

<div class="traffic-light">
	<div class="light red" class:active={isRed} class:emergency={isEmergency}></div>
	<div class="light yellow" class:active={isYellow}></div>
	<div class="light green" class:active={isGreen}></div>
</div>

<style>
	.traffic-light {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 6px 5px;
		background: #374151;
		border-radius: 16px;
		border: 2px solid #4b5563;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* Dark mode - lighter border for visibility */
	:global(.dark) .traffic-light {
		border-color: #6b7280;
	}

	.light {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		transition: all 0.2s ease;
		border: 1px solid rgba(0, 0, 0, 0.2);
	}

	/* Inactive states - muted gray for light theme */
	.light.red,
	.light.yellow,
	.light.green {
		background: #6b7280;
	}

	/* Dark mode inactive - darker for contrast with housing */
	:global(.dark) .light.red,
	:global(.dark) .light.yellow,
	:global(.dark) .light.green {
		background: #4b5563;
		border-color: rgba(0, 0, 0, 0.3);
	}

	/* Active states - vibrant colors */
	.light.red.active {
		background: #ef4444;
		border-color: #dc2626;
	}

	.light.yellow.active {
		background: #eab308;
		border-color: #ca8a04;
	}

	.light.green.active {
		background: #22c55e;
		border-color: #16a34a;
	}

	/* Dark mode active - add glow effect */
	:global(.dark) .light.red.active {
		box-shadow:
			0 0 10px #ef4444,
			0 0 20px rgba(239, 68, 68, 0.4);
	}

	:global(.dark) .light.yellow.active {
		box-shadow:
			0 0 10px #eab308,
			0 0 20px rgba(234, 179, 8, 0.4);
	}

	:global(.dark) .light.green.active {
		box-shadow:
			0 0 10px #22c55e,
			0 0 20px rgba(34, 197, 94, 0.4);
	}

	/* Emergency - light theme uses scale pulse */
	.light.red.active.emergency {
		animation: pulse-red-light 1s ease-in-out infinite;
	}

	/* Emergency - dark theme uses glow pulse (overrides above) */
	:global(.dark) .light.red.active.emergency {
		animation: pulse-red-dark 1s ease-in-out infinite;
	}

	@keyframes pulse-red-dark {
		0%,
		100% {
			box-shadow:
				0 0 10px #ef4444,
				0 0 20px rgba(239, 68, 68, 0.4);
		}
		50% {
			box-shadow:
				0 0 16px #ef4444,
				0 0 32px rgba(239, 68, 68, 0.6);
		}
	}

	@keyframes pulse-red-light {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}
</style>
