<script lang="ts">
	import type { SavedAddress } from '$lib/types/address';
	import type { StatusCacheEntry, ScheduleCache } from '$lib/stores/address-status';
	import { addressStatusStore } from '$lib/stores/address-status';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import AddressCard from './AddressCard.svelte';

	interface Props {
		addresses: SavedAddress[];
		statuses: Map<string, StatusCacheEntry>;
		scheduleCache: ScheduleCache | null;
		onadd: () => void;
		onedit: (id: string) => void;
		ondelete: (id: string) => void;
	}

	let { addresses, statuses, scheduleCache, onadd, onedit, ondelete }: Props = $props();

	const schedules = $derived(scheduleCache?.schedules ?? null);

	const isEmpty = $derived(addresses.length === 0);

	const isRefreshing = $derived(
		addresses.length > 0 && Array.from(statuses.values()).some((entry) => entry.loading)
	);

	async function handleRefresh() {
		await addressStatusStore.refreshAllStatuses(addresses);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="h2 font-bold">{UI_TEXT.savedAddresses}</h2>

		{#if !isEmpty}
			<div class="flex items-center gap-2">
				<!-- Refresh button -->
				<button
					type="button"
					class="btn-icon btn-icon-sm variant-ghost-surface"
					onclick={handleRefresh}
					disabled={isRefreshing}
					aria-label={UI_TEXT.refresh}
					title={UI_TEXT.refresh}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-5 h-5"
						class:animate-spin={isRefreshing}
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
				</button>

				<!-- Add button - desktop/tablet only, mobile uses FAB -->
				<button
					type="button"
					class="btn btn-sm variant-ghost-surface hidden sm:flex items-center gap-1"
					onclick={onadd}
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
					onedit={() => onedit(address.id)}
					ondelete={() => ondelete(address.id)}
				/>
			{/each}
		</div>
	{/if}

	<!-- Mobile FAB - sized to match Sentry feedback button (48x48px) -->
	{#if !isEmpty}
		<button
			type="button"
			class="fixed bottom-8 right-6 z-40 w-12 h-12 flex items-center justify-center variant-filled-primary shadow-xl md:hidden rounded-full"
			onclick={onadd}
			aria-label={UI_TEXT.addAddress}
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
		</button>
	{/if}
</div>
