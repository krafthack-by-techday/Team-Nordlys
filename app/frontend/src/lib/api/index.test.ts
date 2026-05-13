import { describe, it, expect } from 'vitest';
import { api } from './index';
import { ApiError } from './errors';

describe('api client', () => {
	it('constructs correct event list URL', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
		};
		await api.listEvents(mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/events');
	});

	it('constructs correct single event URL with encoding', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
		};
		await api.getEvent('foo/bar', mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/events/foo%2Fbar');
	});

	it('constructs correct indicators URL', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
		};
		await api.listIndicators(mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/indicators');
	});

	it('constructs correct peers URL', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
		};
		await api.listPeers(mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/peers');
	});

	it('constructs correct stats URL', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
		};
		await api.stats(mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/stats');
	});

	it('constructs correct vulnerabilities URL', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
		};
		await api.listVulnerabilities(mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/vulnerabilities');
	});

	it('constructs correct scans URL', async () => {
		const calls: string[] = [];
		const mockFetch = (url: string | URL | Request) => {
			calls.push(String(url));
			return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
		};
		await api.listScans(mockFetch as typeof fetch);
		expect(calls[0]).toBe('/api/v1/scans');
	});

	it('throws ApiError on non-ok response', async () => {
		const mockFetch = () => Promise.resolve(new Response('Not Found', { status: 404 }));
		await expect(api.listEvents(mockFetch as typeof fetch)).rejects.toBeInstanceOf(ApiError);
	});

	it('ApiError contains status and body', async () => {
		const mockFetch = () => Promise.resolve(new Response('bad request', { status: 400 }));
		try {
			await api.listEvents(mockFetch as typeof fetch);
			expect.unreachable('should have thrown');
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError);
			expect((e as ApiError).status).toBe(400);
			expect((e as ApiError).body).toBe('bad request');
		}
	});
});
