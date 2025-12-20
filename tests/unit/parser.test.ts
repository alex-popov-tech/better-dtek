/**
 * Unit tests for DTEK HTML parser module
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractCsrfMeta, extractDisconScheduleData, parseTemplate } from '$lib/server/dtek/parser';

// Load fixture HTML
const fixtureHtml = readFileSync(join(process.cwd(), 'fixtures', 'template.html'), 'utf-8');

describe('extractCsrfMeta', () => {
	it('should extract CSRF token from valid HTML', () => {
		const result = extractCsrfMeta(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.length).toBeGreaterThan(50);
		}
	});

	it('should return error for HTML without CSRF meta tag', () => {
		const html = '<html><head><title>Test</title></head></html>';
		const result = extractCsrfMeta(html);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('PARSE_ERROR');
			expect(result.error.parseType).toBe('csrf');
		}
	});

	it('should return error for empty HTML', () => {
		const result = extractCsrfMeta('');
		expect(result.ok).toBe(false);
	});

	it('should extract the exact CSRF token from fixture', () => {
		const result = extractCsrfMeta(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(
				'tbUy0fC52Af_UYAQ42czXe7RjgnT7RA_X6KvLBmGdjv99lq3lfiINs0i10PbKwM0jJz2ZOCqellmyNhia8UhCg=='
			);
		}
	});
});

describe('extractDisconScheduleData', () => {
	it('should extract DisconSchedule data from valid HTML', () => {
		const result = extractDisconScheduleData(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.streetsByCity).toBeTruthy();
			expect(result.value.updateFact).toBeTruthy();
		}
	});

	it('should extract streetsByCity as object', () => {
		const result = extractDisconScheduleData(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(typeof result.value.streetsByCity).toBe('object');
			expect(Object.keys(result.value.streetsByCity).length).toBeGreaterThan(0);
		}
	});

	it('should extract updateFact as string with correct format', () => {
		const result = extractDisconScheduleData(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(typeof result.value.updateFact).toBe('string');
			// Format: DD.MM.YYYY HH:MM
			expect(result.value.updateFact).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
		}
	});

	it('should extract the exact updateFact from fixture', () => {
		const result = extractDisconScheduleData(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.updateFact).toBe('11.12.2025 20:51');
		}
	});

	it('should extract streets for specific cities', () => {
		const result = extractDisconScheduleData(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			// Check that some cities have streets
			const cities = Object.keys(result.value.streetsByCity);
			expect(cities.length).toBeGreaterThan(0);

			// Each city should have an array of streets
			for (const city of cities.slice(0, 10)) {
				expect(Array.isArray(result.value.streetsByCity[city])).toBe(true);
				expect(result.value.streetsByCity[city].length).toBeGreaterThan(0);
			}
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
		const result = parseTemplate(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.csrf).toBeTruthy();
			expect(result.value.updateFact).toBeTruthy();
			expect(result.value.cities).toBeTruthy();
			expect(result.value.streetsByCity).toBeTruthy();
		}
	});

	it('should extract all required fields', () => {
		const result = parseTemplate(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			// Check CSRF
			expect(typeof result.value.csrf).toBe('string');
			expect(result.value.csrf).toBe(
				'tbUy0fC52Af_UYAQ42czXe7RjgnT7RA_X6KvLBmGdjv99lq3lfiINs0i10PbKwM0jJz2ZOCqellmyNhia8UhCg=='
			);

			// Check updateFact
			expect(typeof result.value.updateFact).toBe('string');
			expect(result.value.updateFact).toBe('11.12.2025 20:51');

			// Check cities array
			expect(Array.isArray(result.value.cities)).toBe(true);
			expect(result.value.cities.length).toBeGreaterThan(0);

			// Check streetsByCity object
			expect(typeof result.value.streetsByCity).toBe('object');
			expect(Object.keys(result.value.streetsByCity).length).toBeGreaterThan(0);
		}
	});

	it('should have cities sorted alphabetically', () => {
		const result = parseTemplate(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const cities = result.value.cities;

			// Check that cities are sorted
			for (let i = 1; i < cities.length; i++) {
				expect(cities[i].localeCompare(cities[i - 1])).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it('should have matching cities in cities array and streetsByCity keys', () => {
		const result = parseTemplate(fixtureHtml);
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

describe('parseTemplate - integration with real fixture data', () => {
	it('should parse fixture and return valid DtekTemplateData structure', () => {
		const result = parseTemplate(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toMatchObject({
				csrf: expect.any(String),
				updateFact: expect.any(String),
				cities: expect.any(Array),
				streetsByCity: expect.any(Object),
			});

			// Verify structure integrity
			expect(result.value.cities.length).toBeGreaterThan(0); // Should have cities
			expect(Object.keys(result.value.streetsByCity).length).toBe(result.value.cities.length);

			// Verify each city has streets
			for (const city of result.value.cities) {
				expect(result.value.streetsByCity[city]).toBeDefined();
				expect(Array.isArray(result.value.streetsByCity[city])).toBe(true);
			}
		}
	});

	it('should extract real city and street data', () => {
		const result = parseTemplate(fixtureHtml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const cities = result.value.cities;

			// Fixture contains specific city types (с-ще and смт in this case)
			const hasExpectedCities = cities.includes('с-ще Таїрове') && cities.includes('смт Таїрове');
			expect(hasExpectedCities).toBe(true);

			// Verify specific city has streets
			expect(result.value.streetsByCity['с-ще Таїрове']).toBeDefined();
			expect(result.value.streetsByCity['с-ще Таїрове'].length).toBeGreaterThan(0);
			expect(result.value.streetsByCity['смт Таїрове']).toBeDefined();
			expect(result.value.streetsByCity['смт Таїрове'].length).toBeGreaterThan(0);
		}
	});
});
