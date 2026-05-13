import type { PageServerLoad } from './$types';
import { apiService } from '$lib/api/server';
import type { SignedEvent, PeerWithStatus } from '$lib/api/types';

export const load: PageServerLoad = async ({ fetch }) => {
	let peers: PeerWithStatus[] = [];
	let events: SignedEvent[] = [];
	let online = false;

	try {
		[peers, events] = await Promise.all([
			apiService.listPeers(fetch),
			apiService.listEvents(fetch)
		]);
		online = true;
	} catch {
		// Backend down
	}

	return { peers, events, online };
};
