import { describe, it, expect, vi } from 'vitest';
import { withRetry, retryError, DEFAULT_RETRY_DELAYS, type RetryError } from '$lib/utils/retry';
import { ok, err } from '$lib/types/result';

describe('withRetry', () => {
	describe('successful operations', () => {
		it('returns success on first attempt for ok Result', async () => {
			const fn = vi.fn().mockResolvedValue(ok('value'));
			const result = await withRetry(fn);

			expect(result).toEqual(ok('value'));
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('returns success on first attempt for non-Result value', async () => {
			const fn = vi.fn().mockResolvedValue('direct-value');
			const result = await withRetry(fn);

			expect(result).toEqual(ok('direct-value'));
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('returns success for null value', async () => {
			const fn = vi.fn().mockResolvedValue(null);
			const result = await withRetry(fn);

			expect(result).toEqual(ok(null));
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('returns success for undefined value', async () => {
			const fn = vi.fn().mockResolvedValue(undefined);
			const result = await withRetry(fn);

			expect(result).toEqual(ok(undefined));
			expect(fn).toHaveBeenCalledTimes(1);
		});
	});

	describe('retry behavior', () => {
		it('retries on failed Result and succeeds on 2nd attempt', async () => {
			const fn = vi
				.fn()
				.mockResolvedValueOnce(err({ code: 'FAIL' }))
				.mockResolvedValueOnce(ok('success'));

			const result = await withRetry(fn, { delays: [10] });

			expect(result).toEqual(ok('success'));
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('retries on thrown error and succeeds on 2nd attempt', async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce(ok('recovered'));

			const result = await withRetry(fn, { delays: [10] });

			expect(result).toEqual(ok('recovered'));
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('retries multiple times before succeeding', async () => {
			const fn = vi
				.fn()
				.mockResolvedValueOnce(err({ code: 'FAIL1' }))
				.mockResolvedValueOnce(err({ code: 'FAIL2' }))
				.mockResolvedValueOnce(ok('finally'));

			const result = await withRetry(fn, { delays: [10, 10] });

			expect(result).toEqual(ok('finally'));
			expect(fn).toHaveBeenCalledTimes(3);
		});
	});

	describe('exhausted retries', () => {
		it('returns RetryError after all attempts exhausted with Result errors', async () => {
			const fn = vi.fn().mockResolvedValue(err({ code: 'PERSISTENT_FAIL' }));
			const result = await withRetry(fn, { delays: [10, 10] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				const error = result.error as RetryError;
				expect(error.code).toBe('RETRY_EXHAUSTED');
				expect(error.attempts).toBe(3);
				expect(error.lastError).toEqual({ code: 'PERSISTENT_FAIL' });
			}
			expect(fn).toHaveBeenCalledTimes(3);
		});

		it('returns RetryError after all attempts exhausted with thrown errors', async () => {
			const thrownError = new Error('Always fails');
			const fn = vi.fn().mockRejectedValue(thrownError);
			const result = await withRetry(fn, { delays: [10, 10] });

			expect(result.ok).toBe(false);
			if (!result.ok) {
				const error = result.error as RetryError;
				expect(error.code).toBe('RETRY_EXHAUSTED');
				expect(error.attempts).toBe(3);
				expect(error.lastError).toBe(thrownError);
			}
			expect(fn).toHaveBeenCalledTimes(3);
		});

		it('uses default delays when not specified', async () => {
			const fn = vi.fn().mockResolvedValue(err({ code: 'FAIL' }));
			const result = await withRetry(fn, { delays: [] }); // Empty delays = 1 attempt

			expect(result.ok).toBe(false);
			if (!result.ok) {
				const error = result.error as RetryError;
				expect(error.attempts).toBe(1);
			}
			expect(fn).toHaveBeenCalledTimes(1);
		});
	});

	describe('onRetry callback', () => {
		it('calls onRetry before each retry sleep', async () => {
			const onRetry = vi.fn();
			const fn = vi
				.fn()
				.mockResolvedValueOnce(err({ code: 'FAIL1' }))
				.mockResolvedValueOnce(err({ code: 'FAIL2' }))
				.mockResolvedValueOnce(ok('success'));

			await withRetry(fn, { delays: [100, 200], onRetry });

			expect(onRetry).toHaveBeenCalledTimes(2);
			expect(onRetry).toHaveBeenNthCalledWith(1, 1, { code: 'FAIL1' }, 100);
			expect(onRetry).toHaveBeenNthCalledWith(2, 2, { code: 'FAIL2' }, 200);
		});

		it('does not call onRetry on first attempt success', async () => {
			const onRetry = vi.fn();
			const fn = vi.fn().mockResolvedValue(ok('immediate'));

			await withRetry(fn, { delays: [100], onRetry });

			expect(onRetry).not.toHaveBeenCalled();
		});

		it('calls onRetry with thrown error', async () => {
			const onRetry = vi.fn();
			const thrownError = new Error('Boom');
			const fn = vi.fn().mockRejectedValueOnce(thrownError).mockResolvedValueOnce(ok('ok'));

			await withRetry(fn, { delays: [10], onRetry });

			expect(onRetry).toHaveBeenCalledWith(1, thrownError, 10);
		});
	});

	describe('timing', () => {
		it('respects delay timing between retries', async () => {
			const start = Date.now();
			const fn = vi.fn().mockResolvedValue(err({ code: 'FAIL' }));

			await withRetry(fn, { delays: [50, 50] });

			const elapsed = Date.now() - start;
			// Should be at least 100ms (2 * 50ms delays)
			expect(elapsed).toBeGreaterThanOrEqual(90);
			expect(fn).toHaveBeenCalledTimes(3);
		});
	});

	describe('DEFAULT_RETRY_DELAYS', () => {
		it('exports correct default delays', () => {
			expect(DEFAULT_RETRY_DELAYS).toEqual([500, 1000, 2000]);
		});
	});

	describe('retryError helper', () => {
		it('creates RetryError with correct structure', () => {
			const lastError = { code: 'SOME_ERROR' };
			const error = retryError(3, lastError);

			expect(error.code).toBe('RETRY_EXHAUSTED');
			expect(error.message).toBe('All 3 attempts failed');
			expect(error.attempts).toBe(3);
			expect(error.lastError).toBe(lastError);
			expect(typeof error.timestamp).toBe('number');
		});
	});
});
