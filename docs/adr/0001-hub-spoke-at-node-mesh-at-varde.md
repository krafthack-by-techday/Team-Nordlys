# ADR-0001: Hub-spoke at node, mesh at Varde

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

A Nordlys peer comprises two distinct deployment zones with very
different network properties. The internal zone is where the
incident-response team sits and where the signing key lives; security
operations will not allow inbound internet connections into that zone
and will only reluctantly allow outbound. The DMZ is the zone
explicitly designated for hosting services that face the internet.
Across organisations, the system has to share signed events under the
constraint that no peer is structurally privileged or load-bearing for
the rest.

A flat peer-to-peer mesh between internal-zone nodes would require
opening firewall holes that real power companies refuse to open. A
single central server reachable by all internal-zone nodes would
re-introduce the very single-point-of-failure that the project exists
to avoid. Inside the organisation, the network has many backend
services with similar but not identical authentication needs that
should not each implement their own auth, audit, and rate-limit
plumbing.

The DMZ-Varde-plus-internal-node split is fundamental to
sector-specific OT deployments generally and is parameterizable for
sectors other than Norwegian energy. This decision serves Tenet 2
(mesh continuity) by avoiding any hub Varde whose loss would
partition the sector, and Tenet 7 (sector-specific cyber threat
sharing) by reflecting the OT reality that internal-zone networks
will not accept inbound internet connections.

## Decision

Two topologies coexist by design. Inside the organisation, the node
stack is hub-and-spoke: one process (the API gateway) is the sole
externally-reachable component and acts as the auth, audit, and
rate-limit hub for all backend services. Backend services bind to
internal addresses and trust calls reaching them. Across
organisations, Vardes form a flat mesh where every Varde gossips with
every other Varde over HTTP and there is no hub Varde.

## Consequences

- The internal zone never accepts inbound connections from the
  internet, which removes a class of firewall objections that would
  otherwise block adoption.
- Backend services do not implement authentication or audit logging
  themselves, which centralises one piece of security-critical code
  and makes it easier to review.
- The api-gateway becomes a per-peer single point of failure: if it
  dies, the operator loses the dashboard and external ingestion until
  it is restarted. The mesh keeps running because mesh transport does
  not flow through the gateway.
- Loss of any single Varde takes only that Varde's organisation
  off-mesh, not the wider network. There is no hub Varde whose loss
  would partition the sector.
- The model is bad at deployments where the peer cannot operate a
  DMZ. Such peers must lean on a third party's Varde, which
  re-introduces a trust dependency the architecture otherwise avoids.
- Two topologies double the operational concept count: an operator
  has to understand both the internal hub-and-spoke and the external
  Varde mesh.

## Alternatives considered

- **Flat peer-to-peer between internal nodes.** Direct WS or HTTP
  between nodes in different organisations. Rejected because no
  realistic security operations team will open inbound internet ports
  to a zone holding signing keys and incident data.
- **One sector-operated central server.** A KraftCERT-hosted relay
  that all peers connect to. Rejected because it is the canonical
  high-value target the project exists to avoid, and because the
  operator becomes a sector-critical service provider with all the
  governance baggage that entails.
- **Two-tier Varde split** (sector-operated public layer plus
  per-peer private Vardes). Rejected because the two-tier design
  creates a dependency on the sector-operated tier and adds a
  routing problem without removing any failure modes.

## References

- `app/be/services/api-gateway/src/index.ts`
- `app/be/services/api-gateway/src/auth.ts`
- `app/be/services/varde-svc/src/peer-gossip.ts`
- `app/be/README.md` (Varde mesh section, "each peer owns its own
  Varde")
- `docs/TBD-TRANSPORT-ARKITEKTUR.md`
