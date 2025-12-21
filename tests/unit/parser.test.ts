/**
 * Unit tests for DTEK HTML parser module
 */

import { describe, it, expect } from 'vitest';
import { extractCsrfMeta, extractDisconScheduleData, parseTemplate } from '$lib/server/dtek/parser';

// Minimal valid HTML for testing DisconSchedule extraction
const validDisconHtml = `
<html>
<head>
	<meta name="csrf-token" content="test-csrf-token-12345">
</head>
<body>
<script>
DisconSchedule.streets = {"Kyiv": ["Main St", "Second St"], "Odesa": ["Beach Rd"]};
DisconSchedule.fact = {"update": "21.12.2025 10:30"};
</script>
</body>
</html>`;

describe('extractCsrfMeta', () => {
	it('should extract CSRF token from valid HTML', () => {
		const html = '<html><head><meta name="csrf-token" content="test-token-abc123"></head></html>';
		const result = extractCsrfMeta(html);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe('test-token-abc123');
		}
	});

	it('should return error for HTML without CSRF meta tag', () => {
		const html = '<html><head><title>Test</title></head></html>';
		const result = extractCsrfMeta(html);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('PARSE_ERROR');
			if (result.error.code === 'PARSE_ERROR') {
				expect(result.error.parseType).toBe('csrf');
			}
		}
	});

	it('should return error for empty HTML', () => {
		const result = extractCsrfMeta('');
		expect(result.ok).toBe(false);
	});

	it('should return REGION_UNAVAILABLE error for Incapsula bot protection page', () => {
		const incapsulaHtml = `<html>
<head>
<META NAME="robots" CONTENT="noindex,nofollow">
<script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891814e9a2dace20bd4,719d34d31c8e3a6e6fffd425f7e032f3">
</script>
<body>
</body></html>`;
		const result = extractCsrfMeta(incapsulaHtml);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('REGION_UNAVAILABLE');
		}
	});
});

describe('extractDisconScheduleData', () => {
	it('should extract DisconSchedule data from valid HTML', () => {
		const result = extractDisconScheduleData(validDisconHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.streetsByCity).toBeTruthy();
			expect(result.value.updateFact).toBeTruthy();
		}
	});

	it('should extract streetsByCity as object', () => {
		const result = extractDisconScheduleData(validDisconHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(typeof result.value.streetsByCity).toBe('object');
			expect(Object.keys(result.value.streetsByCity).length).toBe(2);
		}
	});

	it('should extract updateFact as string with correct format', () => {
		const result = extractDisconScheduleData(validDisconHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(typeof result.value.updateFact).toBe('string');
			// Format: DD.MM.YYYY HH:MM
			expect(result.value.updateFact).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
			expect(result.value.updateFact).toBe('21.12.2025 10:30');
		}
	});

	it('should extract streets for specific cities', () => {
		const result = extractDisconScheduleData(validDisconHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const cities = Object.keys(result.value.streetsByCity);
			expect(cities).toContain('Kyiv');
			expect(cities).toContain('Odesa');

			expect(result.value.streetsByCity['Kyiv']).toEqual(['Main St', 'Second St']);
			expect(result.value.streetsByCity['Odesa']).toEqual(['Beach Rd']);
		}
	});

	it('should return error for HTML without DisconSchedule', () => {
		const html =
			'<html><head><title>Test</title></head><body><script>var x = 1;</script></body></html>';
		const result = extractDisconScheduleData(html);
		expect(result.ok).toBe(false);
	});

	it('should return error for empty HTML', () => {
		const result = extractDisconScheduleData('');
		expect(result.ok).toBe(false);
	});
});

describe('parseTemplate', () => {
	it('should parse valid template HTML successfully', () => {
		const result = parseTemplate(validDisconHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.csrf).toBe('test-csrf-token-12345');
			expect(result.value.updateFact).toBe('21.12.2025 10:30');
			expect(result.value.cities).toEqual(['Kyiv', 'Odesa']);
			expect(result.value.streetsByCity).toBeTruthy();
		}
	});

	it('should have matching cities in cities array and streetsByCity keys', () => {
		const result = parseTemplate(validDisconHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const citiesFromArray = new Set(result.value.cities);
			const citiesFromObject = new Set(Object.keys(result.value.streetsByCity));

			expect(citiesFromArray.size).toBe(citiesFromObject.size);

			// Every city in array should be in object
			for (const city of citiesFromArray) {
				expect(citiesFromObject.has(city)).toBe(true);
			}
		}
	});

	it('should return error for HTML without CSRF', () => {
		const html = `
			<html>
				<head><title>Test</title></head>
				<body>
					<script>
						DisconSchedule.streets = {"city": ["street1"]};
						DisconSchedule.fact = {"update": "11.12.2025 20:51"};
					</script>
				</body>
			</html>
		`;
		const result = parseTemplate(html);
		expect(result.ok).toBe(false);
	});

	it('should return error for HTML without DisconSchedule', () => {
		const html = `
			<html>
				<head>
					<meta name="csrf-token" content="test-token">
				</head>
				<body></body>
			</html>
		`;
		const result = parseTemplate(html);
		expect(result.ok).toBe(false);
	});

	it('should return error for empty HTML', () => {
		const result = parseTemplate('');
		expect(result.ok).toBe(false);
	});

	it('should handle malformed JavaScript gracefully', () => {
		const html = `
			<html>
				<head>
					<meta name="csrf-token" content="test-token">
				</head>
				<body>
					<script>
						DisconSchedule.streets = {malformed syntax
					</script>
				</body>
			</html>
		`;
		const result = parseTemplate(html);
		expect(result.ok).toBe(false);
	});
});
