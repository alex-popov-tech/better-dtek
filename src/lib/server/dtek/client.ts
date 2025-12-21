/**
 * DTEK HTTP client module with cookie management
 *
 * Provides low-level HTTP operations for interacting with DTEK API:
 * - CookieJar for managing session cookies
 * - fetchTemplate() for initial page load
 * - fetchBuildingStatuses() for querying building status
 */

import type { DtekStatusResponse, Result, NetworkError, ParseError } from '$lib/types';
import { ok, err, networkError, parseError } from '$lib/types';
import { dtekStatusResponseSchema } from '$lib/schemas';
import { getRegionConfig, type RegionCode } from '$lib/constants/regions';

// URL generators
export function getBaseUrl(region: RegionCode): string {
	return getRegionConfig(region).url;
}

export function getTemplateUrl(region: RegionCode): string {
	return `${getBaseUrl(region)}/ua/shutdowns`;
}

export function getAjaxUrl(region: RegionCode): string {
	return `${getBaseUrl(region)}/ua/ajax`;
}

export const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

/**
 * Cookie jar for managing session cookies from DTEK
 */
export class CookieJar {
	private cookies: Map<string, string>;

	constructor() {
		this.cookies = new Map();
	}

	/**
	 * Parse and absorb Set-Cookie headers
	 * @param setCookieHeaders - Array of Set-Cookie header values
	 */
	absorb(setCookieHeaders: string[]): void {
		for (const header of setCookieHeaders) {
			// Extract name=value from "name=value; Path=/; ..."
			const pair = header.split(';', 1)[0];
			const eqIndex = pair.indexOf('=');
			if (eqIndex <= 0) continue;

			const name = pair.slice(0, eqIndex).trim();
			const value = pair.slice(eqIndex + 1).trim();
			this.cookies.set(name, value);
		}
	}

	/**
	 * Get all cookies in "name=value; name2=value2" format
	 */
	getHeader(): string {
		return Array.from(this.cookies.entries())
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	/**
	 * Get only essential cookies needed for DTEK requests
	 * Filters to: dtek-{region}, _csrf-dtek-{region}, _language, visid_incap_*, incap_ses_*, incap_wrt_*
	 * @param region - Region code for cookie name matching
	 */
	getFiltered(region: RegionCode): string {
		const keepPattern = new RegExp(
			`^(dtek-${region}|_csrf-dtek-${region}|_language|visid_incap_|incap_ses_|incap_wrt_)`
		);
		return Array.from(this.cookies.entries())
			.filter(([name]) => keepPattern.test(name))
			.map(([k, v]) => `${k}=${v}`)
			.join('; ');
	}

	/**
	 * Clear all cookies
	 */
	clear(): void {
		this.cookies.clear();
	}

	/**
	 * Get number of cookies stored
	 */
	get size(): number {
		return this.cookies.size;
	}
}

/**
 * Helper to extract Set-Cookie headers from Response
 * Node 20+ has headers.getSetCookie(), fallback for older versions
 */
function getSetCookieHeaders(headers: Headers): string[] {
	// Node 20+ has getSetCookie() method on Headers
	const headersWithGetSetCookie = headers as Headers & {
		getSetCookie?: () => string[];
	};
	if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
		return headersWithGetSetCookie.getSetCookie();
	}
	const sc = headers.get('set-cookie');
	return sc ? [sc] : [];
}

/**
 * Result type for fetchTemplate success
 */
export interface FetchTemplateSuccess {
	html: string;
	cookies: CookieJar;
}

/**
 * Fetch DTEK template page and extract cookies
 * @param region - Region code to determine which DTEK subdomain to use
 * @returns Result with HTML content and cookie jar, or NetworkError
 */
