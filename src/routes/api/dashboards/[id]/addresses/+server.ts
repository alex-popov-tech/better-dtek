import type { RequestHandler } from './$types';
import { addDashboardAddress } from '$lib/server/dashboards/repository';
import {
	dashboardJson,
	dashboardErrorResponse,
	dashboardNotFoundResponse,
	isDashboardId,
} from '$lib/server/dashboards/http';
import { validateBody } from '$lib/server/validate';
import { dashboardAddressSchema } from '$lib/schemas';
import type { AddressInput } from '$lib/types';

/**
 * Add an address to a dashboard
 */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDashboardId(params.id)) return dashboardNotFoundResponse();

	const validation = await validateBody(request, dashboardAddressSchema);
	if (!validation.ok) return validation.error.response;

	const result = await addDashboardAddress(params.id, validation.value as AddressInput);
	if (!result.ok) return dashboardErrorResponse(result.error);

	return dashboardJson(result.value, 201);
};
