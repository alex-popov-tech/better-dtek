import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { ok, err, apiError } from '$lib/types';
import type { Dashboard, SavedAddress, AddressInput } from '$lib/types';

vi.mock('$lib/utils/dashboard-api', () => ({
	createDashboard: vi.fn(),
	fetchDashboard: vi.fn(),
	renameDashboard: vi.fn(),
	addDashboardAddress: vi.fn(),
	updateDashboardAddress: vi.fn(),
	removeDashboardAddress: vi.fn(),
}));

vi.mock('$lib/stores/dashboards', () => ({
	dashboardsStore: { remember: vi.fn(), forget: vi.fn(), subscribe: vi.fn() },
}));

import * as api from '$lib/utils/dashboard-api';
import { dashboardsStore } from '$lib/stores/dashboards';
import { createDashboardStore } from '$lib/stores/dashboard';

const ID = '234hldch72';

const input: AddressInput = {
	region: 'kem',
	city: 'м. Київ',
	street: 'вул. Хрещатик',
	building: '1',
	label: 'Сашко',
};

const first: SavedAddress = { ...input, id: 'a', createdAt: 100 };
const second: SavedAddress = { ...input, id: 'b', createdAt: 200, label: 'Діма' };

const initial: Dashboard = { id: ID, name: 'Геймери', createdAt: 1, addresses: [first] };

beforeEach(() => {
	vi.resetAllMocks();
});

describe('createDashboardStore', () => {
	it('starts with the given dashboard', () => {
		const store = createDashboardStore(initial);
		expect(get(store)).toEqual(initial);
	});

	it('add appends the server-returned address', async () => {
		vi.mocked(api.addDashboardAddress).mockResolvedValue(ok(second));
		const store = createDashboardStore(initial);

		const result = await store.add(input);

		expect(result.ok).toBe(true);
		expect(api.addDashboardAddress).toHaveBeenCalledWith(ID, input);
		expect(get(store).addresses).toEqual([first, second]);
	});

	it('add leaves state untouched and returns the error on failure', async () => {
		const failure = apiError('LIMIT_REACHED', 'максимум', 409);
		vi.mocked(api.addDashboardAddress).mockResolvedValue(err(failure));
		const store = createDashboardStore(initial);

		const result = await store.add(input);

		expect(result).toEqual({ ok: false, error: failure });
		expect(get(store)).toEqual(initial);
	});

	it('update replaces the matching address', async () => {
		const changed: SavedAddress = { ...first, building: '7' };
		vi.mocked(api.updateDashboardAddress).mockResolvedValue(ok(changed));
		const store = createDashboardStore({ ...initial, addresses: [first, second] });

		const result = await store.update('a', { ...input, building: '7' });

		expect(result.ok).toBe(true);
		expect(api.updateDashboardAddress).toHaveBeenCalledWith(ID, 'a', { ...input, building: '7' });
		expect(get(store).addresses).toEqual([changed, second]);
	});

	it('remove drops the address', async () => {
		vi.mocked(api.removeDashboardAddress).mockResolvedValue(ok(undefined));
		const store = createDashboardStore({ ...initial, addresses: [first, second] });

		const result = await store.remove('a');

		expect(result.ok).toBe(true);
		expect(api.removeDashboardAddress).toHaveBeenCalledWith(ID, 'a');
		expect(get(store).addresses).toEqual([second]);
	});

	it('remove keeps the address when the server fails', async () => {
		vi.mocked(api.removeDashboardAddress).mockResolvedValue(
			err(apiError('NETWORK_ERROR', 'мережа'))
		);
		const store = createDashboardStore(initial);

		const result = await store.remove('a');

		expect(result.ok).toBe(false);
		expect(get(store).addresses).toEqual([first]);
	});

	it('rename updates the name and remembers it', async () => {
		vi.mocked(api.renameDashboard).mockResolvedValue(ok({ id: ID, name: 'Родина', createdAt: 1 }));
		const store = createDashboardStore(initial);

		const result = await store.rename('Родина');

		expect(result.ok).toBe(true);
		expect(get(store).name).toBe('Родина');
		expect(get(store).addresses).toEqual([first]);
		expect(dashboardsStore.remember).toHaveBeenCalledWith({ id: ID, name: 'Родина' });
	});

	it('reload replaces name and addresses with the server copy', async () => {
		const server: Dashboard = { id: ID, name: 'Нова назва', createdAt: 1, addresses: [second] };
		vi.mocked(api.fetchDashboard).mockResolvedValue(ok(server));
		const store = createDashboardStore(initial);

		const result = await store.reload();

		expect(result.ok).toBe(true);
		expect(get(store)).toEqual(server);
	});

	it('reload keeps the current state when the server fails', async () => {
		vi.mocked(api.fetchDashboard).mockResolvedValue(err(apiError('SERVER_ERROR', 'помилка')));
		const store = createDashboardStore(initial);

		const result = await store.reload();

		expect(result.ok).toBe(false);
		expect(get(store)).toEqual(initial);
	});
});
