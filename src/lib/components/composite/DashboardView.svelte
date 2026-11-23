<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { SavedAddress } from '$lib/types/address';
	import type { Dashboard, AddressInput } from '$lib/types/dashboard';
	import type { AddressFormData } from '$lib/schemas';
	import { onMount, tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { createDashboardStore } from '$lib/stores/dashboard';
	import { dashboardsStore } from '$lib/stores/dashboards';
	import { clearScheduleExpandState } from '$lib/stores/addresses';
	import { addressStatusStore, scheduleCacheStore } from '$lib/stores/address-status';
	import { citiesStore } from '$lib/stores/cities';
	import { showError } from '$lib/stores/toast';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { DASHBOARD_NAME_MAX } from '$lib/types/dashboard';
	import AddressList from './AddressList.svelte';
	import AddressModal from './AddressModal.svelte';
	import PullToRefresh from './PullToRefresh.svelte';

	interface Props {
		/** Dashboard as loaded by the server; later changes live in the store */
		dashboard: Dashboard;
		form: SuperValidated<AddressFormData>;
	}

	let { dashboard: initialDashboard, form }: Props = $props();

	// The store is the source of truth after the first render
	const store = createDashboardStore(untrack(() => initialDashboard));

	const dashboard = $derived($store);
	const addresses = $derived(dashboard.addresses);
	const statuses = $derived($addressStatusStore);
	const scheduleCache = $derived($scheduleCacheStore);

	// Modal state
	let showModal = $state(false);
	let editingAddress = $state<SavedAddress | undefined>(undefined);
	let triggerElement: HTMLElement | null = null;

	// Rename state
	let renaming = $state(false);
	let nameDraft = $state('');
	let nameInput: HTMLInputElement | undefined = $state(undefined);
	let savingName = $state(false);

	// Copy-link feedback
	let linkCopied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	let reloading = $state(false);
	let saving = false;
	const isRefreshing = $derived(
		reloading ||
			(addresses.length > 0 && addresses.some((a) => statuses.get(a.id)?.loading ?? false))
	);

	// Remember this dashboard on this device
	onMount(() => {
		dashboardsStore.remember({ id: dashboard.id, name: dashboard.name });
		return () => clearTimeout(copiedTimer);
	});

	// Auto-fetch statuses when addresses change
	$effect(() => {
		if (addresses.length > 0) {
			addressStatusStore.fetchAllStatuses(addresses);
		}
	});

	/** Reload the address list (other people's edits), then the statuses */
	async function handleRefresh() {
		reloading = true;
		const result = await store.reload();
		reloading = false;

		if (!result.ok) {
			showError(result.error.message);
			return;
		}

		// The reload replaces the address list, so the effect above re-fetches the
		// statuses; fetching here as well would double every /api/status call.
		dashboardsStore.remember({ id: $store.id, name: $store.name });
	}

	// Modal helpers
	function closeModal() {
		showModal = false;
		editingAddress = undefined;
		citiesStore.reset();
		triggerElement?.focus();
		triggerElement = null;
	}

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

	async function handleDelete(id: string) {
		const result = await store.remove(id);
		if (!result.ok) {
			showError(result.error.message);
			return;
		}

		addressStatusStore.invalidate(id);
		clearScheduleExpandState(id);
		if (editingAddress?.id === id) closeModal();
	}

	async function handleSave(input: AddressInput) {
		// The form is submittable again while the API call is in flight;
		// ignore a second tap so it cannot add the address twice
		if (saving) return;

		const editing = editingAddress;
		saving = true;
		const result = editing ? await store.update(editing.id, input) : await store.add(input);
		saving = false;

		if (!result.ok) {
			// Keep the modal open so the input is not lost
			showError(result.error.message);
			return;
		}

		// Location may have changed; drop the cached status (the list change re-fetches it)
		if (editing) addressStatusStore.invalidate(editing.id);
		closeModal();
	}

	// Rename
	async function startRename() {
		nameDraft = dashboard.name;
		renaming = true;
		await tick();
		nameInput?.focus();
		nameInput?.select();
	}

	function cancelRename() {
		renaming = false;
	}

	async function submitRename(event: SubmitEvent) {
		event.preventDefault();
		const name = nameDraft.trim();
		if (!name || savingName) return;

		if (name === dashboard.name) {
			renaming = false;
			return;
		}

		savingName = true;
		const result = await store.rename(name);
		savingName = false;

		if (!result.ok) {
			showError(result.error.message);
			return;
		}
		renaming = false;
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelRename();
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			linkCopied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (linkCopied = false), 2000);
		} catch {
			showError(UI_TEXT.copyLinkFailed);
		}
	}
</script>

<svelte:head>
	<title>{dashboard.name} — {UI_TEXT.appTitle}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<PullToRefresh onRefresh={handleRefresh} {isRefreshing}>
	<div class="space-y-4">
		<!-- Dashboard toolbar -->
		<div class="flex flex-wrap items-center justify-between gap-2">
			<a href={resolve('/')} class="btn btn-sm variant-ghost-surface flex items-center gap-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="w-4 h-4"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
				<span>{UI_TEXT.backToMyAddresses}</span>
			</a>

			<div class="flex items-center gap-2">
				<button
					type="button"
					class="btn btn-sm variant-ghost-surface"
					onclick={startRename}
					disabled={renaming}
				>
					{UI_TEXT.renameDashboard}
				</button>
				<button
					type="button"
					class="btn btn-sm variant-ghost-surface"
					onclick={copyLink}
					data-testid="copy-dashboard-link"
				>
					<span aria-live="polite">{linkCopied ? UI_TEXT.linkCopied : UI_TEXT.copyLink}</span>
				</button>
			</div>
		</div>

		{#if renaming}
			<form class="flex flex-wrap items-center gap-2" onsubmit={submitRename}>
				<input
					bind:this={nameInput}
					bind:value={nameDraft}
					type="text"
					class="input flex-1 min-w-0 px-3 py-2"
					maxlength={DASHBOARD_NAME_MAX}
					required
					aria-label={UI_TEXT.dashboardName}
					onkeydown={handleRenameKeydown}
				/>
				<button
					type="submit"
					class="btn btn-sm variant-filled-primary"
					disabled={savingName || !nameDraft.trim()}
				>
					{UI_TEXT.save}
				</button>
				<button type="button" class="btn btn-sm variant-ghost-surface" onclick={cancelRename}>
					{UI_TEXT.cancel}
				</button>
			</form>
		{/if}

		<AddressList
			{addresses}
			{statuses}
			{scheduleCache}
			title={dashboard.name}
			emptyTitle={UI_TEXT.dashboardEmpty}
			onadd={handleAdd}
			onedit={handleEdit}
			ondelete={handleDelete}
			onrefresh={handleRefresh}
		/>
	</div>
</PullToRefresh>

{#if showModal}
	<AddressModal
		{form}
		address={editingAddress}
		onsave={handleSave}
		oncancel={closeModal}
		ondelete={editingAddress ? () => handleDelete(editingAddress!.id) : undefined}
	/>
{/if}
