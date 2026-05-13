# ADR-0016: Health-aware Varde selection

**Status**: Proposed
**Date**: 2026-05-07
**Deciders**: (leave blank — to be filled by team)

## Context

Rendezvous hashing (ADR-0003) selects N Vardes per node by a stable
deterministic rank. The rank does not consider how a Varde is
currently behaving: a Varde that has been timing out pings, dropping
the session, or returning slow responses is ranked the same as one
that is healthy. Without a feedback signal, the node stays attached
to a misbehaving Varde for as long as the Varde remains in the
roster, which extends user-visible latency on every event the
node tries to publish through it. The naive fix — exclude Vardes
whose health falls below a threshold — has a different problem:
during a partial outage, exclusion can drop a node below the
two-tunnel redundancy floor (ADR-0004) or cause every node to
converge on the same handful of "best" Vardes, creating hotspots.

This decision serves Tenet 6 (operational realism) directly through
hysteresis, sticky bonus, and swap cooldown chosen against real
failure modes; Tenet 2 (mesh continuity) through deprioritise-not-
exclude under degraded mesh conditions; and Tenet 3 (bounded
fanout) by keeping selection within the top-N envelope rather than
expanding fan-out under stress.

## Decision

Each tunnel maintains an exponentially-weighted score in a fixed
range, updated by observable signals (round-trip time, ping-timeout
events, disconnects, reconnects, delivery latency). A Varde whose
score falls below a deprioritisation threshold for at least 30
seconds is moved to the end of the rank order — last resort, but
not excluded. A small sticky bonus is added to currently-connected
Vardes to reduce churn. A swap cooldown prevents rotation more
often than once per minute. A minimum-tunnel floor (default 2)
prevents health-driven swaps from reducing the count below the
redundancy minimum. Scores persist across mesh-svc restarts in a
local on-disk store.

## Consequences

- Persistently slow or flapping Vardes drift to the back of the
  selection without operator intervention, while remaining
  available as fallback.
- The hysteresis on deprioritisation (30 seconds below threshold)
  prevents single transient events from triggering churn that the
  swap cooldown would then have to suppress.
- The minimum-tunnel floor means an overall poor mesh state may
  leave the node attached to an unhealthy Varde rather than drop
  below the redundancy floor. The node may publish to a Varde it
  has reason to distrust, but will not be mesh-isolated by its
  own health logic.
- Score persistence means a Varde that misbehaved before a
  mesh-svc restart starts the next session deprioritised, rather
  than getting a clean slate. This is what an operator wants in
  steady state and what a developer running tests does not — the
  test harness has to clear the score store between runs.
- The signals are local to each node. Two nodes connected to the
  same Varde may compute very different scores depending on their
  own network path. This is correct but unintuitive to an
  operator looking at "the" health of a Varde from a single
  vantage point.
- The design is bad at situations where every Varde is unhealthy.
  The deprioritise-not-exclude rule means the node keeps trying,
  which is correct for transient faults but wasteful when every
  Varde in the roster is genuinely down for a sustained period.

## Alternatives considered

- **Hard exclusion below threshold.** Exclude Vardes whose health
  drops below a threshold, falling back to the next-ranked.
  Rejected because exclusion can drop the node below the
  redundancy floor and because every node converging on the same
  "best" subset creates hotspots on those Vardes.
- **No health signal; trust the rendezvous rank.** Simpler and
  fully deterministic. Rejected because a flapping Varde then
  remains in the selection indefinitely, and the user-visible
  publish latency suffers for as long as the Varde is in the
  roster.
- **Centralised health gossip across nodes.** Each node publishes
  its observed Varde health, and a global view influences
  selection. Rejected because it adds a feedback loop with global
  state that the architecture otherwise avoids, and because the
  per-node local signal is the more honest data point — what
  matters for a node's selection is the path that node sees.

## References

- `app/be/packages/health-score/src/score.ts`
- `app/be/packages/health-score/src/config.ts`
- `app/be/services/mesh-svc/src/rendezvous.ts` (health overlay,
  sticky bonus)
- `app/be/services/mesh-svc/src/manager.ts` (swap cooldown,
  minimum-tunnel floor)
