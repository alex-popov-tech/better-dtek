/**
 * Environment variable validation
 *
 * Validates required environment variables at runtime using Zod.
 * Provides clear error messages when variables are missing or invalid.
 */

// Load .env file for local development (SvelteKit/Vite should do this,
// but adding it here ensures it works for all server-side code)
import 'dotenv/config';
import { z } from 'zod';

/**
 * Schema for Redis-related environment variables
 */
const redisEnvSchema = z.object({
	REDIS_URL: z
		.string()
		.min(1, 'REDIS_URL environment variable is required')
		.refine(
			(url) => url.startsWith('redis://') || url.startsWith('rediss://'),
			'REDIS_URL must start with redis:// or rediss://'
		),
});

export type RedisEnv = z.infer<typeof redisEnvSchema>;

/**
 * Cached validated environment
 */
let cachedRedisEnv: RedisEnv | null = null;

/**
 * Get validated Redis environment variables
 * Caches the result after first validation
 *
 * @throws {ZodError} If validation fails
 */
export function getRedisEnv(): RedisEnv {
	if (cachedRedisEnv) return cachedRedisEnv;

	const result = redisEnvSchema.safeParse(process.env);

	if (!result.success) {
		const formatted = result.error.format();
		const message = formatted.REDIS_URL?._errors?.join(', ') || 'Invalid environment';
		throw new Error(`Environment validation failed: ${message}`);
	}

	cachedRedisEnv = result.data;
	return cachedRedisEnv;
}
