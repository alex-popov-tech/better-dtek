import type { CitiesResponse, StreetsResponse, StatusResponse } from '$lib/types/address';
import { UI_TEXT } from '$lib/constants/ui-text';

/**
 * Fetch all available cities from DTEK API
 * @returns Array of city names
 * @throws Error if fetch fails or response is invalid
 */
export async function fetchCities(): Promise<string[]> {
	try {
		const response = await fetch('/api/cities');

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: CitiesResponse = await response.json();

		if (!Array.isArray(data.cities)) {
			throw new Error(UI_TEXT.invalidApiResponse);
		}

		return data.cities;
	} catch (error) {
		console.error('[API Client] fetchCities failed:', error);
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(UI_TEXT.networkError);
		}
		throw error instanceof Error ? error : new Error(UI_TEXT.dtekUnavailable);
	}
}

/**
 * Fetch streets for a specific city
 * @param city - City name (will be URL encoded)
 * @returns Array of street names
 * @throws Error if fetch fails or response is invalid
 */
export async function fetchStreets(city: string): Promise<string[]> {
	if (!city || city.trim().length === 0) {
		throw new Error(UI_TEXT.cityRequired);
	}

	try {
		const url = `/api/streets?city=${encodeURIComponent(city)}`;
		const response = await fetch(url);

		if (!response.ok) {
			if (response.status === 400) {
				throw new Error(UI_TEXT.invalidParams);
			}
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: StreetsResponse = await response.json();

		if (!Array.isArray(data.streets)) {
			throw new Error(UI_TEXT.invalidApiResponse);
		}

		return data.streets;
	} catch (error) {
		console.error('[API Client] fetchStreets failed:', error);
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(UI_TEXT.networkError);
		}
		throw error instanceof Error ? error : new Error(UI_TEXT.dtekUnavailable);
	}
}

/**
 * Fetch building statuses for a specific city and street
 * @param city - City name (will be URL encoded)
 * @param street - Street name (will be URL encoded)
 * @returns StatusResponse containing all buildings with their status
 * @throws Error if fetch fails or response is invalid
 */
export async function fetchBuildingStatuses(city: string, street: string): Promise<StatusResponse> {
	if (!city || city.trim().length === 0) {
		throw new Error(UI_TEXT.cityRequired);
	}

	if (!street || street.trim().length === 0) {
		throw new Error(UI_TEXT.streetRequired);
	}

	try {
		const url = `/api/status?city=${encodeURIComponent(city)}&street=${encodeURIComponent(street)}`;
		const response = await fetch(url);

		if (!response.ok) {
			if (response.status === 400) {
				throw new Error(UI_TEXT.invalidParams);
			}
			if (response.status === 503) {
				throw new Error(UI_TEXT.dtekUnavailable);
			}
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: StatusResponse = await response.json();

		// Validate response structure
		if (!data.city || !data.street || typeof data.buildings !== 'object') {
			throw new Error(UI_TEXT.invalidApiResponse);
		}

		return data;
	} catch (error) {
		console.error('[API Client] fetchBuildingStatuses failed:', error);
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(UI_TEXT.networkError);
		}
		throw error instanceof Error ? error : new Error(UI_TEXT.dtekUnavailable);
	}
}
