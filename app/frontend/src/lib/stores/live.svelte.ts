/**
 * Live reactive store powered by SSE.
 *
 * Provides real-time state for events, stats, indicators, peers, and chat
 * using Svelte 5 runes. The SSE connection is started once and shared
 * across all pages via the root layout.
 *
 * Usage in +layout.svelte:
 *   import { liveStore } from '$lib/stores/live.svelte';
 *   const live = liveStore.start(data.stats, data.events);
 *
 * Usage in components:
 *   import { liveStore } from '$lib/stores/live.svelte';
 *   // liveStore.stats, liveStore.events, etc. are reactive
 */

import { createSSEClient, type SSEClient } from '$lib/api/sse';
import {
	generateEvents,
	generateIndicators,
	generatePeers,
	generateChatMessages,
	generateStats,
	generateVulnerabilities,
	generateSingleEvent
} from '$lib/dummy/data';
import type {
	SignedEvent,
	SignedIndicator,
	SignedChatMessage,
	PeerWithStatus,
	Stats,
	Vulnerability,
	EventWithPath
} from '$lib/api/types';

// ── Reactive state (module-level singletons) ────────────────────────

let stats = $state<Stats | null>(null);
let events = $state<SignedEvent[]>([]);
let indicators = $state<SignedIndicator[]>([]);
let peers = $state<PeerWithStatus[]>([]);
let chatMessages = $state<SignedChatMessage[]>([]);
let vulnerabilities = $state<Vulnerability[]>([]);
let connected = $state(false);
let online = $state(false);

/** Maximum number of items to keep in memory per collection. */
const MAX_ITEMS = 500;

// ── SSE client singleton ────────────────────────────────────────────

let client: SSEClient | null = null;
let _dummy = false;
let _dummyInterval: ReturnType<typeof setInterval> | null = null;

/** Subscribers notified when a new event arrives (for packet animations). */
let _eventListeners: Array<(event: EventWithPath) => void> = [];

/** Seed all collections with generated demo data + start continuous stream. */
function startDummy(): void {
	if (_dummy) return;
	if (typeof window === 'undefined') return;
	_dummy = true;

	const dummyEvents = generateEvents(80);
	const dummyPeers = generatePeers(584);
	const dummyIndicators = generateIndicators(25);
	const dummyChatMessages = generateChatMessages(dummyEvents.slice(0, 5).map(e => e.id), 12);
	const dummyVulns = generateVulnerabilities(12);
	const dummyStats = generateStats(dummyPeers, dummyEvents);

	stats = dummyStats;
	events = dummyEvents;
	indicators = dummyIndicators;
	peers = dummyPeers;
	chatMessages = dummyChatMessages;
	vulnerabilities = dummyVulns;
	connected = true;
	online = true;

	// Continuous event stream — new event every 2–5 seconds
	const selfId = dummyStats.node_id;
	_dummyInterval = setInterval(() => {
		const event = generateSingleEvent();
		// Append self as final hop (I received this event)
		if (!event.path.includes(selfId)) event.path.push(selfId);
		events = [event, ...events].slice(0, MAX_ITEMS);
		for (const fn of _eventListeners) fn(event);
	}, 2000 + Math.random() * 3000);
}

function start(initialStats: Stats | null, initialEvents?: SignedEvent[]): void {
	// Only start once (client-side only)
	if (client) return;
	if (typeof window === 'undefined') return;

	// Seed with SSR data
	if (initialStats) {
		stats = initialStats;
		online = true;
	}
	if (initialEvents) {
		events = initialEvents;
	}

	client = createSSEClient({
		onConnected: () => {
			connected = true;
			online = true;
		},
		onOpen: () => {
			connected = true;
			online = true;
		},
		onError: () => {
			connected = false;
		},
		onEvent: (event) => {
			// Prepend new event, dedup by id, cap size
			events = [event, ...events.filter((e) => e.id !== event.id)].slice(0, MAX_ITEMS);
			for (const fn of _eventListeners) fn(event);
		},
		onIndicator: (indicator) => {
			indicators = [indicator, ...indicators.filter((i) => i.id !== indicator.id)].slice(
				0,
				MAX_ITEMS
			);
		},
		onChat: (message) => {
			chatMessages = [message, ...chatMessages.filter((m) => m.id !== message.id)].slice(
				0,
				MAX_ITEMS
			);
		},
		onStats: (s) => {
			stats = s;
			online = true;
		},
		onPeer: (peer) => {
			const idx = peers.findIndex((p) => p.node_id === peer.node_id);
			if (idx >= 0) {
				peers[idx] = peer;
				// Trigger reactivity by reassigning
				peers = [...peers];
			} else {
				peers = [peer, ...peers];
			}
		}
	});
}

function stop(): void {
	client?.close();
	client = null;
	if (_dummyInterval) { clearInterval(_dummyInterval); _dummyInterval = null; }
	_dummy = false;
	connected = false;
}

/** Subscribe to new events (returns unsubscribe fn). Used for packet animations. */
function onEvent(fn: (event: EventWithPath) => void): () => void {
	_eventListeners.push(fn);
	return () => { _eventListeners = _eventListeners.filter(l => l !== fn); };
}

/** Seed peers from SSR load (topology page). */
function seedPeers(p: PeerWithStatus[]): void {
	peers = p;
}

/** Seed indicators from SSR load. */
function seedIndicators(i: SignedIndicator[]): void {
	indicators = i;
}

// ── Public API ──────────────────────────────────────────────────────

export const liveStore = {
	start,
	startDummy,
	stop,
	seedPeers,
	seedIndicators,
	onEvent,

	get stats() {
		return stats;
	},
	get events() {
		return events;
	},
	get indicators() {
		return indicators;
	},
	get peers() {
		return peers;
	},
	get chatMessages() {
		return chatMessages;
	},
	get vulnerabilities() {
		return vulnerabilities;
	},
	get connected() {
		return connected;
	},
	get online() {
		return online;
	}
};
