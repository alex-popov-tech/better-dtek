import type { ParamMatcher } from '@sveltejs/kit';
import { dashboardIdSchema } from '$lib/schemas';

/**
 * Matches only strings in the dashboard id format, so the top-level
 * dashboard route does not capture other top-level paths.
 */
export const match: ParamMatcher = (param) => dashboardIdSchema.safeParse(param).success;
