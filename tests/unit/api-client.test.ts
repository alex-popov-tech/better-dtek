import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchCities, fetchStreets, fetchBuildingStatuses } from '$lib/utils/api-client';
import type { CitiesResponse, StreetsResponse, StatusResponse } from '$lib/types/address';

describe('fetchCities', () => {
	beforeEach(() => {
		// Mock global fetch
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches cities successfully', async () => {
		const mockResponse: CitiesResponse = {
			cities: ['м. Одеса', 'м. Київ', 'м. Львів'],
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockResponse,
		});

		const result = await fetchCities('oem');

		expect(global.fetch).toHaveBeenCalledWith('/api/cities?region=oem');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(['м. Одеса', 'м. Київ', 'м. Львів']);
		}
	});

	it('returns error on HTTP error response', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
		});

		const result = await fetchCities('oem');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('SERVER_ERROR');
		}
	});

	it('returns error on invalid response format', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ cities: 'not an array' }),
		});

		const result = await fetchCities('oem');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe('Невірний формат відповіді API');
		}
	});

	it('returns network error on fetch failure', async () => {
		(global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		const result = await fetchCities('oem');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('NETWORK_ERROR');
			expect(result.error.message).toBe("Немає з'єднання");
		}
	});
});

describe('fetchStreets', () => {
	beforeEach(() => {
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches streets successfully with URL encoding', async () => {
		const mockResponse: StreetsResponse = {
			city: 'м. Одеса',
			streets: ['вул. Педагогічна', 'вул. Дерибасівська'],
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockResponse,
		});

		const result = await fetchStreets('oem', 'м. Одеса');

		expect(global.fetch).toHaveBeenCalledWith(
			'/api/streets?region=oem&city=%D0%BC.%20%D0%9E%D0%B4%D0%B5%D1%81%D0%B0'
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(['вул. Педагогічна', 'вул. Дерибасівська']);
		}
	});

	it('returns error if city is empty', async () => {
		const result = await fetchStreets('oem', '');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe("Назва міста обов'язкова");
		}
	});

	it('returns error if city is whitespace only', async () => {
		const result = await fetchStreets('oem', '   ');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe("Назва міста обов'язкова");
		}
	});

	it('returns error on 400 Bad Request', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
		});

		const result = await fetchStreets('oem', 'м. Одеса');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe('Невірні параметри');
		}
	});

	it('returns error on invalid response format', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ streets: null }),
		});

		const result = await fetchStreets('oem', 'м. Одеса');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe('Невірний формат відповіді API');
		}
	});

	it('returns network error on fetch failure', async () => {
		(global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		const result = await fetchStreets('oem', 'м. Одеса');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('NETWORK_ERROR');
			expect(result.error.message).toBe("Немає з'єднання");
		}
	});
});

describe('fetchBuildingStatuses', () => {
	beforeEach(() => {
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches building statuses successfully with URL encoding', async () => {
		const mockResponse: StatusResponse = {
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			buildings: {
				'25/39': {},
				'27': {
					outage: { type: 'emergency' as const, from: '14:30 17.12.2025', to: '23:00 17.12.2025' },
				},
			},
			schedules: {},
			fetchedAt: Date.now(),
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockResponse,
		});

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Педагогічна');

		expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/status?region=oem'));
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('%D0%BC.%20%D0%9E%D0%B4%D0%B5%D1%81%D0%B0')
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.buildings).toHaveProperty('25/39');
			expect(result.value.buildings['25/39'].outage).toBeUndefined();
			expect(result.value.buildings['27'].outage).toBeDefined();
		}
	});

	it('returns error if city is empty', async () => {
		const result = await fetchBuildingStatuses('oem', '', 'вул. Педагогічна');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe("Назва міста обов'язкова");
		}
	});

	it('returns error if street is empty', async () => {
		const result = await fetchBuildingStatuses('oem', 'м. Одеса', '');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe("Назва вулиці обов'язкова");
		}
	});

	it('returns error if both city and street are empty', async () => {
		const result = await fetchBuildingStatuses('oem', '', '');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe("Назва міста обов'язкова");
		}
	});

	it('returns error on 400 Bad Request', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
		});

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Педагогічна');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe('Невірні параметри');
		}
	});

	it('returns error on 503 Service Unavailable', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 503,
			statusText: 'Service Unavailable',
		});

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Педагогічна');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('SERVER_ERROR');
			expect(result.error.message).toBe('Сервіс ДТЕК тимчасово недоступний');
		}
	});

	it('returns error on invalid response format (missing city)', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				street: 'вул. Педагогічна',
				buildings: {},
				schedules: {},
				fetchedAt: Date.now(),
			}),
		});

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Педагогічна');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe('Невірний формат відповіді API');
		}
	});

	it('returns error on invalid response format (invalid buildings)', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: 'not an object',
				schedules: {},
				fetchedAt: Date.now(),
			}),
		});

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Педагогічна');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('VALIDATION_ERROR');
			expect(result.error.message).toBe('Невірний формат відповіді API');
		}
	});

	it('returns network error on fetch failure', async () => {
		(global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Педагогічна');

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('NETWORK_ERROR');
			expect(result.error.message).toBe("Немає з'єднання");
		}
	});

	it('handles empty buildings object', async () => {
		const mockResponse: StatusResponse = {
			city: 'м. Одеса',
			street: 'вул. Тестова',
			buildings: {},
			schedules: {},
			fetchedAt: Date.now(),
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockResponse,
		});

		const result = await fetchBuildingStatuses('oem', 'м. Одеса', 'вул. Тестова');

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.buildings).toEqual({});
		}
	});
});
