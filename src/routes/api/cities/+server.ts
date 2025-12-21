import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDtekService } from '$lib/server';
import { handleServiceError, unwrapRetryError } from '$lib/server/route-utils';
import { validateQuery } from '$lib/server/validate';
import { regionQuerySchema } from '$lib/schemas';
import type { RegionCode } from '$lib/constants/regions';
import { withRetry, DEFAULT_RETRY_DELAYS } from '$lib/utils/retry';

export const GET: RequestHandler = async ({ url }) => {
	const validation = validateQuery(url, regionQuerySchema);
	if (!validation.ok) {
		return validation.error.response;
	}

	const { region } = validation.value;
	const service = getDtekService(region as RegionCode);

	const result = await withRetry(() => service.getCities(), {
		delays: DEFAULT_RETRY_DELAYS,
		onRetry: (attempt, _, delay) => {
			console.log(`[API] /api/cities retry ${attempt}, waiting ${delay}ms`);
		},
	});

	if (!result.ok) {
		return handleServiceError(
			`[API] GET /api/cities?region=${region} failed:`,
			unwrapRetryError(result.error)
		);
	}

	return json(
		{ cities: result.value },
		{
			headers: {
				'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
			},
		}
	);
};
