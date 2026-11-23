import type { RequestHandler } from './$types';
import { createDashboard } from '$lib/server/dashboards/repository';
import { dashboardJson, dashboardErrorResponse } from '$lib/server/dashboards/http';
import { validateBody } from '$lib/server/validate';
import { dashboardNameBodySchema } from '$lib/schemas';

/**
 * Create a dashboard
 */
export const POST: RequestHandler = async ({ request }) => {
	const validation = await validateBody(request, dashboardNameBodySchema);
	if (!validation.ok) return validation.error.response;

	const result = await createDashboard(validation.value.name);
	if (!result.ok) return dashboardErrorResponse(result.error);

	console.log(`[API] POST /api/dashboards created ${result.value.id}`);
	return dashboardJson(result.value, 201);
};
