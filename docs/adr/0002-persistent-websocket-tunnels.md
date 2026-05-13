# ADR-0002: Persistent WebSocket tunnels

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Each node has to exchange events with the mesh in near real time. The
node sits in an internal zone behind a firewall that allows outbound
TLS but not inbound traffic from the internet. Two basic transport
shapes are available under that constraint: short-lived HTTP requests
that the node initiates on a polling interval, or a long-lived
connection the node opens once and reuses for many messages in both
directions. The mesh has both write traffic from node to Varde
(originating events) and push traffic from Varde to node (events
gossiped from other peers, identity updates, revocations, bootstrap
snapshots, invite-validation forwards).

Polling has the operational virtue of being trivial to debug and
firewall-friendly, but at the rate the operator dashboard needs to
update (sub-second on incoming events) it requires very short polling
intervals, which dominate request volume with empty responses. A
long-lived connection lets the Varde push the moment it has something
and lets the node send the moment it has something, with one TCP and
one TLS handshake amortised over the entire session.

> **Note**: The original choice of WebSocket over HTTP polling is not
> documented in code comments. Rationale recorded here is reconstructed
> from the message patterns the protocol supports. Team to confirm.

This decision serves Tenet 6 (operational realism) by accepting a
stateful protocol to fit the observed firewall and latency
constraints, and Tenet 4 (convergence over guaranteed delivery) by
leaving disconnect-window losses to the catchup protocol rather than
building an on-disk queue at the transport layer.

## Decision

Each node opens a small fixed number of long-lived WebSocket
connections to a selected subset of Vardes. Connections are initiated
outbound from the node, terminated by TLS at the Varde, and held open
indefinitely under a keepalive regime. On disconnect the node retries
with exponential backoff (base 1 s, doubling per attempt, ceiling
60 s, additive jitter up to 30% of the current base). Liveness is
maintained by a periodic application-level ping; the server side reaps
sessions that have been idle for the equivalent of three missed pings.

## Consequences

- Push traffic from Varde to node is delivered immediately rather
  than on the next poll, so the operator dashboard sees gossiped
  events from peers within seconds.
- The single outbound TLS handshake amortises across the session,
  removing the per-event TLS cost that HTTP polling would incur.
- The protocol can carry stateful flows (HELLO, WELCOME, RESYNC,
  parked invite validation) that map awkwardly onto stateless
  request/response.
- WebSockets are harder to debug than HTTP. Operations teams without
  WS-aware tooling cannot inspect a session as easily as a single
  request, and proxies that buffer or strip the upgrade header break
  the transport silently.
- The fan-out broadcast on the node side is fire-and-forget: a frame
  written to a closed socket is dropped, and there is no on-disk
  retry queue. Events sent during a brief disconnect window can be
  lost unless they are recovered later through the catchup protocol
  (ADR-0008).
- A coordinated reconnect storm (e.g. a Varde restart) creates a
  burst of concurrent upgrade attempts. The Varde mitigates this with
  an upgrade-rate throttle that returns 503 to excess attempts and
  relies on client backoff to spread retries.

## Alternatives considered

- **Short-interval HTTP polling.** Each node polls each Varde for new
  events on a fixed interval. Conceptually simple and proxy-friendly,
  but at sub-second latency targets it dominates request volume with
  empty responses, and the push-from-Varde traffic patterns
  (invite-validation forwards, identity updates, bootstrap snapshots)
  do not map naturally to a polling client.
- **Server-Sent Events (SSE) one-way push plus separate POST for
  writes.** A reasonable middle ground that avoids the bidirectional
  WebSocket complexity. Rejected because the protocol uses correlated
  request/response (corr_id on invite validation) that benefits from
  a single stateful channel.
- **gRPC streaming.** Equivalent transport semantics with stronger
  typing, but adds a heavier dependency stack and is awkward to
  proxy through DMZ infrastructure that is comfortable with
  HTTP/WebSocket.

## References

- `app/be/services/mesh-svc/src/tunnel.ts`
- `app/be/services/mesh-svc/src/manager.ts`
- `app/be/services/varde-svc/src/ws-handler.ts`
- `app/be/services/varde-svc/src/throttle.ts`
- `app/be/packages/ws-protocol/src/index.ts`
