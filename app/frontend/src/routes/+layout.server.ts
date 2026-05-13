import type { LayoutServerLoad } from './$types';
import { apiService } from '$lib/api/server';
import type { Stats } from '$lib/api/types';

export const load: LayoutServerLoad = async ({ fetch, locals }) => {
	let stats: Stats | null = null;
	let online = false;

	try {
		stats = await apiService.stats(fetch);
		online = true;
	} catch {
		// Backend down — layout still renders, pages handle their own data
	}

	return { stats, online, user: locals.user ?? null };
};
