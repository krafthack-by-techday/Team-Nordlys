import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';
import { env } from '$env/dynamic/private';

const paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale));
			}
		});
	});

/**
 * Auth guard: checks session state against the API gateway.
 * - No users (setup_required) → redirect to /setup
 * - Pending verification → redirect to /setup
 * - Not authenticated → redirect to /login
 * - Authenticated → continue
 */
const authHandle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Public routes that don't require auth
	if (pathname === '/') {
		return resolve(event);
	}
	const publicPaths = ['/login', '/setup', '/api/'];
	if (publicPaths.some((p) => pathname.startsWith(p))) {
		return resolve(event);
	}
	// Static assets & health checks
	if (pathname.startsWith('/_app/') || pathname.startsWith('/favicon')) {
		return resolve(event);
	}

	const baseUrl = (env.CORE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

	try {
		// Forward the session cookie to the backend
		const cookie = event.request.headers.get('cookie') ?? '';
		const resp = await fetch(`${baseUrl}/v1/auth/me`, {
			headers: { cookie }
		});
		const data = (await resp.json()) as Record<string, unknown>;

		if (data.setup_required || data.setup_pending) {
			if (!pathname.startsWith('/setup')) {
				return new Response(null, {
					status: 302,
					headers: { location: '/setup' }
				});
			}
			return resolve(event);
		}

		if (!data.authenticated) {
			return new Response(null, {
				status: 302,
				headers: { location: '/login' }
			});
		}

		// Attach user to locals for downstream use
		event.locals.user = data.user as { id: string; email: string; name: string; role: string };
	} catch {
		// If backend is unreachable, let the request through (graceful degradation)
		// Frontend will handle the error state
	}

	return resolve(event);
};

export const handle: Handle = sequence(paraglideHandle, authHandle);
