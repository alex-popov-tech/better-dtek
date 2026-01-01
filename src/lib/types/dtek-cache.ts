/**
 * DTEK Redis Cache Schema
 *
 * This module defines the shared types for caching DTEK data in Redis.
 * Used by both the refresh script (scripts/refresh-dtek-data.ts) and
 * the SvelteKit application for reading cached data.
 *
 * Redis Keys:
 *   dtek:data:{region}  - Per-region cached data (TTL: 24h, refreshed every 20min)
 *   dtek:meta           - Last refresh metadata
 *
 * Regions: kem | oem | dnem | dem
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const DTEK_REGIONS = ['kem', 'oem', 'dnem', 'dem'] as const;
export type DtekRegion = (typeof DTEK_REGIONS)[number];

/** Cache TTL in seconds (24 hours - fallback for extraction failures, normal refresh is every 20 min) */
export const DTEK_CACHE_TTL = 86400;

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

/**
 * Default city names for single-city array format (only KEM uses this).
 * Multi-city regions (OEM, DNEM, DEM) return streets as object with city keys,
 * so these fallbacks are not used for them.
 */
export const DTEK_REGION_CITY_NAMES: Record<DtekRegion, string> = {
	kem: 'м. Київ',
	oem: 'м. Одеса', // fallback not used - OEM uses multi-city format
	dnem: 'м. Дніпро', // fallback not used - DNEM uses multi-city format
	dem: 'Донецька область', // fallback not used - DEM uses multi-city format (serves unoccupied territories)
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
