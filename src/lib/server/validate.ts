/**
 * API route validation utilities
 *
 * Provides helper functions for validating query parameters
 * in SvelteKit API routes using Zod schemas.
 * Uses the Result<T, E> pattern for consistency with the rest of the codebase.
 */

import { json } from '@sveltejs/kit';
import type { z } from 'zod';
import type { Result } from '$lib/types';
import { ok, err } from '$lib/types';

/**
 * API validation error - wraps a Response for early return in routes
 */
export interface ApiValidationError {
	response: Response;
}

/**
 * Validate URL query parameters against a Zod schema
 *
 * @param url - The URL object containing search params
 * @param schema - Zod schema to validate against
 * @returns Result with typed data on success, or ApiValidationError on failure
 *
 * @example
 * ```ts
 * const validation = validateQuery(url, cityQuerySchema);
 * if (!validation.ok) return validation.error.response;
 * const { city } = validation.value;
 * ```
 */
export function validateQuery<T extends z.ZodType>(
	url: URL,
	schema: T
): Result<z.infer<T>, ApiValidationError> {
	const params = Object.fromEntries(url.searchParams);
	const result = schema.safeParse(params);

	if (!result.success) {
		// Get the first error message for user display
		const firstError = result.error.issues[0];
		const message = firstError?.message ?? 'Невірні параметри запиту';

		// Build field errors array for frontend
		const fieldErrors = result.error.issues.map((issue) => ({
			field: issue.path.join('.'),
			code: issue.code.toUpperCase(),
			message: issue.message,
		}));

		console.error('[API Validation] Query validation failed:', {
			params,
			errors: result.error.flatten(),
		});

		return err({
			response: json(
				{
					error: 'VALIDATION_ERROR',
					message,
					errors: fieldErrors,
				},
				{ status: 400 }
			),
		});
	}

	return ok(result.data);
}

/**
 * Validate a JSON request body against a Zod schema
 *
 * A body that is not valid JSON is reported the same way as a body that
 * fails the schema: 400 VALIDATION_ERROR.
 *
 * @param request - The incoming request
 * @param schema - Zod schema to validate against
 * @returns Result with typed data on success, or ApiValidationError on failure
 */
export async function validateBody<T extends z.ZodType>(
	request: Request,
	schema: T
): Promise<Result<z.infer<T>, ApiValidationError>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return err({
			response: json(
				{ error: 'VALIDATION_ERROR', message: 'Некоректне тіло запиту', errors: [] },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			),
		});
	}

	const result = schema.safeParse(body);

	if (!result.success) {
		const firstError = result.error.issues[0];
		const message = firstError?.message ?? 'Невірні параметри запиту';

		const fieldErrors = result.error.issues.map((issue) => ({
			field: issue.path.join('.'),
			code: issue.code.toUpperCase(),
			message: issue.message,
		}));

		console.error('[API Validation] Body validation failed:', result.error.flatten());

		return err({
			response: json(
				{ error: 'VALIDATION_ERROR', message, errors: fieldErrors },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			),
		});
	}

	return ok(result.data);
}
