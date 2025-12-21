import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDtekService } from '$lib/server';
import { handleServiceError, unwrapRetryError } from '$lib/server/route-utils';
import { validateQuery } from '$lib/server/validate';
import { cityQuerySchema } from '$lib/schemas';
import type { RegionCode } from '$lib/constants/regions';
import { withRetry, DEFAULT_RETRY_DELAYS } from '$lib/utils/retry';

export const GET: RequestHandler = async ({ url }) => {
	const validation = validateQuery(url, cityQuerySchema);
	if (!validation.ok) return validation.error.response;

	const { region, city } = validation.value;
	const service = getDtekService(region as RegionCode);

	const result = await withRetry(() => service.getStreets(city), {
		delays: DEFAULT_RETRY_DELAYS,
		onRetry: (attempt, _, delay) => {
			console.log(`[API] /api/streets retry ${attempt}, waiting ${delay}ms`);
		},
	});

	if (!result.ok) {
		return handleServiceError(
			`[API] GET /api/streets?region=${region}&city=${city} failed:`,
			unwrapRetryError(result.error)
		);
	}

	return json(
		{ city, streets: result.value },
		{
			headers: {
				'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
			},
		}
	);
};
