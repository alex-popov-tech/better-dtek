# Form Error Handling: 80/20 Implementation Guide

This guide covers the minimal changes needed for maximum impact on form error handling. Three improvements that deliver accessibility compliance and clear error categorization.

---

## Overview

| Improvement                | Effort | Impact                                     |
| -------------------------- | ------ | ------------------------------------------ |
| 1. ErrorMessage component  | 1-2 hr | Accessibility (screen readers, colorblind) |
| 2. Backend errors[] array  | 2-3 hr | Field-level error mapping from API         |
| 3. Form-level error banner | 1-2 hr | Clear UX for non-field errors              |

**Total: ~4-7 hours | Files: 6-8 | Result: Accessible, clear error handling**

---

## 1. ErrorMessage Component

**Goal:** Single reusable component with icon (colorblind) + ARIA (screen readers).

### Create `src/lib/components/atomic/ErrorMessage.svelte`

```svelte
<script lang="ts">
	interface Props {
		error: string | undefined;
		inputId: string;
	}

	let { error, inputId }: Props = $props();
</script>

{#if error}
	<div
		id="{inputId}-error"
		role="alert"
		class="flex items-center gap-1.5 text-error-500 text-sm mt-1"
	>
		<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
				clip-rule="evenodd"
			/>
		</svg>
		<span>{error}</span>
	</div>
{/if}
```

### Update BaseAutocomplete.svelte

```svelte
<!-- Add import -->
<script lang="ts">
	import ErrorMessage from './ErrorMessage.svelte';

	// Add inputId prop or generate
	const inputId = `autocomplete-${Math.random().toString(36).slice(2, 9)}`;
</script>

<!-- Update input -->
<input
	id={inputId}
	aria-invalid={!!error}
	aria-describedby={error ? `${inputId}-error` : undefined}
	...rest
/>

<!-- Replace error display -->
<ErrorMessage {error} {inputId} />
```

### Update RegionSelect.svelte

```svelte
<script lang="ts">
  import ErrorMessage from './ErrorMessage.svelte';
  const inputId = 'region-select';
</script>

<select
  id={inputId}
  aria-invalid={!!error}
  aria-describedby={error ? `${inputId}-error` : undefined}
  ...
>

<ErrorMessage {error} {inputId} />
```

### Update BuildingSelect.svelte

Same pattern as RegionSelect.

### Export from index

```typescript
// src/lib/components/atomic/index.ts
export { default as ErrorMessage } from './ErrorMessage.svelte';
```

---

## 2. Backend errors[] Array

**Goal:** Backend returns field-specific errors so frontend can map them to inputs.

### Update error types

```typescript
// src/lib/types/errors.ts

// Add FieldError interface
export interface FieldError {
	readonly field: string;
	readonly code: string;
	readonly message: string;
}

// Update ApiError on client side
export interface ApiError {
	readonly code: ApiErrorCode;
	readonly message: string;
	readonly httpStatus?: number;
	readonly fieldErrors?: FieldError[]; // NEW
}
```

### Update validateQuery to return field errors

```typescript
// src/lib/server/validate.ts

export interface ApiValidationError {
	response: Response;
	fieldErrors: FieldError[]; // NEW
}

export function validateQuery<T extends z.ZodType>(
	url: URL,
	schema: T
): Result<z.infer<T>, ApiValidationError> {
	const params = Object.fromEntries(url.searchParams);
	const result = schema.safeParse(params);

	if (!result.success) {
		// Extract field errors from Zod
		const fieldErrors: FieldError[] = result.error.errors.map((err) => ({
			field: err.path.join('.'),
			code: err.code.toUpperCase(),
			message: err.message,
		}));

		return err({
			response: json(
				{
					error: 'VALIDATION_ERROR',
					message: 'Невірні параметри запиту',
					errors: fieldErrors, // Include field errors
				},
				{ status: 400 }
			),
			fieldErrors,
		});
	}

	return ok(result.data);
}
```

### Update api-client.ts to extract field errors

```typescript
// src/lib/utils/api-client.ts

interface ApiResponse {
	error?: string;
	message?: string;
	errors?: Array<{ field: string; code: string; message: string }>;
}

async function handleErrorResponse(response: Response): Promise<ApiError> {
	try {
		const data: ApiResponse = await response.json();
		return {
			code: (data.error as ApiErrorCode) || 'SERVER_ERROR',
			message: data.message || 'Помилка сервера',
			httpStatus: response.status,
			fieldErrors: data.errors, // Pass through field errors
		};
	} catch {
		return {
			code: 'SERVER_ERROR',
			message: 'Помилка сервера',
			httpStatus: response.status,
		};
	}
}
```

