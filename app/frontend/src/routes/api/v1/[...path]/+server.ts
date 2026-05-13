import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const upstream = () => (env.CORE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Proxy all /api/v1/* requests to the Elysia api-gateway. */
const proxy: RequestHandler = async ({ params, request, url }) => {
	const target = `${upstream()}/v1/${params.path}${url.search}`;

	const headers = new Headers(request.headers);
	// Remove host so the upstream gets its own host header
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
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
