/**
 * DTEK region configuration
 *
 * Maps region codes to their display names and API base URLs.
 * Each region has its own DTEK subdomain.
 */

export const REGIONS = {
	kem: {
		code: 'kem',
		name: 'Київ',
		url: 'https://www.dtek-kem.com.ua',
	},
	krem: {
		code: 'krem',
		name: 'Київська область',
		url: 'https://www.dtek-krem.com.ua',
	},
	oem: {
		code: 'oem',
		name: 'Одеська область',
		url: 'https://www.dtek-oem.com.ua',
	},
	dnem: {
		code: 'dnem',
		name: 'Дніпропетровська область',
		url: 'https://www.dtek-dnem.com.ua',
	},
	dem: {
		code: 'dem',
		name: 'Донецька область',
		url: 'https://www.dtek-dem.com.ua',
	},
} as const;

export type RegionCode = keyof typeof REGIONS;
export type RegionConfig = (typeof REGIONS)[RegionCode];

/** Default region for new addresses */
export const DEFAULT_REGION: RegionCode = 'kem';

/** Array of all region codes for iteration/validation */
export const REGION_CODES = Object.keys(REGIONS) as RegionCode[];

/**
 * Get region configuration by code
 */
export function getRegionConfig(code: RegionCode): RegionConfig {
	return REGIONS[code];
}

/**
 * Get base URL for a region
 */
export function getRegionUrl(code: RegionCode): string {
	return REGIONS[code].url;
}
