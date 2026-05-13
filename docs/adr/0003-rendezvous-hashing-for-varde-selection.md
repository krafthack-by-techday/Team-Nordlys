# ADR-0003: Rendezvous hashing for Varde selection

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Each node holds tunnels to a small subset of the available Vardes
(see ADR-0004), not to all of them. The selection has to be
deterministic so a node can compute it locally without consulting a
coordinator, uniform so no Varde becomes a hotspot, and stable across
roster changes so adding or removing one Varde does not reshuffle the
entire fleet. The scale target of the v1.0 design is roughly
400 nodes against a handful of Vardes per organisation, which means
even a small fraction of unnecessary churn produces a visible
reconnect storm.

Modulo-based assignment (`hash(node_id) mod M`) is uniform when M is
fixed but reassigns nearly every node when M changes. Consistent
hashing on a ring is a known fix but introduces tunable virtual nodes
and a weaker uniformity guarantee. A purpose-built scheme that gives
both properties without tuning is preferable.

This decision serves Tenet 3 (bounded fanout) by selecting only N
Vardes per node rather than every Varde in the roster, and Tenet 6
(operational realism) by minimising reconnect storms when the roster
changes.

## Decision

Each node ranks the available Vardes by Highest Random Weight (HRW,
also known as rendezvous hashing): for each candidate Varde the node
computes the SHA-256 of the concatenation `node_id | varde_id`, takes
the first 8 bytes as a big-endian unsigned integer, and selects the N
candidates with the highest scores. The default N is 3 (see
ADR-0004). When the roster changes, only nodes whose rank order
crosses the top-N boundary need to switch tunnels.

## Consequences

- Adding or removing one Varde from a fleet of M reassigns roughly
  N/M of all (node, Varde) pairs, not the whole fleet. This is the
  property the algorithm is chosen for.
- The selection is deterministic and pure: every node computes the
  same answer with no coordination or shared state.
- Score distribution is uniform under SHA-256, so no Varde becomes
  hot from an artefact of the hash.
- The algorithm is per-node O(M) rather than O(1), so a roster of
  thousands of Vardes would become measurable. At the design scale
  (single-digit Vardes per organisation, low double-digit total)
  this does not matter.
- HRW is unfamiliar to engineers who have only seen modulo or
  consistent hashing. A reader who does not already know it has to
  trust the algorithm or read the small number of lines that
  implement it.
- The algorithm has no notion of Varde capacity or geographic
  affinity. Every Varde is treated as interchangeable; an operator
  cannot bias selection by region or by Varde size without
  introducing weights.

## Alternatives considered

- **Modulo-based assignment.** Trivially uniform but reassigns
  almost every node when the Varde count changes. Rejected because
  the resulting reconnect storm at every roster change is operationally
  unacceptable.
- **Consistent hashing with virtual nodes.** Solves the reshuffle
  problem and is more familiar than HRW. Rejected because it
  requires tuning the virtual-node count to keep distribution flat,
  and HRW gives the same property without tuning.
- **Operator-assigned static mapping.** Most direct, but requires
  human intervention on every roster change and creates two sources
  of truth (the assignment and the actual Varde list) that can drift.

## References

- `app/be/services/mesh-svc/src/rendezvous.ts`
- `app/be/services/mesh-svc/src/rendezvous.test.ts`
- Thaler & Ravishankar, "A Name-Based Mapping Scheme for Rendezvous"
  (1996), the original HRW paper.
