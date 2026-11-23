/**
 * Dashboard repository - stores public dashboards in Redis
 *
 * One hash per dashboard (see ./keys.ts). Adds and removes are single atomic
 * commands, so edits to different addresses never overwrite each other.
 * Edits to the same address or to the name are last-writer-wins by design.
 * Keys never get a TTL.
 */

import { randomUUID } from 'node:crypto';
import type {
	Result,
	SavedAddress,
	Dashboard,
	DashboardMeta,
	DashboardError,
	AddressInput,
} from '$lib/types';
import { ok, err, dashboardError, DASHBOARD_MAX_ADDRESSES } from '$lib/types';
import { UI_TEXT } from '$lib/constants/ui-text';
import { getRedis } from '$lib/server/kv/client';
import {
	generateDashboardId,
	dashboardKey,
	addressField,
	isAddressField,
	META_FIELD,
} from './keys';

const MAX_ID_ATTEMPTS = 5;

interface StoredMeta {
	name: string;
	createdAt: number;
}

const notFound = () => dashboardError('NOT_FOUND', UI_TEXT.dashboardNotFound);

const storageError = (cause: unknown) => {
	console.error('[Dashboards] Redis error:', cause);
	return dashboardError('STORAGE_ERROR', UI_TEXT.dashboardStorageError, cause);
};

function parseJson<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/**
 * Create an empty dashboard under a fresh random id
 */
export async function createDashboard(name: string): Promise<Result<Dashboard, DashboardError>> {
	try {
		const redis = getRedis();
		const meta: StoredMeta = { name, createdAt: Date.now() };

		for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
			const id = generateDashboardId();
			const created = await redis.hsetnx(dashboardKey(id), META_FIELD, JSON.stringify(meta));
			if (created === 1) {
				return ok({ id, ...meta, addresses: [] });
			}
		}

		return err(storageError(new Error('Could not allocate a unique dashboard id')));
	} catch (cause) {
		return err(storageError(cause));
	}
}

/**
 * Read a dashboard with its addresses (sorted by creation time)
 */
export async function getDashboard(id: string): Promise<Result<Dashboard, DashboardError>> {
	try {
		const fields = await getRedis().hgetall(dashboardKey(id));
		const meta = fields[META_FIELD] ? parseJson<StoredMeta>(fields[META_FIELD]) : null;
		if (!meta) return err(notFound());

		const addresses: SavedAddress[] = [];
		for (const [field, raw] of Object.entries(fields)) {
			if (!isAddressField(field)) continue;
			const address = parseJson<SavedAddress>(raw);
			if (!address) {
				console.error(`[Dashboards] Skipping corrupt field ${field} in dashboard ${id}`);
				continue;
			}
			addresses.push(address);
		}
		addresses.sort((a, b) => a.createdAt - b.createdAt);

		return ok({ id, name: meta.name, createdAt: meta.createdAt, addresses });
	} catch (cause) {
		return err(storageError(cause));
	}
}

/**
 * Rename a dashboard
 */
export async function renameDashboard(
	id: string,
	name: string
): Promise<Result<DashboardMeta, DashboardError>> {
	try {
		const redis = getRedis();
		const key = dashboardKey(id);

		const raw = await redis.hget(key, META_FIELD);
		const meta = raw ? parseJson<StoredMeta>(raw) : null;
		if (!meta) return err(notFound());

		const updated: StoredMeta = { name, createdAt: meta.createdAt };
		await redis.hset(key, META_FIELD, JSON.stringify(updated));

		return ok({ id, ...updated });
	} catch (cause) {
		return err(storageError(cause));
	}
}

/**
 * Add an address; the server assigns its id and creation time
 */
export async function addDashboardAddress(
	id: string,
	input: AddressInput
): Promise<Result<SavedAddress, DashboardError>> {
	try {
		const redis = getRedis();
		const key = dashboardKey(id);

		if (!(await redis.hexists(key, META_FIELD))) return err(notFound());

		// Hash holds the meta field plus one field per address
		const fieldCount = await redis.hlen(key);
		if (fieldCount - 1 >= DASHBOARD_MAX_ADDRESSES) {
			return err(dashboardError('LIMIT_REACHED', UI_TEXT.dashboardLimitReached));
		}

		const address: SavedAddress = { ...input, id: randomUUID(), createdAt: Date.now() };
		await redis.hset(key, addressField(address.id), JSON.stringify(address));

		return ok(address);
	} catch (cause) {
		return err(storageError(cause));
	}
}

/**
 * Replace an address's fields, keeping its id and creation time
 */
export async function updateDashboardAddress(
	id: string,
	addressId: string,
	input: AddressInput
): Promise<Result<SavedAddress, DashboardError>> {
	try {
		const redis = getRedis();
		const key = dashboardKey(id);
		const field = addressField(addressId);

		if (!(await redis.hexists(key, META_FIELD))) return err(notFound());

		const raw = await redis.hget(key, field);
		const existing = raw ? parseJson<SavedAddress>(raw) : null;
		if (!existing) return err(notFound());

		const address: SavedAddress = { ...input, id: existing.id, createdAt: existing.createdAt };
		await redis.hset(key, field, JSON.stringify(address));

		return ok(address);
	} catch (cause) {
		return err(storageError(cause));
	}
}

/**
 * Remove an address; succeeds when it is already gone
 */
export async function removeDashboardAddress(
	id: string,
	addressId: string
): Promise<Result<void, DashboardError>> {
	try {
		const redis = getRedis();
		const key = dashboardKey(id);

		if (!(await redis.hexists(key, META_FIELD))) return err(notFound());

		await redis.hdel(key, addressField(addressId));
		return ok(undefined);
	} catch (cause) {
		return err(storageError(cause));
	}
}
