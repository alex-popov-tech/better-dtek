<script lang="ts">
	import type { SavedAddress } from '$lib/types/address';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { fetchBuildingStatuses } from '$lib/utils/api-client';
	import CitySelect from '../atomic/CitySelect.svelte';
	import StreetSelect from '../atomic/StreetSelect.svelte';
	import BuildingSelect from '../atomic/BuildingSelect.svelte';

	interface Props {
		address?: SavedAddress;
		onsave: (address: Omit<SavedAddress, 'id' | 'createdAt'>) => void;
		oncancel: () => void;
		ondelete?: () => void;
	}

	let { address: initialAddress, onsave, oncancel, ondelete }: Props = $props();

	// Form state (initialized from props, not reactive to prop changes)
	let selectedCity = $state<string | null>(initialAddress?.city || null);
	let selectedStreet = $state<string | null>(initialAddress?.street || null);
	let selectedBuilding = $state<string | null>(initialAddress?.building || null);
	let label = $state<string>(initialAddress?.label || '');

	// Building data
	let buildings = $state<string[]>([]);
	let loadingStatus = $state(false);
	let statusError = $state<string | undefined>(undefined);

	// Form validation
	const canSubmit = $derived(
		selectedCity !== null && selectedStreet !== null && selectedBuilding !== null
	);

	// Fetch buildings when street changes
	$effect(() => {
		if (selectedCity && selectedStreet) {
			async function loadBuildings() {
				try {
					loadingStatus = true;
					statusError = undefined;
					buildings = [];
					selectedBuilding = null;

					const response = await fetchBuildingStatuses(selectedCity!, selectedStreet!);
					buildings = Object.keys(response.buildings);

					// If editing and building exists in response, select it
					if (initialAddress?.building && buildings.includes(initialAddress.building)) {
						selectedBuilding = initialAddress.building;
					}
				} catch (err) {
					statusError = err instanceof Error ? err.message : UI_TEXT.error;
					console.error('Failed to load buildings:', err);
				} finally {
					loadingStatus = false;
				}
			}

			loadBuildings();
		} else {
			buildings = [];
			selectedBuilding = null;
		}
	});

	function handleSubmit(event: Event) {
		event.preventDefault();

		if (!canSubmit) return;

		onsave({
			city: selectedCity!,
			street: selectedStreet!,
			building: selectedBuilding!,
			label: label.trim() || undefined,
		});
	}

	function handleCityChange(city: string) {
		selectedCity = city;
		// Reset dependent fields
		selectedStreet = null;
		selectedBuilding = null;
		buildings = [];
	}

	function handleStreetChange(street: string) {
		selectedStreet = street;
		// Reset dependent fields (buildings will be refreshed by $effect)
		selectedBuilding = null;
	}

	function handleBuildingChange(building: string) {
		selectedBuilding = building;
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<!-- City Select -->
	<CitySelect value={selectedCity} onchange={handleCityChange} />

	<!-- Street Select -->
	<StreetSelect city={selectedCity} value={selectedStreet} onchange={handleStreetChange} />

	<!-- Building Select -->
	<BuildingSelect
		{buildings}
		value={selectedBuilding}
		onchange={handleBuildingChange}
		loading={loadingStatus}
		error={statusError}
	/>

	<!-- Optional Label -->
	<div class="flex flex-col gap-1">
		<label for="label-input" class="label">
			<span>{UI_TEXT.label}</span>
		</label>
		<input
			id="label-input"
			type="text"
			class="input"
			bind:value={label}
			placeholder={UI_TEXT.labelPlaceholder}
		/>
	</div>

	<!-- Actions -->
	<div class="flex gap-2 justify-end">
		{#if ondelete}
			<button type="button" class="btn variant-ghost-error" onclick={ondelete}>
				{UI_TEXT.delete}
			</button>
		{/if}

		<button type="button" class="btn variant-ghost-surface" onclick={oncancel}>
			{UI_TEXT.cancel}
		</button>

		<button type="submit" class="btn variant-filled-primary" disabled={!canSubmit}>
			{UI_TEXT.save}
		</button>
	</div>
</form>
