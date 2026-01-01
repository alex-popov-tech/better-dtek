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
import { mkdirSync } from 'fs';
import { z } from 'zod';
import { chromium, type BrowserContext } from 'playwright';
import Redis from 'ioredis';

// Artifacts directory for screenshots and videos
const ARTIFACTS_DIR = 'artifacts';
const SCREENSHOTS_DIR = `${ARTIFACTS_DIR}/screenshots`;
const VIDEOS_DIR = `${ARTIFACTS_DIR}/videos`;
import {
	DTEK_REGIONS,
	DTEK_CACHE_TTL,
	DTEK_REGION_URLS,
	DTEK_REGION_CITY_NAMES,
	dtekDataKey,
	isDtekRegion,
	type DtekRegion,
	type DtekCachedRegion,
} from '../src/lib/types/dtek-cache.js';

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const DisconScheduleSchema = z.object({
	streets: z
		.union([z.record(z.string(), z.array(z.string())), z.array(z.string())])
		.refine((v) => (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0), {
			message: 'streets must not be empty',
		}),
	fact: z.object({ update: z.string().min(1) }),
	preset: z.unknown(),
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
	for (let i = 1; i <= attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			if (i === attempts) throw error;
			console.log(`  Attempt ${i}/${attempts} failed: ${error}, retrying...`);
		}
	}
	throw new Error('unreachable');
}

/** Extract balanced JSON from text starting after marker */
function extractJson(text: string, marker: string, open: string, close: string): unknown {
	const start = text.indexOf(marker);
	if (start === -1) return null;
	const eq = text.indexOf('=', start);
	if (eq === -1) return null;
	const jsonStart = text.indexOf(open, eq);
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
		streets:
			extractJson(html, 'DisconSchedule.streets', '[', ']') ??
			extractJson(html, 'DisconSchedule.streets', '{', '}'),
		fact: extractJson(html, 'DisconSchedule.fact', '{', '}'),
		preset: extractJson(html, 'DisconSchedule.preset', '{', '}'),
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

	try {
		await page.goto(url, { waitUntil: 'networkidle', timeout: 10_000 });

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

		// Get page HTML and parse on Node.js side (avoids tsx transform issues in browser)
		const html = await page.content();
		const raw = parseDisconSchedule(html);
		const validated = DisconScheduleSchema.parse(raw);

		// Normalize streets (can be array for single-city regions or object for multi-city)
		const streetsByCity: Record<string, string[]> = Array.isArray(validated.streets)
			? { [DTEK_REGION_CITY_NAMES[region]]: validated.streets }
			: (validated.streets as Record<string, string[]>);

		// Extract cookies
		const cookies = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');

		return {
			region,
			baseUrl,
			csrf,
			cookies,
			updateFact: validated.fact.update,
			cities: Object.keys(streetsByCity),
			streetsByCity,
			presetData: validated.preset,
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

	try {
		for (const region of regionsToProcess) {
			console.log(`${region.toUpperCase()}...`);
			const data = await withRetry(() => extractRegion(context, region), 3);
			await redis.set(dtekDataKey(region), JSON.stringify(data), 'EX', DTEK_CACHE_TTL);
			console.log(`  OK: ${data.cities.length} cities, updated ${data.updateFact}`);
		}
		console.log('\nDone');
	} finally {
		await browser.close();
		await redis.quit();
	}
}

main().catch((error) => {
	console.error(`FATAL: ${error}`);
	process.exit(1);
});
