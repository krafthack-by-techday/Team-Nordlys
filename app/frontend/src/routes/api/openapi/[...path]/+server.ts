import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const upstream = () => (env.CORE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Proxy /api/openapi/* to the Elysia api-gateway's Swagger UI + spec. */
const proxy: RequestHandler = async ({ params, request, url }) => {
	const suffix = params.path ? `/${params.path}` : '';
	const target = `${upstream()}/openapi${suffix}${url.search}`;

	const headers = new Headers(request.headers);
	headers.delete('host');

	const res = await fetch(target, {
		method: request.method,
		headers,
		body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
		// @ts-expect-error -- duplex needed for streaming bodies in Bun/Node 18+
		duplex: 'half'
	});

	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers: res.headers
	});
};

export const GET = proxy;
