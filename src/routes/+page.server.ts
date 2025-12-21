/**
 * Page server for Superforms integration
 *
 * Provides form state for AddressForm and validates submissions.
 * Note: Address data is stored client-side in localStorage,
 * so the form action only validates and returns the data.
 */

import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { addressFormSchema } from '$lib/schemas';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Create empty form for initial state
	const form = await superValidate(zod4(addressFormSchema));
	return { form };
};

export const actions: Actions = {
	/**
	 * Validate and return address data for client-side storage
	 */
	addAddress: async ({ request }) => {
		const form = await superValidate(request, zod4(addressFormSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		// Return validated data for client to store in localStorage
		return message(form, 'success');
	},
};
