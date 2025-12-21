/**
 * Client-side API utilities
 *
 * Provides functions to fetch data from the application's API endpoints.
 * Uses Result pattern for explicit error handling instead of throwing exceptions.
 */

import type { CitiesResponse, StreetsResponse, StatusResponse } from '$lib/types/address';
import type { Result } from '$lib/types/result';
import type { ApiError, FieldError } from '$lib/types/errors';
import { ok, err } from '$lib/types/result';
import { apiError } from '$lib/types/errors';
import type { RegionCode } from '$lib/constants/regions';
import { UI_TEXT } from '$lib/constants/ui-text';

/**
 * Response structure for error responses from API
 */
interface ApiErrorResponse {
	error?: string;
	message?: string;
	errors?: Array<{ field: string; code: string; message: string }>;
}

/**
 * Parse error response and extract field errors if present
 */
async function parseErrorResponse(
	response: Response
): Promise<{ errorCode?: string; fieldErrors?: FieldError[] }> {
	try {
		const data: ApiErrorResponse = await response.json();
		return {
			errorCode: data.error,
			fieldErrors: data.errors,
		};
	} catch {
		return {};
	}
}

/**
 * Fetch all available cities from DTEK API for a specific region
 * @param region - Region code (e.g., 'kem', 'oem')
 * @returns Result with array of city names or ApiError
 */
export async function fetchCities(region: RegionCode): Promise<Result<string[], ApiError>> {
	try {
		const url = `/api/cities?region=${encodeURIComponent(region)}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[API Client] fetchCities failed: HTTP', response.status);
			const { errorCode, fieldErrors } = await parseErrorResponse(response);
			if (errorCode === 'REGION_UNAVAILABLE') {
				return err(
					apiError('REGION_UNAVAILABLE', UI_TEXT.regionUnavailable, response.status, fieldErrors)
				);
			}
			if (errorCode === 'VALIDATION_ERROR') {
				return err(
					apiError('VALIDATION_ERROR', UI_TEXT.invalidParams, response.status, fieldErrors)
				);
			}
			return err(apiError('SERVER_ERROR', UI_TEXT.dtekUnavailable, response.status, fieldErrors));
		}

		const data: CitiesResponse = await response.json();

		if (!Array.isArray(data.cities)) {
			console.error('[API Client] fetchCities: invalid response structure');
			return err(apiError('VALIDATION_ERROR', UI_TEXT.invalidApiResponse));
		}

		return ok(data.cities);
	} catch (error) {
		console.error('[API Client] fetchCities failed:', error);
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return err(apiError('NETWORK_ERROR', UI_TEXT.networkError));
		}
		return err(apiError('NETWORK_ERROR', UI_TEXT.dtekUnavailable));
	}
}

/**
 * Fetch streets for a specific city in a region
 * @param region - Region code (e.g., 'kem', 'oem')
 * @param city - City name (will be URL encoded)
 * @returns Result with array of street names or ApiError
 */
export async function fetchStreets(
	region: RegionCode,
	city: string
): Promise<Result<string[], ApiError>> {
	if (!city || city.trim().length === 0) {
		return err(apiError('VALIDATION_ERROR', UI_TEXT.cityRequired));
	}

	try {
		const url = `/api/streets?region=${encodeURIComponent(region)}&city=${encodeURIComponent(city)}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[API Client] fetchStreets failed: HTTP', response.status);
			const { errorCode, fieldErrors } = await parseErrorResponse(response);
			if (response.status === 400 || errorCode === 'VALIDATION_ERROR') {
				return err(
					apiError('VALIDATION_ERROR', UI_TEXT.invalidParams, response.status, fieldErrors)
				);
			}
			return err(apiError('SERVER_ERROR', UI_TEXT.dtekUnavailable, response.status, fieldErrors));
		}

		const data: StreetsResponse = await response.json();

		if (!Array.isArray(data.streets)) {
			console.error('[API Client] fetchStreets: invalid response structure');
			return err(apiError('VALIDATION_ERROR', UI_TEXT.invalidApiResponse));
		}

		return ok(data.streets);
	} catch (error) {
		console.error('[API Client] fetchStreets failed:', error);
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return err(apiError('NETWORK_ERROR', UI_TEXT.networkError));
		}
		return err(apiError('NETWORK_ERROR', UI_TEXT.dtekUnavailable));
	}
}

/**
 * Fetch building statuses for a specific city and street in a region
 * @param region - Region code (e.g., 'kem', 'oem')
 * @param city - City name (will be URL encoded)
 * @param street - Street name (will be URL encoded)
 * @returns Result with StatusResponse or ApiError
 */
export async function fetchBuildingStatuses(
	region: RegionCode,
	city: string,
	street: string
): Promise<Result<StatusResponse, ApiError>> {
	if (!city || city.trim().length === 0) {
		return err(apiError('VALIDATION_ERROR', UI_TEXT.cityRequired));
	}

	if (!street || street.trim().length === 0) {
		return err(apiError('VALIDATION_ERROR', UI_TEXT.streetRequired));
	}

	try {
		const url = `/api/status?region=${encodeURIComponent(region)}&city=${encodeURIComponent(city)}&street=${encodeURIComponent(street)}`;
		const response = await fetch(url);

		if (!response.ok) {
			console.error('[API Client] fetchBuildingStatuses failed: HTTP', response.status);
			const { errorCode, fieldErrors } = await parseErrorResponse(response);
			if (response.status === 400 || errorCode === 'VALIDATION_ERROR') {
				return err(
					apiError('VALIDATION_ERROR', UI_TEXT.invalidParams, response.status, fieldErrors)
				);
			}
			return err(apiError('SERVER_ERROR', UI_TEXT.dtekUnavailable, response.status, fieldErrors));
		}

		const data: StatusResponse = await response.json();

		// Validate response structure
		if (!data.city || !data.street || typeof data.buildings !== 'object') {
			console.error('[API Client] fetchBuildingStatuses: invalid response structure');
			return err(apiError('VALIDATION_ERROR', UI_TEXT.invalidApiResponse));
		}

		return ok(data);
	} catch (error) {
		console.error('[API Client] fetchBuildingStatuses failed:', error);
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return err(apiError('NETWORK_ERROR', UI_TEXT.networkError));
		}
		return err(apiError('NETWORK_ERROR', UI_TEXT.dtekUnavailable));
	}
}
