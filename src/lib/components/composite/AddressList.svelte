<script lang="ts">
	import type { SavedAddress } from '$lib/types/address';
	import type { StatusCacheEntry, ScheduleCache } from '$lib/stores/address-status';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import AddressCard from './AddressCard.svelte';
	import RefreshButton from '../atomic/RefreshButton.svelte';

	interface Props {
		addresses: SavedAddress[];
		statuses: Map<string, StatusCacheEntry>;
		scheduleCache: ScheduleCache | null;
		onrefreshall: () => void;
		onadd: () => void;
		onedit: (id: string) => void;
		ondelete: (id: string) => void;
		onrefresh: (id: string) => void;
	}

	let {
		addresses,
		statuses,
		scheduleCache,
		onrefreshall,
		onadd,
		onedit,
		ondelete,
		onrefresh,
	}: Props = $props();

	const schedules = $derived(scheduleCache?.schedules ?? null);

	const isEmpty = $derived(addresses.length === 0);

	// Check if any address is currently loading (for refresh all button state)
	const isAnyLoading = $derived(Array.from(statuses.values()).some((entry) => entry.loading));
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="h2 font-bold">{UI_TEXT.savedAddresses}</h2>
		{#if !isEmpty}
			<RefreshButton onclick={onrefreshall} loading={isAnyLoading} label={UI_TEXT.refreshAll} />
		{/if}
	</div>

	<!-- Empty state -->
	{#if isEmpty}
		<div class="card p-12 text-center space-y-6">
			<div class="text-surface-500-400-token">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-20 h-20 mx-auto"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
					/>
				</svg>
			</div>

			<div class="space-y-2">
				<h3 class="h3">{UI_TEXT.noSavedAddresses}</h3>
				<p class="text-surface-600-300-token">{UI_TEXT.addFirstAddress}</p>
				<p class="text-surface-500-400-token text-sm">{UI_TEXT.emptyStateValueProp}</p>
			</div>

			<button
				type="button"
				class="btn btn-lg variant-filled-primary"
				onclick={onadd}
				data-testid="add-address-btn"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="w-5 h-5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				<span>{UI_TEXT.addAddress}</span>
			</button>
		</div>
	{:else}
		<!-- Address cards grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each addresses as address (address.id)}
				{@const statusEntry = statuses.get(address.id)}
				<AddressCard
					{address}
					status={statusEntry?.status || null}
					loading={statusEntry?.loading || false}
					error={statusEntry?.error}
					fetchedAt={statusEntry?.fetchedAt}
					{schedules}
					onrefresh={() => onrefresh(address.id)}
					onedit={() => onedit(address.id)}
					ondelete={() => ondelete(address.id)}
				/>
			{/each}
		</div>

		<!-- Add button -->
		<div class="flex justify-center">
			<button type="button" class="btn variant-ghost-primary" onclick={onadd}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-5 h-5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				<span>{UI_TEXT.addAddress}</span>
			</button>
		</div>
	{/if}
</div>
