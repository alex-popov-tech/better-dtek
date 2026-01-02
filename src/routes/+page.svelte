<script lang="ts">
	import type { SavedAddress } from '$lib/types/address';
	import type { PageData } from './$types';
	import { addressesStore } from '$lib/stores/addresses';
	import { addressStatusStore, scheduleCacheStore } from '$lib/stores/address-status';
	import { citiesStore } from '$lib/stores/cities';
	import AddressList from '$lib/components/composite/AddressList.svelte';
	import AddressForm from '$lib/components/composite/AddressForm.svelte';

	let { data }: { data: PageData } = $props();

	// Modal state
	let showModal = $state(false);
	let editingAddress = $state<SavedAddress | undefined>(undefined);
	let modalElement: HTMLDivElement | undefined = $state(undefined);
	let triggerElement: HTMLElement | null = null;

	// Subscribe to stores
	const addresses = $derived($addressesStore);
	const statuses = $derived($addressStatusStore);
	const scheduleCache = $derived($scheduleCacheStore);

	// Auto-fetch statuses when addresses change
	$effect(() => {
		if (addresses.length > 0) {
			addressStatusStore.fetchAllStatuses(addresses);
		}
	});

	// Focus modal when opened
	$effect(() => {
		if (showModal && modalElement) {
			modalElement.focus();
		}
	});

	// Modal helpers
	function closeModal() {
		showModal = false;
		editingAddress = undefined;
		citiesStore.reset();
		triggerElement?.focus();
		triggerElement = null;
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeModal();
		}
	}

	// Handlers
	function handleAdd() {
		triggerElement = document.activeElement as HTMLElement;
		editingAddress = undefined;
		showModal = true;
	}

	function handleEdit(id: string) {
		triggerElement = document.activeElement as HTMLElement;
		const address = addresses.find((a) => a.id === id);
		if (address) {
			editingAddress = address;
			showModal = true;
		}
	}

	function handleDelete(id: string) {
		if (editingAddress && editingAddress.id === id) {
			// Deleting from within edit modal
			addressesStore.remove(id);
			closeModal();
		} else {
			// Deleting from card
			addressesStore.remove(id);
		}
	}

	function handleSave(data: Omit<SavedAddress, 'id' | 'createdAt'>) {
		if (editingAddress) {
			// Invalidate cached status before updating (address location may have changed)
			addressStatusStore.invalidate(editingAddress.id);
			addressesStore.update(editingAddress.id, data);
		} else {
			// Add new address
			addressesStore.add(data);
		}
		closeModal();
	}

	function handleCancel() {
		closeModal();
	}
</script>

<AddressList
	{addresses}
	{statuses}
	{scheduleCache}
	onadd={handleAdd}
	onedit={handleEdit}
	ondelete={handleDelete}
/>

{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		onkeydown={handleModalKeydown}
		tabindex="-1"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="absolute inset-0 bg-surface-backdrop-token backdrop-blur-md cursor-pointer border-0"
			onclick={handleCancel}
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
				{editingAddress ? 'Редагувати адресу' : 'Додати адресу'}
			</h2>
			<AddressForm
				data={{ form: data.form }}
				address={editingAddress}
				onsave={handleSave}
				oncancel={handleCancel}
				ondelete={editingAddress ? () => handleDelete(editingAddress!.id) : undefined}
			/>
		</div>
	</div>
{/if}
