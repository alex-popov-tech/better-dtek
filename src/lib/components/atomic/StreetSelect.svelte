<script lang="ts">
	import { untrack } from 'svelte';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { fetchStreets } from '$lib/utils/api-client';
	import { showError } from '$lib/stores/toast';
	import type { RegionCode } from '$lib/constants/regions';
	import BaseAutocomplete from './BaseAutocomplete.svelte';

	interface Props {
		region: RegionCode;
		city: string | null;
		value: string | null;
		onchange: (street: string) => void;
		disabled?: boolean;
		error?: string;
		success?: boolean;
	}

	let {
		region,
		city,
		value = $bindable(),
		onchange,
		disabled = false,
		error,
		success = false,
	}: Props = $props();

	let streets = $state<string[]>([]);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let previousCity = $state<string | null>(null);
	let previousRegion = $state<RegionCode | null>(null);

	// Fetch streets when region or city changes
	$effect(() => {
		// Use untrack to prevent reading previousCity/previousRegion as dependencies
		// This avoids a reactive loop where writing to these values triggers re-execution
		const prevCity = untrack(() => previousCity);
		const prevRegion = untrack(() => previousRegion);

		if (region && city) {
			const cityChanged = prevCity !== null && prevCity !== city;
			const regionChanged = prevRegion !== null && prevRegion !== region;
			previousCity = city;
			previousRegion = region;

			async function loadStreets() {
				loading = true;
				loadError = null;
				streets = [];

				// Reset value when city or region changed (not on initial load)
				if (cityChanged || regionChanged) {
					value = null;
				}

				const result = await fetchStreets(region, city!);

				if (!result.ok) {
					loadError = result.error.message;
					showError(result.error.message);
				} else {
					streets = result.value;
				}

				loading = false;
			}

			loadStreets();
		} else {
			previousCity = null;
			previousRegion = null;
			streets = [];
			// Only write if value is different to prevent potential infinite loop
			if (value !== null) {
				value = null;
			}
		}
	});

	const isDisabled = $derived(disabled || !city);
	const combinedError = $derived(error || loadError || undefined);
</script>

<BaseAutocomplete
	bind:value
	{onchange}
	options={streets}
	label={UI_TEXT.street}
	placeholder={UI_TEXT.streetPlaceholder}
	{loading}
	disabled={isDisabled}
	error={combinedError}
	{success}
	inputId="street"
	emptyState={UI_TEXT.noResults}
	showAllOnFocus={true}
/>
