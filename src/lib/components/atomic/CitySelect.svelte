<script lang="ts">
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { citiesStore } from '$lib/stores/cities';
	import BaseAutocomplete from './BaseAutocomplete.svelte';

	interface Props {
		value: string | null;
		onchange: (city: string) => void;
		disabled?: boolean;
		error?: string;
		success?: boolean;
	}

	let { value = $bindable(), onchange, disabled = false, error, success = false }: Props = $props();

	// Subscribe to cities store
	const citiesState = $derived($citiesStore);
	const combinedError = $derived(error || undefined);
</script>

<BaseAutocomplete
	bind:value
	{onchange}
	options={citiesState.cities}
	label={UI_TEXT.city}
	placeholder={UI_TEXT.cityPlaceholder}
	loading={citiesState.loading}
	{disabled}
	error={combinedError}
	{success}
	inputId="city"
	emptyState={UI_TEXT.noResults}
	showAllOnFocus={true}
/>
