import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	generateDashboardId,
	dashboardKey,
	dashboardKeyPrefix,
	addressField,
	isAddressField,
	META_FIELD,
} from '$lib/server/dashboards/keys';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('generateDashboardId', () => {
	it('generates ids that match the id format', () => {
		for (let i = 0; i < 200; i++) expect(generateDashboardId()).toMatch(/^[a-z0-9]{10}$/);
	});

	it('generates different ids', () => {
		expect(generateDashboardId()).not.toBe(generateDashboardId());
	});
});

describe('dashboard keys', () => {
	it('uses the production prefix when VERCEL_ENV is production', () => {
		vi.stubEnv('VERCEL_ENV', 'production');
		expect(dashboardKey('234hldch72')).toBe('dashboard:234hldch72');
	});

	it('uses the dev prefix on preview deployments', () => {
		vi.stubEnv('VERCEL_ENV', 'preview');
		expect(dashboardKey('234hldch72')).toBe('dashboard-dev:234hldch72');
	});

	it('uses the dev prefix when VERCEL_ENV is unset', () => {
		vi.stubEnv('VERCEL_ENV', '');
		expect(dashboardKeyPrefix()).toBe('dashboard-dev:');
	});

	it('builds and recognises address fields', () => {
		expect(addressField('u1')).toBe('addr:u1');
		expect(isAddressField('addr:u1')).toBe(true);
		expect(isAddressField(META_FIELD)).toBe(false);
	});
});
