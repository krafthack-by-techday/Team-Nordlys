/**
 * Peer-related utility functions.
 * Single source of truth for peer status logic.
 */
import type { SignedPeerIdentity, PeerWithStatus } from '$lib/api/types';

const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutes

/** Check if a peer is stale (offline) based on last_seen_at.
 *  Self-node is never stale — if the service is running, we are online by definition. */
export function isPeerStale(
	lastSeenAt: string | undefined,
	thresholdMs = DEFAULT_STALE_MS,
	isSelf = false
): boolean {
	if (isSelf) return false;
	if (!lastSeenAt) return true;
	return Date.now() - new Date(lastSeenAt).getTime() > thresholdMs;
}

/** Check if a peer is a KraftCERT node (self-registered). */
export function isKraftcert(peer: SignedPeerIdentity | PeerWithStatus): boolean {
	return peer.registered_by === peer.node_id;
}
