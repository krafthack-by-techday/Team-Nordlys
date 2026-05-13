# ADR-0013: Contracts package as single source of truth

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Six services exchange the same data shapes: events, indicators, chat
messages, peer identities, revocations, vulnerabilities, scan
results, audit log entries. Each service has at least three places
that need the shape — the inbound request validator, the storage
layer, the outbound forwarder — and several services consume shapes
they do not themselves produce. If each service keeps its own copy of
each shape, drift is inevitable: one service adds a field, another
service silently drops it on round-trip, the OpenAPI documentation
goes out of step with reality. The integrity of cross-service
canonicalisation also depends on every service agreeing on the exact
field names and types of a signed object; a small mismatch means a
signature that was valid at the producer no longer verifies at the
consumer.

This decision serves Tenet 5 (one writer per responsibility) by
giving the schema a single authoritative owner that every service
consumes, and Tenet 1 (trust lives in signatures) by ensuring every
service canonicalises identical bytes for any signed object.

## Decision

A standalone package (separate from any service) holds the
authoritative schema for every type that crosses a service boundary.
Every service imports its types from this package and uses the same
schema both as a runtime validator on inbound traffic and as the
type definition for the data it manipulates internally. The schema
package is also the input to OpenAPI generation, so the published
API documentation is derived from the same source as the code that
implements it.

## Consequences

- A field added to a contract is visible to every service that
  imports it, surfacing eagerly as a type or validator mismatch on
  services that need to be updated.
- Inbound validation, internal types, and OpenAPI documentation
  cannot drift relative to each other; they share a generator.
- Signed objects canonicalise consistently across services because
  all services agree on the field set.
- A contract change forces a coordinated update across services. A
  small change at the contracts layer can produce build failures
  in many places, which is correct but noisy in a busy
  development cycle.
- The package is a hard dependency of every service. A bug in the
  contracts package (an accidentally exported wrong type, a
  validator regression) propagates to every service simultaneously.
- The model is bad at evolving contracts incrementally. Adding an
  optional field is straightforward, but changing the meaning of
  an existing field requires a versioning discipline that the
  package itself does not enforce — the convention is to introduce
  a new versioned route and a new contract rather than mutate.

## Alternatives considered

- **Per-service schema definitions.** Each service owns its own
  types and validators. Rejected because of the inevitable drift
  problem and because the OpenAPI documentation across services
  could not be kept consistent.
- **Generated types from a single OpenAPI document.** A
  centralised OpenAPI spec generates types per service. Equivalent
  in effect but adds a code-generation step and gives weaker
  in-language type ergonomics than direct type imports.
- **Database schema as source of truth.** Use the ORM definitions
  directly. Rejected because not every contract is a stored shape
  (request bodies, WS frames, ingest inputs), and because tying
  external API shape to internal storage shape conflates two
  concerns that should evolve separately.

## References

- `app/be/packages/contracts/src/`
- `app/be/packages/contracts/src/primitives.ts`
- `app/be/packages/contracts/src/event.ts`
- `app/be/packages/contracts/src/identity.ts`
- `app/be/packages/contracts/src/vulnerability.ts`
