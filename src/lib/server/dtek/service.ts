/**
 * DtekService facade - high-level API for DTEK integration
 *
 * Combines parser, client, and cache modules into a unified service.
 * Manages session state (cookies, CSRF, template data) with automatic refresh.
 *
 * Features:
 * - Automatic session refresh (1 hour TTL) with concurrent refresh lock
 * - Cached status responses (10 minute TTL)
 * - Result-based error handling with rich context
 *
 * Note: Retry logic is handled at API route level using withRetry() utility.
 */

import type {
	DtekTemplateData,
	DtekStatusResponse,
	Result,
	DtekError,
	ProcessedSchedules,
} from '$lib/types';
import { ok, err, sessionError, formatErrorForLog } from '$lib/types';
import { fetchTemplate, fetchBuildingStatuses, CookieJar } from './client';
import { parseTemplate } from './parser';
import { TtlCache } from './cache';
import { naturalSort, naturalSortKeys } from '$lib/utils/natural-sort';
import type { RegionCode } from '$lib/constants/regions';

/**
 * Internal session state
 */
interface SessionState {
	cookies: CookieJar;
	csrf: string;
	updateFact: string;
	templateData: DtekTemplateData;
}

/**
 * DtekService - main service class for DTEK operations
 * Each instance is region-specific with isolated session and cache
 */
export class DtekService {
	private readonly regionCode: RegionCode;
	private session: SessionState | null = null;
	private sessionExpiresAt: number = 0;
	private readonly SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
	private readonly statusCache: TtlCache<DtekStatusResponse>;
	private readonly STATUS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
	/** Promise for in-progress session refresh (prevents concurrent refresh stampede) */
	private sessionRefreshPromise: Promise<Result<void, DtekError>> | null = null;

	constructor(region: RegionCode) {
		this.regionCode = region;
		this.statusCache = new TtlCache<DtekStatusResponse>(this.STATUS_CACHE_TTL_MS);
		console.log(`[DtekService] Created service instance for region: ${region}`);
	}

	/**
	 * Clear session state
	 */
	private clearSession(): void {
		this.session = null;
		this.sessionExpiresAt = 0;
	}

	/**
	 * Ensure valid session exists (with cookies, CSRF, template data)
	 * Uses lock to prevent concurrent refresh stampede when multiple
	 * requests arrive while session is expired.
	 */
	private async ensureSession(): Promise<Result<void, DtekError>> {
		// Fast path: session is valid
		if (this.session && Date.now() < this.sessionExpiresAt) {
			return ok(undefined);
		}

		// Check if refresh is already in progress - wait for it
		if (this.sessionRefreshPromise) {
			console.log(`[DtekService:${this.regionCode}] Waiting for existing session refresh...`);
			return this.sessionRefreshPromise;
		}

		// Start refresh and store the promise for others to await
		console.log(`[DtekService:${this.regionCode}] Starting session refresh...`);
		this.sessionRefreshPromise = this.refreshSessionInternal();

		try {
			return await this.sessionRefreshPromise;
		} finally {
			// Clear the lock after completion (success or failure)
			this.sessionRefreshPromise = null;
		}
	}

	/**
	 * Internal session refresh logic
	 * Only called once per refresh cycle (others await the promise)
	 */
	private async refreshSessionInternal(): Promise<Result<void, DtekError>> {
		// Fetch template page for this region
		const fetchResult = await fetchTemplate(this.regionCode);
		if (!fetchResult.ok) {
			this.clearSession();
			console.error(
				`[DtekService:${this.regionCode}] Failed to fetch template:`,
				formatErrorForLog(fetchResult.error)
			);
			return fetchResult;
		}

		const { html, cookies } = fetchResult.value;

		// Parse template data
		const parseResult = parseTemplate(html);
		if (!parseResult.ok) {
			this.clearSession();
			console.error(
				`[DtekService:${this.regionCode}] Failed to parse template:`,
				formatErrorForLog(parseResult.error)
			);
			return parseResult;
		}

		const templateData = parseResult.value;
		const now = Date.now();

		// Store new session
		this.session = {
			cookies,
			csrf: templateData.csrf,
			updateFact: templateData.updateFact,
			templateData,
		};
		this.sessionExpiresAt = now + this.SESSION_TTL_MS;

		console.log(
			`[DtekService:${this.regionCode}] Session refreshed successfully. Expires at: ${new Date(this.sessionExpiresAt).toISOString()}`
		);
		console.log(
			`[DtekService:${this.regionCode}] Template data: ${templateData.cities.length} cities, updateFact: ${templateData.updateFact}`
		);

		return ok(undefined);
	}

