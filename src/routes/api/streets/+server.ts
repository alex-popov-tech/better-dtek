import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dtekService } from '$lib/server';
import { handleServiceError } from '$lib/server/route-utils';

export const GET: RequestHandler = async ({ url }) => {
	const city = url.searchParams.get('city');

	if (!city) {
		return json(
			{ error: 'VALIDATION_ERROR', message: "Параметр city обов'язковий" },
			{ status: 400 }
		);
	}

	const result = await dtekService.getStreets(city);

	if (!result.ok) {
		return handleServiceError('[API] GET /api/streets failed:', result.error);
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
