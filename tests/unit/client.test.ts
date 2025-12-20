/**
 * Unit tests for DTEK HTTP client module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	CookieJar,
	fetchTemplate,
	fetchBuildingStatuses,
	BASE_URL,
	TEMPLATE_URL,
	AJAX_URL,
	USER_AGENT,
} from '$lib/server/dtek/client';
import type { DtekStatusResponse } from '$lib/types';

describe('CookieJar', () => {
	let jar: CookieJar;

	beforeEach(() => {
		jar = new CookieJar();
	});

	describe('absorb()', () => {
		it('should parse single Set-Cookie header', () => {
			jar.absorb(['session=abc123; Path=/; HttpOnly']);
			expect(jar.size).toBe(1);
			expect(jar.getHeader()).toBe('session=abc123');
		});

		it('should parse multiple Set-Cookie headers', () => {
			jar.absorb([
				'session=abc123; Path=/; HttpOnly',
				'csrf=xyz789; Path=/; Secure',
				'_language=en; Max-Age=3600',
			]);
			expect(jar.size).toBe(3);
			expect(jar.getHeader()).toContain('session=abc123');
			expect(jar.getHeader()).toContain('csrf=xyz789');
			expect(jar.getHeader()).toContain('_language=en');
		});

		it('should handle cookies with equals sign in value', () => {
			jar.absorb(['token=base64==; Path=/']);
			expect(jar.getHeader()).toBe('token=base64==');
		});

		it('should ignore malformed cookies', () => {
			jar.absorb(['invalid', '=noname', '; Path=/']);
			expect(jar.size).toBe(0);
		});

		it('should overwrite existing cookies with same name', () => {
			jar.absorb(['session=first; Path=/']);
			jar.absorb(['session=second; Path=/']);
			expect(jar.size).toBe(1);
			expect(jar.getHeader()).toBe('session=second');
		});

		it('should trim whitespace from name and value', () => {
			jar.absorb(['  foo  =  bar  ; Path=/']);
			expect(jar.getHeader()).toBe('foo=bar');
		});
	});

	describe('getHeader()', () => {
		it('should return empty string when no cookies', () => {
			expect(jar.getHeader()).toBe('');
		});

		it('should format single cookie', () => {
			jar.absorb(['session=abc123; Path=/']);
			expect(jar.getHeader()).toBe('session=abc123');
		});

		it('should format multiple cookies with semicolon separator', () => {
			jar.absorb(['a=1; Path=/', 'b=2; Path=/', 'c=3; Path=/']);
			const header = jar.getHeader();
			expect(header).toContain('a=1');
			expect(header).toContain('b=2');
			expect(header).toContain('c=3');
			expect(header.split('; ')).toHaveLength(3);
		});
	});

	describe('getFiltered()', () => {
		beforeEach(() => {
			jar.absorb([
				'dtek-oem=session123; Path=/',
				'_csrf-dtek-oem=csrf456; Path=/',
				'_language=uk; Path=/',
				'visid_incap_12345=visitor678; Path=/',
				'incap_ses_789=session901; Path=/',
				'incap_wrt_456=wrt234; Path=/',
				'other_cookie=should_be_filtered; Path=/',
				'random=data; Path=/',
			]);
		});

		it('should return only essential DTEK cookies', () => {
			const filtered = jar.getFiltered();
			expect(filtered).toContain('dtek-oem=session123');
			expect(filtered).toContain('_csrf-dtek-oem=csrf456');
			expect(filtered).toContain('_language=uk');
			expect(filtered).toContain('visid_incap_12345=visitor678');
			expect(filtered).toContain('incap_ses_789=session901');
			expect(filtered).toContain('incap_wrt_456=wrt234');
		});

		it('should exclude non-essential cookies', () => {
			const filtered = jar.getFiltered();
			expect(filtered).not.toContain('other_cookie');
			expect(filtered).not.toContain('random');
		});

		it('should return empty string when no essential cookies', () => {
			jar.clear();
			jar.absorb(['other=value; Path=/', 'random=data; Path=/']);
			expect(jar.getFiltered()).toBe('');
		});

		it('should handle Imperva cookies with various suffixes', () => {
			jar.clear();
			jar.absorb([
				'visid_incap_123456=value1; Path=/',
				'incap_ses_999_123=value2; Path=/',
				'incap_wrt_abc=value3; Path=/',
			]);
			const filtered = jar.getFiltered();
			expect(filtered).toContain('visid_incap_123456=value1');
			expect(filtered).toContain('incap_ses_999_123=value2');
			expect(filtered).toContain('incap_wrt_abc=value3');
		});
	});

	describe('clear()', () => {
		it('should remove all cookies', () => {
			jar.absorb(['a=1; Path=/', 'b=2; Path=/', 'c=3; Path=/']);
			expect(jar.size).toBe(3);
			jar.clear();
			expect(jar.size).toBe(0);
			expect(jar.getHeader()).toBe('');
		});
	});

	describe('size', () => {
		it('should return 0 for empty jar', () => {
			expect(jar.size).toBe(0);
		});

		it('should return correct count of cookies', () => {
			jar.absorb(['a=1; Path=/']);
			expect(jar.size).toBe(1);
			jar.absorb(['b=2; Path=/', 'c=3; Path=/']);
			expect(jar.size).toBe(3);
		});
	});
});

describe('fetchTemplate()', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should fetch template page with correct headers', async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValueOnce(
			new Response('<html><body>Test</body></html>', {
				status: 200,
				headers: new Headers({
					'set-cookie': 'dtek-oem=session123; Path=/',
				}),
			})
		);

		await fetchTemplate();

		expect(mockFetch).toHaveBeenCalledWith(
			TEMPLATE_URL,
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					'user-agent': USER_AGENT,
					accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'accept-language': 'en',
					'cache-control': 'no-cache',
					pragma: 'no-cache',
				}),
				redirect: 'follow',
			})
		);
	});

	it('should return HTML content and cookies', async () => {
		const mockHtml = '<html><head><meta name="csrf-token" content="test-csrf"></head></html>';
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValueOnce(
			new Response(mockHtml, {
				status: 200,
				headers: new Headers({
					'set-cookie': 'dtek-oem=session123; Path=/',
				}),
			})
		);

		const result = await fetchTemplate();

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.html).toBe(mockHtml);
			expect(result.value.cookies.size).toBe(1);
			expect(result.value.cookies.getHeader()).toContain('dtek-oem=session123');
		}
	});

	it('should absorb multiple Set-Cookie headers', async () => {
		const mockFetch = vi.mocked(fetch);
		const mockResponse = new Response('<html></html>', {
			status: 200,
		});

		// Mock getSetCookie method (Node 20+)
		(mockResponse.headers as any).getSetCookie = vi
			.fn()
			.mockReturnValue([
				'dtek-oem=session123; Path=/',
				'_csrf-dtek-oem=csrf456; Path=/',
				'_language=uk; Path=/',
			]);

		mockFetch.mockResolvedValueOnce(mockResponse);

		const result = await fetchTemplate();

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.cookies.size).toBe(3);
			expect(result.value.cookies.getHeader()).toContain('dtek-oem=session123');
			expect(result.value.cookies.getHeader()).toContain('_csrf-dtek-oem=csrf456');
			expect(result.value.cookies.getHeader()).toContain('_language=uk');
		}
	});
});

describe('fetchBuildingStatuses()', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should send POST request with correct headers and body', async () => {
		const mockFetch = vi.mocked(fetch);
		const mockResponse: DtekStatusResponse = {
			result: true,
			data: {},
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockResponse), {
				status: 200,
				headers: new Headers({
					'content-type': 'application/json',
				}),
			})
		);

		const cookies = new CookieJar();
		cookies.absorb([
			'dtek-oem=session123; Path=/',
			'_csrf-dtek-oem=csrf456; Path=/',
			'_language=uk; Path=/',
		]);

		await fetchBuildingStatuses({
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			updateFact: '11.12.2025 20:51',
			csrf: 'test-csrf-token',
			cookies,
		});

		expect(mockFetch).toHaveBeenCalledWith(
			AJAX_URL,
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'user-agent': USER_AGENT,
					accept: 'application/json, text/javascript, */*; q=0.01',
					'accept-language': 'en',
					'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
					'x-requested-with': 'XMLHttpRequest',
					'x-csrf-token': 'test-csrf-token',
					origin: BASE_URL,
					referer: TEMPLATE_URL,
					cookie: expect.stringContaining('dtek-oem=session123'),
					'cache-control': 'no-cache',
					pragma: 'no-cache',
				}),
				redirect: 'follow',
			})
		);

		const callArgs = mockFetch.mock.calls[0];
		const body = callArgs[1]?.body as string;
		expect(body).toContain('method=getHomeNum');
		expect(body).toContain('data%5B0%5D%5Bname%5D=city'); // URL encoded data[0][name]=city
		expect(body).toContain('data%5B0%5D%5Bvalue%5D=%D0%BC.+%D0%9E%D0%B4%D0%B5%D1%81%D0%B0'); // URL encoded м. Одеса
		expect(body).toContain('data%5B1%5D%5Bname%5D=street');
		expect(body).toContain('data%5B2%5D%5Bname%5D=updateFact');
	});

	it('should parse JSON response correctly', async () => {
		const mockFetch = vi.mocked(fetch);
		const mockResponse: DtekStatusResponse = {
			result: true,
			data: {
				'25/39': {
					sub_type: 'Аварійні ремонтні роботи',
					start_date: '00:40 13.12.2025',
					end_date: '23:00 17.12.2025',
					type: '2',
					sub_type_reason: ['GPV1.2'],
					voluntarily: null,
				},
				'26': {
					sub_type: null,
					start_date: null,
					end_date: null,
					type: null,
					sub_type_reason: null,
					voluntarily: null,
				},
			},
		};

		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify(mockResponse), {
				status: 200,
				headers: new Headers({
					'content-type': 'application/json',
				}),
			})
		);

		const cookies = new CookieJar();
		cookies.absorb(['dtek-oem=session123; Path=/']);

		const result = await fetchBuildingStatuses({
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			updateFact: '11.12.2025 20:51',
			csrf: 'test-csrf-token',
			cookies,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.result).toBe(true);
			expect(result.value.data).toHaveProperty('25/39');
			expect(result.value.data).toHaveProperty('26');
			expect(result.value.data['25/39'].type).toBe('2');
			expect(result.value.data['25/39'].sub_type).toBe('Аварійні ремонтні роботи');
			expect(result.value.data['26'].type).toBeNull();
		}
	});

	it('should use filtered cookies in request', async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ result: true, data: {} }), {
				status: 200,
			})
		);

		const cookies = new CookieJar();
		cookies.absorb([
			'dtek-oem=session123; Path=/',
			'_csrf-dtek-oem=csrf456; Path=/',
			'other_cookie=should_not_appear; Path=/',
			'random=data; Path=/',
		]);

		await fetchBuildingStatuses({
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			updateFact: '11.12.2025 20:51',
			csrf: 'test-csrf',
			cookies,
		});

		const callArgs = mockFetch.mock.calls[0];
		const cookieHeader = (callArgs[1]?.headers as Record<string, string>)['cookie'];
		expect(cookieHeader).toContain('dtek-oem=session123');
		expect(cookieHeader).toContain('_csrf-dtek-oem=csrf456');
		expect(cookieHeader).not.toContain('other_cookie');
		expect(cookieHeader).not.toContain('random');
	});

	it('should absorb new cookies from response', async () => {
		const mockFetch = vi.mocked(fetch);
		const mockResponse = new Response(JSON.stringify({ result: true, data: {} }), {
			status: 200,
		});

		// Mock getSetCookie method
		(mockResponse.headers as any).getSetCookie = vi
			.fn()
			.mockReturnValue(['new_session=xyz789; Path=/', 'updated_csrf=abc123; Path=/']);

		mockFetch.mockResolvedValueOnce(mockResponse);

		const cookies = new CookieJar();
		cookies.absorb(['dtek-oem=old_session; Path=/']);
		expect(cookies.size).toBe(1);

		await fetchBuildingStatuses({
			city: 'м. Одеса',
			street: 'вул. Педагогічна',
			updateFact: '11.12.2025 20:51',
			csrf: 'test-csrf',
			cookies,
		});

		expect(cookies.size).toBe(3);
		expect(cookies.getHeader()).toContain('new_session=xyz789');
		expect(cookies.getHeader()).toContain('updated_csrf=abc123');
	});

	it('should handle empty data response', async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ result: true, data: {} }), {
				status: 200,
			})
		);

		const cookies = new CookieJar();
		cookies.absorb(['dtek-oem=session; Path=/']);

		const result = await fetchBuildingStatuses({
			city: 'м. Тест',
			street: 'вул. Тестова',
			updateFact: '11.12.2025 20:51',
			csrf: 'csrf',
			cookies,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.result).toBe(true);
			expect(result.value.data).toEqual({});
		}
	});
});

describe('Module constants', () => {
	it('should export correct BASE_URL', () => {
		expect(BASE_URL).toBe('https://www.dtek-oem.com.ua');
	});

	it('should export correct TEMPLATE_URL', () => {
		expect(TEMPLATE_URL).toBe('https://www.dtek-oem.com.ua/ua/shutdowns');
	});

	it('should export correct AJAX_URL', () => {
		expect(AJAX_URL).toBe('https://www.dtek-oem.com.ua/ua/ajax');
	});

	it('should export USER_AGENT string', () => {
		expect(USER_AGENT).toContain('Mozilla/5.0');
		expect(USER_AGENT).toContain('Chrome');
	});
});
