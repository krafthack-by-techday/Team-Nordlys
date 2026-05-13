# ADR-0007: State-snapshot bootstrap frame

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

A node connecting to a Varde for the first time, or reconnecting
after an outage, starts with an out-of-date picture of the mesh:
which peers exist, which keys they hold, which peers have been
revoked, which other Vardes are reachable. Without that picture,
inbound events from other peers cannot be verified (the signer is
unknown), invite-validation flows cannot pick a trusted peer to
forward to, and the operator dashboard shows incomplete topology.
The straightforward way to fill the picture would be a sequence of
small queries (one per identity, one per revocation, one for the
roster) issued by the node after the connection opens. At
sector-mesh scale (low hundreds of identities) those queries
multiply round-trips.

The picture is also one that the Varde already has, fully indexed in
its local database, and that the Varde can serialise once and ship
in one go.

The frame is anchor-agnostic: each identity in the snapshot carries
its own anchor signature, so a multi-anchor deployment ships
identities signed by different anchors in the same frame without
protocol change. This decision serves Tenet 1 (trust lives in
signatures) by re-verifying every identity and revocation in the
snapshot rather than trusting the snapshot's source, Tenet 4
(convergence) by giving newly connected peers a single round-trip to
a converged view of the identity register, and Tenet 8 (auditability)
by ensuring the verifiable identity register is complete from the
first event a peer processes.

## Decision

Immediately after sending WELCOME on a new WebSocket session, the
Varde sends a single STATE_SNAPSHOT frame containing the full
identity register, the full revocation list, and the current Varde
roster. The roster sub-object is signed by the Varde's own key, and
the entire frame body is signed a second time at the outer level.
The receiving node persists each identity, each revocation, and the
roster, and is then ready to verify subsequent inbound traffic.

## Consequences

- A newly connected node has a verifiable view of the mesh's
  identities and revocations within one network round-trip after
  WELCOME, without needing N additional requests.
- The snapshot is signed twice (inner roster, outer body) so a
  downstream node can verify the roster's provenance independently
  of the Varde that delivered it, useful when rosters are forwarded.
- The snapshot is built fresh on every HELLO. There is no caching
  layer, so a Varde with a busy reconnect period serialises the
  snapshot many times in close succession. At v1.0 scale this is
  acceptable; at much larger scale it would warrant a TTL cache.
- The snapshot has no size cap and no pagination. A mesh with
  thousands of identities or a long revocation history would
  produce a large frame. Today's design assumes a few hundred
  identities and a small revocation list; pagination becomes a real
  concern only beyond that.
- The receiving node trusts the snapshot's contents in v1.0 and
  re-verifies each identity individually in core-svc; the outer
  signature on the snapshot itself is computed but not yet checked
  in mesh-svc. This is a v1.0 shortcut; closure (verifying the
  outer signature once the Varde's public key has been exchanged
  during the handshake) is on the road-map and not in v1.0 scope.
- The snapshot deliberately excludes events, indicators, and chat
  messages — those are recovered via RESYNC (ADR-0008). This
  separation means the snapshot contains no TLP-bearing objects and
  requires no distribution filtering. If future snapshot types
  include TLP-bearing objects, they must be filtered by the
  requesting node's distribution entitlement (ADR-0020, Layer 10).

## Alternatives considered

- **N small requests after WELCOME.** Each identity, revocation,
  and roster entry fetched separately. Rejected because the
  round-trip cost grows with mesh size and there is no benefit to
  the granularity at bootstrap time.
- **Lazy fetch on first verification failure.** The node starts
  empty; when an inbound event from an unknown signer arrives, the
  node fetches that identity. Rejected because every cold-start
  event would fail verification on the first attempt and require a
  retry, complicating the verification loop.
- **Periodic snapshot pushed to all sessions.** A pre-built
  snapshot pushed by the Varde on a timer, used for both bootstrap
  and refresh. Rejected because the v1.0 shape (build per HELLO)
  is simpler and the refresh case is already covered by the
  identity-update broadcast on changes.

## References

- ADR-0008 (Resync catchup protocol) — events recovered separately
- ADR-0020 (TLP v2.0 enforcement architecture) — future snapshot
  types must be TLP-filtered (Layer 10)
- `app/be/services/varde-svc/src/snapshot.ts`
- `app/be/services/varde-svc/src/ws-handler.ts` (snapshot sent
  immediately after WELCOME)
- `app/be/services/mesh-svc/src/inbound.ts` (snapshot processing on
  receive)
- `app/be/packages/ws-protocol/src/index.ts` (`StateSnapshotMsg`)
- RFC 8785 (JSON Canonicalisation Scheme), used for the signature
  payload.
