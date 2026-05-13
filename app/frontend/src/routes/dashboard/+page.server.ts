import type { PageServerLoad } from './$types';
import { apiService } from '$lib/api/server';
import type { SignedEvent } from '$lib/api/types';

export const load: PageServerLoad = async ({ fetch }) => {
	let events: SignedEvent[] = [];

	try {
		events = await apiService.listEvents(fetch);
	} catch {
		// Backend down — return empty
	}

	return { events };
};
