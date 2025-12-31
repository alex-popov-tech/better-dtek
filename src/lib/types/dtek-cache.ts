/**
 * DTEK Redis Cache Schema
 *
 * This module defines the shared types for caching DTEK data in Redis.
 * Used by both the refresh script (scripts/refresh-dtek-data.ts) and
 * the SvelteKit application for reading cached data.
 *
 * Redis Keys:
 *   dtek:data:{region}  - Per-region cached data (TTL: 15min)
 *   dtek:meta           - Last refresh metadata (TTL: 15min)
 *
 * Regions: kem | oem | dnem | dem
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const DTEK_REGIONS = ['kem', 'oem', 'dnem', 'dem'] as const;
export type DtekRegion = (typeof DTEK_REGIONS)[number];

/** Cache TTL in seconds (25 minutes) */
export const DTEK_CACHE_TTL = 1500;

/** Redis key for refresh metadata */
export const DTEK_META_KEY = 'dtek:meta';

// -----------------------------------------------------------------------------
// Key Helpers
// -----------------------------------------------------------------------------

/** Get Redis key for a region's cached data */
export function dtekDataKey(region: DtekRegion): string {
	return `dtek:data:${region}`;
}

// -----------------------------------------------------------------------------
// Region URLs
// -----------------------------------------------------------------------------

export const DTEK_REGION_URLS: Record<DtekRegion, string> = {
	kem: 'https://www.dtek-kem.com.ua',
	oem: 'https://www.dtek-oem.com.ua',
	dnem: 'https://www.dtek-dnem.com.ua',
	dem: 'https://www.dtek-dem.com.ua',
};

/** Default city names for single-city regions (like KEM) */
export const DTEK_REGION_CITY_NAMES: Record<DtekRegion, string> = {
	kem: 'м. Київ',
	oem: 'м. Одеса',
	dnem: 'м. Дніпро',
	dem: 'м. Донецьк',
};

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

/**
 * Cached data for a single DTEK region.
 * Stored in Redis at key: dtek:data:{region}
 */
export interface DtekCachedRegion {
	/** Region identifier */
	region: DtekRegion;

	/** Base URL for this region (e.g., https://www.dtek-kem.com.ua) */
	baseUrl: string;

	/** CSRF token for authenticated requests */
	csrf: string;

	/** Session cookies as semicolon-separated string (e.g., "name=val; name2=val2") */
	cookies: string;

	/** Last data update timestamp from DTEK (e.g., "31.12.2025 14:24") */
	updateFact: string;

	/** List of cities in this region */
	cities: string[];

	/** Streets indexed by city name */
	streetsByCity: Record<string, string[]>;

	/** Raw DisconSchedule.preset data (schedule groups) */
	presetData: unknown;

	/** ISO timestamp when this data was extracted */
	extractedAt: string;
}

/**
 * Metadata about the last refresh operation.
 * Stored in Redis at key: dtek:meta
 */
export interface DtekCacheMeta {
	/** ISO timestamp of last refresh */
	lastRefresh: string;

	/** Regions that were successfully updated */
	regionsUpdated: DtekRegion[];

	/** Error messages for regions that failed */
	errors: Partial<Record<DtekRegion, string>>;
}

// -----------------------------------------------------------------------------
// Type Guards
// -----------------------------------------------------------------------------

export function isDtekRegion(value: string): value is DtekRegion {
	return DTEK_REGIONS.includes(value as DtekRegion);
}
