import { describe, it, expect } from 'vitest';
import { match } from '../../src/params/dashboardId';

describe('dashboardId param matcher', () => {
	it('matches a dashboard id', () => {
		expect(match('234hldch72')).toBe(true);
	});

	it.each(['ABCDEFGHIJ', 'favicon.ico', 'abc', 'api', '234hldch721', ''])(
		'does not match "%s"',
		(param) => {
			expect(match(param)).toBe(false);
		}
	);
});
