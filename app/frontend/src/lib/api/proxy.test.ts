import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $env/dynamic/private
vi.mock('$env/dynamic/private', () => ({
	env: { CORE_API_URL: 'http://mock-gateway:3000' }
}));

let GET: Function;
let POST: Function;

beforeEach(async () => {
	const mod = await import('../../routes/api/v1/[...path]/+server');
	GET = mod.GET;
	POST = mod.POST;
});

afterEach(() => {
	vi.restoreAllMocks();
});

function makeEvent(overrides: {
	method?: string;
	path?: string;
	search?: string;
	body?: string;
	headers?: Record<string, string>;
}) {
	const method = overrides.method ?? 'GET';
	return {
		params: { path: overrides.path ?? 'events' },
		url: new URL(`http://localhost/api/v1/${overrides.path ?? 'events'}${overrides.search ?? ''}`),
		request: new Request(`http://localhost/api/v1/${overrides.path ?? 'events'}`, {
			method,
			headers: new Headers({ host: 'localhost', ...(overrides.headers ?? {}) }),
			body: method !== 'GET' && method !== 'HEAD' ? overrides.body : undefined
		})
	};
}

describe('BFF proxy', () => {
	it('forwards GET to upstream with correct URL', async () => {
		const mockData = [{ id: '1', title: 'test' }];
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify(mockData), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const res = await GET(makeEvent({ path: 'events' }));

		expect(fetchSpy).toHaveBeenCalledOnce();
		const calledUrl = fetchSpy.mock.calls[0][0] as string;
		expect(calledUrl).toBe('http://mock-gateway:3000/v1/events');
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body).toEqual(mockData);
	});

	it('preserves query string', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('[]', { status: 200 })
		);

		await GET(makeEvent({ path: 'events', search: '?severity=high&limit=10' }));

		const calledUrl = fetchSpy.mock.calls[0][0] as string;
		expect(calledUrl).toBe('http://mock-gateway:3000/v1/events?severity=high&limit=10');
	});

	it('strips host header', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('{}', { status: 200 })
		);

		await GET(makeEvent({ path: 'stats', headers: { host: 'evil.com' } }));

		const calledHeaders = fetchSpy.mock.calls[0][1]?.headers as Headers;
		expect(calledHeaders.get('host')).toBeNull();
	});

	it('forwards POST with body', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('{"ok":true}', { status: 201 })
		);

		const res = await POST(
			makeEvent({
				method: 'POST',
				path: 'events',
				body: '{"title":"new event"}',
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(fetchSpy).toHaveBeenCalledOnce();
		expect(res.status).toBe(201);
	});

	it('passes upstream error status through', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('Not Found', { status: 404, statusText: 'Not Found' })
		);

		const res = await GET(makeEvent({ path: 'nonexistent' }));
		expect(res.status).toBe(404);
	});
});
