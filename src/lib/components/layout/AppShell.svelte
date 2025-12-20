<script lang="ts">
	import { AppShell as SkeletonAppShell, AppBar } from '@skeletonlabs/skeleton';
	import ThemeToggle from './ThemeToggle.svelte';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<SkeletonAppShell>
	<svelte:fragment slot="header">
		<AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end">
			<svelte:fragment slot="lead">
				<!-- Logo/Icon placeholder -->
				<div class="flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-6 h-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
						/>
					</svg>
				</div>
			</svelte:fragment>

			<!-- App title -->
			<div class="flex flex-col items-center">
				<h1 class="text-lg md:text-xl font-bold">{UI_TEXT.appTitle}</h1>
				<p class="text-xs text-surface-600-300-token hidden sm:block">
					{UI_TEXT.appSubtitle}
				</p>
			</div>

			<svelte:fragment slot="trail">
				<ThemeToggle />
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>

	<!-- Main content -->
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
		{@render children()}
	</div>
</SkeletonAppShell>
