/**
 * Public dashboard page
 *
 * Loads the dashboard on the server so the first paint already has the
 * addresses. Edits go through /api/dashboards from the client; the form
 * action only validates, as on the home page.
 */

import { error } from '@sveltejs/kit';
import { getDashboard } from '$lib/server/dashboards/repository';
import { createAddressForm, addAddressAction } from '$lib/server/address-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// Several people edit the same dashboard; never serve a cached copy
	setHeaders({ 'Cache-Control': 'no-store' });

	const result = await getDashboard(params.id);
	if (!result.ok) {
		error(result.error.code === 'NOT_FOUND' ? 404 : 503, result.error.message);
	}

	return { dashboard: result.value, form: await createAddressForm() };
};

export const actions: Actions = {
	addAddress: addAddressAction,
};
