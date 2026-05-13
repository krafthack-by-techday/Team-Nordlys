/**
 * Client-side API — thin fetch wrappers that hit the BFF proxy at `/api/v1/*`.
 *
 * **Preferred pattern**: use `+page.server.ts` load functions with
 * `$lib/api/server` instead. This client exists for progressive enhancement
 * (client-side refresh via `invalidateAll`, form actions, etc.).
 */

import { ApiError } from './errors';
import type {
	SignedEvent,
	SignedIndicator,
	SignedPeerIdentity,
	Vulnerability,
	Scan,
	Stats
} from './types';

// Re-export everything so consumers can `import { api, ApiError, type SignedEvent } from '$lib/api'`
export { ApiError } from './errors';
export type * from './types';

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const API_BASE = '/api';
const V1 = `${API_BASE}/v1`;

async function get<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
	const res = await fetchFn(`${V1}${path}`);
	if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
	return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Public client API
// ---------------------------------------------------------------------------

export const api = {
	listEvents: (f?: typeof fetch) => get<SignedEvent[]>('/events', f),
	getEvent: (id: string, f?: typeof fetch) =>
		get<SignedEvent>(`/events/${encodeURIComponent(id)}`, f),
	listIndicators: (f?: typeof fetch) => get<SignedIndicator[]>('/indicators', f),
	listPeers: (f?: typeof fetch) => get<SignedPeerIdentity[]>('/peers', f),
	stats: (f?: typeof fetch) => get<Stats>('/stats', f),
	listVulnerabilities: (f?: typeof fetch) => get<Vulnerability[]>('/vulnerabilities', f),
	listScans: (f?: typeof fetch) => get<Scan[]>('/scans', f)
};

export { API_BASE, V1 };
