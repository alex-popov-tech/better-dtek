import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dtekService } from '$lib/server';
import { handleServiceError } from '$lib/server/route-utils';
import type { BuildingStatus } from '$lib/types/address';
import type { DtekBuildingStatus } from '$lib/types/dtek';

/**
 * Extract schedule group ID from sub_type_reason array
 * Looks for pattern like "GPV1.2", "GPV2.1", etc.
 */
function extractScheduleGroup(subTypeReason: string[] | null): string | undefined {
	if (!subTypeReason?.length) return undefined;
	return subTypeReason.find((r) => /^GPV\d+\.\d+$/.test(r));
}

/**
 * Transform raw DTEK building status to new format
 */
function transformBuildingStatus(raw: DtekBuildingStatus): BuildingStatus {
	const result: BuildingStatus = {};

	const group = extractScheduleGroup(raw.sub_type_reason);
	if (group) result.group = group;

	if (raw.type === '2' && raw.start_date && raw.end_date) {
		result.emergency = {
			from: raw.start_date,
			to: raw.end_date,
		};
	}

	return result;
}

export const GET: RequestHandler = async ({ url }) => {
	const city = url.searchParams.get('city');
	const street = url.searchParams.get('street');

	if (!city || !street) {
		return json(
			{ error: 'VALIDATION_ERROR', message: "Параметри city та street обов'язкові" },
			{ status: 400 }
		);
	}

	const start = Date.now();
	console.log(`[API] GET /api/status city=${city} street=${street}`);

	const result = await dtekService.getStatus(city, street);
	const fetchedAt = Date.now();

	console.log(`[API] GET /api/status completed in ${fetchedAt - start}ms`);

	if (!result.ok) {
		return handleServiceError('[API] GET /api/status failed:', result.error);
	}

	const response = result.value;

	// Validate response structure
	if (!response || !response.data || typeof response.data !== 'object') {
		console.error('[API] Invalid response structure from dtekService:', response);
		return json(
			{ error: 'PARSE_ERROR', message: 'Сервер ДТЕК повернув некоректні дані' },
			{ status: 502 }
		);
	}

	// Transform buildings and collect groups
	const buildings: Record<string, BuildingStatus> = {};
	const groupIds = new Set<string>();

	for (const [num, raw] of Object.entries(response.data)) {
		const status = transformBuildingStatus(raw);
		buildings[num] = status;
		if (status.group) groupIds.add(status.group);
	}

	// Fetch schedules for referenced groups
	const schedulesResult = await dtekService.getSchedules([...groupIds]);
	const schedules = schedulesResult.ok ? schedulesResult.value : {};

	// Return all buildings with transformed status and schedules
	return json({
		city,
		street,
		buildings,
		schedules,
		fetchedAt,
	});
};
