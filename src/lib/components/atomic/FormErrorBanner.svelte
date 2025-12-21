<script lang="ts">
	interface Props {
		error: string | null;
		onRetry?: () => void;
	}

	let { error, onRetry }: Props = $props();
</script>

{#if error}
	<div
		role="alert"
		class="bg-error-50 dark:bg-error-900/20 border-l-4 border-error-500 p-4 mb-4 rounded-r"
	>
		<div class="flex items-start gap-3">
			<svg
				class="w-5 h-5 text-error-500 shrink-0 mt-0.5"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
					clip-rule="evenodd"
				/>
			</svg>
			<div class="flex-1">
				<p class="text-error-700 dark:text-error-300">{error}</p>
				{#if onRetry}
					<button
						type="button"
						class="mt-2 text-sm text-error-600 dark:text-error-400 underline hover:no-underline"
						onclick={onRetry}
					>
						Спробувати ще раз
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
