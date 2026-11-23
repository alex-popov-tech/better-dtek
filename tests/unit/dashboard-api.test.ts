import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ok, err, dashboardError } from '$lib/types';
import type { Dashboard, SavedAddress } from '$lib/types';

vi.mock('$lib/server/dashboards/repository', () => ({
	createDashboard: vi.fn(),
	getDashboard: vi.fn(),
	renameDashboard: vi.fn(),
	addDashboardAddress: vi.fn(),
	updateDashboardAddress: vi.fn(),
	removeDashboardAddress: vi.fn(),
}));

vi.mock('$lib/server/sentry', () => ({
	isSentryEnabled: () => false,
}));

import * as repo from '$lib/server/dashboards/repository';
import { POST as createHandler } from '../../src/routes/api/dashboards/+server';
import {
	GET as getHandler,
	PATCH as renameHandler,
} from '../../src/routes/api/dashboards/[id]/+server';
import { POST as addAddressHandler } from '../../src/routes/api/dashboards/[id]/addresses/+server';
import {
	PUT as updateAddressHandler,
	DELETE as deleteAddressHandler,
} from '../../src/routes/api/dashboards/[id]/addresses/[addressId]/+server';

const ID = '234hldch72';
const ADDRESS_ID = '0b0e4f0e-1111-4222-8333-444455556666';

const addressBody = {
	region: 'kem',
	city: 'м. Київ',
	street: 'вул. Хрещатик',
	building: '1',
	label: 'Сашко',
};

const address: SavedAddress = { ...addressBody, region: 'kem', id: ADDRESS_ID, createdAt: 1 };
const dashboard: Dashboard = { id: ID, name: 'Геймери', createdAt: 1, addresses: [] };

type Handler = (event: never) => Response | Promise<Response>;

