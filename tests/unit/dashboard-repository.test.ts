import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AddressInput } from '$lib/types';

/**
 * In-memory stand-in for the Redis hash commands the repository uses
 */
function createFakeRedis() {
	const data = new Map<string, Map<string, string>>();
	const hash = (key: string) => data.get(key);

	return {
		data,
		hsetnx: vi.fn(async (key: string, field: string, value: string) => {
			const h = hash(key) ?? new Map<string, string>();
			if (h.has(field)) return 0;
			h.set(field, value);
			data.set(key, h);
			return 1;
		}),
		hset: vi.fn(async (key: string, field: string, value: string) => {
			const h = hash(key) ?? new Map<string, string>();
			const isNew = h.has(field) ? 0 : 1;
			h.set(field, value);
			data.set(key, h);
			return isNew;
		}),
		hget: vi.fn(async (key: string, field: string) => hash(key)?.get(field) ?? null),
		hgetall: vi.fn(async (key: string) => Object.fromEntries(hash(key) ?? [])),
		hexists: vi.fn(async (key: string, field: string) => (hash(key)?.has(field) ? 1 : 0)),
		hlen: vi.fn(async (key: string) => hash(key)?.size ?? 0),
		hdel: vi.fn(async (key: string, field: string) => (hash(key)?.delete(field) ? 1 : 0)),
		expire: vi.fn(async () => 1),
	};
}

let fake = createFakeRedis();

vi.mock('$lib/server/kv/client', () => ({
	getRedis: () => fake,
}));

import {
	createDashboard,
	getDashboard,
	renameDashboard,
	addDashboardAddress,
	updateDashboardAddress,
	removeDashboardAddress,
} from '$lib/server/dashboards/repository';
import { dashboardKey } from '$lib/server/dashboards/keys';

const input: AddressInput = {
	region: 'kem',
	city: 'м. Київ',
	street: 'вул. Хрещатик',
	building: '1',
	label: 'Сашко',
};

async function setupDashboard(name = 'Геймери') {
	const created = await createDashboard(name);
	if (!created.ok) throw new Error('setup failed');
	return created.value;
}

