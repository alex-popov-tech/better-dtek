#!/usr/bin/env npx tsx

/**
 * DTEK Data Refresh Script
 *
 * Extracts DTEK data from all 4 regions using Playwright and stores in Redis.
 *
 * Usage:
 *   npx tsx scripts/refresh-dtek-data.ts                # Uses .env file
 *   npx tsx scripts/refresh-dtek-data.ts --headed       # Visible browser
 *   npx tsx scripts/refresh-dtek-data.ts --region=kem   # Single region
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { z } from 'zod';
import { chromium, type BrowserContext } from 'playwright';
import Redis from 'ioredis';

// Artifacts directory for screenshots, videos, and data
const ARTIFACTS_DIR = 'artifacts';
const SCREENSHOTS_DIR = `${ARTIFACTS_DIR}/screenshots`;
const VIDEOS_DIR = `${ARTIFACTS_DIR}/videos`;
const DATA_FILE = `${ARTIFACTS_DIR}/extracted-data.json`;
import {
	DTEK_REGIONS,
	DTEK_CACHE_TTL,
	DTEK_REGION_URLS,
	DTEK_REGION_CITY_NAMES,
	dtekDataKey,
	isDtekRegion,
	type DtekRegion,
	type DtekCachedRegion,
	type ScheduleData,
	type HourlySchedule,
} from '../src/lib/types/dtek-cache.js';
import type { ScheduleStatus, ScheduleRange } from '../src/lib/types/dtek.js';

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const DisconScheduleSchema = z.object({
	streets: z
		.union([z.record(z.string(), z.array(z.string())), z.array(z.string())])
		.refine((v) => (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0), {
			message: 'streets must not be empty',
		}),
	fact: z.object({
		update: z.string().min(1),
		// data can be empty array [] or object { timestamp: { groupId: { hour: status } } }
		data: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
		// today is the timestamp key to use for current day in data
		today: z.number().optional(),
	}),
	preset: z.unknown(),
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const RETRY_DELAYS = [5_000, 10_000, 30_000, 60_000]; // 5s, 10s, 30s, 60s (then stays at 60s)
const PAGE_TIMEOUT = 10_000; // 10s timeout for page navigation and route.fetch

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
	let lastError: unknown;
	for (let i = 1; i <= attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (i === attempts) {
				console.log(`  Attempt ${i}/${attempts} failed: ${error}`);
				throw error;
			}
			const delay = RETRY_DELAYS[Math.min(i - 1, RETRY_DELAYS.length - 1)];
			console.log(`  Attempt ${i}/${attempts} failed: ${error}`);
			console.log(`  Waiting ${delay / 1000}s before retry...`);
			await sleep(delay);
		}
	}
	throw lastError ?? new Error('unreachable');
}

/** Extract balanced JSON from text starting after marker */
function extractJson(text: string, marker: string, open: string, close: string): unknown {
	const start = text.indexOf(marker);
	if (start === -1) return null;
	const eq = text.indexOf('=', start);
	if (eq === -1) return null;

	// Find the open bracket - must be immediately after = (with optional whitespace)
	let jsonStart = -1;
	for (let i = eq + 1; i < text.length; i++) {
		const ch = text[i];
		if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') continue;
		if (ch === open) {
			jsonStart = i;
			break;
		}
		// Found a non-whitespace char that isn't the expected opener - wrong format
		return null;
	}
	if (jsonStart === -1) return null;

	let depth = 0;
	for (let i = jsonStart; i < text.length; i++) {
		if (text[i] === open) depth++;
		else if (text[i] === close && --depth === 0) {
			try {
				return JSON.parse(text.slice(jsonStart, i + 1));
			} catch {
				return null;
			}
		}
	}
	return null;
}

/** Parse DisconSchedule data from page HTML */
function parseDisconSchedule(html: string) {
	return {
		// Try object format first (multi-city), then array (single-city like KEM)
		streets:
			extractJson(html, 'DisconSchedule.streets', '{', '}') ??
			extractJson(html, 'DisconSchedule.streets', '[', ']'),
		fact: extractJson(html, 'DisconSchedule.fact', '{', '}'),
		preset: extractJson(html, 'DisconSchedule.preset', '{', '}'),
	};
}

