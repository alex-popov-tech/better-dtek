/**
 * HTTP helpers shared by the /api/dashboards routes
 */

import { json } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import type { DashboardError, DashboardErrorCode } from '$lib/types';
import { dashboardError } from '$lib/types';
import { UI_TEXT } from '$lib/constants/ui-text';
import { dashboardIdSchema } from '$lib/schemas';
import { isSentryEnabled } from '$lib/server/sentry';

/** Dashboards are edited by several people; responses must never be cached */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const STATUS_BY_CODE: Record<DashboardErrorCode, number> = {
	NOT_FOUND: 404,
	LIMIT_REACHED: 409,
	STORAGE_ERROR: 503,
};

/** JSON success response with no-store caching */
export function dashboardJson(data: unknown, status = 200): Response {
	return json(data, { status, headers: NO_STORE });
}

/** Empty 204 response with no-store caching */
export function dashboardNoContent(): Response {
	return new Response(null, { status: 204, headers: NO_STORE });
}

/** Map a repository error to its JSON error response */
export function dashboardErrorResponse(error: DashboardError): Response {
	if (error.code === 'STORAGE_ERROR' && error.cause && isSentryEnabled()) {
		Sentry.captureException(error.cause);
	}

	return json(
		{ error: error.code, message: error.message },
		{ status: STATUS_BY_CODE[error.code], headers: NO_STORE }
	);
}

/** 404 response for a dashboard that does not exist */
export function dashboardNotFoundResponse(): Response {
	return dashboardErrorResponse(dashboardError('NOT_FOUND', UI_TEXT.dashboardNotFound));
}

/** Whether a route param has the dashboard id format */
export function isDashboardId(id: string | undefined): id is string {
	return dashboardIdSchema.safeParse(id).success;
}
