# ADR-0009: Anti-entropy pull at the Varde layer

**Status**: Proposed — partially superseded by ADR-0023
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

When a node publishes an event, that event is sent over the node's
WebSocket tunnels to a small set of Vardes (ADR-0004). The Varde
fans out the event to every node currently connected to that same
Varde. But a node connected to a different Varde does not see the
event until something carries it across the Varde-to-Varde boundary.
Without that path, the mesh is partitioned by Varde-affinity: every
peer sees only events from senders that happen to share at least one
selected Varde with the receiver.

The cross-Varde path can be push (the originating Varde forwards to
its peers) or pull (each Varde periodically asks its peers what they
have). Push has lower latency but creates fan-out fan-in patterns
that need a per-peer subscriber list and inbound firewall rules on
each Varde. Pull is higher latency but makes every Varde
self-sufficient: it knows what to ask for and asks on its own
schedule.

For events the protocol is anchor-agnostic; the last-writer-wins
identity-conflict resolution is fundamentally single-anchor and
would need a versioning or precedence scheme under multi-anchor
deployments — flagged as an open question. This decision serves
Tenet 4 (convergence) as the consistency safety net behind direct
fan-out, Tenet 2 (mesh continuity) by routing around a failed Varde
without coordination, Tenet 3 (bounded fanout) through the
seven-second cycle and per-request timeout, and Tenet 6 (operational
realism) through frequency reduction for failing peer-relays without
exclusion.

## Decision

Each Varde runs a periodic anti-entropy loop that pulls events,
identities, and revocations from every other Varde in its configured
peer list. The loop runs every seven seconds, in parallel across all
peers, with a three-second per-request timeout. Each cycle pulls
identities first, then events newer than the per-peer in-memory
cursor. Conflicts on identities resolve last-writer-wins; events are
append-only and deduplicate on UUID. A peer that has failed five
consecutive pulls is attempted only every third cycle until it
recovers, but is never excluded from the roster.

## Consequences

- A failure of any one Varde does not orphan the events that
  reached it; peer Vardes pull them on the next cycle and they
  continue to propagate even while the originating Varde is
  unreachable from some readers.
- The pull-only design means no Varde needs an inbound firewall
  rule for push subscribers. Every cross-Varde call is a Varde
  initiating an outbound HTTPS request.
- The seven-second interval bounds the cross-Varde latency. A
  receiving node that is not directly connected to the originating
  Varde sees the event within roughly one gossip cycle, plus the
  fan-out latency on the receiving side. End-to-end this stays
  under ten seconds in normal operation.
- The cursor is held in memory only. On Varde restart, the cursor
  resets and the next pull re-fetches everything the peer has;
  UUID deduplication absorbs the redundancy. This is wasteful but
  safe.
- Conflict resolution on identities is naive (last-writer-wins).
  In v1.0 KraftCERT is the sole identity issuer (ADR-0010), so the
  conflict case does not arise. In a future multi-anchor design,
  this resolution becomes inadequate and would need a
  versioning-or-precedence scheme. Specifying that scheme is a
  prerequisite for any multi-anchor deployment; not in v1.0 scope.
- The protocol has no notion of partitions or epochs. After a long
  network split, the two halves reconcile by gossip pull and
  deduplication, with no explicit reconciliation step. This works
  for short partitions but provides no signal to the operator that
  a split occurred.
- Gossip pull responses must be filtered by TLP distribution before
  sending (ADR-0020). A RED event addressed to peers [A, B] must
  not appear in pull responses to peer C's Varde. This requires the
  gossip endpoint to resolve the requesting Varde's owner from the
  roster and apply the distribution check per object. The pull
  query shape (`since cursor`) remains the same; the result set is
  narrowed by distribution entitlement.

## Alternatives considered

- **Push between Vardes.** The originating Varde forwards every
  event to every peer Varde. Lower latency. Rejected because it
  requires inbound rules on each Varde and a per-peer subscriber
  list to manage, and the seven-second pull cycle is fast enough
  for the use case.
- **A coordinator that batches and distributes.** One Varde
  serialises mesh state and others pull from it. Rejected because
  it re-introduces a central role that the architecture exists to
  avoid.
- **No cross-Varde gossip; rely on direct fan-out only.** Each
  event reaches only the nodes directly connected to a Varde the
  publisher also chose. Rejected because the rendezvous-hashing
  selection (ADR-0003) makes most node pairs share zero or one
  Varde, leaving the mesh effectively partitioned by selection
  affinity.

## References

- ADR-0020 (TLP v2.0 enforcement architecture) — gossip responses
  must be TLP-filtered (Layer 4)
- `app/be/services/varde-svc/src/peer-gossip.ts`
- `app/be/services/varde-svc/src/routes/gossip.ts`
- `app/be/services/varde-svc/src/repos.ts`
  (`upsertIdentity`, `dedupInsertEvent`)
