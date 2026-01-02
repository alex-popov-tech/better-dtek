import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TtlCache } from '../../src/lib/server/dtek/cache';

describe('TtlCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('basic functionality', () => {
		it('should set and get values', () => {
			const cache = new TtlCache<string>(1000);

			cache.set('key1', 'value1');
			expect(cache.get('key1')).toBe('value1');
		});

		it('should return null for missing keys', () => {
			const cache = new TtlCache<string>(1000);

			expect(cache.get('nonexistent')).toBeNull();
		});

		it('should handle multiple key-value pairs', () => {
			const cache = new TtlCache<number>(1000);

			cache.set('a', 1);
			cache.set('b', 2);
			cache.set('c', 3);

			expect(cache.get('a')).toBe(1);
			expect(cache.get('b')).toBe(2);
			expect(cache.get('c')).toBe(3);
		});

		it('should overwrite existing values', () => {
			const cache = new TtlCache<string>(1000);

			cache.set('key', 'value1');
			cache.set('key', 'value2');

			expect(cache.get('key')).toBe('value2');
		});
	});

	describe('TTL expiration', () => {
		it('should return null for expired entries', () => {
			const cache = new TtlCache<string>(1000);

			cache.set('key', 'value');
			expect(cache.get('key')).toBe('value');

			// Advance time past TTL
			vi.advanceTimersByTime(1001);

			expect(cache.get('key')).toBeNull();
		});

		it('should not expire entries before TTL', () => {
			const cache = new TtlCache<string>(1000);

			cache.set('key', 'value');

			// Advance time but not past TTL
			vi.advanceTimersByTime(999);

			expect(cache.get('key')).toBe('value');
		});

		it('should handle mixed expired and valid entries', () => {
			const cache = new TtlCache<string>(1000);

			cache.set('key1', 'value1');

			// Advance time halfway
			vi.advanceTimersByTime(500);

			cache.set('key2', 'value2');

			// Advance time to expire first key but not second
			vi.advanceTimersByTime(600);

			expect(cache.get('key1')).toBeNull();
			expect(cache.get('key2')).toBe('value2');
		});
	});

	describe('custom TTL', () => {
		it('should use custom TTL when provided', () => {
			const cache = new TtlCache<string>(1000); // Default 1 second

			// Set with custom TTL of 2 seconds
			cache.set('key', 'value', 2000);

			// Advance past default TTL
			vi.advanceTimersByTime(1500);

			// Should still be valid due to custom TTL
			expect(cache.get('key')).toBe('value');

			// Advance past custom TTL
			vi.advanceTimersByTime(600);

			expect(cache.get('key')).toBeNull();
		});

		it('should allow shorter custom TTL', () => {
			const cache = new TtlCache<string>(1000); // Default 1 second

			// Set with custom TTL of 500ms
			cache.set('key', 'value', 500);

			// Advance past custom TTL but before default
			vi.advanceTimersByTime(600);

			expect(cache.get('key')).toBeNull();
		});

		it('should allow different TTLs for different keys', () => {
			const cache = new TtlCache<string>(1000);

			cache.set('short', 'value1', 500);
			cache.set('long', 'value2', 2000);

			// Advance to expire short but not long
			vi.advanceTimersByTime(600);

			expect(cache.get('short')).toBeNull();
			expect(cache.get('long')).toBe('value2');
		});
	});

	describe('complex data types', () => {
		it('should handle objects', () => {
			const cache = new TtlCache<{ name: string; age: number }>(1000);

			const user = { name: 'John', age: 30 };
			cache.set('user', user);

			expect(cache.get('user')).toEqual(user);
		});

		it('should handle arrays', () => {
			const cache = new TtlCache<string[]>(1000);

			const cities = ['Odesa', 'Kyiv', 'Lviv'];
			cache.set('cities', cities);

			expect(cache.get('cities')).toEqual(cities);
		});

		it('should handle nested structures', () => {
			interface NestedData {
				cities: string[];
				streets: Record<string, string[]>;
			}

			const cache = new TtlCache<NestedData>(1000);

			const data: NestedData = {
				cities: ['Odesa'],
				streets: {
					Odesa: ['Street 1', 'Street 2'],
				},
			};

			cache.set('data', data);

			expect(cache.get('data')).toEqual(data);
		});
	});
});
