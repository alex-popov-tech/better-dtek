import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	createDashboard,
	fetchDashboard,
	renameDashboard,
	addDashboardAddress,
	updateDashboardAddress,
	removeDashboardAddress,
} from '$lib/utils/dashboard-api';
import type { AddressInput } from '$lib/types';

const ID = '234hldch72';
const input: AddressInput = {
	region: 'kem',
	city: 'м. Київ',
	street: 'вул. Хрещатик',
	building: '1',
};

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('dashboard API client', () => {
	it('createDashboard posts the name and returns the dashboard', async () => {
		const dashboard = { id: ID, name: 'Геймери', createdAt: 1, addresses: [] };
		fetchMock.mockResolvedValue(jsonResponse(dashboard, 201));

		const result = await createDashboard('Геймери');

		expect(result).toEqual({ ok: true, value: dashboard });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/dashboards');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ name: 'Геймери' });
	});

	it('fetchDashboard maps 404 to NOT_FOUND', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'NOT_FOUND', message: 'нема' }, 404));

		const result = await fetchDashboard(ID);

		expect(!result.ok && result.error.code).toBe('NOT_FOUND');
		expect(!result.ok && result.error.httpStatus).toBe(404);
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/dashboards/${ID}`);
	});

	it('addDashboardAddress maps 409 to LIMIT_REACHED', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'LIMIT_REACHED', message: 'макс' }, 409));

		const result = await addDashboardAddress(ID, input);

		expect(!result.ok && result.error.code).toBe('LIMIT_REACHED');
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/dashboards/${ID}/addresses`);
	});

	it('renameDashboard maps 400 to VALIDATION_ERROR and sends PATCH', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'VALIDATION_ERROR', message: 'x' }, 400));

		const result = await renameDashboard(ID, '');

		expect(!result.ok && result.error.code).toBe('VALIDATION_ERROR');
		expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
	});

	it('updateDashboardAddress maps 503 to SERVER_ERROR and sends PUT to the address URL', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'STORAGE_ERROR', message: 'x' }, 503));

		const result = await updateDashboardAddress(ID, 'addr-1', input);

		expect(!result.ok && result.error.code).toBe('SERVER_ERROR');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(`/api/dashboards/${ID}/addresses/addr-1`);
		expect(init.method).toBe('PUT');
	});

	it('removeDashboardAddress succeeds on an empty 204', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

		const result = await removeDashboardAddress(ID, 'addr-1');

		expect(result).toEqual({ ok: true, value: undefined });
		expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
	});

	it('maps a thrown fetch to NETWORK_ERROR', async () => {
		fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

		const result = await fetchDashboard(ID);

		expect(!result.ok && result.error.code).toBe('NETWORK_ERROR');
	});
});
