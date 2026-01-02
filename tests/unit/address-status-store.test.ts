import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { addressStatusStore } from '$lib/stores/address-status';
import type { SavedAddress } from '$lib/types/address';
import * as apiClient from '$lib/utils/api-client';
import { ok, err } from '$lib/types/result';
import { apiError } from '$lib/types/errors';

// Mock API client
vi.mock('$lib/utils/api-client');

// Mock toast store
vi.mock('$lib/stores/toast', () => ({
	showError: vi.fn(),
	showSuccess: vi.fn(),
	showInfo: vi.fn(),
}));

describe('addressStatusStore', () => {
	const mockAddress1: SavedAddress = {
		id: 'addr-1',
		region: 'oem',
		city: 'м. Одеса',
		street: 'вул. Педагогічна',
		building: '25/39',
		label: 'Дім',
		createdAt: Date.now(),
	};

	const mockAddress2: SavedAddress = {
		id: 'addr-2',
		region: 'oem',
		city: 'м. Одеса',
		street: 'вул. Дерибасівська',
		building: '12',
		label: 'Робота',
		createdAt: Date.now(),
	};

	beforeEach(() => {
		addressStatusStore._reset();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('fetchStatus', () => {
		it('fetches and caches status successfully', async () => {
			const mockResponse = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse));

			await addressStatusStore.fetchStatus(mockAddress1);

			const cache = get(addressStatusStore);
			const entry = cache.get('addr-1');

			expect(entry).toBeDefined();
			expect(entry?.status).toEqual({});
			expect(entry?.loading).toBe(false);
			expect(entry?.error).toBeNull();
			expect(entry?.fetchedAt).toBe(mockResponse.fetchedAt);
		});

		it('sets loading state during fetch', async () => {
			let loadingStateObserved = false;

			const mockResponse = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockImplementation(async () => {
				// Check loading state during fetch
				const cache = get(addressStatusStore);
				const entry = cache.get('addr-1');
				if (entry?.loading) {
					loadingStateObserved = true;
				}
				return ok(mockResponse);
			});

			await addressStatusStore.fetchStatus(mockAddress1);

			expect(loadingStateObserved).toBe(true);
		});

		it('handles missing building in response', async () => {
			const mockResponse = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					// Building 25/39 not in response
					'27': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse));

			await addressStatusStore.fetchStatus(mockAddress1);

			const entry = addressStatusStore.getStatus('addr-1');

			expect(entry?.status).toBeNull();
			expect(entry?.loading).toBe(false);
			expect(entry?.error).toBeNull();
		});

		it('handles fetch error and stores error message', async () => {
			const errorMessage = 'Сервіс ДТЕК тимчасово недоступний';
			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(
				err(apiError('SERVER_ERROR', errorMessage))
			);

			await addressStatusStore.fetchStatus(mockAddress1);

			const entry = addressStatusStore.getStatus('addr-1');

			expect(entry?.error).toBe(errorMessage);
			expect(entry?.loading).toBe(false);
		});

		it('skips fetch if cache is fresh (not stale)', async () => {
			const mockResponse = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse));

			// First fetch
			await addressStatusStore.fetchStatus(mockAddress1);

			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(1);

			// Second fetch - should use cache
			await addressStatusStore.fetchStatus(mockAddress1);

			// Should still be called only once
			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(1);
		});

		it('refetches if cache is stale (> 5 minutes)', async () => {
			vi.useFakeTimers();

			const mockResponse1 = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			const mockResponse2 = {
				...mockResponse1,
				buildings: {
					'25/39': {
						outage: {
							type: 'emergency' as const,
							from: '14:30 17.12.2025',
							to: '23:00 17.12.2025',
						},
					},
				},
				fetchedAt: Date.now() + 6 * 60 * 1000,
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse1));

			// First fetch
			await addressStatusStore.fetchStatus(mockAddress1);

			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(1);

			// Advance time by 6 minutes (past 5-minute TTL)
			vi.advanceTimersByTime(6 * 60 * 1000);

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse2));

			// Second fetch - cache should be stale, so refetch
			await addressStatusStore.fetchStatus(mockAddress1);

			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(2);

			const entry = addressStatusStore.getStatus('addr-1');
			expect(entry?.status?.outage).toBeDefined();

			vi.useRealTimers();
		});

		it('refetches if previous fetch had error', async () => {
			// First fetch - error
			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(
				err(apiError('NETWORK_ERROR', 'Network error'))
			);

			await addressStatusStore.fetchStatus(mockAddress1);

			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(1);

			// Second fetch - should retry despite cache
			const mockResponse = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse));

			await addressStatusStore.fetchStatus(mockAddress1);

			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(2);

			const entry = addressStatusStore.getStatus('addr-1');
			expect(entry?.error).toBeNull();
			expect(entry?.status?.outage).toBeUndefined();
		});
	});

	describe('fetchAllStatuses', () => {
		it('fetches statuses for multiple addresses in parallel', async () => {
			const mockResponse1 = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': {},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			const mockResponse2 = {
				city: 'м. Одеса',
				street: 'вул. Дерибасівська',
				buildings: {
					'12': {
						outage: {
							type: 'stabilization' as const,
							from: '14:30 17.12.2025',
							to: '23:00 17.12.2025',
						},
					},
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses)
				.mockResolvedValueOnce(ok(mockResponse1))
				.mockResolvedValueOnce(ok(mockResponse2));

			await addressStatusStore.fetchAllStatuses([mockAddress1, mockAddress2]);

			expect(apiClient.fetchBuildingStatuses).toHaveBeenCalledTimes(2);

			const entry1 = addressStatusStore.getStatus('addr-1');
			const entry2 = addressStatusStore.getStatus('addr-2');

			expect(entry1?.status?.outage).toBeUndefined();
			expect(entry2?.status?.outage).toBeDefined();
		});

		it('continues fetching even if one address fails', async () => {
			vi.mocked(apiClient.fetchBuildingStatuses)
				.mockResolvedValueOnce(err(apiError('NETWORK_ERROR', 'Failed for address 1')))
				.mockResolvedValueOnce(
					ok({
						city: 'м. Одеса',
						street: 'вул. Дерибасівська',
						buildings: {
							'12': {},
						},
						schedules: {},
						fetchedAt: Date.now(),
					})
				);

			await addressStatusStore.fetchAllStatuses([mockAddress1, mockAddress2]);

			const entry1 = addressStatusStore.getStatus('addr-1');
			const entry2 = addressStatusStore.getStatus('addr-2');

			expect(entry1?.error).toBe('Failed for address 1');
			expect(entry2?.status?.outage).toBeUndefined();
		});

		it('handles empty address array', async () => {
			await addressStatusStore.fetchAllStatuses([]);

			expect(apiClient.fetchBuildingStatuses).not.toHaveBeenCalled();
		});
	});

	describe('getStatus', () => {
		it('returns status for existing address', async () => {
			const mockResponse = {
				city: 'м. Одеса',
				street: 'вул. Педагогічна',
				buildings: {
					'25/39': { group: 'GPV1.2' },
				},
				schedules: {},
				fetchedAt: Date.now(),
			};

			vi.mocked(apiClient.fetchBuildingStatuses).mockResolvedValueOnce(ok(mockResponse));

			await addressStatusStore.fetchStatus(mockAddress1);

			const status = addressStatusStore.getStatus('addr-1');

			expect(status).toBeDefined();
			expect(status?.status?.group).toBe('GPV1.2');
		});

		it('returns undefined for non-existent address', () => {
			const status = addressStatusStore.getStatus('non-existent-id');

			expect(status).toBeUndefined();
		});
	});
});
