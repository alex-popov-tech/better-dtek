/**
 * Page server for Superforms integration
 *
 * Provides form state for AddressForm and validates submissions.
 * Note: Address data is stored client-side in localStorage,
 * so the form action only validates and returns the data.
 */

import { createAddressForm, addAddressAction } from '$lib/server/address-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Create empty form for initial state
	const form = await createAddressForm();
	return { form };
};

export const actions: Actions = {
	/**
	 * Validate and return address data for client-side storage
	 */
	addAddress: addAddressAction,
};
