<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { dashboardsStore } from '$lib/stores/dashboards';
	import { createDashboard } from '$lib/utils/dashboard-api';
	import { showError } from '$lib/stores/toast';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { DASHBOARD_NAME_MAX } from '$lib/types/dashboard';

	const dashboards = $derived($dashboardsStore);

	// "My dashboards" panel
	let menuOpen = $state(false);
	let menuElement: HTMLDivElement | undefined = $state(undefined);

	// "Create dashboard" dialog
	let createOpen = $state(false);
	let name = $state('');
	let creating = $state(false);
	let nameInput: HTMLInputElement | undefined = $state(undefined);
	let createTrigger: HTMLElement | null = null;

	// Close the panel when the last dashboard is forgotten
	$effect(() => {
		if (dashboards.length === 0) menuOpen = false;
	});

	function handleWindowClick(event: MouseEvent) {
		// composedPath, not contains(): a clicked "forget" row is already removed from the DOM
		if (menuOpen && menuElement && !event.composedPath().includes(menuElement)) {
			menuOpen = false;
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (createOpen) {
			closeCreate();
		} else if (menuOpen) {
			menuOpen = false;
		}
	}

	async function openCreate() {
		createTrigger = document.activeElement as HTMLElement;
		menuOpen = false;
		name = '';
		createOpen = true;
		await tick();
		nameInput?.focus();
	}

	function closeCreate() {
		if (creating) return;
		createOpen = false;
		createTrigger?.focus();
		createTrigger = null;
	}

	async function submitCreate(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || creating) return;

		creating = true;
		const result = await createDashboard(trimmed);
		creating = false;

		if (!result.ok) {
			// Keep the dialog open so the name is not lost
			showError(result.error.message);
			return;
		}

		dashboardsStore.remember({ id: result.value.id, name: result.value.name });
		createOpen = false;
		await goto(resolve('/[id=dashboardId]', { id: result.value.id }));
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="flex flex-wrap items-center gap-2 mb-6">
	{#if dashboards.length > 0}
		<div class="relative" bind:this={menuElement}>
			<button
				type="button"
				class="btn btn-sm variant-ghost-surface flex items-center gap-1"
				aria-haspopup="true"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
				data-testid="dashboards-menu-btn"
			>
				<span>{UI_TEXT.myDashboards}</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="2"
					stroke="currentColor"
					class="w-4 h-4 transition-transform"
					class:rotate-180={menuOpen}
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
				</svg>
			</button>

			{#if menuOpen}
				<ul
					class="card absolute left-0 top-full mt-2 z-40 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto p-2 shadow-xl ring-1 ring-surface-300-600-token"
					data-testid="dashboards-menu"
				>
					{#each dashboards as dashboard (dashboard.id)}
						<li class="flex items-center gap-1">
							<a
								href={resolve('/[id=dashboardId]', { id: dashboard.id })}
								class="flex-1 min-w-0 truncate rounded-token px-3 py-2 hover:variant-soft-surface"
							>
								{dashboard.name}
							</a>
							<button
								type="button"
								class="btn-icon btn-icon-sm variant-ghost-surface shrink-0"
								aria-label="{UI_TEXT.forgetDashboard}: {dashboard.name}"
								title={UI_TEXT.forgetDashboard}
								onclick={() => dashboardsStore.forget(dashboard.id)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke="currentColor"
									class="w-4 h-4"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<button
		type="button"
		class="btn btn-sm variant-ghost-surface flex items-center gap-1"
		onclick={openCreate}
		data-testid="create-dashboard-btn"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="2"
			stroke="currentColor"
			class="w-4 h-4"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
		</svg>
		<span>{UI_TEXT.createDashboard}</span>
	</button>
</div>

{#if createOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center px-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-dashboard-title"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="absolute inset-0 bg-surface-backdrop-token backdrop-blur-md cursor-pointer border-0"
			onclick={closeCreate}
			aria-label="Закрити модальне вікно"
		></button>
		<form
			class="card p-6 w-full sm:max-w-md relative z-10 shadow-xl ring-1 ring-surface-300-600-token space-y-4"
			onsubmit={submitCreate}
			data-testid="create-dashboard-dialog"
		>
			<h2 id="create-dashboard-title" class="h3 font-bold">{UI_TEXT.createDashboard}</h2>

			<label class="label">
				<span>{UI_TEXT.dashboardName}</span>
				<input
					bind:this={nameInput}
					bind:value={name}
					type="text"
					class="input px-3 py-2"
					maxlength={DASHBOARD_NAME_MAX}
					placeholder={UI_TEXT.dashboardNamePlaceholder}
					required
				/>
			</label>

			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="btn variant-ghost-surface"
					onclick={closeCreate}
					disabled={creating}
				>
					{UI_TEXT.cancel}
				</button>
				<button
					type="submit"
					class="btn variant-filled-primary"
					disabled={creating || !name.trim()}
				>
					{UI_TEXT.create}
				</button>
			</div>
		</form>
	</div>
{/if}
