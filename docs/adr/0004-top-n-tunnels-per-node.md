# ADR-0004: Top-N tunnels per node

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Each node maintains some number of WebSocket tunnels to Vardes
(ADR-0002), selected by a stable algorithm (ADR-0003). The number is
a redundancy and bandwidth tunable. One tunnel makes every node
fully dependent on a single Varde and a single TCP path; the failure
of one Varde immediately disconnects every node it serves. Tunnels
to all Vardes maximise redundancy but multiply outbound traffic by
the Varde count and create large fan-in on every Varde when a node
publishes. A middle value gives both redundancy and bounded
fan-out.

A receiving Varde cannot tell from the transport whether two copies
of the same event arrived from one node over two tunnels or from two
different nodes; it has to deduplicate at the object layer regardless,
because gossip between Vardes also produces the same effect. So the
"send to N tunnels" cost is paid in network bandwidth, not in
correctness or in additional dedup logic.

> **Note**: The specific choice of N=3 as default is not justified in
> code comments. Rationale recorded here is reconstructed from the
> redundancy floor (N>=2) and the bandwidth ceiling implied by the
> 400-node scale target. Team to confirm.

This decision serves Tenet 3 (bounded fanout) by capping the
amplification factor on publish traffic, Tenet 2 (mesh continuity) by
tolerating up to N-1 simultaneous Varde failures before a node
becomes mesh-isolated, and Tenet 6 (operational realism) by setting a
redundancy floor that health-driven swaps cannot violate.

## Decision

Each node holds N parallel tunnels to its top-ranked N Vardes, with
N=3 by default and configurable per-deployment. When a node publishes
an event, the event is sent on every open tunnel; the receiving
Vardes deduplicate on UUID at insert time. A separate redundancy
floor (default 2 active tunnels) prevents health-driven Varde
rotation from temporarily reducing the count below the floor.

## Consequences

- The loss of any single Varde leaves the node with N-1 working
  tunnels. At N=3 the node tolerates two simultaneous Varde
  failures before becoming mesh-isolated.
- Each event is sent N times on the wire and deduplicated N-1 times
  on the receive side. At N=3 this is a 3x bandwidth multiplier on
  publish traffic, which the design accepts as the cost of redundancy.
- A node can publish even while one tunnel is mid-reconnect; at
  least one of the remaining tunnels typically delivers.
- The fan-out is poorly tuned for nodes that publish very large or
  very high-rate events. At 3x amplification a high-rate publisher
  costs three times the bandwidth of a single-tunnel design.
- The minimum-tunnel floor at 2 means the node may keep an unhealthy
  Varde in rotation rather than drop below 2 working tunnels. Health
  is one input to selection, not a hard exclusion (see ADR-0016).
- The default of 3 is a guess, not a measured optimum. A deployment
  with strong Varde reliability can reduce N to save bandwidth; a
  deployment with weak Varde reliability would benefit from a higher
  N but trades bandwidth in a way no one has measured.
- Fan-out across N tunnels is not unconditional. Objects with TLP
  distribution labels that restrict delivery to specific peers
  (RED, AMBER with recipients) are sent only on tunnels to Vardes
  owned by entitled peers (ADR-0020, Layer 1). The N-way fan-out
  applies in full only to GREEN and CLEAR objects. This means a RED
  event addressed to one peer uses one tunnel regardless of N.

## Alternatives considered

- **N=1 (single tunnel).** Simpler, no fan-out cost. Rejected
  because a single Varde restart immediately disconnects every node
  served by it, with no graceful failover.
- **N = all Vardes (full fan-out).** Maximum redundancy. Rejected
  because the 3x bandwidth cost grows linearly with Varde count,
  which makes the system's bandwidth profile depend on roster size in
  a way the architecture would otherwise avoid.
- **Primary-with-fallback (1 active, N-1 standby).** Lower bandwidth
  than full fan-out. Rejected because a tunnel that does not carry
  traffic does not exercise its path; failover detection becomes a
  separate problem on top of liveness pings, and the receiving Varde
  no longer sees the node as a source until failover completes.

## References

- ADR-0020 (TLP v2.0 enforcement architecture) — tunnel-level
  TLP filtering (Layer 1)
- `app/be/services/mesh-svc/src/manager.ts` (broadcast fan-out, swap
  cooldown, healthMinTunnels floor)
- `app/be/services/mesh-svc/src/config.ts` (`varde_top_n` default)
- `app/be/services/varde-svc/src/repos.ts` (`dedupInsertEvent` at the
  receiving end)
