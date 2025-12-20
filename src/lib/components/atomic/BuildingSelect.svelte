<script lang="ts">
	import { UI_TEXT } from '$lib/constants/ui-text';
	import BaseAutocomplete from './BaseAutocomplete.svelte';

	interface Props {
		buildings: string[];
		value: string | null;
		onchange: (building: string) => void;
		disabled?: boolean;
		loading?: boolean;
		error?: string;
	}

	let {
		buildings,
		value = $bindable(),
		onchange,
		disabled = false,
		loading = false,
		error,
	}: Props = $props();

	const isDisabled = $derived(disabled || buildings.length === 0);
</script>

<BaseAutocomplete
	bind:value
	{onchange}
	options={buildings}
	label={UI_TEXT.building}
	placeholder={UI_TEXT.buildingPlaceholder}
	{loading}
	disabled={isDisabled}
	{error}
	minChars={1}
	inputId="building"
	showAllOnFocus={true}
	emptyState={UI_TEXT.noResults}
/>
