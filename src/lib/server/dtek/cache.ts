/**
 * Internal cache entry structure
 */
interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

/**
 * Generic in-memory TTL cache with automatic expiration
 */
export class TtlCache<T> {
	private cache: Map<string, CacheEntry<T>>;
	private defaultTtlMs: number;

	constructor(defaultTtlMs: number) {
		this.cache = new Map();
		this.defaultTtlMs = defaultTtlMs;
	}

	/**
	 * Get value from cache
	 * @returns The cached value or null if missing or expired
	 */
	get(key: string): T | null {
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if expired
		if (Date.now() >= entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	/**
	 * Set value in cache with optional custom TTL
	 * @param key Cache key
	 * @param value Value to cache
	 * @param ttlMs Custom TTL in milliseconds (uses default if not provided)
	 */
	set(key: string, value: T, ttlMs?: number): void {
		const ttl = ttlMs ?? this.defaultTtlMs;
		const expiresAt = Date.now() + ttl;

		this.cache.set(key, {
			data: value,
			expiresAt,
		});
	}

	/**
	 * Check if a valid (non-expired) entry exists
	 */
	has(key: string): boolean {
		return this.get(key) !== null;
	}

	/**
	 * Delete entry from cache
	 */
	delete(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Clear all entries from cache
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics for debugging
	 */
	getStats(): { size: number; keys: string[] } {
		// Clean up expired entries first
		for (const [key, entry] of this.cache.entries()) {
			if (Date.now() >= entry.expiresAt) {
				this.cache.delete(key);
			}
		}

		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()),
		};
	}
}
