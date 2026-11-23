/**
 * Superforms wiring for AddressForm, shared by every page that shows it
 *
 * The form only validates on the server; where the address is stored
 * (localStorage or a dashboard) is decided by the page on the client.
 */

import { superValidate, fail, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { RequestEvent } from '@sveltejs/kit';
import { addressFormSchema } from '$lib/schemas';

/** Create the empty form for a page's initial state */
export function createAddressForm() {
	return superValidate(zod4(addressFormSchema));
}

/** Form action: validate the submitted address and return it to the client */
export async function addAddressAction({ request }: RequestEvent) {
	const form = await superValidate(request, zod4(addressFormSchema));

	if (!form.valid) {
		return fail(400, { form });
	}

	return message(form, 'success');
}
