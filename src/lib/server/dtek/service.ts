/**
 * DtekService facade - high-level API for DTEK integration
 *
 * Combines parser, client, and cache modules into a unified service.
 * Manages session state (cookies, CSRF, template data) with automatic refresh.
 *
 * Features:
 * - Automatic session refresh (1 hour TTL)
 * - Cached status responses (10 minute TTL)
 * - Retry on 401/403 errors
 * - Result-based error handling with rich context
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
import { statusCache } from './cache';
import { naturalSort, naturalSortKeys } from '$lib/utils/natural-sort';

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
 */
export class DtekService {
	private session: SessionState | null = null;
	private sessionExpiresAt: number = 0;
	private readonly SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

	/**
	 * Clear session state
	 */
	private clearSession(): void {
		this.session = null;
		this.sessionExpiresAt = 0;
	}

	/**
	 * Ensure valid session exists (with cookies, CSRF, template data)
	 * Automatically refreshes if expired or missing
	 */
	private async ensureSession(): Promise<Result<void, DtekError>> {
		const now = Date.now();

		// Check if session is still valid
		if (this.session && now < this.sessionExpiresAt) {
			return ok(undefined);
		}

		// Session expired or missing - refresh
		console.log('[DtekService] Session expired or missing, refreshing...');

		// Fetch template page
		const fetchResult = await fetchTemplate();
		if (!fetchResult.ok) {
			this.clearSession();
			console.error(
				'[DtekService] Failed to fetch template:',
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
				'[DtekService] Failed to parse template:',
				formatErrorForLog(parseResult.error)
			);
			return parseResult;
		}

		const templateData = parseResult.value;

		// Store new session
		this.session = {
			cookies,
			csrf: templateData.csrf,
			updateFact: templateData.updateFact,
			templateData,
		};
		this.sessionExpiresAt = now + this.SESSION_TTL_MS;

		console.log(
			`[DtekService] Session refreshed successfully. Expires at: ${new Date(this.sessionExpiresAt).toISOString()}`
		);
		console.log(
			`[DtekService] Template data: ${templateData.cities.length} cities, updateFact: ${templateData.updateFact}`
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
	 * @param city - City name (Ukrainian, e.g., "м. Одеса")
	 * @param street - Street name (Ukrainian, e.g., "вул. Педагогічна")
	 * @returns Result with DTEK status response with building data
	 */
	async getStatus(city: string, street: string): Promise<Result<DtekStatusResponse, DtekError>> {
		const cacheKey = `status:${city}:${street}`;

		// Check cache first
		const cached = statusCache.get(cacheKey);
		if (cached) {
			console.log(`[DtekService] Cache hit for ${cacheKey}`);
			return ok(cached);
		}

		console.log(`[DtekService] Cache miss for ${cacheKey}, fetching from DTEK...`);

		// Cache miss - fetch from DTEK
		let retryCount = 0;
		const maxRetries = 1;

		while (retryCount <= maxRetries) {
			const sessionResult = await this.ensureSession();
			if (!sessionResult.ok) {
				return sessionResult;
			}

			if (!this.session) {
				return err(sessionError('missing', 'Session is not available after refresh'));
			}

			// Fetch building statuses
			const fetchResult = await fetchBuildingStatuses({
				city,
				street,
				updateFact: this.session.updateFact,
				csrf: this.session.csrf,
				cookies: this.session.cookies,
			});

			if (!fetchResult.ok) {
				// Check if it's an auth error (401/403)
				const isAuthError =
					fetchResult.error.code === 'NETWORK_ERROR' &&
					(fetchResult.error.httpStatus === 401 || fetchResult.error.httpStatus === 403);

				if (isAuthError && retryCount < maxRetries) {
					console.warn(
						`[DtekService] Auth error detected, clearing session and retrying... (attempt ${retryCount + 1}/${maxRetries})`
					);

					// Clear session and retry
					this.clearSession();
					retryCount++;
					continue;
				}

				// Non-auth error or max retries reached
				console.error(
					`[DtekService] Failed to fetch status for ${city} / ${street}:`,
					formatErrorForLog(fetchResult.error)
				);

				return fetchResult;
			}

			// Sort building keys naturally and cache the result
			const sortedResponse: DtekStatusResponse = {
				...fetchResult.value,
				data: naturalSortKeys(fetchResult.value.data),
			};
			statusCache.set(cacheKey, sortedResponse);

			console.log(
				`[DtekService] Successfully fetched status for ${city} / ${street}. Buildings: ${Object.keys(sortedResponse.data).length}`
			);

			return ok(sortedResponse);
		}

		// Should never reach here, but TypeScript needs it
		return err(sessionError('refresh_failed', 'Failed to fetch status after session retry'));
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
		console.log('[DtekService] Manual session refresh requested');
		this.clearSession();
		return this.ensureSession();
	}

	/**
	 * Get service statistics (for debugging)
	 */
	getStats(): {
		sessionValid: boolean;
		sessionExpiresIn: number | null;
		cacheStats: { size: number; keys: string[] };
	} {
		const now = Date.now();
		const sessionValid = this.session !== null && now < this.sessionExpiresAt;
		const sessionExpiresIn = sessionValid ? this.sessionExpiresAt - now : null;

		return {
			sessionValid,
			sessionExpiresIn,
			cacheStats: statusCache.getStats(),
		};
	}
}

/**
 * Create a new DtekService instance
 * Useful for testing with isolated session state
 */
export function createDtekService(): DtekService {
	return new DtekService();
}

/**
 * Singleton instance of DtekService
 * Use this in your application code
 */
export const dtekService = createDtekService();
