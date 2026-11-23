<script lang="ts">
	import type { SavedAddress } from '$lib/types/address';
	import type { PageData } from './$types';
	import { addressesStore } from '$lib/stores/addresses';
	import { addressStatusStore, scheduleCacheStore } from '$lib/stores/address-status';
	import { citiesStore } from '$lib/stores/cities';
	import AddressList from '$lib/components/composite/AddressList.svelte';
	import AddressModal from '$lib/components/composite/AddressModal.svelte';
	import PullToRefresh from '$lib/components/composite/PullToRefresh.svelte';

	let { data }: { data: PageData } = $props();

	// Modal state
	let showModal = $state(false);
	let editingAddress = $state<SavedAddress | undefined>(undefined);
	let triggerElement: HTMLElement | null = null;

	// Subscribe to stores
	const addresses = $derived($addressesStore);
	const statuses = $derived($addressStatusStore);
	const scheduleCache = $derived($scheduleCacheStore);

	// Pull-to-refresh state
	const isRefreshing = $derived(
		addresses.length > 0 && Array.from(statuses.values()).some((entry) => entry.loading)
	);

	async function handlePullRefresh() {
		if (addresses.length > 0) {
			await addressStatusStore.refreshAllStatuses(addresses);
		}
	}

	// Auto-fetch statuses when addresses change
	$effect(() => {
		if (addresses.length > 0) {
			addressStatusStore.fetchAllStatuses(addresses);
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

<PullToRefresh onRefresh={handlePullRefresh} {isRefreshing}>
	<AddressList
		{addresses}
		{statuses}
		{scheduleCache}
		onadd={handleAdd}
		onedit={handleEdit}
		ondelete={handleDelete}
	/>
</PullToRefresh>

{#if showModal}
	<AddressModal
		form={data.form}
		address={editingAddress}
		onsave={handleSave}
		oncancel={handleCancel}
		ondelete={editingAddress ? () => handleDelete(editingAddress!.id) : undefined}
	/>
{/if}
