import { apiService, ApiError } from '$lib/api/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const events = await apiService.listEvents(fetch);
		return { events, error: null };
	} catch (err) {
		console.error('[events] Failed to load:', err);
		return {
			events: [],
			error: err instanceof ApiError ? err.message : 'Backend unavailable'
		};
	}
};
