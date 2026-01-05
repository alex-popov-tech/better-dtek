<script lang="ts">
	import '../app.postcss';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import { theme } from '$lib/stores/theme';
	import { initToastStore } from '$lib/stores/toast';
	import { initializeForFirstTimeUser } from '$lib/stores/addresses';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import { initializeStores, storePopup, Toast, getToastStore } from '@skeletonlabs/skeleton';
	import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
	import { onMount } from 'svelte';

	initializeStores();
	storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
	initToastStore(getToastStore());

	onMount(() => {
		initializeForFirstTimeUser();
	});

	let { children } = $props();

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

<!-- Toast wrapper with high z-index to appear above modals -->
<div class="fixed top-0 right-0 z-[100] pointer-events-none">
	<div class="pointer-events-auto">
		<Toast />
	</div>
</div>

<AppShell>
	{@render children()}
</AppShell>
