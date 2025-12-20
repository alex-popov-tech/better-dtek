<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		expanded?: boolean;
		children: Snippet;
	}

	let { title, expanded = $bindable(false), children }: Props = $props();

	function toggle() {
		expanded = !expanded;
	}
</script>

<div class="collapsible bg-surface-200/50 dark:bg-surface-700/30 rounded-lg">
	<button
		type="button"
		class="collapse-toggle flex items-center justify-between w-full p-2 text-left"
		onclick={toggle}
		aria-expanded={expanded}
	>
		<span class="font-medium text-surface-900 dark:text-surface-50">{title}</span>
		<svg
			class="w-5 h-5 transition-transform duration-300"
			class:-rotate-90={!expanded}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
			></path>
		</svg>
	</button>
	<div
		class="collapse-content overflow-hidden transition-all duration-300"
		class:max-h-0={!expanded}
		class:max-h-[500px]={expanded}
	>
		{@render children()}
	</div>
</div>
