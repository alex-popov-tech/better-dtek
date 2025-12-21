<script lang="ts">
	import { untrack } from 'svelte';
	import type { SavedAddress } from '$lib/types/address';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { AddressFormData } from '$lib/schemas';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { addressFormSchema } from '$lib/schemas';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { DEFAULT_REGION, type RegionCode } from '$lib/constants/regions';
	import { fetchBuildingStatuses } from '$lib/utils/api-client';
	import { showError } from '$lib/stores/toast';
	import { citiesStore } from '$lib/stores/cities';
	import type { ApiError } from '$lib/types/errors';
	import RegionSelect from '../atomic/RegionSelect.svelte';
	import CitySelect from '../atomic/CitySelect.svelte';
	import StreetSelect from '../atomic/StreetSelect.svelte';
	import BuildingSelect from '../atomic/BuildingSelect.svelte';
	import FormErrorBanner from '../atomic/FormErrorBanner.svelte';
	import ErrorMessage from '../atomic/ErrorMessage.svelte';

	interface Props {
		data: { form: SuperValidated<AddressFormData> };
		address?: SavedAddress;
		onsave: (address: Omit<SavedAddress, 'id' | 'createdAt'>) => void;
		oncancel: () => void;
		ondelete?: () => void;
	}

	let { data, address: initialAddress, onsave, oncancel, ondelete }: Props = $props();

	// Initialize superForm with client-side validation
	const { form, errors, enhance, submitting } = superForm(data.form, {
		validators: zod4Client(addressFormSchema),
		dataType: 'json',
		// Handle successful submission
		onResult: ({ result }) => {
			if (result.type === 'success') {
				// Call onsave with validated form data including region
				onsave({
					region: $form.region as RegionCode,
					city: $form.city,
					street: $form.street,
					building: $form.building,
					label: $form.label?.trim() || undefined,
				});
			}
		},
		// Prevent default navigation on success
		resetForm: false,
	});

	// Guard to ensure initialization only runs once
	let initialized = false;

	// Initialize form with existing address data if editing, or defaults for new
	// Uses untrack to batch form updates and prevent cascading effect executions
	$effect(() => {
		if (initialized) return;
		initialized = true;

		// Use untrack to prevent these writes from triggering dependent effects immediately
		untrack(() => {
			if (initialAddress) {
				$form.region = initialAddress.region;
				$form.city = initialAddress.city;
				$form.street = initialAddress.street;
				$form.building = initialAddress.building;
				$form.label = initialAddress.label || '';
			} else {
				// New address - no default region, user must select
				$form.region = '';
			}
		});
	});

	// Prefetch cities when region is selected
	$effect(() => {
		if ($form.region) {
			citiesStore.prefetch($form.region as RegionCode);
		}
	});

	// Building data (loaded dynamically based on city+street)
	let buildings = $state<string[]>([]);
	let loadingStatus = $state(false);
	let statusError = $state<string | undefined>(undefined);

	// Form-level error for non-field-specific errors
	let formError = $state<string | null>(null);

	// Subscribe to citiesStore for region error
	const citiesState = $derived($citiesStore);

	/**
	 * Categorize API error and handle appropriately
	 * - Field errors: set on specific form fields
	 * - Form errors: display in banner
	 * - System errors: show as toast
	 */
	function handleApiError(error: ApiError) {
		// Check for field-level errors from backend
		if (error.fieldErrors?.length) {
			// Map field errors to superforms errors (not implemented yet - would need custom handling)
			// For now, treat as form-level error
			formError = error.message;
			return;
		}

		// Form-level validation errors
		if (error.code === 'VALIDATION_ERROR') {
			formError = error.message;
			return;
		}

		// System errors (network, DTEK unavailable, etc.) - show as toast
		showError(error.message);
	}

	// Track if form can submit (all required fields filled)
	const canSubmit = $derived(
		$form.region && $form.city && $form.street && $form.building && !$submitting
	);

	// Field success states - show green border when field has valid value and no error
	// Region: successful after selection AND cities loaded without error
	const regionSuccess = $derived(
		!!$form.region && !citiesState.loading && !citiesState.error && !citiesState.regionError
	);

	// City: successful when selected (and region is valid)
	const citySuccess = $derived(!!$form.city && !!$form.region && !citiesState.error);

	// Street: successful when selected (and city is valid)
	const streetSuccess = $derived(!!$form.street && !!$form.city);

	// Building: successful when selected (and street is valid)
	const buildingSuccess = $derived(!!$form.building && !!$form.street && !statusError);

	// Fetch buildings when region+city+street are all selected
	$effect(() => {
		if ($form.region && $form.city && $form.street) {
			async function loadBuildings() {
				loadingStatus = true;
				statusError = undefined;
				formError = null; // Clear form error on new attempt
				buildings = [];

				const result = await fetchBuildingStatuses(
					$form.region as RegionCode,
					$form.city,
					$form.street
				);

				if (!result.ok) {
					statusError = result.error.message;
					handleApiError(result.error);
				} else {
					buildings = Object.keys(result.value.buildings);

					// If editing and building exists in response, keep it selected
					// Otherwise clear building selection
					// IMPORTANT: Guard all writes with equality check to prevent infinite loop
					// (superForm's $form notifies on every write, even if value unchanged)
					if (initialAddress?.building && buildings.includes(initialAddress.building)) {
						if ($form.building !== initialAddress.building) {
							$form.building = initialAddress.building;
						}
					} else if (!buildings.includes($form.building) && $form.building !== '') {
						$form.building = '';
					}
				}

				loadingStatus = false;
			}

			loadBuildings();
		} else {
			buildings = [];
			if ($form.building !== '') {
				$form.building = '';
			}
		}
	});

	function handleRegionChange(region: RegionCode) {
		$form.region = region;
		// Reset dependent fields when region changes
		$form.city = '';
		$form.street = '';
		$form.building = '';
		buildings = [];
		// Prefetch cities for new region
		citiesStore.prefetch(region);
	}

	function handleCityChange(city: string) {
		$form.city = city;
		// Reset dependent fields
		$form.street = '';
		$form.building = '';
		buildings = [];
	}

	function handleStreetChange(street: string) {
		$form.street = street;
		// Reset building (buildings will be refreshed by $effect)
		$form.building = '';
	}

	function handleBuildingChange(building: string) {
		$form.building = building;
	}