beforeEach(() => {
	fake = createFakeRedis();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('createDashboard', () => {
	it('creates an empty dashboard with a valid id and the given name', async () => {
		const result = await createDashboard('Геймери');

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.id).toMatch(/^[a-z0-9]{10}$/);
		expect(result.value.name).toBe('Геймери');
		expect(result.value.addresses).toEqual([]);
		expect(fake.data.has(dashboardKey(result.value.id))).toBe(true);
	});

	it('never sets an expiry', async () => {
		await createDashboard('Геймери');
		expect(fake.expire).not.toHaveBeenCalled();
	});

	it('retries with a new id on collision', async () => {
		fake.hsetnx.mockResolvedValueOnce(0);

		const result = await createDashboard('Геймери');

		expect(result.ok).toBe(true);
		expect(fake.hsetnx).toHaveBeenCalledTimes(2);
		expect(fake.hsetnx.mock.calls[0][0]).not.toBe(fake.hsetnx.mock.calls[1][0]);
	});

	it('gives up with STORAGE_ERROR after 5 collisions', async () => {
		fake.hsetnx.mockResolvedValue(0);

		const result = await createDashboard('Геймери');

		expect(!result.ok && result.error.code).toBe('STORAGE_ERROR');
		expect(fake.hsetnx).toHaveBeenCalledTimes(5);
	});

	it('returns STORAGE_ERROR when Redis throws', async () => {
		fake.hsetnx.mockRejectedValueOnce(new Error('boom'));

		const result = await createDashboard('Геймери');

		expect(!result.ok && result.error.code).toBe('STORAGE_ERROR');
	});
});

describe('getDashboard', () => {
	it('returns NOT_FOUND for an unknown id', async () => {
		const result = await getDashboard('zzzzzzzzzz');
		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
	});

	it('returns addresses sorted by createdAt ascending', async () => {
		const dashboard = await setupDashboard();
		const h = fake.data.get(dashboardKey(dashboard.id))!;
		h.set('addr:b', JSON.stringify({ ...input, id: 'b', createdAt: 200 }));
		h.set('addr:a', JSON.stringify({ ...input, id: 'a', createdAt: 100 }));

		const result = await getDashboard(dashboard.id);

		expect(result.ok && result.value.addresses.map((a) => a.id)).toEqual(['a', 'b']);
		expect(result.ok && result.value.name).toBe('Геймери');
	});

	it('skips a corrupt address field and still returns the dashboard', async () => {
		const dashboard = await setupDashboard();
		fake.data.get(dashboardKey(dashboard.id))!.set('addr:bad', '{not json');

		const result = await getDashboard(dashboard.id);

		expect(result.ok && result.value.addresses).toEqual([]);
	});

	it('returns STORAGE_ERROR when Redis throws', async () => {
		fake.hgetall.mockRejectedValueOnce(new Error('boom'));

		const result = await getDashboard('zzzzzzzzzz');

		expect(!result.ok && result.error.code).toBe('STORAGE_ERROR');
	});
});

describe('renameDashboard', () => {
	it('changes the name and keeps createdAt', async () => {
		const dashboard = await setupDashboard();

		const result = await renameDashboard(dashboard.id, 'Родина');

		expect(result.ok && result.value).toEqual({
			id: dashboard.id,
			name: 'Родина',
			createdAt: dashboard.createdAt,
		});
		const reread = await getDashboard(dashboard.id);
		expect(reread.ok && reread.value.name).toBe('Родина');
	});

	it('returns NOT_FOUND and writes nothing for an unknown dashboard', async () => {
		const result = await renameDashboard('zzzzzzzzzz', 'Родина');

		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
		expect(fake.hset).not.toHaveBeenCalled();
	});
});

describe('addDashboardAddress', () => {
	it('stores the address with a server-assigned id and createdAt', async () => {
		const dashboard = await setupDashboard();

		const result = await addDashboardAddress(dashboard.id, input);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toMatchObject(input);
		expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(typeof result.value.createdAt).toBe('number');

		const reread = await getDashboard(dashboard.id);
		expect(reread.ok && reread.value.addresses).toEqual([result.value]);
	});

	it('does not create a hash when adding to an unknown dashboard', async () => {
		const result = await addDashboardAddress('zzzzzzzzzz', input);

		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
		expect(fake.hset).not.toHaveBeenCalled();
		expect(fake.data.size).toBe(0);
	});

	it('accepts 20 addresses and rejects the 21st', async () => {
		const dashboard = await setupDashboard();
		for (let i = 0; i < 20; i++) {
			const added = await addDashboardAddress(dashboard.id, input);
			expect(added.ok).toBe(true);
		}

		const result = await addDashboardAddress(dashboard.id, input);

		expect(!result.ok && result.error.code).toBe('LIMIT_REACHED');
		const reread = await getDashboard(dashboard.id);
		expect(reread.ok && reread.value.addresses).toHaveLength(20);
	});
});

describe('updateDashboardAddress', () => {
	it('replaces the fields and keeps id and createdAt', async () => {
		const dashboard = await setupDashboard();
		const added = await addDashboardAddress(dashboard.id, input);
		if (!added.ok) throw new Error('setup failed');

		const result = await updateDashboardAddress(dashboard.id, added.value.id, {
			region: 'oem',
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			building: '25',
		});

		expect(result.ok && result.value).toEqual({
			id: added.value.id,
			createdAt: added.value.createdAt,
			region: 'oem',
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			building: '25',
		});
	});

	it('returns NOT_FOUND for a missing address and writes nothing', async () => {
		const dashboard = await setupDashboard();
		fake.hset.mockClear();

		const result = await updateDashboardAddress(dashboard.id, 'missing', input);

		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
		expect(fake.hset).not.toHaveBeenCalled();
	});

	it('returns NOT_FOUND for an unknown dashboard', async () => {
		const result = await updateDashboardAddress('zzzzzzzzzz', 'a', input);
		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
	});
});

describe('removeDashboardAddress', () => {
	it('removes the address', async () => {
		const dashboard = await setupDashboard();
		const added = await addDashboardAddress(dashboard.id, input);
		if (!added.ok) throw new Error('setup failed');

		const result = await removeDashboardAddress(dashboard.id, added.value.id);

		expect(result.ok).toBe(true);
		const reread = await getDashboard(dashboard.id);
		expect(reread.ok && reread.value.addresses).toEqual([]);
	});

	it('succeeds when the address is already gone', async () => {
		const dashboard = await setupDashboard();
		const result = await removeDashboardAddress(dashboard.id, 'missing');
		expect(result.ok).toBe(true);
	});

	it('returns NOT_FOUND for an unknown dashboard', async () => {
		const result = await removeDashboardAddress('zzzzzzzzzz', 'a');
		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
	});
});