---

## 3. Form-Level Error Banner

**Goal:** Show errors that aren't tied to specific fields at the top of the form.

### Create FormErrorBanner.svelte

```svelte
<!-- src/lib/components/atomic/FormErrorBanner.svelte -->
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
```

### Update AddressForm.svelte

```svelte
<script lang="ts">
	import { FormErrorBanner } from '$lib/components/atomic';

	let formError: string | null = $state(null);

	async function handleSubmit() {
		formError = null; // Clear on new submit

		// ... existing validation ...

		const result = await submitToApi(data);

		if (!result.ok) {
			const error = result.error;

			// Check for field-specific errors
			if (error.fieldErrors?.length) {
				error.fieldErrors.forEach((fe) => {
					// Map to superforms errors
					// $errors[fe.field] = fe.message;
				});
				return;
			}

			// Check if it's a form-related error
			if (error.code === 'VALIDATION_ERROR') {
				formError = error.message;
				return;
			}

			// System error - show as toast
			showError(error.message);
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<!-- Form-level error at top -->
	<FormErrorBanner error={formError} />

	<!-- Existing form fields -->
	...
</form>
```

---

## Error Categorization Logic

Use this decision tree in your form submit handler:

```typescript
function handleApiError(error: ApiError) {
	// 1. Field-level errors from backend
	if (error.fieldErrors?.length) {
		error.fieldErrors.forEach((fe) => {
			setFieldError(fe.field, fe.message);
		});
		focusFirstError();
		return;
	}

	// 2. Form-level errors (validation without specific field)
	if (error.code === 'VALIDATION_ERROR') {
		formError = error.message;
		return;
	}

	// 3. System errors (network, DTEK unavailable, etc.)
	showError(error.message);
	// Keep form open for retry
}

function isRetryableError(code: string): boolean {
	return ['NETWORK_ERROR', 'REGION_UNAVAILABLE', 'SESSION_ERROR'].includes(code);
}
```

---

## Testing Checklist

### Accessibility Testing

- [ ] Screen reader (VoiceOver on Mac: Cmd+F5) reads error messages when they appear
- [ ] Focus moves to first error field on submit with errors
- [ ] Error icon visible (not just color) for each error

### Error Flow Testing

- [ ] Frontend validation: Leave required field empty → error appears inline
- [ ] Backend validation: Submit invalid params → field errors map correctly
- [ ] Form-level error: Backend returns validation error without field → banner appears
- [ ] System error: Disconnect network → toast appears

### Manual Test Cases

```bash
# Test backend field errors
curl "http://localhost:5173/api/status" | jq
# Should return: { error: "VALIDATION_ERROR", errors: [...] }

# Test with missing params
curl "http://localhost:5173/api/status?region=kyiv" | jq
# Should return field errors for city and street
```

---

## Files Changed Summary

| File                                                | Changes                                   |
| --------------------------------------------------- | ----------------------------------------- |
| `src/lib/components/atomic/ErrorMessage.svelte`     | **NEW**                                   |
| `src/lib/components/atomic/FormErrorBanner.svelte`  | **NEW**                                   |
| `src/lib/components/atomic/index.ts`                | Export new components                     |
| `src/lib/components/atomic/BaseAutocomplete.svelte` | Use ErrorMessage, add aria-describedby    |
| `src/lib/components/atomic/RegionSelect.svelte`     | Use ErrorMessage, add aria-describedby    |
| `src/lib/components/atomic/BuildingSelect.svelte`   | Use ErrorMessage, add aria-describedby    |
| `src/lib/types/errors.ts`                           | Add FieldError interface, update ApiError |
| `src/lib/server/validate.ts`                        | Return field errors array                 |
| `src/lib/utils/api-client.ts`                       | Extract fieldErrors from response         |
| `src/lib/components/composite/AddressForm.svelte`   | Add FormErrorBanner, error categorization |

---

## What We're NOT Doing (and Why)

| Skipped                               | Reason                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| RFC 9457 `type`, `title`, `instance`  | Your format works; adds complexity without benefit for internal API |
| Form error summary listing all errors | Your form has 4 fields; summary adds noise                          |
| `retryable` hint from backend         | Frontend already knows from error code                              |
| Full focus management system          | Simple first-error focus is sufficient                              |

---

## Success Criteria

After implementation:

1. Screen reader announces "Street, edit text, invalid entry. Оберіть вулицю" (not just "invalid entry")
2. Colorblind users see error icon, not just red text
3. Backend validation errors map to specific form fields
4. Non-field errors appear in banner at top of form
5. System errors (DTEK down, network) appear as toast
