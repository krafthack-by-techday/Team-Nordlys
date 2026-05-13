# ADR-0005: Single-writer core-svc

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Several services on a node touch the same database: the API gateway
writes the audit log, the collector forwards events for persistence,
the scanner emits scan results as events, and the mesh layer brings
in events that other peers signed. The events table and a handful of
related tables (indicators, chat messages, peer identities, the
revocation list) carry cryptographic signatures and are the primary
auditable record on the node. Allowing every service that has reason
to insert into those tables to do so directly creates two distinct
problems. The first is integrity: signing requires the private key,
so any writer would need access to it (which conflicts with
ADR-0006). The second is consistency: an unsigned object that
slipped past one of multiple writers would be indistinguishable from
a signed one without re-checking every row.

The single-writer property is anchor-agnostic: it concerns mutation
locality on a single peer and works identically with one or many
co-equal trust anchors. This decision serves Tenet 5 (one writer per
responsibility) directly, Tenet 1 (trust lives in signatures) by
routing every signed-object insert through one canonicalisation-and-
signing path, and Tenet 8 (auditability) by keeping rate-cap, dedup,
and severity policy enforcement in one component to audit.

## Decision

One service is the sole writer to the signed-object tables (events,
indicators, chat messages, peer identities, revocations, invite
tokens). All other services that need to persist such an object
forward it over the local network to that service. The service
canonicalises the object, signs it (or re-verifies an externally
signed one), and inserts. Other tables that do not require signing
(audit log, sessions, node settings) are written by their natural
owner.

## Consequences

- The signing key lives in exactly one process. Other services that
  produce events do not need access to it.
- Every record in the signed tables provably traversed the same code
  path: canonicalise, sign or verify, insert. The reader does not
  have to consider the possibility of an unsigned row arriving from
  some other writer.
- Rate-cap enforcement, deduplication, and per-severity policy
  decisions live in one place. They cannot be bypassed by adding a
  new producer that talks directly to the database.
- The single writer is a per-node availability dependency. If it is
  down, no events can be created or accepted from the mesh, even
  though other services are alive.
- Inter-service traffic for every event creation adds a local
  network hop. At node scale this is sub-millisecond and not a
  practical concern, but it is one more failure surface (the
  forwarder may time out, the network may drop) than a direct
  database write would be.
- Refactoring the schema requires the writer to be updated in lock-
  step with the readers. If a reader expects a column the writer no
  longer populates, the failure surfaces only at runtime.
- Queries against the signed-object tables are subject to a
  mandatory TLP-aware filter (ADR-0020, Layer 9). The single-writer
  property composes with this: the writer enforces TLP invariants
  at insert time, and the query layer enforces distribution scoping
  at read time. No other service can bypass either check.

## Alternatives considered

- **Every service writes its own data.** Direct ORM access from
  collector, scanner, and mesh layers. Rejected because it requires
  the signing key in every writer (breaking ADR-0006) and because
  policy enforcement spreads across multiple code paths.
- **Database-level triggers enforcing signature presence.** A
  Postgres trigger that rejects inserts without a valid signature
  field. Rejected because canonicalising and verifying a signature
  in a database trigger is not practical, and because rate-cap and
  deduplication logic still has to live somewhere.
- **A message queue between producers and the writer.** Producers
  enqueue, the writer dequeues. Rejected because the queue adds
  another stateful component to operate, and at node scale a direct
  HTTP forward provides the same decoupling without the operational
  cost.

## References

- ADR-0020 (TLP v2.0 enforcement architecture) — TLP invariant
  enforcement at signing time (Layer 0) and query-time filtering
  (Layer 9)
- `app/be/services/core-svc/src/routes/events.ts`
- `app/be/services/core-svc/src/routes/inbound.ts`
- `app/be/services/core-svc/src/repos/events.ts`
- `app/be/services/core-svc/src/repos/peers.ts`
- `app/be/services/collector-svc/src/forward.ts`
- `app/be/services/scanner-svc/src/index.ts`
