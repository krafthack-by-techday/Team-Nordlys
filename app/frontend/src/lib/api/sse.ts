/**
 * SSE client for real-time updates from the api-gateway.
 *
 * Connects to `/api/v1/stream` (through the BFF proxy) and dispatches
 * typed messages. Auto-reconnects on disconnect with exponential backoff.
 *
 * Usage:
 *   import { createSSEClient } from '$lib/api/sse';
 *
 *   const sse = createSSEClient({
 *     onEvent: (event) => { ... },
 *     onStats: (stats) => { ... },
 *   });
 *
 *   // Later:
 *   sse.close();
 */

import type {
	SignedEvent,
	SignedIndicator,
	SignedChatMessage,
	PeerWithStatus,
	Stats
} from './types';

// ── SSE event types ─────────────────────────────────────────────────

export type SSEEventMap = {
	event: SignedEvent;
	indicator: SignedIndicator;
	chat: SignedChatMessage;
	stats: Stats;
	peer: PeerWithStatus;
	connected: { clients: number };
};

export type SSEEventName = keyof SSEEventMap;

export type SSEHandlers = {
	[K in SSEEventName as `on${Capitalize<K>}`]?: (data: SSEEventMap[K]) => void;
} & {
	onOpen?: () => void;
	onError?: (error: Event) => void;
};

// ── Client ──────────────────────────────────────────────────────────

export interface SSEClient {
	/** Close the connection and stop reconnecting. */
	close(): void;
	/** Whether the connection is currently open. */
	readonly connected: boolean;
}

const SSE_URL = '/api/v1/stream';

export function createSSEClient(handlers: SSEHandlers): SSEClient {
	let es: EventSource | null = null;
	let closed = false;
	let reconnectMs = 1000;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function connect() {
		if (closed) return;

		es = new EventSource(SSE_URL);

		es.onopen = () => {
			reconnectMs = 1000; // reset backoff on success
			handlers.onOpen?.();
		};

		es.onerror = (e) => {
			handlers.onError?.(e);
			es?.close();
			es = null;
			scheduleReconnect();
		};

		// Register typed event listeners
		const eventNames: SSEEventName[] = ['event', 'indicator', 'chat', 'stats', 'peer', 'connected'];

		for (const name of eventNames) {
			es.addEventListener(name, (e: MessageEvent) => {
				try {
					const data = JSON.parse(e.data);
					const handlerKey = `on${name.charAt(0).toUpperCase()}${name.slice(1)}` as keyof SSEHandlers;
					const handler = handlers[handlerKey];
					if (handler) {
						(handler as (data: unknown) => void)(data);
					}
				} catch {
					console.warn(`[sse] Failed to parse ${name} message:`, e.data);
				}
			});
		}
	}

	function scheduleReconnect() {
		if (closed) return;
		reconnectTimer = setTimeout(() => {
			reconnectMs = Math.min(reconnectMs * 2, 30_000);
			connect();
		}, reconnectMs);
	}

	function close() {
		closed = true;
		if (reconnectTimer) clearTimeout(reconnectTimer);
		es?.close();
		es = null;
	}

	// Start immediately
	connect();

	return {
		close,
		get connected() {
			return es?.readyState === EventSource.OPEN;
		}
	};
}
