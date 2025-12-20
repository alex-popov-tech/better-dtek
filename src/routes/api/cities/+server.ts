import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dtekService } from '$lib/server';
import { handleServiceError } from '$lib/server/route-utils';

export const GET: RequestHandler = async () => {
	const result = await dtekService.getCities();

	if (!result.ok) {
		return handleServiceError('[API] GET /api/cities failed:', result.error);
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
