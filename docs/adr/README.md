# Architecture Decision Records

These records document the major design choices behind the Nordlys
backend. Each ADR captures one decision, the forces that shaped it,
its consequences (including what the design is bad at), and the
realistic alternatives that were considered and rejected.

The records are intended to outlive the current implementation.
They describe decisions, not code; an engineer porting the system
to another language should be able to use these records as the
design reference without reading the existing source. Implementation
details (current language, framework, file paths) appear only in
each ADR's References section.

For a five-page entry document covering the system as a whole, see
[`../architecture-overview.md`](../architecture-overview.md).

---

## Mesh & Transport

How Vardes connect, gossip, and deliver messages across the mesh.

- [ADR-0001 — Hub-spoke at node, mesh at Varde](0001-hub-spoke-at-node-mesh-at-varde.md). Internal-zone hub-and-spoke around the API gateway, flat mesh of peer-owned Vardes between organisations.
- [ADR-0002 — Persistent WebSocket tunnels](0002-persistent-websocket-tunnels.md). Long-lived outbound connections from nodes to Vardes, with reconnect backoff and application-level liveness pings.
- [ADR-0003 — Rendezvous hashing for Varde selection](0003-rendezvous-hashing-for-varde-selection.md). HRW-based deterministic selection so adding or removing a Varde re-routes only N/M of the fleet.
- [ADR-0004 — Top-N tunnels per node](0004-top-n-tunnels-per-node.md). Each node maintains N parallel tunnels (default 3) with fan-out broadcast and receiver-side dedup.
- [ADR-0007 — State-snapshot bootstrap frame](0007-state-snapshot-bootstrap-frame.md). One signed frame after WELCOME ships the full identity register, revocations, and Varde roster.
- [ADR-0008 — Resync catchup protocol](0008-resync-catchup-protocol.md). Reconnecting nodes pull missed records by ISO timestamp cursor, capped at 500 per response.
- [ADR-0009 — Anti-entropy pull at the Varde layer](0009-anti-entropy-pull-at-varde-layer.md). Each Varde periodically pulls from every peer Varde over HTTP; UUID dedup absorbs overlap. **Superseded by ADR-0023 for inter-Varde gossip.**
- [ADR-0016 — Health-aware Varde selection](0016-health-aware-varde-selection.md). Misbehaving Vardes are deprioritised but never excluded, with hysteresis and a redundancy floor.
- [ADR-0023 — Bounded gossip topology](0023-bounded-gossip-topology.md). Replaces flat all-to-all gossip with bounded-fanout gossip (random-k or Plumtree). Each Varde gossips with ~15 peers instead of N-1. Implements Tenet 3.
- [ADR-0024 — Direct delivery with envelope encryption](0024-direct-delivery-with-envelope-encryption.md). Separate delivery channel for TLP:RED and AMBER-with-recipients: HTTP POST directly to recipient Vardes with SSB-inspired envelope encryption (X25519 + XChaCha20-Poly1305).

## Trust & Identity

How peers establish identity, authenticate, and revoke trust.

- [ADR-0005 — Single-writer core-svc](0005-single-writer-core-svc.md). One service holds the write monopoly on signed-object tables; others forward.
- [ADR-0006 — Private key isolation from mesh-svc](0006-private-key-isolation-from-mesh-svc.md). The signing key lives in core-svc only; the network-facing process never sees it.
- [ADR-0010 — KraftCERT as trust anchor](0010-kraftcert-as-trust-anchor.md). One peer is the sole identity issuer in v1.0; multi-anchor design is on the road-map.
- [ADR-0011 — Invite-token onboarding](0011-invite-token-onboarding.md). Single-use, hashed-at-rest, company-bound 1-hour tokens issued out-of-band by the trust anchor.

## Data & Storage

How objects are stored, partitioned, deduplicated, and validated.

- [ADR-0012 — Postgres table partitioning](0012-postgres-table-partitioning.md). Time-range partitions on events (weekly) and audit_log (monthly); retention by DROP TABLE.
- [ADR-0013 — Contracts package as single source of truth](0013-contracts-as-single-source-of-truth.md). One schema package shared by every service drives runtime validation, internal types, and OpenAPI.
- [ADR-0015 — Trust-ranked vulnerability deduplication](0015-trust-ranked-vulnerability-deduplication.md). Per-source trust score governs whether an incoming report overwrites or only enriches.

## Extensions

How the core is extended with plugins, scenarios, and detection content.

- [ADR-0014 — YAML scenario engine with shadow mode](0014-yaml-scenario-engine-with-shadow-mode.md). Domain-readable detection rules with AND-only matchers and a flag for live-traffic dry runs.
- [ADR-0017 — Plugin trust model](0017-plugin-trust-model.md). Skeleton — blocked on anchor clarifications. Manifest format, capability language, signing protocol for extensions.
- [ADR-0018 — Plugin quality rating model](0018-plugin-quality-rating-model.md). Skeleton — depends on ADR-0017. Quality signals, community ratings, and trust scores for extensions.
- [ADR-0019 — Composable extension points](0019-composable-extension-points.md). Skeleton — depends on ADR-0017. Plugin-of-plugin composition: domain extensions exposing interfaces that sub-extensions implement.

## Security & Access Control

TLP enforcement, RBAC, and detection/correlation architecture.

- [ADR-0020 — TLP v2.0 enforcement architecture](0020-tlp-enforcement.md). Defence-in-depth TLP enforcement at every propagation boundary: signing, mesh fan-out, Varde gossip, API gateway, database queries. Implements Tenet 10.
- [ADR-0021 — Role-based access control](0021-rbac.md). Skeleton — depends on ADR-0020. Operator-level RBAC with TLP clearance, functional roles, and emergency escalation. Implements Tenet 11.
- [ADR-0022 — Correlation and incident detection](0022-correlation-and-incident-detection.md). Local-first correlation with three-stage lifecycle (local → shadow → promoted), TLP high-water mark enforcement, amplification prevention, and cryptographic authority marking.
