/**
 * DtekService facade - high-level API for DTEK integration
 *
 * Reads pre-cached data from Vercel KV (populated by GitHub Action every 10min).
 * Only getStatus() still makes real-time HTTP calls to DTEK for building status.
 *
 * Features:
 * - getCities/getStreets/getSchedules: Read-only from KV cache
 * - getStatus: HTTP to DTEK using CSRF/cookies from KV, with 10min local cache
 * - Result-based error handling with rich context
 */

import type {
	DtekStatusResponse,
	Result,
	DtekError,
	ProcessedSchedules,
	DtekRawPreset,
	ScheduleStatus,
	ScheduleRange,
} from '$lib/types';
import { ok, formatErrorForLog } from '$lib/types';
import { fetchBuildingStatuses, CookieJar } from './client';
import { TtlCache } from './cache';
import { naturalSort, naturalSortKeys } from '$lib/utils/natural-sort';
import type { RegionCode } from '$lib/constants/regions';
import { getDtekRegionData } from '$lib/server/kv/client';
import type { DtekCachedRegion } from '$lib/types/dtek-cache';

// ============================================================================
// Schedule Processing Utilities
// ============================================================================

type NormalizedStatus = 'yes' | 'maybe' | 'no';

function normalizeStatus(status: ScheduleStatus): NormalizedStatus {
	if (status === 'yes') return 'yes';
	if (status === 'maybe' || status === 'mfirst' || status === 'msecond') return 'maybe';
	return 'no';
}

function addRange(
	ranges: ScheduleRange[],
	from: number,
	to: number,
	status: NormalizedStatus
): void {
	const last = ranges[ranges.length - 1];
	if (last && last.to === from && last.status === status) {
		last.to = to;
	} else {
		ranges.push({ from, to, status });
	}
}

/**
 * Compress hourly schedule to ranges with normalized statuses
 * Hour key mapping: "1" → 00:00-01:00, "10" → 09:00-10:00
 */
function compressDaySchedule(dayData: Record<string, ScheduleStatus>): ScheduleRange[] {
	const ranges: ScheduleRange[] = [];

	for (let hourKey = 1; hourKey <= 24; hourKey++) {
		const rawStatus = dayData[String(hourKey)];
		if (!rawStatus) continue;

		const hourStart = hourKey - 1;

		if (rawStatus === 'mfirst') {
			addRange(ranges, hourStart, hourStart + 0.5, 'maybe');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'yes');
		} else if (rawStatus === 'msecond') {
			addRange(ranges, hourStart, hourStart + 0.5, 'yes');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'maybe');
		} else if (rawStatus === 'first') {
			addRange(ranges, hourStart, hourStart + 0.5, 'no');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'yes');
		} else if (rawStatus === 'second') {
			addRange(ranges, hourStart, hourStart + 0.5, 'yes');
			addRange(ranges, hourStart + 0.5, hourStart + 1, 'no');
		} else {
			addRange(ranges, hourStart, hourStart + 1, normalizeStatus(rawStatus));
		}
	}

	return ranges;
}

/**
 * Process raw preset schedules into compressed format
 */
function processPresetSchedules(rawPreset: DtekRawPreset): ProcessedSchedules {
	const result: ProcessedSchedules = {};

	for (const [groupId, weekData] of Object.entries(rawPreset.data)) {
		result[groupId] = {};
		for (const [dayNum, dayData] of Object.entries(weekData)) {
			result[groupId][dayNum] = compressDaySchedule(dayData);
		}
	}

	return result;
}

// ============================================================================
// DtekService
// ============================================================================

/**
 * DtekService - main service class for DTEK operations
 * Each instance is region-specific with isolated cache
 */
export class DtekService {
	private readonly regionCode: RegionCode;
	private readonly statusCache: TtlCache<DtekStatusResponse>;
	private readonly STATUS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

	// Cache processed schedules in memory (no need to re-process on every call)
	private schedulesCache: ProcessedSchedules | null = null;
	private schedulesCacheExtractedAt: string | null = null;

	constructor(region: RegionCode) {
		this.regionCode = region;
		this.statusCache = new TtlCache<DtekStatusResponse>(this.STATUS_CACHE_TTL_MS);
		console.log(`[DtekService] Created service instance for region: ${region}`);
	}

	/**
	 * Get region data from KV cache
	 */
	private async getRegionData(): Promise<Result<DtekCachedRegion, DtekError>> {
		const result = await getDtekRegionData(this.regionCode);
		if (!result.ok) {
			console.error(
				`[DtekService:${this.regionCode}] KV read failed:`,
				formatErrorForLog(result.error)
			);
		}
		return result;
	}

	/**
	 * Get list of all cities
	 * @returns Result with array of city names (Ukrainian), naturally sorted
	 */
	async getCities(): Promise<Result<string[], DtekError>> {
		const regionResult = await this.getRegionData();
		if (!regionResult.ok) return regionResult;

		return ok(naturalSort(regionResult.value.cities));
	}

