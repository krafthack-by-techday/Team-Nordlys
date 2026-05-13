/**
 * Server-side API service for communicating with the Elysia api-gateway.
 *
 * This module runs ONLY on the server (inside `+page.server.ts` / `+server.ts`
 * load functions and actions). It reads `CORE_API_URL` from private env vars.
 *
 * Usage:
 *
 *   import { apiService } from '$lib/api/server';
 *
 *   export const load: PageServerLoad = async ({ fetch }) => {
 *     const events = await apiService.listEvents(fetch);
 *     return { events };
 *   };
 */
import { env } from '$env/dynamic/private';
import { ApiError } from './errors';
import type {
	SignedEvent,
	EventIngestInput,
	SignedIndicator,
	IndicatorIngestInput,
	PeerWithStatus,
	SignedChatMessage,
	ChatMessageInput,
	Vulnerability,
	Scan,
	ScanRequest,
	Stats
} from './types';

// Re-export for convenience in server load functions
export { ApiError } from './errors';
export type * from './types';

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function baseUrl(): string {
	return (env.CORE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

async function get<T>(path: string, fetchFn: typeof fetch): Promise<T> {
	const res = await fetchFn(`${baseUrl()}/v1${path}`);
	if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
	return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown, fetchFn: typeof fetch): Promise<T> {
	const res = await fetchFn(`${baseUrl()}/v1${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
	return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public service
// ---------------------------------------------------------------------------

export const apiService = {
	// ── Reads ──────────────────────────────────────────────────────────────
	listEvents: (fetch: typeof globalThis.fetch) => get<SignedEvent[]>('/events', fetch),

	getEvent: (id: string, fetch: typeof globalThis.fetch) =>
		get<SignedEvent>(`/events/${encodeURIComponent(id)}`, fetch),

	listIndicators: (fetch: typeof globalThis.fetch) => get<SignedIndicator[]>('/indicators', fetch),

	listPeers: (fetch: typeof globalThis.fetch) => get<PeerWithStatus[]>('/peers', fetch),

	stats: (fetch: typeof globalThis.fetch) => get<Stats>('/stats', fetch),

	listVulnerabilities: (fetch: typeof globalThis.fetch) =>
		get<Vulnerability[]>('/vulnerabilities', fetch),

	listScans: (fetch: typeof globalThis.fetch) => get<Scan[]>('/scans', fetch),

	getScan: (id: string, fetch: typeof globalThis.fetch) =>
		get<Scan>(`/scans/${encodeURIComponent(id)}`, fetch),

	// ── Writes ─────────────────────────────────────────────────────────────
	createEvent: (input: EventIngestInput, fetch: typeof globalThis.fetch) =>
		post<SignedEvent>('/events/manual', input, fetch),

	ingestSiem: (input: EventIngestInput, fetch: typeof globalThis.fetch) =>
		post<SignedEvent>('/ingest/siem', input, fetch),

	ingestIndicator: (input: IndicatorIngestInput, fetch: typeof globalThis.fetch) =>
		post<SignedIndicator>('/ingest/indicator', input, fetch),

	postChatMessage: (eventId: string, input: ChatMessageInput, fetch: typeof globalThis.fetch) =>
		post<SignedChatMessage>(`/chat/${encodeURIComponent(eventId)}`, input, fetch),

	createScan: (input: ScanRequest, fetch: typeof globalThis.fetch) =>
		post<Scan>('/scans', input, fetch)
};
