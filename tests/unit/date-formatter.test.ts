import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, parseDtekDate, formatUkrainianDate } from '$lib/utils/date-formatter';

describe('formatRelativeTime', () => {
	beforeEach(() => {
		// Mock Date.now() to return a fixed timestamp
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-12-17T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns "щойно" for timestamps less than 60 seconds ago', () => {
		const timestamp = Date.now() - 30 * 1000; // 30 seconds ago
		expect(formatRelativeTime(timestamp)).toBe('щойно');
	});

	it('returns minutes for timestamps less than 60 minutes ago', () => {
		const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
		expect(formatRelativeTime(timestamp)).toBe('5 хв тому');
	});

	it('returns hours for timestamps less than 24 hours ago', () => {
		const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
		expect(formatRelativeTime(timestamp)).toBe('2 год тому');
	});

	it('returns "вчора" for timestamps exactly 1 day ago', () => {
		const timestamp = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago
		expect(formatRelativeTime(timestamp)).toBe('вчора');
	});

	it('returns days for timestamps between 2-6 days ago', () => {
		const timestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
		expect(formatRelativeTime(timestamp)).toBe('3 дн тому');
	});

	it('returns weeks for timestamps between 1-4 weeks ago', () => {
		const timestamp = Date.now() - 14 * 24 * 60 * 60 * 1000; // 2 weeks ago
		expect(formatRelativeTime(timestamp)).toBe('2 тиж тому');
	});

	it('returns months for timestamps between 1-12 months ago', () => {
		const timestamp = Date.now() - 60 * 24 * 60 * 60 * 1000; // ~2 months ago
		expect(formatRelativeTime(timestamp)).toBe('2 міс тому');
	});

	it('returns years for timestamps over a year ago', () => {
		const timestamp = Date.now() - 400 * 24 * 60 * 60 * 1000; // ~1 year ago
		expect(formatRelativeTime(timestamp)).toBe('1 рок тому');
	});
});

describe('parseDtekDate', () => {
	it('parses valid DTEK date format correctly', () => {
		const result = parseDtekDate('14:30 17.12.2025');
		expect(result.getFullYear()).toBe(2025);
		expect(result.getMonth()).toBe(11); // December (0-indexed)
		expect(result.getDate()).toBe(17);
		expect(result.getHours()).toBe(14);
		expect(result.getMinutes()).toBe(30);
	});

	it('parses date with leading zeros', () => {
		const result = parseDtekDate('09:05 05.01.2025');
		expect(result.getFullYear()).toBe(2025);
		expect(result.getMonth()).toBe(0); // January (0-indexed)
		expect(result.getDate()).toBe(5);
		expect(result.getHours()).toBe(9);
		expect(result.getMinutes()).toBe(5);
	});

	it('throws error for invalid format (missing time)', () => {
		expect(() => parseDtekDate('17.12.2025')).toThrow('Invalid DTEK date format');
	});

	it('throws error for invalid format (missing date)', () => {
		expect(() => parseDtekDate('14:30')).toThrow('Invalid DTEK date format');
	});

	it('throws error for invalid time format', () => {
		expect(() => parseDtekDate('25:70 17.12.2025')).toThrow('Invalid date values');
	});

	it('throws error for invalid date format', () => {
		expect(() => parseDtekDate('14:30 32.13.2025')).toThrow('Invalid date values');
	});

	it('throws error for non-numeric values', () => {
		expect(() => parseDtekDate('ab:cd ef.gh.ijkl')).toThrow('Invalid date values');
	});

	it('handles dates at edge of valid ranges', () => {
		const result = parseDtekDate('23:59 31.12.2025');
		expect(result.getFullYear()).toBe(2025);
		expect(result.getMonth()).toBe(11);
		expect(result.getDate()).toBe(31);
		expect(result.getHours()).toBe(23);
		expect(result.getMinutes()).toBe(59);
	});
});

describe('formatUkrainianDate', () => {
	it('formats date correctly with Ukrainian month name', () => {
		const date = new Date(2025, 11, 17, 14, 30); // December 17, 2025, 14:30
		expect(formatUkrainianDate(date)).toBe('17 грудня 2025, 14:30');
	});

	it('formats date with different month correctly', () => {
		const date = new Date(2025, 0, 5, 9, 5); // January 5, 2025, 09:05
		expect(formatUkrainianDate(date)).toBe('5 січня 2025, 09:05');
	});

	it('formats date with padding for single-digit minutes', () => {
		const date = new Date(2025, 5, 10, 8, 3); // June 10, 2025, 08:03
		expect(formatUkrainianDate(date)).toBe('10 червня 2025, 08:03');
	});

	it('formats date with padding for single-digit hours', () => {
		const date = new Date(2025, 3, 15, 5, 45); // April 15, 2025, 05:45
		expect(formatUkrainianDate(date)).toBe('15 квітня 2025, 05:45');
	});

	it('formats all months correctly', () => {
		const expectedMonths = [
			'січня',
			'лютого',
			'березня',
			'квітня',
			'травня',
			'червня',
			'липня',
			'серпня',
			'вересня',
			'жовтня',
			'листопада',
			'грудня',
		];

		expectedMonths.forEach((month, index) => {
			const date = new Date(2025, index, 1, 12, 0);
			const formatted = formatUkrainianDate(date);
			expect(formatted).toContain(month);
		});
	});
});

describe('date formatter integration', () => {
	it('can parse and format DTEK date back to Ukrainian format', () => {
		const dtekDate = '14:30 17.12.2025';
		const parsed = parseDtekDate(dtekDate);
		const formatted = formatUkrainianDate(parsed);
		expect(formatted).toBe('17 грудня 2025, 14:30');
	});
});
