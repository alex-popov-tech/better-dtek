<script lang="ts">
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { fetchStreets } from '$lib/utils/api-client';
	import BaseAutocomplete from './BaseAutocomplete.svelte';

	interface Props {
		city: string | null;
		value: string | null;
		onchange: (street: string) => void;
		disabled?: boolean;
		error?: string;
	}

	let { city, value = $bindable(), onchange, disabled = false, error }: Props = $props();

	let streets = $state<string[]>([]);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let previousCity = $state<string | null>(null);

	// Fetch streets when city changes
	$effect(() => {
		if (city) {
			const cityChanged = previousCity !== null && previousCity !== city;
			previousCity = city;

			async function loadStreets() {
				try {
					loading = true;
					loadError = null;
					streets = [];

					// Only reset value when city actually changed, not on initial load
					if (cityChanged) {
						value = null;
					}

					const fetchedStreets = await fetchStreets(city!);
					streets = fetchedStreets;
				} catch (err) {
					loadError = err instanceof Error ? err.message : UI_TEXT.error;
					console.error('Failed to load streets:', err);
				} finally {
					loading = false;
				}
			}

			loadStreets();
		} else {
			previousCity = null;
			streets = [];
			value = null;
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
	inputId="street"
	emptyState={UI_TEXT.noResults}
/>
