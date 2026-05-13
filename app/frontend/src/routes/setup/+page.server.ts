import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ fetch }) => {
	const baseUrl = (env.CORE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

	try {
		const resp = await fetch(`${baseUrl}/v1/setup/status`);
		const data = (await resp.json()) as { status: string };

		// If already active, redirect to dashboard
		if (data.status === 'active') {
			throw redirect(302, '/');
		}

		return { nodeStatus: data.status };
	} catch (e) {
		if (e instanceof Response || (e as any)?.status === 302) throw e;
		return { nodeStatus: 'uninitialized' };
	}
};
