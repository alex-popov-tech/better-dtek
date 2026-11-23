/**
 * Store for one open public dashboard
 *
 * Offers the same add / update / remove operations as the local addresses
 * store, but each one calls the API and the state changes only after the
 * server confirms (not optimistically), so what is shown is what is stored.
 */

import { writable, get } from 'svelte/store';
import type { Readable } from 'svelte/store';
import type { Dashboard, AddressInput } from '$lib/types/dashboard';
import type { Result } from '$lib/types/result';
import type { ApiError } from '$lib/types/errors';
import { ok } from '$lib/types/result';
import {
	fetchDashboard,
	renameDashboard,
	addDashboardAddress,
	updateDashboardAddress,
	removeDashboardAddress,
} from '$lib/utils/dashboard-api';
import { dashboardsStore } from './dashboards';

export interface DashboardStore extends Readable<Dashboard> {
	add(input: AddressInput): Promise<Result<void, ApiError>>;
	update(addressId: string, input: AddressInput): Promise<Result<void, ApiError>>;
	remove(addressId: string): Promise<Result<void, ApiError>>;
	rename(name: string): Promise<Result<void, ApiError>>;
	/** Re-read the dashboard from the server to pick up other people's edits */
	reload(): Promise<Result<void, ApiError>>;
}

export function createDashboardStore(initial: Dashboard): DashboardStore {
	const store = writable<Dashboard>(initial);
	const { subscribe, update, set } = store;
	const id = initial.id;

	return {
		subscribe,

		async add(input) {
			const result = await addDashboardAddress(id, input);
			if (!result.ok) return result;

			update((d) => ({ ...d, addresses: [...d.addresses, result.value] }));
			return ok(undefined);
		},

		async update(addressId, input) {
			const result = await updateDashboardAddress(id, addressId, input);
			if (!result.ok) return result;

			update((d) => ({
				...d,
				addresses: d.addresses.map((a) => (a.id === addressId ? result.value : a)),
			}));
			return ok(undefined);
		},

		async remove(addressId) {
			const result = await removeDashboardAddress(id, addressId);
			if (!result.ok) return result;

			update((d) => ({ ...d, addresses: d.addresses.filter((a) => a.id !== addressId) }));
			return ok(undefined);
		},

		async rename(name) {
			const result = await renameDashboard(id, name);
			if (!result.ok) return result;

			update((d) => ({ ...d, name: result.value.name }));
			dashboardsStore.remember({ id, name: get(store).name });
			return ok(undefined);
		},

		async reload() {
			const result = await fetchDashboard(id);
			if (!result.ok) return result;

			set(result.value);
			return ok(undefined);
		},
	};
}
