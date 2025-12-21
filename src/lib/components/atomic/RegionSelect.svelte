<script lang="ts">
	import { ProgressRadial } from '@skeletonlabs/skeleton';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { REGIONS, REGION_CODES, type RegionCode } from '$lib/constants/regions';
	import ErrorMessage from './ErrorMessage.svelte';

	interface Props {
		value: RegionCode | null;
		onchange: (region: RegionCode) => void;
		disabled?: boolean;
		loading?: boolean;
		success?: boolean;
		error?: string;
	}

	let {
		value = $bindable(),
		onchange,
		disabled = false,
		loading = false,
		success = false,
		error,
	}: Props = $props();

	// Build options from REGIONS constant
	const regionOptions = REGION_CODES.map((code) => ({
		value: code,
		label: REGIONS[code].name,
	}));

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		if (target.value) {
			const region = target.value as RegionCode;
			value = region;
			onchange(region);
		}
	}
</script>

<div class="flex flex-col gap-1">
	<label for="region-select" class="label">
		<span>{UI_TEXT.region}</span>
	</label>

	<div class="relative">
		<select
			id="region-select"
			class="select rounded-full px-3"
			class:input-error={error}
			class:select-success={success && !error}
			class:select-loading={loading}
			disabled={disabled || loading}
			value={value ?? ''}
			onchange={handleChange}
			aria-invalid={!!error}
			aria-describedby={error ? 'region-select-error' : undefined}
			aria-busy={loading}
		>
			<option value="" disabled>{UI_TEXT.regionPlaceholder}</option>
			{#each regionOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		{#if loading}
			<div class="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
				<ProgressRadial
					width="w-4"
					meter="stroke-surface-900 dark:stroke-surface-50"
					track="stroke-surface-300 dark:stroke-surface-700"
				/>
			</div>
		{/if}
	</div>

	<ErrorMessage {error} inputId="region-select" />
</div>
