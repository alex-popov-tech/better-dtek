<script lang="ts">
	import type { PageData } from './$types';
	import DashboardView from '$lib/components/composite/DashboardView.svelte';

	let { data }: { data: PageData } = $props();
</script>

<!-- Recreate the view (and its store) when navigating between dashboards -->
{#key data.dashboard.id}
	<DashboardView dashboard={data.dashboard} form={data.form} />
{/key}
