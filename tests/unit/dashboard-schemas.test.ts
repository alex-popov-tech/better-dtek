import { describe, it, expect } from 'vitest';
import { dashboardIdSchema, dashboardNameSchema, dashboardAddressSchema } from '$lib/schemas';

describe('dashboardIdSchema', () => {
	it('accepts a 10-char lowercase alphanumeric id', () => {
		expect(dashboardIdSchema.safeParse('234hldch72').success).toBe(true);
	});

	it.each(['ABCDEFGHIJ', 'abc', '234hldch721', 'favicon.ico', '234hldch7-'])(
		'rejects id %s',
		(id) => {
			expect(dashboardIdSchema.safeParse(id).success).toBe(false);
		}
	);
});

describe('dashboardNameSchema', () => {
	it('trims the name', () => {
		expect(dashboardNameSchema.parse('  Геймери ')).toBe('Геймери');
	});

	it('rejects whitespace-only names', () => {
		expect(dashboardNameSchema.safeParse('   ').success).toBe(false);
	});

	it('rejects 61-char names and accepts 60-char names', () => {
		expect(dashboardNameSchema.safeParse('а'.repeat(61)).success).toBe(false);
		expect(dashboardNameSchema.safeParse('а'.repeat(60)).success).toBe(true);
	});
});

describe('dashboardAddressSchema', () => {
	const base = { region: 'kem', city: 'м. Київ', street: 'вул. Хрещатик', building: '1' };

	it('rejects a 61-char label', () => {
		expect(dashboardAddressSchema.safeParse({ ...base, label: 'x'.repeat(61) }).success).toBe(
			false
		);
	});

	it('turns an empty label into undefined', () => {
		expect(dashboardAddressSchema.parse({ ...base, label: '' }).label).toBeUndefined();
	});

	it('keeps a trimmed label', () => {
		expect(dashboardAddressSchema.parse({ ...base, label: ' Сашко ' }).label).toBe('Сашко');
	});

	it.each(['city', 'street', 'building'])('rejects a %s longer than 200 characters', (field) => {
		expect(dashboardAddressSchema.safeParse({ ...base, [field]: 'x'.repeat(201) }).success).toBe(
			false
		);
		expect(dashboardAddressSchema.safeParse({ ...base, [field]: 'x'.repeat(200) }).success).toBe(
			true
		);
	});

	it('rejects an unknown region', () => {
		expect(dashboardAddressSchema.safeParse({ ...base, region: 'zzz' }).success).toBe(false);
	});
});
