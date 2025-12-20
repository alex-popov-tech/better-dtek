<script lang="ts">
	import { ProgressRadial } from '@skeletonlabs/skeleton';
	import { UI_TEXT } from '$lib/constants/ui-text';

	interface Props {
		onclick: () => void;
		loading?: boolean;
		label?: string;
		icon?: boolean;
	}

	let { onclick, loading = false, label, icon = true }: Props = $props();

	const buttonLabel = $derived(label || UI_TEXT.refresh);
	// Use icon button style when no label, regular button when label is provided
	const buttonClass = $derived(
		label ? 'btn btn-sm variant-ghost-surface' : 'btn-icon btn-icon-sm variant-ghost-surface'
	);
</script>

<button
	type="button"
	class={buttonClass}
	{onclick}
	disabled={loading}
	aria-label={buttonLabel}
	title={buttonLabel}
>
	{#if loading}
		<ProgressRadial
			width="w-4"
			meter="stroke-surface-900 dark:stroke-surface-50"
			track="stroke-surface-300 dark:stroke-surface-700"
		/>
	{:else if icon}
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
				d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
			/>
		</svg>
	{/if}

	{#if label}
		<span>{label}</span>
	{/if}
</button>
