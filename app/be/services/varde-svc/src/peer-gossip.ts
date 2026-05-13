import { verifyObject } from "@nordlys/crypto";
import type { Revocation, SignedEvent, SignedPeerIdentity } from "@nordlys/contracts";
import { config } from "./config";
import { broadcast } from "./connections";
import { getDbInstance } from "./db";
import { peerGossipPullsTotal } from "./metrics";
import {
  dedupInsertEvent,
  getIdentity,
  insertRevocation,
  isRevoked,
  upsertIdentity,
} from "./repos";

// One ISO timestamp per peer URL. In-memory only — on restart we re-pull
// from cursor=0; UUID dedup at the DB layer makes this safe (just chatty).
const eventCursors = new Map<string, string>();

/** Track consecutive failures per peer for frequency reduction. */
const peerFailures = new Map<string, number>();
const MAX_CONSECUTIVE_FAILURES = 5;

async function syncIdentityFromPeer(peerUrl: string): Promise<void> {
  const res = await fetch(`${peerUrl}/v1/identity`, {
    signal: AbortSignal.timeout(3000),
  }).catch(() => null);
  if (!res || !res.ok) return;
  const data = (await res.json().catch(() => null)) as
    | { peers?: SignedPeerIdentity[]; revocations?: Revocation[] }
    | null;
  if (!data) return;

  const db = getDbInstance();
  for (const peer of data.peers ?? []) {
    // Trust-on-first-use for self-signed records; otherwise the issuer must
    // already be in our register and the signature must verify.
    if (peer.signed_by !== peer.node_id) {
      const issuer = await getIdentity(db, peer.signed_by);
      if (issuer && !verifyObject(peer, issuer.public_key)) continue;
    }
    await upsertIdentity(db, peer);
  }
  for (const rev of data.revocations ?? []) {
    const issuer = await getIdentity(db, rev.signed_by);
    if (issuer && !verifyObject(rev, issuer.public_key)) continue;
    await insertRevocation(db, rev);
  }
}

async function syncEventsFromPeer(peerUrl: string): Promise<void> {
  const cursor = eventCursors.get(peerUrl) ?? new Date(0).toISOString();
  const res = await fetch(
    `${peerUrl}/v1/events/since/${encodeURIComponent(cursor)}`,
    { signal: AbortSignal.timeout(3000) },
  ).catch(() => null);
  if (!res || !res.ok) return;
  const events = (await res.json().catch(() => null)) as SignedEvent[] | null;
  if (!Array.isArray(events) || events.length === 0) return;

  const db = getDbInstance();
  let latest = cursor;
  let newCount = 0;
  for (const event of events) {
    if (await isRevoked(db, event.node_id)) continue;
    const signer = await getIdentity(db, event.node_id);
    if (!signer) continue;
    if (!verifyObject(event, signer.public_key)) continue;

    const { inserted } = await dedupInsertEvent(db, event);
    if (inserted) {
      newCount++;
      // Fan out to locally-connected nodes — include relay path
      broadcast({ type: "EVENT", event, path: [event.node_id, config.vardeId] });
    }
    if (event.created_at > latest) latest = event.created_at;
  }
  eventCursors.set(peerUrl, latest);
  if (newCount > 0) {
    console.log(
      `[varde-svc] peer-gossip pulled ${newCount} new events from ${peerUrl}`,
    );
  }
}

/** Cycle counter for frequency-reduced peers. */
let gossipCycle = 0;

async function gossipOnce(): Promise<void> {
  gossipCycle++;

  // Pull from all peers in parallel with individual timeouts
  const results = await Promise.allSettled(
    config.peerVardeUrls.map(async (peerUrl) => {
      // Reduce frequency for failing peers: only try every 3rd cycle after 5 failures
      const failures = peerFailures.get(peerUrl) ?? 0;
      if (failures >= MAX_CONSECUTIVE_FAILURES && gossipCycle % 3 !== 0) {
        return; // Skip this cycle, but never fully exclude
      }

      try {
        await syncIdentityFromPeer(peerUrl);
        await syncEventsFromPeer(peerUrl);
        peerGossipPullsTotal.inc({ result: "success" });
        // Reset failure counter on success
        peerFailures.set(peerUrl, 0);
      } catch (err) {
        console.warn(`[varde-svc] peer-gossip ${peerUrl} failed:`, err);
        peerGossipPullsTotal.inc({ result: "fail" });
        peerFailures.set(peerUrl, (peerFailures.get(peerUrl) ?? 0) + 1);
      }
    }),
  );
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPeerGossip(): void {
  if (config.peerVardeUrls.length === 0) {
    console.log("[varde-svc] no peer Varder configured — gossip-loop idle");
    return;
  }
  console.log(
    `[varde-svc] peer-gossip-loop: ${config.peerVardeUrls.length} peers, interval=${config.gossipIntervalMs}ms`,
  );
  timer = setInterval(() => {
    void gossipOnce();
  }, config.gossipIntervalMs);
}

export function stopPeerGossip(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