	/**
	 * Get list of all cities
	 * @returns Result with array of city names (Ukrainian), naturally sorted
	 */
	async getCities(): Promise<Result<string[], DtekError>> {
		const sessionResult = await this.ensureSession();
		if (!sessionResult.ok) {
			return sessionResult;
		}

		if (!this.session) {
			return err(sessionError('missing', 'Session is not available after refresh'));
		}

		return ok(naturalSort(this.session.templateData.cities));
	}

	/**
	 * Get list of streets for a specific city
	 * @param city - City name (Ukrainian, e.g., "м. Одеса")
	 * @returns Result with array of street names for the city (naturally sorted)
	 */
	async getStreets(city: string): Promise<Result<string[], DtekError>> {
		const sessionResult = await this.ensureSession();
		if (!sessionResult.ok) {
			return sessionResult;
		}

		if (!this.session) {
			return err(sessionError('missing', 'Session is not available after refresh'));
		}

		const streets = this.session.templateData.streetsByCity[city] || [];
		return ok(naturalSort(streets));
	}

	/**
	 * Get building status for a city + street
	 * Uses cache when available (10 minute TTL)
	 *
	 * Note: No retry logic here - retry is handled at API route level
	 * using withRetry() utility for consistent retry behavior.
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

		// Ensure session is valid
		const sessionResult = await this.ensureSession();
		if (!sessionResult.ok) {
			return sessionResult;
		}

		if (!this.session) {
			return err(sessionError('missing', 'Session is not available after refresh'));
		}

		// Fetch building statuses
		const fetchResult = await fetchBuildingStatuses({
			region: this.regionCode,
			city,
			street,
			updateFact: this.session.updateFact,
			csrf: this.session.csrf,
			cookies: this.session.cookies,
		});

		if (!fetchResult.ok) {
			// Clear session on auth errors so next retry attempt gets fresh session
			const isAuthError =
				fetchResult.error.code === 'NETWORK_ERROR' &&
				(fetchResult.error.httpStatus === 401 || fetchResult.error.httpStatus === 403);

			if (isAuthError) {
				console.warn(`[DtekService:${this.regionCode}] Auth error, clearing session`);
				this.clearSession();
			}

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
		const sessionResult = await this.ensureSession();
		if (!sessionResult.ok) return sessionResult;

		if (!this.session?.templateData.schedules) {
			return ok({});
		}

		const filtered: ProcessedSchedules = {};
		for (const id of groupIds) {
			if (this.session.templateData.schedules[id]) {
				filtered[id] = this.session.templateData.schedules[id];
			}
		}

		return ok(filtered);
	}

	/**
	 * Force refresh session (for debugging/admin purposes)
	 * Clears current session and forces a new fetch on next request
	 */
	async refreshSession(): Promise<Result<void, DtekError>> {
		console.log(`[DtekService:${this.regionCode}] Manual session refresh requested`);
		this.clearSession();
		return this.ensureSession();
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
		sessionValid: boolean;
		sessionExpiresIn: number | null;
		cacheStats: { size: number; keys: string[] };
	} {
		const now = Date.now();
		const sessionValid = this.session !== null && now < this.sessionExpiresAt;
		const sessionExpiresIn = sessionValid ? this.sessionExpiresAt - now : null;

		return {
			region: this.regionCode,
			sessionValid,
			sessionExpiresIn,
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
