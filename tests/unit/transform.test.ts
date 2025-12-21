import { describe, it, expect } from 'vitest';
import {
	extractScheduleGroup,
	getOutageType,
	transformBuildingStatus,
} from '../../src/lib/server/dtek/transform';
import type { DtekBuildingStatus } from '../../src/lib/types/dtek';

describe('extractScheduleGroup', () => {
	it('extracts GPV group from sub_type_reason', () => {
		expect(extractScheduleGroup(['GPV1.2'])).toBe('GPV1.2');
		expect(extractScheduleGroup(['GPV5.1'])).toBe('GPV5.1');
		expect(extractScheduleGroup(['GPV12.3'])).toBe('GPV12.3');
	});

	it('extracts first GPV match when multiple values present', () => {
		expect(extractScheduleGroup(['GPV1.2', 'other'])).toBe('GPV1.2');
		expect(extractScheduleGroup(['other', 'GPV3.1'])).toBe('GPV3.1');
	});

	it('returns undefined for null', () => {
		expect(extractScheduleGroup(null)).toBeUndefined();
	});

	it('returns undefined for empty array', () => {
		expect(extractScheduleGroup([])).toBeUndefined();
	});

	it('returns undefined if no GPV pattern found', () => {
		expect(extractScheduleGroup(['other', 'values'])).toBeUndefined();
		expect(extractScheduleGroup(['GPV'])).toBeUndefined();
		expect(extractScheduleGroup(['GPV1'])).toBeUndefined();
		expect(extractScheduleGroup(['1.2'])).toBeUndefined();
	});
});

describe('getOutageType', () => {
	it('returns emergency for "Аварійні ремонтні роботи"', () => {
		expect(getOutageType('Аварійні ремонтні роботи')).toBe('emergency');
	});

	it('returns emergency for any string containing "Аварійн"', () => {
		expect(getOutageType('Аварійні роботи на лінії')).toBe('emergency');
		expect(getOutageType('Проводяться Аварійні роботи')).toBe('emergency');
	});

	it('returns stabilization for stabilization blackout', () => {
		expect(getOutageType('Стабілізаційне відключення (Згідно графіку погодинних відключень)')).toBe(
			'stabilization'
		);
	});

	it('returns stabilization for any string containing "Стабілізаційн"', () => {
		expect(getOutageType('Стабілізаційне відключення')).toBe('stabilization');
	});

	it('returns planned for "Планові ремонтні роботи"', () => {
		expect(getOutageType('Планові ремонтні роботи')).toBe('planned');
	});

	it('returns planned for null (safe default)', () => {
		expect(getOutageType(null)).toBe('planned');
	});

	it('returns planned for empty string', () => {
		expect(getOutageType('')).toBe('planned');
	});

	it('returns planned for unknown sub_type values', () => {
		expect(getOutageType('Some new type from DTEK')).toBe('planned');
		expect(getOutageType('Технічні роботи')).toBe('planned');
	});
});

describe('transformBuildingStatus', () => {
	it('sets outage for emergency with dates', () => {
		const raw: DtekBuildingStatus = {
			sub_type: 'Аварійні ремонтні роботи',
			start_date: '00:40 13.12.2025',
			end_date: '23:00 17.12.2025',
			type: '2',
			sub_type_reason: ['GPV1.2'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toEqual({
			type: 'emergency',
			from: '00:40 13.12.2025',
			to: '23:00 17.12.2025',
		});
		expect(result.group).toBe('GPV1.2');
	});

	it('sets outage for stabilization blackout', () => {
		const raw: DtekBuildingStatus = {
			sub_type: 'Стабілізаційне відключення (Згідно графіку погодинних відключень)',
			start_date: '10:30 21.12.2025',
			end_date: '17:30 21.12.2025',
			type: '2',
			sub_type_reason: ['GPV1.2'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toEqual({
			type: 'stabilization',
			from: '10:30 21.12.2025',
			to: '17:30 21.12.2025',
		});
		expect(result.group).toBe('GPV1.2');
	});

	it('sets outage for planned maintenance', () => {
		const raw: DtekBuildingStatus = {
			sub_type: 'Планові ремонтні роботи',
			start_date: '08:00 22.12.2025',
			end_date: '17:00 22.12.2025',
			type: '1',
			sub_type_reason: ['GPV2.1'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toEqual({
			type: 'planned',
			from: '08:00 22.12.2025',
			to: '17:00 22.12.2025',
		});
		expect(result.group).toBe('GPV2.1');
	});

	it('does NOT set outage when dates are missing', () => {
		const raw: DtekBuildingStatus = {
			sub_type: 'Аварійні ремонтні роботи',
			start_date: null,
			end_date: null,
			type: '2',
			sub_type_reason: ['GPV1.1'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toBeUndefined();
		expect(result.group).toBe('GPV1.1');
	});

	it('does NOT set outage when type is null', () => {
		const raw: DtekBuildingStatus = {
			sub_type: null,
			start_date: '08:00 22.12.2025',
			end_date: '17:00 22.12.2025',
			type: null,
			sub_type_reason: ['GPV1.1'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toBeUndefined();
	});

	it('handles no outage (all nulls)', () => {
		const raw: DtekBuildingStatus = {
			sub_type: null,
			start_date: null,
			end_date: null,
			type: null,
			sub_type_reason: null,
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toBeUndefined();
		expect(result.group).toBeUndefined();
	});

	it('treats null sub_type with valid type as planned', () => {
		const raw: DtekBuildingStatus = {
			sub_type: null,
			start_date: '08:00 22.12.2025',
			end_date: '17:00 22.12.2025',
			type: '2',
			sub_type_reason: ['GPV1.2'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage?.type).toBe('planned');
	});

	it('handles building with group but no outage', () => {
		const raw: DtekBuildingStatus = {
			sub_type: null,
			start_date: null,
			end_date: null,
			type: null,
			sub_type_reason: ['GPV3.2'],
			voluntarily: null,
		};

		const result = transformBuildingStatus(raw);

		expect(result.outage).toBeUndefined();
		expect(result.group).toBe('GPV3.2');
	});
});
