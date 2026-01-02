<script lang="ts">
	import { Autocomplete, popup } from '@skeletonlabs/skeleton';
	import type { AutocompleteOption, PopupSettings } from '@skeletonlabs/skeleton';
	import { ProgressRadial } from '@skeletonlabs/skeleton';
	import { debounce } from '$lib/utils/debounce';
	import { untrack } from 'svelte';
	import ErrorMessage from './ErrorMessage.svelte';

	interface Props {
		value: string | null;
		onchange: (value: string) => void;
		options: string[];
		label: string;
		placeholder: string;
		loading?: boolean;
		disabled?: boolean;
		error?: string;
		success?: boolean;
		minChars?: number;
		inputId: string;
		showAllOnFocus?: boolean;
		emptyState?: string;
	}

	let {
		value = $bindable(),
		onchange,
		options,
		label,
		placeholder,
		loading = false,
		disabled = false,
		error,
		success = false,
		minChars = 2,
		inputId,
		showAllOnFocus = false,
		emptyState,
	}: Props = $props();

	let inputValue = $state(value || '');
	let debouncedInputValue = $state(value || '');

	// Sync inputValue when value prop changes from parent (e.g., reset on dependency change)
	// Use untrack to read inputValue without making it a dependency
	$effect(() => {
		const newValue = value || '';
		const currentInputValue = untrack(() => inputValue);
		if (newValue !== currentInputValue) {
			inputValue = newValue;
			debouncedInputValue = newValue;
		}
	});

	// Debounce input value updates for filtering
	const updateDebouncedValue = debounce((val: string) => {
		debouncedInputValue = val;
	}, 200);

	$effect(() => {
		updateDebouncedValue(inputValue);
	});

	// Pre-compute all options
	const allOptions = $derived(
		options.map((opt) => ({
			label: opt,
			value: opt,
			keywords: opt.toLowerCase(),
		}))
	);

	// Show options after minChars characters typed, or all options if showAllOnFocus is enabled
	const autocompleteOptions = $derived(
		debouncedInputValue.trim().length >= minChars ? allOptions : showAllOnFocus ? allOptions : []
	);

	function handleSelection(event: CustomEvent<AutocompleteOption<string>>): void {
		const selected = event.detail.value;
		inputValue = selected;
		value = selected;
		onchange(selected);
	}

	// Capture inputId at init - expected to be stable after mount
	const stableInputId = untrack(() => inputId);

	// Use a stable object reference to prevent popup directive from reinitializing on every render
	const popupSettings: PopupSettings = {
		event: 'focus-click',
		target: `${stableInputId}Autocomplete`,
		placement: 'bottom',
	};
</script>

<div class="flex flex-col gap-1">
	<label for="{inputId}-input" class="label">
		<span>{label}</span>
	</label>

	<div class="relative">
		<input
			id="{inputId}-input"
			type="text"
			class="input autocomplete rounded-full"
			class:input-error={error}
			class:input-success={success && !error}
			class:input-loading={loading}
			bind:value={inputValue}
			{placeholder}
			disabled={disabled || loading}
			use:popup={popupSettings}
			aria-required="true"
			aria-invalid={!!error}
			aria-describedby={error ? `${inputId}-error` : undefined}
			aria-busy={loading}
			data-testid="{inputId}-input"
		/>

		{#if loading}
			<div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
				<ProgressRadial
					width="w-4"
					meter="stroke-surface-900 dark:stroke-surface-50"
					track="stroke-surface-300 dark:stroke-surface-700"
				/>
			</div>
		{/if}

		<div
			data-popup="{inputId}Autocomplete"
			class="card z-50 w-full max-w-sm max-h-48 p-4 overflow-y-auto bg-surface-100-800-token shadow-xl"
		>
			<Autocomplete
				input={inputValue}
				options={autocompleteOptions}
				on:selection={handleSelection}
				{emptyState}
				transitions={false}
			/>
		</div>
	</div>

	<ErrorMessage {error} {inputId} />
</div>
