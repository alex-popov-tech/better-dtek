import type { RequestHandler } from './$types';
import { updateDashboardAddress, removeDashboardAddress } from '$lib/server/dashboards/repository';
import {
	dashboardJson,
	dashboardNoContent,
	dashboardErrorResponse,
	dashboardNotFoundResponse,
	isDashboardId,
} from '$lib/server/dashboards/http';
import { validateBody } from '$lib/server/validate';
import { dashboardAddressSchema } from '$lib/schemas';
import type { AddressInput } from '$lib/types';

/**
 * Replace an address in a dashboard
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	if (!isDashboardId(params.id)) return dashboardNotFoundResponse();

	const validation = await validateBody(request, dashboardAddressSchema);
	if (!validation.ok) return validation.error.response;

	const result = await updateDashboardAddress(
		params.id,
		params.addressId,
		validation.value as AddressInput
	);
	if (!result.ok) return dashboardErrorResponse(result.error);

	return dashboardJson(result.value);
};

/**
 * Remove an address from a dashboard
 */
export const DELETE: RequestHandler = async ({ params }) => {
	if (!isDashboardId(params.id)) return dashboardNotFoundResponse();

	const result = await removeDashboardAddress(params.id, params.addressId);
	if (!result.ok) return dashboardErrorResponse(result.error);

	return dashboardNoContent();
};
