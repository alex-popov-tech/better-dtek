/**
 * KV Client for reading DTEK cached data from Vercel KV (Redis)
 *
 * This is a thin wrapper that:
 * 1. Creates a lazy-initialized Redis connection
 * 2. Provides typed get methods for DTEK data
 * 3. Returns Result<T, KvError> for explicit error handling
 */

import Redis from 'ioredis';
import type { Result } from '$lib/types';
import { ok, err, kvError } from '$lib/types';
import { dtekDataKey, type DtekCachedRegion } from '$lib/types/dtek-cache';
import type { RegionCode } from '$lib/constants/regions';

// Lazy singleton Redis client
let redis: Redis | null = null;

/**
 * Get or create the Redis client instance
 */
function getRedis(): Redis {
	if (redis) return redis;

	const url = process.env.REDIS_URL;
	if (!url) {
		throw new Error('REDIS_URL environment variable not set');
	}

	redis = new Redis(url, {
		maxRetriesPerRequest: 3,
		lazyConnect: true,
		connectTimeout: 5000,
	});

	return redis;
}

/**
 * Get cached DTEK data for a region
 * @param region - Region code (kem, oem, dnem, dem)
 * @returns Result with cached region data, or KvError
 */
export async function getDtekRegionData(
	region: RegionCode
): Promise<Result<DtekCachedRegion, import('$lib/types').KvError>> {
	const key = dtekDataKey(region);

	try {
		const client = getRedis();
		const raw = await client.get(key);

		if (!raw) {
			return err(kvError(`No cached data found for region: ${region}`));
		}

		const data: DtekCachedRegion = JSON.parse(raw);
		return ok(data);
	} catch (cause) {
		const message =
			cause instanceof Error && cause.message.includes('REDIS_URL')
				? cause.message
				: `Failed to read KV data for ${region}`;
		return err(kvError(message, cause));
	}
}
