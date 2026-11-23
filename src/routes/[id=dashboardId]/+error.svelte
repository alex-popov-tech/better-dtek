<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { dashboardsStore } from '$lib/stores/dashboards';
	import { UI_TEXT } from '$lib/constants/ui-text';

	const dashboardId = $derived(page.params.id);
	const isRemembered = $derived(
		page.status === 404 && $dashboardsStore.some((d) => d.id === dashboardId)
	);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="card p-12 text-center space-y-6">
	<h2 class="h2 font-bold">{page.error?.message ?? UI_TEXT.dashboardNotFound}</h2>

	<div class="flex flex-wrap items-center justify-center gap-3">
		<a href={resolve('/')} class="btn variant-filled-primary">{UI_TEXT.goHome}</a>
		{#if isRemembered && dashboardId}
			<button
				type="button"
				class="btn variant-ghost-surface"
				onclick={() => dashboardsStore.forget(dashboardId)}
			>
				{UI_TEXT.forgetDashboard}
			</button>
		{/if}
	</div>
</div>
