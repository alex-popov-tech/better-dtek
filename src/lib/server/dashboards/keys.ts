/**
 * Redis key and id helpers for public dashboards
 *
 * Each dashboard is one hash:
 *   {prefix}{id}
 *     meta        -> JSON { name, createdAt }
 *     addr:{uuid} -> JSON SavedAddress
 *
 * The prefix is `dashboard:` on the Vercel production deployment and
 * `dashboard-dev:` everywhere else, because local dev and previews may share
 * the production database and dashboards cannot be deleted.
 */

import { randomInt } from 'node:crypto';
import { DASHBOARD_ID_LENGTH } from '$lib/types/dashboard';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Hash field holding the dashboard name and creation time */
export const META_FIELD = 'meta';

const ADDRESS_FIELD_PREFIX = 'addr:';

/** Generate a random dashboard id */
export function generateDashboardId(): string {
	let id = '';
	for (let i = 0; i < DASHBOARD_ID_LENGTH; i++) {
		id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
	}
	return id;
}

/** Key prefix for the current environment (read at call time) */
export function dashboardKeyPrefix(): string {
	return process.env.VERCEL_ENV === 'production' ? 'dashboard:' : 'dashboard-dev:';
}

/** Redis key of a dashboard hash */
export function dashboardKey(id: string): string {
	return `${dashboardKeyPrefix()}${id}`;
}

/** Hash field of one address */
export function addressField(addressId: string): string {
	return `${ADDRESS_FIELD_PREFIX}${addressId}`;
}

export function isAddressField(field: string): boolean {
	return field.startsWith(ADDRESS_FIELD_PREFIX);
}
