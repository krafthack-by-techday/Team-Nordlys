# ADR-0008: Resync catchup protocol

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Nodes go offline. A node may be down for maintenance, may have lost
its WebSocket session for minutes, or may be brought up after a long
outage. While it was disconnected, other peers continued to publish
events that the Varde fan-out attempted to deliver and could not. On
reconnect, the node has to fill the gap: it needs the events it
missed, in a form it can verify and store. The bootstrap snapshot
(ADR-0007) covers identities and roster, but does not include the
events themselves — those are too many and too large to ship in one
frame.

The catchup mechanism has to answer two questions: how the node
identifies what it missed, and how the Varde returns the missed
events without overwhelming the session.

> **Note**: The choice of timestamp cursor over a sequence-number cursor
> is not justified in code comments. Rationale recorded here is
> reconstructed from the fact that timestamps are globally comparable
> across Vardes whereas per-Varde sequence numbers would not be. Team
> to confirm.

The protocol is anchor-agnostic: catchup recovers signed objects
regardless of which anchor authorised the originating peer. This
decision serves Tenet 4 (convergence) directly by recovering missed
events through idempotent re-delivery and UUID dedup, and Tenet 3
(bounded fanout) by capping any one response at 500 records.

## Decision

After receiving WELCOME, the node fetches its own last-event cursor
(an ISO timestamp) from its local database and sends a RESYNC frame
naming the cursor and the channels it wants to catch up on (events,
indicators, chat). The Varde responds with the matching records in
ascending timestamp order, capped at 500 records per response. If
the catchup spans more than the cap, the node observes the highest
timestamp it received and issues a follow-up RESYNC with that
cursor. Deduplication on UUID at the receiving side prevents
double-insertion when the cursor boundary overlaps.

## Consequences

- A node that has been offline for any duration can re-synchronise
  with a known protocol; there is no separate offline-recovery code
  path.
- Cursors are timestamps, which compose naturally with the
  Varde-to-Varde anti-entropy gossip (ADR-0009). The same query
  shape (`since cursor`) is used by both flows.
- The 500-record cap bounds the size of any one response and keeps
  a runaway resync from blocking the session for a long time. A
  large gap requires multiple round-trips, which the node iterates
  on its own.
- Cursor storage on the node side is the local last-event timestamp
  in core-svc. There is no separate per-Varde cursor; the node
  treats the mesh's event stream as a single ordered set.
- The protocol has no continuation token. The node infers the next
  cursor from the highest timestamp in the response, which works
  but is fragile if two events share the same timestamp at the
  boundary — one of them risks being skipped or re-fetched.
  Deduplication on UUID covers re-fetch but not skip.
- A node that produces events while offline must re-publish them
  itself; the catchup protocol is one-way (Varde to node). There is
  no store-and-forward queue in the mesh transport for outbound
  events that were submitted during a disconnect.
- RESYNC responses must be filtered by TLP distribution before
  sending (ADR-0020). A RED event addressed to peers [A, B] must
  not appear in RESYNC responses to node C. The Varde applies the
  same distribution check as gossip pull (ADR-0009): the requesting
  node's identity determines which objects are included in the
  response.

## Alternatives considered

- **Per-Varde sequence numbers as cursor.** Each Varde assigns a
  monotonic seq to every event it accepts; the node tracks one
  cursor per Varde. Rejected because the same event arrives at
  multiple Vardes (gossip and direct fan-out both deliver it), so
  per-Varde seq does not give a single coherent cursor and the node
  would have to reconcile multiple cursors on every connect.
- **Full mesh state replay on reconnect.** Whatever the cursor, the
  Varde returns everything it has. Rejected because the volume
  grows unboundedly with mesh history and most reconnects are
  short-gap, where the cost is wasted.
- **Push-based catchup queued by the Varde.** The Varde keeps a
  per-session backlog while the session is disconnected and pushes
  it on reconnect. Rejected because the Varde does not always know
  which sessions will reconnect and which are gone for good, and a
  long-lived backlog ties Varde memory to client behaviour.

## References

- ADR-0020 (TLP v2.0 enforcement architecture) — RESYNC responses
  must be TLP-filtered (Layer 10)
- `app/be/services/mesh-svc/src/tunnel.ts` (RESYNC issuance after
  WELCOME)
- `app/be/services/varde-svc/src/ws-handler.ts` (RESYNC handler)
- `app/be/services/varde-svc/src/repos.ts` (`eventsSinceCursor`,
  hard limit 500)
- `app/be/services/core-svc/src/routes/inbound.ts`
  (`/last-event-cursor` endpoint)
