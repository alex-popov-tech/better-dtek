import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
	};
})();

vi.stubGlobal('localStorage', localStorageMock);

const KEY = 'dtek-dashboards';

/** Load a fresh copy of the store so it re-reads localStorage */
async function loadStore() {
	vi.resetModules();
	const module = await import('$lib/stores/dashboards');
	return module.dashboardsStore;
}

beforeEach(() => {
	localStorageMock.clear();
	vi.useRealTimers();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('dashboardsStore', () => {
	it('starts empty', async () => {
		const store = await loadStore();
		expect(get(store)).toEqual([]);
	});

	it('remember adds an entry and persists a version-1 envelope', async () => {
		const store = await loadStore();

		store.remember({ id: '234hldch72', name: 'Геймери' });

		expect(get(store)).toMatchObject([{ id: '234hldch72', name: 'Геймери' }]);
		const stored = JSON.parse(localStorageMock.getItem(KEY)!);
		expect(stored.version).toBe(1);
		expect(stored.data).toMatchObject([{ id: '234hldch72', name: 'Геймери' }]);
		expect(typeof stored.data[0].lastVisitedAt).toBe('number');
	});

	it('survives a reload', async () => {
		const first = await loadStore();
		first.remember({ id: '234hldch72', name: 'Геймери' });

		const second = await loadStore();

		expect(get(second)).toMatchObject([{ id: '234hldch72', name: 'Геймери' }]);
	});

	it('remember on an existing id updates the name and moves it to the top', async () => {
		vi.useFakeTimers();
		const store = await loadStore();
		vi.setSystemTime(1000);
		store.remember({ id: 'aaaaaaaaaa', name: 'Перший' });
		vi.setSystemTime(2000);
		store.remember({ id: 'bbbbbbbbbb', name: 'Другий' });
		expect(get(store).map((d) => d.id)).toEqual(['bbbbbbbbbb', 'aaaaaaaaaa']);

		vi.setSystemTime(3000);
		store.remember({ id: 'aaaaaaaaaa', name: 'Перейменований' });

		expect(get(store)).toEqual([
			{ id: 'aaaaaaaaaa', name: 'Перейменований', lastVisitedAt: 3000 },
			{ id: 'bbbbbbbbbb', name: 'Другий', lastVisitedAt: 2000 },
		]);
	});

	it('forget removes the entry and persists', async () => {
		const store = await loadStore();
		store.remember({ id: 'aaaaaaaaaa', name: 'Перший' });
		store.remember({ id: 'bbbbbbbbbb', name: 'Другий' });

		store.forget('aaaaaaaaaa');

		expect(get(store).map((d) => d.id)).toEqual(['bbbbbbbbbb']);
		expect(JSON.parse(localStorageMock.getItem(KEY)!).data).toHaveLength(1);
	});

	it.each([
		'not json',
		'[]',
		'null',
		'{"version":2,"data":[]}',
		'{"version":1,"data":"x"}',
		'{"data":[]}',
	])('loads %s as an empty list', async (raw) => {
		localStorageMock.setItem(KEY, raw);

		const store = await loadStore();

		expect(get(store)).toEqual([]);
	});

	it('drops malformed entries on load and keeps valid ones', async () => {
		localStorageMock.setItem(
			KEY,
			JSON.stringify({
				version: 1,
				data: [
					{ id: 'BAD', name: 'Поганий', lastVisitedAt: 1 },
					{ id: 'aaaaaaaaaa', name: 'Добрий', lastVisitedAt: 2 },
					{ id: 'bbbbbbbbbb', lastVisitedAt: 3 },
					null,
				],
			})
		);

		const store = await loadStore();

		expect(get(store)).toEqual([{ id: 'aaaaaaaaaa', name: 'Добрий', lastVisitedAt: 2 }]);
	});
});
