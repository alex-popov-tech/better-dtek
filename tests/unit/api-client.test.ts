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

		const result = await fetchCities();

		expect(global.fetch).toHaveBeenCalledWith('/api/cities');
		expect(result).toEqual(['м. Одеса', 'м. Київ', 'м. Львів']);
	});

	it('throws error on HTTP error response', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
		});

		await expect(fetchCities()).rejects.toThrow();
	});

	it('throws error on invalid response format', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ cities: 'not an array' }),
		});

		await expect(fetchCities()).rejects.toThrow('Невірний формат відповіді API');
	});

	it('throws network error on fetch failure', async () => {
		(global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await expect(fetchCities()).rejects.toThrow("Немає з'єднання");
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

		const result = await fetchStreets('м. Одеса');

		expect(global.fetch).toHaveBeenCalledWith(
			'/api/streets?city=%D0%BC.%20%D0%9E%D0%B4%D0%B5%D1%81%D0%B0'
		);
		expect(result).toEqual(['вул. Педагогічна', 'вул. Дерибасівська']);
	});

	it('throws error if city is empty', async () => {
		await expect(fetchStreets('')).rejects.toThrow("Назва міста обов'язкова");
	});

	it('throws error if city is whitespace only', async () => {
		await expect(fetchStreets('   ')).rejects.toThrow("Назва міста обов'язкова");
	});

	it('throws error on 400 Bad Request', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
		});

		await expect(fetchStreets('м. Одеса')).rejects.toThrow('Невірні параметри');
	});

	it('throws error on invalid response format', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ streets: null }),
		});

		await expect(fetchStreets('м. Одеса')).rejects.toThrow('Невірний формат відповіді API');
	});

	it('throws network error on fetch failure', async () => {
		(global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await expect(fetchStreets('м. Одеса')).rejects.toThrow("Немає з'єднання");
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
				'27': { emergency: { from: '14:30 17.12.2025', to: '23:00 17.12.2025' } },
			},
			schedules: {},
			fetchedAt: Date.now(),
		};

		(global.fetch as any).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockResponse,
		});

		const result = await fetchBuildingStatuses('м. Одеса', 'вул. Педагогічна');

		expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/status?city='));
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('%D0%BC.%20%D0%9E%D0%B4%D0%B5%D1%81%D0%B0')
		);
		expect(result.buildings).toHaveProperty('25/39');
		expect(result.buildings['25/39'].emergency).toBeUndefined();
		expect(result.buildings['27'].emergency).toBeDefined();
	});

	it('throws error if city is empty', async () => {
		await expect(fetchBuildingStatuses('', 'вул. Педагогічна')).rejects.toThrow(
			"Назва міста обов'язкова"
		);
	});

	it('throws error if street is empty', async () => {
		await expect(fetchBuildingStatuses('м. Одеса', '')).rejects.toThrow("Назва вулиці обов'язкова");
	});

	it('throws error if both city and street are empty', async () => {
		await expect(fetchBuildingStatuses('', '')).rejects.toThrow("Назва міста обов'язкова");
	});

	it('throws error on 400 Bad Request', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
		});

		await expect(fetchBuildingStatuses('м. Одеса', 'вул. Педагогічна')).rejects.toThrow(
			'Невірні параметри'
		);
	});

	it('throws error on 503 Service Unavailable', async () => {
		(global.fetch as any).mockResolvedValueOnce({
			ok: false,
			status: 503,
			statusText: 'Service Unavailable',
		});

		await expect(fetchBuildingStatuses('м. Одеса', 'вул. Педагогічна')).rejects.toThrow(
			'Сервіс ДТЕК тимчасово недоступний'
		);
	});

	it('throws error on invalid response format (missing city)', async () => {
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

		await expect(fetchBuildingStatuses('м. Одеса', 'вул. Педагогічна')).rejects.toThrow(
			'Невірний формат відповіді API'
		);
	});

	it('throws error on invalid response format (invalid buildings)', async () => {
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

		await expect(fetchBuildingStatuses('м. Одеса', 'вул. Педагогічна')).rejects.toThrow(
			'Невірний формат відповіді API'
		);
	});

	it('throws network error on fetch failure', async () => {
		(global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await expect(fetchBuildingStatuses('м. Одеса', 'вул. Педагогічна')).rejects.toThrow(
			"Немає з'єднання"
		);
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

		const result = await fetchBuildingStatuses('м. Одеса', 'вул. Тестова');

		expect(result.buildings).toEqual({});
	});
});
