import type { DtekBuildingStatus, ScheduleRange } from './dtek.js';

/**
 * Emergency outage info with time range
 */
export interface EmergencyInfo {
	from: string; // "HH:MM DD.MM.YYYY"
	to: string; // "HH:MM DD.MM.YYYY"
}

/**
 * Building status for client consumption
 * (returned by /api/status endpoint)
 */
export interface BuildingStatus {
	emergency?: EmergencyInfo; // Only present if emergency active
	group?: string; // Schedule group ID, e.g., "GPV1.2"
}

/**
 * User's saved address stored in localStorage
 */
export interface SavedAddress {
	/** UUID */
	id: string;
	/** City name, e.g. "м. Одеса" */
	city: string;
	/** Street name, e.g. "вул. Педагогічна" */
	street: string;
	/** Building number, e.g. "25/39" */
	building: string;
	/** Optional user-friendly label ("Дім", "Робота") */
	label?: string;
	/** Unix timestamp when address was created */
	createdAt: number;
}

/**
 * Status for a saved address (used in UI)
 */
export interface AddressStatus {
	address: SavedAddress;
	status: DtekBuildingStatus | null;
	/** Unix timestamp when status was fetched */
	fetchedAt: number;
	/** Error message if fetch failed */
	error?: string;
}

/**
 * API response for GET /api/cities
 */
export interface CitiesResponse {
	cities: string[];
}

/**
 * API response for GET /api/streets
 */
export interface StreetsResponse {
	city: string;
	streets: string[];
}

/**
 * API response for GET /api/status (all buildings)
 */
export interface StatusResponse {
	city: string;
	street: string;
	buildings: Record<string, BuildingStatus>;
	schedules: Record<string, Record<string, ScheduleRange[]>>;
	fetchedAt: number;
}

/**
 * API response for GET /api/status with building param (single building)
 */
export interface SingleStatusResponse {
	city: string;
	street: string;
	building: string;
	status: DtekBuildingStatus | null;
	fetchedAt: number;
}

/**
 * API error response format
 */
export interface ApiErrorResponse {
	error: string;
	message: string;
}