	/**
	 * Get list of streets for a specific city
	 * @param city - City name (Ukrainian, e.g., "м. Одеса")
	 * @returns Result with array of street names for the city (naturally sorted)
	 */
	async getStreets(city: string): Promise<Result<string[], DtekError>> {
		const regionResult = await this.getRegionData();
		if (!regionResult.ok) return regionResult;

		const streets = regionResult.value.streetsByCity[city] || [];
		return ok(naturalSort(streets));
	}

	/**
	 * Get building status for a city + street
	 * Uses local cache when available (10 minute TTL)
	 * Uses CSRF/cookies from KV for authentication
	 *
	 * @param city - City name (Ukrainian, e.g., "м. Одеса")
	 * @param street - Street name (Ukrainian, e.g., "вул. Педагогічна")
	 * @returns Result with DTEK status response with building data
	 */
	async getStatus(city: string, street: string): Promise<Result<DtekStatusResponse, DtekError>> {
		const cacheKey = `${city}:${street}`;

		// Check cache first
		const cached = this.statusCache.get(cacheKey);
		if (cached) {
			console.log(`[DtekService:${this.regionCode}] Cache hit for ${cacheKey}`);
			return ok(cached);
		}

		console.log(
			`[DtekService:${this.regionCode}] Cache miss for ${cacheKey}, fetching from DTEK...`
		);

		// Get credentials from KV
		const regionResult = await this.getRegionData();
		if (!regionResult.ok) return regionResult;

		const regionData = regionResult.value;

		// Build CookieJar from stored cookie string
		const cookies = CookieJar.fromString(regionData.cookies);

		// Fetch building statuses using stored credentials
		const fetchResult = await fetchBuildingStatuses({
			region: this.regionCode,
			city,
			street,
			updateFact: regionData.updateFact,
			csrf: regionData.csrf,
			cookies,
		});

		if (!fetchResult.ok) {
			console.error(
				`[DtekService:${this.regionCode}] Failed to fetch status for ${city} / ${street}:`,
				formatErrorForLog(fetchResult.error)
			);
			return fetchResult;
		}

		// Sort building keys naturally and cache the result
		const sortedResponse: DtekStatusResponse = {
			...fetchResult.value,
			data: naturalSortKeys(fetchResult.value.data),
		};
		this.statusCache.set(cacheKey, sortedResponse);

		console.log(
			`[DtekService:${this.regionCode}] Successfully fetched status for ${city} / ${street}. Buildings: ${Object.keys(sortedResponse.data).length}`
		);

		return ok(sortedResponse);
	}

	/**
	 * Get schedules for specific groups
	 * @param groupIds - Array of group IDs to retrieve schedules for
	 * @returns Result with filtered schedules for the specified groups
	 */
	async getSchedules(groupIds: string[]): Promise<Result<ProcessedSchedules, DtekError>> {
		const regionResult = await this.getRegionData();
		if (!regionResult.ok) return regionResult;

		const regionData = regionResult.value;

		// Check if we need to re-process schedules (new data from KV)
		if (!this.schedulesCache || this.schedulesCacheExtractedAt !== regionData.extractedAt) {
			// Process raw preset data from KV
			if (regionData.presetData) {
				this.schedulesCache = processPresetSchedules(regionData.presetData as DtekRawPreset);
			} else {
				this.schedulesCache = {};
			}
			this.schedulesCacheExtractedAt = regionData.extractedAt;
		}

		// Filter to requested groups
		const filtered: ProcessedSchedules = {};
		for (const id of groupIds) {
			if (this.schedulesCache[id]) {
				filtered[id] = this.schedulesCache[id];
			}
		}

		return ok(filtered);
	}

	/**
	 * Get the region code for this service instance
	 */
	getRegion(): RegionCode {
		return this.regionCode;
	}

	/**
	 * Get service statistics (for debugging)
	 */
	getStats(): {
		region: RegionCode;
		cacheStats: { size: number; keys: string[] };
	} {
		return {
			region: this.regionCode,
			cacheStats: this.statusCache.getStats(),
		};
	}
}

/**
 * Create a new DtekService instance for a specific region
 * Useful for testing with isolated session state
 */
export function createDtekService(region: RegionCode): DtekService {
	return new DtekService(region);
}

/**
 * Service registry for per-region instances
 * Lazily creates service instances on first access
 */
const serviceRegistry = new Map<RegionCode, DtekService>();

/**
 * Get a DtekService instance for a specific region
 * Creates a new instance if one doesn't exist for that region
 *
 * @param region - Region code (e.g., 'kem', 'oem', 'dnem', 'dem')
 * @returns DtekService instance for the specified region
 */
export function getDtekService(region: RegionCode): DtekService {
	let service = serviceRegistry.get(region);
	if (!service) {
		service = createDtekService(region);
		serviceRegistry.set(region, service);
	}
	return service;
}