</script>

<form method="POST" action="?/addAddress" use:enhance class="space-y-4">
	<!-- Form-level error banner -->
	<FormErrorBanner error={formError} />

	<!-- Region Select -->
	<div class="flex flex-col gap-1">
		<RegionSelect
			value={($form.region as RegionCode) || null}
			onchange={handleRegionChange}
			loading={citiesState.loading}
			success={regionSuccess}
			error={citiesState.regionError || citiesState.error || undefined}
		/>
		<ErrorMessage error={$errors.region?.[0]} inputId="region-validation" />
	</div>

	<!-- City Select -->
	<div class="flex flex-col gap-1">
		<CitySelect
			value={$form.city || null}
			onchange={handleCityChange}
			disabled={!$form.region || !!citiesState.regionError || !!citiesState.error}
			success={citySuccess}
		/>
		<ErrorMessage error={$errors.city?.[0]} inputId="city-validation" />
	</div>

	<!-- Street Select -->
	<div class="flex flex-col gap-1">
		<StreetSelect
			region={($form.region as RegionCode) || DEFAULT_REGION}
			city={$form.city || null}
			value={$form.street || null}
			onchange={handleStreetChange}
			success={streetSuccess}
		/>
		<ErrorMessage error={$errors.street?.[0]} inputId="street-validation" />
	</div>

	<!-- Building Select -->
	<div class="flex flex-col gap-1">
		<BuildingSelect
			{buildings}
			value={$form.building || null}
			onchange={handleBuildingChange}
			loading={loadingStatus}
			error={statusError}
			success={buildingSuccess}
		/>
		<ErrorMessage error={$errors.building?.[0]} inputId="building-validation" />
	</div>

	<!-- Optional Label -->
	<div class="flex flex-col gap-1">
		<label for="label-input" class="label">
			<span>{UI_TEXT.label}</span>
		</label>
		<input
			id="label-input"
			type="text"
			name="label"
			class="input rounded-full"
			bind:value={$form.label}
			placeholder={UI_TEXT.labelPlaceholder}
		/>
	</div>

	<!-- Hidden fields for form submission -->
	<input type="hidden" name="region" value={$form.region} />
	<input type="hidden" name="city" value={$form.city} />
	<input type="hidden" name="street" value={$form.street} />
	<input type="hidden" name="building" value={$form.building} />

	<!-- Actions -->
	<div class="flex gap-2 justify-end">
		{#if ondelete}
			<button type="button" class="btn variant-soft-error" onclick={ondelete}>
				{UI_TEXT.delete}
			</button>
		{/if}

		<button type="button" class="btn variant-ghost-surface" onclick={oncancel}>
			{UI_TEXT.cancel}
		</button>

		<button type="submit" class="btn variant-filled-primary" disabled={!canSubmit}>
			{#if $submitting}
				<span class="animate-spin">...</span>
			{:else}
				{UI_TEXT.save}
			{/if}
		</button>
	</div>
</form>
