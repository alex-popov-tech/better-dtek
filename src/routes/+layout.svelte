<script lang="ts">
	import '../app.postcss';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import { theme } from '$lib/stores/theme';
	import { citiesStore } from '$lib/stores/cities';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { initializeStores, storePopup } from '@skeletonlabs/skeleton';
	import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';

	initializeStores();
	storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

	let { children } = $props();

	// Pre-fetch cities on app load
	$effect(() => {
		citiesStore.prefetch();
	});

	// Apply theme class to HTML element
	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('dark', $theme === 'dark');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{UI_TEXT.appTitle} - {UI_TEXT.appSubtitle}</title>
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>
