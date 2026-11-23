<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { SavedAddress } from '$lib/types/address';
	import type { AddressFormData } from '$lib/schemas';
	import { onMount } from 'svelte';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import AddressForm from './AddressForm.svelte';

	interface Props {
		form: SuperValidated<AddressFormData>;
		/** Address being edited; omit to add a new one */
		address?: SavedAddress;
		onsave: (address: Omit<SavedAddress, 'id' | 'createdAt'>) => void;
		oncancel: () => void;
		ondelete?: () => void;
	}

	let { form, address, onsave, oncancel, ondelete }: Props = $props();

	let modalElement: HTMLDivElement | undefined = $state(undefined);

	// Focus the modal when it opens
	onMount(() => {
		modalElement?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center"
	role="dialog"
	aria-modal="true"
	aria-labelledby="modal-title"
	onkeydown={handleKeydown}
	tabindex="-1"
>
	<!-- Backdrop -->
	<button
		type="button"
		class="absolute inset-0 bg-surface-backdrop-token backdrop-blur-md cursor-pointer border-0"
		onclick={oncancel}
		aria-label="Закрити модальне вікно"
	></button>
	<div
		bind:this={modalElement}
		class="card p-6 w-full sm:max-w-xl max-h-[80vh] overflow-y-auto relative z-10 shadow-xl ring-1 ring-surface-300-600-token"
		data-testid="address-modal"
		tabindex="-1"
		role="none"
		onclick={(e) => e.stopPropagation()}
	>
		<h2 id="modal-title" class="h2 font-bold mb-4">
			{address ? UI_TEXT.editAddress : UI_TEXT.addAddress}
		</h2>
		<AddressForm data={{ form }} {address} {onsave} {oncancel} {ondelete} />
	</div>
</div>
