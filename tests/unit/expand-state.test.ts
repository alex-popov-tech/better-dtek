import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import {
	getScheduleExpandState,
	setScheduleExpandState,
	clearScheduleExpandState,
} from '$lib/stores/addresses';

beforeEach(() => {
	localStorageMock.clear();
});

describe('clearScheduleExpandState', () => {
	it('drops the saved state so the address falls back to defaults', () => {
		setScheduleExpandState('addr-1', { todayExpanded: false, tomorrowExpanded: true });
		expect(getScheduleExpandState('addr-1')).toEqual({
			todayExpanded: false,
			tomorrowExpanded: true,
		});

		clearScheduleExpandState('addr-1');

		expect(getScheduleExpandState('addr-1')).toEqual({
			todayExpanded: true,
			tomorrowExpanded: false,
		});
		const stored = JSON.parse(localStorageMock.getItem('dtek-addresses')!);
		expect(stored.uiState['addr-1']).toBeUndefined();
	});

	it('leaves other addresses untouched and does nothing for an unknown id', () => {
		setScheduleExpandState('addr-2', { todayExpanded: false, tomorrowExpanded: false });

		clearScheduleExpandState('unknown');

		expect(getScheduleExpandState('addr-2')).toEqual({
			todayExpanded: false,
			tomorrowExpanded: false,
		});
	});
});