/** Call a route handler with a minimal request event */
function call(
	handler: Handler,
	options: { method?: string; body?: unknown; rawBody?: string; params?: Record<string, string> }
): Promise<Response> {
	const { method = 'GET', body, rawBody, params = {} } = options;
	const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
	const request = new Request('http://localhost/api/dashboards', {
		method,
		body: payload,
		headers: payload ? { 'content-type': 'application/json' } : undefined,
	});
	return Promise.resolve(handler({ request, params, url: new URL(request.url) } as never));
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/dashboards', () => {
	it('returns 201 and the dashboard, passing the trimmed name', async () => {
		vi.mocked(repo.createDashboard).mockResolvedValue(ok(dashboard));

		const response = await call(createHandler, { method: 'POST', body: { name: ' Геймери ' } });

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual(dashboard);
		expect(repo.createDashboard).toHaveBeenCalledWith('Геймери');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});

	it('returns 400 VALIDATION_ERROR for a body that is not valid JSON', async () => {
		const response = await call(createHandler, { method: 'POST', rawBody: '{oops' });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('VALIDATION_ERROR');
		expect(repo.createDashboard).not.toHaveBeenCalled();
	});

	it('returns 400 for a whitespace-only name', async () => {
		const response = await call(createHandler, { method: 'POST', body: { name: '   ' } });

		expect(response.status).toBe(400);
		expect(repo.createDashboard).not.toHaveBeenCalled();
	});

	it('returns 503 STORAGE_ERROR when storage fails', async () => {
		vi.mocked(repo.createDashboard).mockResolvedValue(
			err(dashboardError('STORAGE_ERROR', 'помилка'))
		);

		const response = await call(createHandler, { method: 'POST', body: { name: 'Геймери' } });

		expect(response.status).toBe(503);
		expect((await response.json()).error).toBe('STORAGE_ERROR');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});

describe('GET /api/dashboards/[id]', () => {
	it('returns 200 and the dashboard', async () => {
		vi.mocked(repo.getDashboard).mockResolvedValue(ok(dashboard));

		const response = await call(getHandler, { params: { id: ID } });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(dashboard);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});

	it('returns 404 NOT_FOUND for an unknown id', async () => {
		vi.mocked(repo.getDashboard).mockResolvedValue(err(dashboardError('NOT_FOUND', 'нема')));

		const response = await call(getHandler, { params: { id: ID } });

		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe('NOT_FOUND');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});

	it('returns 404 for a malformed id without calling the repository', async () => {
		const response = await call(getHandler, { params: { id: 'ABC' } });

		expect(response.status).toBe(404);
		expect(repo.getDashboard).not.toHaveBeenCalled();
	});
});

describe('PATCH /api/dashboards/[id]', () => {
	it('returns 200 and the renamed meta', async () => {
		const meta = { id: ID, name: 'Родина', createdAt: 1 };
		vi.mocked(repo.renameDashboard).mockResolvedValue(ok(meta));

		const response = await call(renameHandler, {
			method: 'PATCH',
			body: { name: 'Родина' },
			params: { id: ID },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(meta);
		expect(repo.renameDashboard).toHaveBeenCalledWith(ID, 'Родина');
	});

	it('returns 400 for a 61-char name', async () => {
		const response = await call(renameHandler, {
			method: 'PATCH',
			body: { name: 'а'.repeat(61) },
			params: { id: ID },
		});

		expect(response.status).toBe(400);
		expect(repo.renameDashboard).not.toHaveBeenCalled();
	});
});

describe('POST /api/dashboards/[id]/addresses', () => {
	it('returns 201 and the stored address', async () => {
		vi.mocked(repo.addDashboardAddress).mockResolvedValue(ok(address));

		const response = await call(addAddressHandler, {
			method: 'POST',
			body: addressBody,
			params: { id: ID },
		});

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual(address);
		expect(repo.addDashboardAddress).toHaveBeenCalledWith(ID, addressBody);
	});

	it('returns 409 LIMIT_REACHED at the cap', async () => {
		vi.mocked(repo.addDashboardAddress).mockResolvedValue(
			err(dashboardError('LIMIT_REACHED', 'максимум'))
		);

		const response = await call(addAddressHandler, {
			method: 'POST',
			body: addressBody,
			params: { id: ID },
		});

		expect(response.status).toBe(409);
		expect((await response.json()).error).toBe('LIMIT_REACHED');
	});

	it('returns 400 when a required field is missing', async () => {
		const response = await call(addAddressHandler, {
			method: 'POST',
			body: { region: 'kem', city: 'м. Київ' },
			params: { id: ID },
		});

		expect(response.status).toBe(400);
		expect(repo.addDashboardAddress).not.toHaveBeenCalled();
	});
});

describe('PUT /api/dashboards/[id]/addresses/[addressId]', () => {
	it('returns 200 and the stored address', async () => {
		vi.mocked(repo.updateDashboardAddress).mockResolvedValue(ok(address));

		const response = await call(updateAddressHandler, {
			method: 'PUT',
			body: addressBody,
			params: { id: ID, addressId: ADDRESS_ID },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(address);
		expect(repo.updateDashboardAddress).toHaveBeenCalledWith(ID, ADDRESS_ID, addressBody);
	});

	it('returns 404 when the address is missing', async () => {
		vi.mocked(repo.updateDashboardAddress).mockResolvedValue(
			err(dashboardError('NOT_FOUND', 'нема'))
		);

		const response = await call(updateAddressHandler, {
			method: 'PUT',
			body: addressBody,
			params: { id: ID, addressId: ADDRESS_ID },
		});

		expect(response.status).toBe(404);
	});
});

describe('DELETE /api/dashboards/[id]/addresses/[addressId]', () => {
	it('returns 204 with an empty body', async () => {
		vi.mocked(repo.removeDashboardAddress).mockResolvedValue(ok(undefined));

		const response = await call(deleteAddressHandler, {
			method: 'DELETE',
			params: { id: ID, addressId: ADDRESS_ID },
		});

		expect(response.status).toBe(204);
		expect(await response.text()).toBe('');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(repo.removeDashboardAddress).toHaveBeenCalledWith(ID, ADDRESS_ID);
	});

	it('returns 404 for a malformed dashboard id without calling the repository', async () => {
		const response = await call(deleteAddressHandler, {
			method: 'DELETE',
			params: { id: 'nope', addressId: ADDRESS_ID },
		});

		expect(response.status).toBe(404);
		expect(repo.removeDashboardAddress).not.toHaveBeenCalled();
	});
});
