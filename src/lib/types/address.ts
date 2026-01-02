import type { ScheduleRange } from './dtek.js';
import type { RegionCode } from '$lib/constants/regions.js';

/**
 * Type of active outage from DTEK API
 * - emergency: "Аварійні ремонтні роботи" (infrastructure failure)
 * - stabilization: "Стабілізаційне відключення" (grid balancing, scheduled)
 * - planned: "Планові ремонтні роботи" or unknown types
 */
export type OutageType = 'emergency' | 'stabilization' | 'planned';

/**
 * Active outage info with type and time range
 */
export interface ActiveOutage {
	type: OutageType;
	from: string; // "HH:MM DD.MM.YYYY"
	to: string; // "HH:MM DD.MM.YYYY"
}

/**
 * Building status for client consumption
 * (returned by /api/status endpoint)
 */
export interface BuildingStatus {
	/** Active outage info (if any outage is active) */
	outage?: ActiveOutage;
	/** Schedule group ID, e.g., "GPV1.2" */
	group?: string;
}

/**
 * User's saved address stored in localStorage
 */
export interface SavedAddress {
	/** UUID */
	id: string;
	/** Region code, e.g. "kem", "oem" */
	region: RegionCode;
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
 * API error response format
 */
export interface ApiErrorResponse {
	error: string;
	message: string;
}
