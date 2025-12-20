import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TtlCache, templateCache, statusCache } from '../../src/lib/server/dtek/cache';
import type { DtekTemplateData, DtekStatusResponse } from '../../src/lib/types';

describe('Pre-configured cache instances', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Clear caches before each test
		templateCache.clear();
		statusCache.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
		templateCache.clear();
		statusCache.clear();
	});

	describe('templateCache', () => {
		it('should be an instance of TtlCache', () => {
			expect(templateCache).toBeInstanceOf(TtlCache);
		});

		it('should store and retrieve DtekTemplateData', () => {
			const mockData: DtekTemplateData = {
				csrf: 'test-csrf-token',
				updateFact: '17.12.2025 08:00',
				cities: ['м. Одеса', 'м. Київ'],
				streetsByCity: {
					'м. Одеса': ['вул. Педагогічна', 'вул. Дерибасівська'],
					'м. Київ': ['вул. Хрещатик'],
				},
			};

			templateCache.set('template', mockData);
			const retrieved = templateCache.get('template');

			expect(retrieved).toEqual(mockData);
		});

		it('should have 1 hour (60 minutes) TTL', () => {
			const mockData: DtekTemplateData = {
				csrf: 'test-csrf',
				updateFact: '17.12.2025 08:00',
				cities: [],
				streetsByCity: {},
			};

			templateCache.set('template', mockData);

			// Should still be valid after 59 minutes
			vi.advanceTimersByTime(59 * 60 * 1000);
			expect(templateCache.get('template')).toEqual(mockData);

			// Should expire after 61 minutes
			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(templateCache.get('template')).toBeNull();
		});
	});

	describe('statusCache', () => {
		it('should be an instance of TtlCache', () => {
			expect(statusCache).toBeInstanceOf(TtlCache);
		});

		it('should store and retrieve DtekStatusResponse', () => {
			const mockResponse: DtekStatusResponse = {
				result: true,
				data: {
					'25/39': {
						sub_type: 'Аварійні ремонтні роботи',
						start_date: '00:40 13.12.2025',
						end_date: '23:00 17.12.2025',
						type: '2',
						sub_type_reason: ['GPV1.2'],
						voluntarily: null,
					},
				},
			};

			statusCache.set('status:м. Одеса:вул. Педагогічна', mockResponse);
			const retrieved = statusCache.get('status:м. Одеса:вул. Педагогічна');

			expect(retrieved).toEqual(mockResponse);
		});

		it('should have 10 minutes TTL', () => {
			const mockResponse: DtekStatusResponse = {
				result: true,
				data: {},
			};

			statusCache.set('status:test:test', mockResponse);

			// Should still be valid after 9 minutes
			vi.advanceTimersByTime(9 * 60 * 1000);
			expect(statusCache.get('status:test:test')).toEqual(mockResponse);

			// Should expire after 11 minutes
			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(statusCache.get('status:test:test')).toBeNull();
		});

		it('should handle multiple status keys independently', () => {
			const response1: DtekStatusResponse = {
				result: true,
				data: {
					'1': {
						sub_type: null,
						start_date: null,
						end_date: null,
						type: null,
						sub_type_reason: null,
						voluntarily: null,
					},
				},
			};

			const response2: DtekStatusResponse = {
				result: true,
				data: {
					'2': {
						sub_type: null,
						start_date: null,
						end_date: null,
						type: null,
						sub_type_reason: null,
						voluntarily: null,
					},
				},
			};

			statusCache.set('status:city1:street1', response1);
			statusCache.set('status:city2:street2', response2);

			expect(statusCache.get('status:city1:street1')).toEqual(response1);
			expect(statusCache.get('status:city2:street2')).toEqual(response2);
		});
	});

	describe('cache isolation', () => {
		it('should keep templateCache and statusCache separate', () => {
			const templateData: DtekTemplateData = {
				csrf: 'csrf',
				updateFact: 'fact',
				cities: [],
				streetsByCity: {},
			};

			const statusData: DtekStatusResponse = {
				result: true,
				data: {},
			};

			templateCache.set('key', templateData);
			statusCache.set('key', statusData);

			expect(templateCache.get('key')).toEqual(templateData);
			expect(statusCache.get('key')).toEqual(statusData);

			// Clearing one should not affect the other
			templateCache.clear();

			expect(templateCache.get('key')).toBeNull();
			expect(statusCache.get('key')).toEqual(statusData);
		});
	});
});
