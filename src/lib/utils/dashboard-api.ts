/**
 * Client-side API for public dashboards
 *
 * Thin wrappers around the /api/dashboards routes that return
 * Result<T, ApiError> instead of throwing.
 */

import type { SavedAddress } from '$lib/types/address';
import type { Dashboard, DashboardMeta, AddressInput } from '$lib/types/dashboard';
import type { Result } from '$lib/types/result';
import type { ApiError, ApiErrorCode } from '$lib/types/errors';
import { ok, err } from '$lib/types/result';
import { apiError } from '$lib/types/errors';
import { UI_TEXT } from '$lib/constants/ui-text';

const BASE = '/api/dashboards';

/** Read the server's validation message, if the error body has one */
async function readServerMessage(response: Response): Promise<string | undefined> {
	try {
		const body = (await response.json()) as { message?: unknown };
		return typeof body.message === 'string' && body.message ? body.message : undefined;
	} catch {
		return undefined;
	}
}

/** Map an HTTP error status to a client error */
function errorFromStatus(status: number, serverMessage?: string): ApiError {
	const byStatus: Record<number, [ApiErrorCode, string]> = {
		400: ['VALIDATION_ERROR', UI_TEXT.invalidParams],
		404: ['NOT_FOUND', UI_TEXT.dashboardNotFound],
		409: ['LIMIT_REACHED', UI_TEXT.dashboardLimitReached],
	};
	const [code, message] = byStatus[status] ?? ['SERVER_ERROR', UI_TEXT.dashboardStorageError];
	// Validation messages name the field that is wrong; the generic text does not
	return apiError(code, (status === 400 && serverMessage) || message, status);
}

/**
 * Send a request and parse the JSON response
 * @param path - Path below /api/dashboards (empty for the collection)
 */
async function request<T>(
	method: string,
	path: string,
	body?: unknown
): Promise<Result<T, ApiError>> {
	try {
		const response = await fetch(`${BASE}${path}`, {
			method,
			headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		if (!response.ok) {
			console.error(`[Dashboard API] ${method} ${path} failed: HTTP`, response.status);
			const serverMessage = response.status === 400 ? await readServerMessage(response) : undefined;
			return err(errorFromStatus(response.status, serverMessage));
		}

		if (response.status === 204) return ok(undefined as T);

		return ok((await response.json()) as T);
	} catch (error) {
		console.error(`[Dashboard API] ${method} ${path} error:`, error);
		return err(apiError('NETWORK_ERROR', UI_TEXT.networkError));
	}
}

export function createDashboard(name: string): Promise<Result<Dashboard, ApiError>> {
	return request('POST', '', { name });
}

export function fetchDashboard(id: string): Promise<Result<Dashboard, ApiError>> {
	return request('GET', `/${id}`);
}

export function renameDashboard(
	id: string,
	name: string
): Promise<Result<DashboardMeta, ApiError>> {
	return request('PATCH', `/${id}`, { name });
}

export function addDashboardAddress(
	id: string,
	input: AddressInput
): Promise<Result<SavedAddress, ApiError>> {
	return request('POST', `/${id}/addresses`, input);
}

export function updateDashboardAddress(
	id: string,
	addressId: string,
	input: AddressInput
): Promise<Result<SavedAddress, ApiError>> {
	return request('PUT', `/${id}/addresses/${encodeURIComponent(addressId)}`, input);
}

export function removeDashboardAddress(
	id: string,
	addressId: string
): Promise<Result<void, ApiError>> {
	return request('DELETE', `/${id}/addresses/${encodeURIComponent(addressId)}`);
}