/** Get current day of week in Kyiv timezone (1=Monday, 7=Sunday) */
function getKyivDayOfWeek(date: Date = new Date()): string {
	const kyivDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
	const jsDay = kyivDate.getDay(); // 0=Sunday, 1=Monday, ...
	// Convert to ISO: 1=Monday, 7=Sunday
	return String(jsDay === 0 ? 7 : jsDay);
}

/** Get tomorrow's day of week in Kyiv timezone */
function getKyivTomorrowDayOfWeek(): string {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	return getKyivDayOfWeek(tomorrow);
}

// -----------------------------------------------------------------------------
// Schedule Compression
// -----------------------------------------------------------------------------

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
function compressDaySchedule(dayData: HourlySchedule): ScheduleRange[] {
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
 * Resolve schedules from fact.data (real-time) and preset.data (static).
 * For today: use fact.data if available, else preset.data
 * For tomorrow: always use preset.data
 * Returns pre-compressed ranges ready for storage.
 */
function resolveSchedules(
	presetData: unknown,
	factData: unknown,
	factToday: number | undefined
): ScheduleData | null {
	// Parse preset.data structure: groupId → dayOfWeek → hour → status
	const preset = presetData as Record<
		string,
		Record<string, Record<string, ScheduleStatus>>
	> | null;
	if (!preset || typeof preset !== 'object') {
		return null;
	}

	const todayDow = getKyivDayOfWeek();
	const tomorrowDow = getKyivTomorrowDayOfWeek();

	// Parse fact.data structure: timestamp → groupId → hour → status
	// fact.data can be [] (empty) or { timestamp: { groupId: { hour: status } } }
	const fact = factData as
		| Record<string, Record<string, Record<string, ScheduleStatus>>>
		| unknown[]
		| null;
	const factTodayData =
		fact && !Array.isArray(fact) && factToday
			? (fact[String(factToday)] as Record<string, Record<string, ScheduleStatus>> | undefined)
			: undefined;

	// Collect all group IDs from both sources
	const groupIds = new Set<string>();
	for (const groupId of Object.keys(preset)) {
		groupIds.add(groupId);
	}
	if (factTodayData) {
		for (const groupId of Object.keys(factTodayData)) {
			groupIds.add(groupId);
		}
	}

	// Build schedule data for each group with compressed ranges
	const groups: ScheduleData['groups'] = {};

	for (const groupId of Array.from(groupIds)) {
		// Today: prefer fact, fallback to preset
		const todayHourly: HourlySchedule =
			factTodayData?.[groupId] ?? preset[groupId]?.[todayDow] ?? {};

		// Tomorrow: always from preset
		const tomorrowHourly: HourlySchedule = preset[groupId]?.[tomorrowDow] ?? {};

		// Compress hourly data to ranges
		groups[groupId] = {
			today: compressDaySchedule(todayHourly),
			tomorrow: compressDaySchedule(tomorrowHourly),
		};
	}

	return {
		todayDayOfWeek: todayDow,
		tomorrowDayOfWeek: tomorrowDow,
		groups,
	};
}

// -----------------------------------------------------------------------------
// Extraction
// -----------------------------------------------------------------------------

async function extractRegion(
	context: BrowserContext,
	region: DtekRegion
): Promise<DtekCachedRegion> {
	const baseUrl = DTEK_REGION_URLS[region];
	const url = `${baseUrl}/ua/shutdowns`;

	const page = await context.newPage();

	// Intercept response to capture raw HTML before JS modifies/removes script tags
	let rawHtml: string | null = null;
	let routeError: Error | null = null;

	await page.route('**/ua/shutdowns', async (route) => {
		try {
			const response = await route.fetch({ timeout: PAGE_TIMEOUT });
			rawHtml = await response.text();
			await route.fulfill({ response, body: rawHtml });
		} catch (error) {
			routeError = error instanceof Error ? error : new Error(String(error));
			await route.abort('failed');
		}
	});

	try {
		await page.goto(url, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT });

		// Re-throw route handler error so retry mechanism can catch it
		if (routeError) {
			throw routeError;
		}

		// Clean up route handler
		await page.unroute('**/ua/shutdowns');

		// Capture screenshot after page load
		await page.screenshot({
			path: `${SCREENSHOTS_DIR}/${region}-${Date.now()}.png`,
			fullPage: true,
		});

		// Wait for CSRF token
		const csrfLocator = page.locator('meta[name="csrf-token"]');
		await csrfLocator.waitFor({ state: 'attached', timeout: 5_000 });
		const csrf = await csrfLocator.getAttribute('content');
		if (!csrf) throw new Error('CSRF token is empty');

		// Parse DisconSchedule from RAW HTML (before JS modified/removed it)
		if (!rawHtml) throw new Error('Failed to capture raw HTML response');
		const raw = parseDisconSchedule(rawHtml);
		const validated = DisconScheduleSchema.parse(raw);

		// Normalize streets (can be array for single-city regions or object for multi-city)
		const streetsByCity: Record<string, string[]> = Array.isArray(validated.streets)
			? { [DTEK_REGION_CITY_NAMES[region]]: validated.streets }
			: (validated.streets as Record<string, string[]>);

		// Filter out invalid street entries (empty, whitespace-only, or placeholder like "*")
		for (const city of Object.keys(streetsByCity)) {
			streetsByCity[city] = streetsByCity[city].filter(
				(street) => street && street.trim() && street.trim() !== '*'
			);
		}

		// Extract cookies
		const cookies = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');

		// Resolve schedules from fact.data (real-time) and preset.data (static)
		const presetData = (validated.preset as { data?: unknown })?.data ?? null;
		const factData = validated.fact.data;
		const factToday = validated.fact.today;
		const scheduleData = resolveSchedules(presetData, factData, factToday);

		return {
			region,
			baseUrl,
			csrf,
			cookies,
			updateFact: validated.fact.update,
			cities: Object.keys(streetsByCity),
			streetsByCity,
			scheduleData,
			extractedAt: new Date().toISOString(),
		};
	} finally {
		await page.close();
	}
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
	// Parse CLI args
	const args = process.argv.slice(2);
	const headed = args.includes('--headed');
	const regionArg = args.find((a) => a.startsWith('--region='))?.split('=')[1];
	const regionsToProcess: DtekRegion[] =
		regionArg && isDtekRegion(regionArg) ? [regionArg] : [...DTEK_REGIONS];

	// Validate environment
	const redisUrl = z
		.string()
		.min(1, 'REDIS_URL is required')
		.refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'))
		.parse(process.env.REDIS_URL);

	console.log(`DTEK Data Refresh (${headed ? 'headed' : 'headless'})`);
	console.log(`Regions: ${regionsToProcess.join(', ')}\n`);

	// Create artifacts directories
	mkdirSync(SCREENSHOTS_DIR, { recursive: true });
	mkdirSync(VIDEOS_DIR, { recursive: true });

	const redis = new Redis(redisUrl);
	const browser = await chromium.launch({ headless: !headed });
	const context = await browser.newContext({
		userAgent:
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
		recordVideo: { dir: VIDEOS_DIR, size: { width: 1280, height: 720 } },
	});

	const extractedData: Record<string, DtekCachedRegion> = {};

	try {
		for (const region of regionsToProcess) {
			console.log(`${region.toUpperCase()}...`);
			const data = await withRetry(() => extractRegion(context, region), 10);
			await redis.set(dtekDataKey(region), JSON.stringify(data), 'EX', DTEK_CACHE_TTL);
			extractedData[region] = data;
			console.log(`  OK: ${data.cities.length} cities, updated ${data.updateFact}`);
		}

		// Save extracted data to JSON file for debugging/artifacts
		writeFileSync(
			DATA_FILE,
			JSON.stringify(
				{
					extractedAt: new Date().toISOString(),
					regions: extractedData,
				},
				null,
				2
			)
		);
		console.log(`\nSaved extracted data to ${DATA_FILE}`);
		console.log('Done');
	} finally {
		await browser.close();
		await redis.quit();
	}
}

main().catch((error) => {
	console.error(`FATAL: ${error}`);
	process.exit(1);
});
