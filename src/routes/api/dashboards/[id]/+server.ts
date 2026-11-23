import type { RequestHandler } from './$types';
import { getDashboard, renameDashboard } from '$lib/server/dashboards/repository';
import {
	dashboardJson,
	dashboardErrorResponse,
	dashboardNotFoundResponse,
	isDashboardId,
} from '$lib/server/dashboards/http';
import { validateBody } from '$lib/server/validate';
import { dashboardNameBodySchema } from '$lib/schemas';

/**
 * Read a dashboard with its addresses
 */
export const GET: RequestHandler = async ({ params }) => {
	if (!isDashboardId(params.id)) return dashboardNotFoundResponse();

	const result = await getDashboard(params.id);
	if (!result.ok) return dashboardErrorResponse(result.error);

	return dashboardJson(result.value);
};

/**
 * Rename a dashboard
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
	if (!isDashboardId(params.id)) return dashboardNotFoundResponse();

	const validation = await validateBody(request, dashboardNameBodySchema);
	if (!validation.ok) return validation.error.response;

	const result = await renameDashboard(params.id, validation.value.name);
	if (!result.ok) return dashboardErrorResponse(result.error);

	return dashboardJson(result.value);
};
