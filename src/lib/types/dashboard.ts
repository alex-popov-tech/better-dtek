import type { SavedAddress } from './address.js';

/** Length of a dashboard id (lowercase letters and digits) */
export const DASHBOARD_ID_LENGTH = 10;
/** Max length of a dashboard name after trimming */
export const DASHBOARD_NAME_MAX = 60;
/** Max length of an address label inside a dashboard */
export const DASHBOARD_LABEL_MAX = 60;
/** Max number of addresses in one dashboard */
export const DASHBOARD_MAX_ADDRESSES = 20;

/**
 * Dashboard without its addresses
 */
export interface DashboardMeta {
	/** Short random id, also the URL path */
	id: string;
	name: string;
	/** Unix timestamp (ms) when the dashboard was created */
	createdAt: number;
}

/**
 * Public dashboard: a named, server-stored list of addresses
 */
export interface Dashboard extends DashboardMeta {
	/** Sorted by createdAt ascending */
	addresses: SavedAddress[];
}

/** Address fields supplied by a client; id and createdAt are assigned by the server */
export type AddressInput = Omit<SavedAddress, 'id' | 'createdAt'>;

export type DashboardErrorCode = 'NOT_FOUND' | 'LIMIT_REACHED' | 'STORAGE_ERROR';

export interface DashboardError {
	readonly code: DashboardErrorCode;
	readonly message: string;
	readonly cause?: unknown;
}

export const dashboardError = (
	code: DashboardErrorCode,
	message: string,
	cause?: unknown
): DashboardError => ({ code, message, cause });
