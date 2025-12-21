/**
 * Transform raw DTEK API responses to client-friendly format
 */

import type { BuildingStatus, OutageType } from '$lib/types/address';
import type { DtekBuildingStatus } from '$lib/types/dtek';

/**
 * Extract schedule group ID from sub_type_reason array
 * Looks for pattern like "GPV1.2", "GPV2.1", etc.
 */
export function extractScheduleGroup(subTypeReason: string[] | null): string | undefined {
	if (!subTypeReason?.length) return undefined;
	return subTypeReason.find((r) => /^GPV\d+\.\d+$/.test(r));
}

/**
 * Determine outage type from DTEK sub_type field
 *
 * Known sub_type values:
 * - "Аварійні ремонтні роботи" → emergency (infrastructure failure)
 * - "Стабілізаційне відключення (Згідно графіку погодинних відключень)" → stabilization
 * - "Планові ремонтні роботи" → planned
 * - null or unknown → planned (safe default, no pulsing)
 */
export function getOutageType(subType: string | null): OutageType {
	if (!subType) return 'planned';
	if (subType.includes('Аварійн')) return 'emergency';
	if (subType.includes('Стабілізаційн')) return 'stabilization';
	return 'planned';
}

/**
 * Transform raw DTEK building status to client format
 *
 * Sets `outage` when API reports an active blackout (type + dates present).
 * The outage type is determined by parsing the sub_type field.
 */
export function transformBuildingStatus(raw: DtekBuildingStatus): BuildingStatus {
	const result: BuildingStatus = {};

	// Extract schedule group (e.g., "GPV1.2")
	const group = extractScheduleGroup(raw.sub_type_reason);
	if (group) result.group = group;

	// Set outage if API reports active blackout with dates
	if (raw.type && raw.start_date && raw.end_date) {
		result.outage = {
			type: getOutageType(raw.sub_type),
			from: raw.start_date,
			to: raw.end_date,
		};
	}

	return result;
}