export async function fetchTemplate(
	region: RegionCode
): Promise<Result<FetchTemplateSuccess, NetworkError>> {
	const cookies = new CookieJar();
	const templateUrl = getTemplateUrl(region);

	try {
		const response = await fetch(templateUrl, {
			method: 'GET',
			headers: {
				'user-agent': USER_AGENT,
				accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'accept-language': 'en',
				'cache-control': 'no-cache',
				pragma: 'no-cache',
			},
			redirect: 'follow',
		});

		// Absorb cookies from response
		const setCookieHeaders = getSetCookieHeaders(response.headers);
		cookies.absorb(setCookieHeaders);

		if (!response.ok) {
			return err(
				networkError(templateUrl, `DTEK server returned HTTP ${response.status}`, {
					httpStatus: response.status,
				})
			);
		}

		const html = await response.text();

		return ok({ html, cookies });
	} catch (cause) {
		return err(
			networkError(templateUrl, 'Failed to connect to DTEK server', {
				cause,
			})
		);
	}
}

/**
 * Parameters for fetchBuildingStatuses
 */
export interface FetchBuildingStatusesParams {
	/** Region code (e.g., "oem", "kem") */
	region: RegionCode;
	/** City name (Ukrainian, e.g., "м. Одеса") */
	city: string;
	/** Street name (Ukrainian, e.g., "вул. Педагогічна") */
	street: string;
	/** Update fact timestamp from template (e.g., "11.12.2025 20:51") */
	updateFact: string;
	/** CSRF token from template */
	csrf: string;
	/** Cookie jar with session cookies */
	cookies: CookieJar;
}

/**
 * Fetch building statuses for a city + street
 * @param params - Request parameters
 * @returns Result with DTEK status response, or NetworkError/ParseError
 */
export async function fetchBuildingStatuses(
	params: FetchBuildingStatusesParams
): Promise<Result<DtekStatusResponse, NetworkError | ParseError>> {
	const { region, city, street, updateFact, csrf, cookies } = params;

	// Generate URLs for this region
	const ajaxUrl = getAjaxUrl(region);
	const baseUrl = getBaseUrl(region);
	const templateUrl = getTemplateUrl(region);

	// Build form body
	const body = new URLSearchParams();
	body.set('method', 'getHomeNum');
	body.set('data[0][name]', 'city');
	body.set('data[0][value]', city);
	body.set('data[1][name]', 'street');
	body.set('data[1][value]', street);
	body.set('data[2][name]', 'updateFact');
	body.set('data[2][value]', updateFact);

	// Get filtered cookies for this region
	const cookieHeader = cookies.getFiltered(region);

	try {
		const response = await fetch(ajaxUrl, {
			method: 'POST',
			headers: {
				'user-agent': USER_AGENT,
				accept: 'application/json, text/javascript, */*; q=0.01',
				'accept-language': 'en',
				'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'x-requested-with': 'XMLHttpRequest',
				'x-csrf-token': csrf,
				origin: baseUrl,
				referer: templateUrl,
				cookie: cookieHeader,
				'cache-control': 'no-cache',
				pragma: 'no-cache',
			},
			body: body.toString(),
			redirect: 'follow',
		});

		// Absorb any new cookies
		const setCookieHeaders = getSetCookieHeaders(response.headers);
		cookies.absorb(setCookieHeaders);

		if (!response.ok) {
			return err(
				networkError(ajaxUrl, `DTEK API returned HTTP ${response.status}`, {
					httpStatus: response.status,
				})
			);
		}

		const text = await response.text();

		// Parse JSON
		let rawJson: unknown;
		try {
			rawJson = JSON.parse(text);
		} catch (cause) {
			return err(
				parseError('json', 'Failed to parse DTEK API response as JSON', {
					expected: 'Valid JSON response',
					found: text.length > 200 ? `${text.slice(0, 200)}...` : text,
					cause,
				})
			);
		}

		// Validate response structure with Zod
		const validationResult = dtekStatusResponseSchema.safeParse(rawJson);
		if (!validationResult.success) {
			const errorDetails = validationResult.error.flatten();
			console.error('[DTEK Client] Response validation failed:', errorDetails);
			return err(
				parseError('json', 'DTEK API returned invalid data structure', {
					expected: 'Valid DtekStatusResponse structure',
					found: JSON.stringify(errorDetails.fieldErrors),
				})
			);
		}

		return ok(validationResult.data as DtekStatusResponse);
	} catch (cause) {
		return err(
			networkError(ajaxUrl, 'Failed to fetch building statuses from DTEK', {
				cause,
			})
		);
	}
}
