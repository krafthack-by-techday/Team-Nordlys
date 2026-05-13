# ADR-0023: Bounded gossip topology

**Status**: Proposed
**Date**: 2026-05-11
**Deciders**: (leave blank — to be filled by team)

## Context

The current Varde mesh design specifies flat all-to-all gossip: every
Varde gossips with every other Varde over HTTP, every 5–10 seconds
(CONCEPTS.md, architecture-overview.md). At 400 peers this means each
Varde makes **399 HTTP requests per gossip cycle** — approximately 57
requests per second continuously. This does not scale.

The problem is not theoretical. At 400 peers:

- 400 × 399 = 159,600 gossip pairs per cycle
- Each Varde sustains ~57 req/s outbound + ~57 req/s inbound
- Total network gossip traffic: ~320,000 HTTP requests every 7 seconds
- Most responses will be empty (no new events since last cursor), but
  the connection overhead alone is prohibitive

Worse, this scales quadratically. At 800 peers it doubles in both
directions (799 requests per Varde per cycle). The mesh's value
proposition — rapid sector-wide sharing — requires a gossip topology
that scales sub-linearly with peer count.

Tenet 3 (bounded fanout, always) explicitly requires that every
propagation primitive has an upper bound. Flat all-to-all gossip
violates this tenet: each Varde's gossip fanout grows linearly with
mesh size. This ADR corrects that violation.

The design must preserve two properties:

1. **Convergence.** Every GREEN/CLEAR/AMBER object eventually reaches
   every Varde, even if individual gossip links fail.
2. **Bounded per-node cost.** Each Varde's gossip work (connections,
   bandwidth, CPU) must be bounded by a constant independent of mesh
   size.

## Decision

### 1. Gossip fanout is bounded and configurable

Each Varde gossips with a fixed number of peers per cycle, denoted
`gossip_fanout` (default: 15). This replaces the current all-to-all
design. The fanout is independent of mesh size: a 400-node mesh and a
4000-node mesh use the same per-Varde fanout.

At `gossip_fanout=15` and a 7-second cycle, each Varde makes 15 HTTP
requests per cycle — approximately 2.1 req/s. This is a **96%
reduction** from the current 57 req/s.

### 2. Two viable gossip strategies

This ADR presents two strategies for how the bounded fanout is used.
Both are architecturally sound; the choice between them is an
implementation decision that can be made (and changed) without
affecting other ADRs.

#### Strategy A: Random-k gossip with lazy repair

Each gossip cycle, the Varde selects `k` peers uniformly at random
from the roster and pulls new events from them.

**Pull cycle (every 7 seconds):**

```
peers = random_sample(roster, k=15)
for peer in peers:
    new_events = HTTP GET peer/v1/events/since/{cursor}
    for event in new_events:
        if event.id not in seen:
            store(event)
            seen.add(event.id)
```

**Convergence analysis:** With k=15 and N=400, a single new event
propagates as follows. In round 1, the originator's Varde has the
event; on average 15/400 = 3.75% of other Vardes pull from the
originator and receive it. Each of those Vardes then has the event
for the next round. After `r` rounds, the expected fraction of Vardes
that have the event is approximately `1 - (1 - k/N)^r`. For k=15,
N=400:

- Round 1: ~3.7% (15 Vardes)
- Round 2: ~7.3% (29 Vardes)
- Round 3: ~10.7% (43 Vardes)

This is slow — pure random-k pull is not sufficient for rapid
convergence. The fix is to add **push on receive**: when a Varde
receives a new event (one it has not seen before), it immediately
pushes it to `push_fanout` (default: 10) random peers via HTTP POST,
in addition to storing it for future pull responses.

**Push-on-receive:**

```
on_receive(event):
    if event.id in seen: return
    seen.add(event.id)
    store(event)
    push_peers = random_sample(roster, push_fanout=10)
    for peer in push_peers:
        HTTP POST peer/v1/events/push {event}
```

With push_fanout=10, a new event spreads epidemically:
- Round 0: 1 Varde has it, pushes to 10
- Round 1: ~11 Vardes have it, each pushes to 10 (but with overlap)
- Round 2: ~100 Vardes have it
- Round 3: ~350+ Vardes have it
- Round 4: ~400 (saturation)

Convergence in **3–4 rounds = 21–28 seconds**. The periodic pull
cycle serves as a **repair mechanism** for the ~1% that push misses
due to failed connections or timing.

**Properties:**
- Implementation: ~100-200 lines of gossip logic
- Per-Varde outbound: up to 10 pushes per new event + 15 pulls/cycle
- Bandwidth: O(N × push_fanout) messages per broadcast ≈ 4000
- Self-healing: random peer selection naturally routes around failures
- Determinism: probabilistic — rare cases of delayed delivery,
  repaired by pull

#### Strategy B: Plumtree (Epidemic Broadcast Trees)

Each Varde maintains two peer sets:

- **Eager peers** (default: 5): a spanning tree overlay. Full messages
  are pushed immediately via HTTP POST.
- **Lazy peers** (default: 10): redundant overlay links. Only message
  IDs (IHAVE notifications) are exchanged.

**Normal operation:**

```
on_receive(event) from eager_peer:
    store(event)
    push to all other eager_peers (full message)
    send IHAVE(event.id) to all lazy_peers

on_receive(IHAVE(id)) from lazy_peer:
    if id not in seen:
        start timer(id, timeout=2*gossip_interval)

on_timer_expire(id):
    # Eager tree failed to deliver — repair
    send GRAFT(id) to the lazy_peer that sent IHAVE
    promote that lazy_peer to eager
    demote the failed eager_peer to lazy
    request full message via GRAFT
```

**Tree construction:** On startup, a Varde connects to 5 random peers
as eager and 10 as lazy. When duplicates arrive via eager links
(because the initial topology has cycles), the Varde sends PRUNE to
the redundant eager peer, demoting it to lazy. Over ~30 seconds the
eager links self-organize into an approximate spanning tree with no
cycles (messages flow exactly once via the tree) and the lazy links
provide redundancy.

**Properties:**
- Implementation: ~300-500 lines (eager/lazy sets, IHAVE/GRAFT/PRUNE
  protocol, timer management, peer promotion/demotion)
- Per-Varde outbound: 5 eager pushes per new event + 10 IHAVE
  notifications + periodic lazy shuffles
- Bandwidth: O(N) full messages (tree-optimal) + O(N × lazy_fanout)
  small IHAVE messages. ~2-3× optimal. Approximately **70% less
  bandwidth** than Strategy A.
- Self-healing: GRAFT/PRUNE reacts to failures within 2 gossip
  intervals (~14s). Periodic lazy peer shuffling (HyParView-style)
  ensures long-term connectivity.
- Determinism: deterministic along the tree; lazy repair for failures

### 3. Comparison and recommendation

| Property | Strategy A (Random-k) | Strategy B (Plumtree) |
|---|---|---|
| Messages per broadcast | ~4000 (10× optimal) | ~800 (2× optimal) |
| Bandwidth at 10 msg/s, 1KB | ~40MB/s total, 100KB/s/node | ~8MB/s total, 20KB/s/node |
| Convergence time | 3-4 rounds (21-28s) | 2-3 rounds (14-21s) |
| Implementation complexity | Low (~150 lines) | Medium-high (~400 lines) |
| Failure recovery | Implicit (random selection) | Explicit (GRAFT in ~14s) |
| Steady-state connections | 15 per cycle (random, not persistent) | 15 persistent (5 eager + 10 lazy) |

**Recommendation:** Start with Strategy A for v1.x. The bandwidth
overhead (100KB/s per node at 10 broadcasts/second) is negligible for
internet-connected servers in DMZ. Strategy B should be adopted when
either (a) message rates exceed ~50/second sustained, (b) message
sizes regularly exceed 10KB, or (c) convergence time below 20 seconds
is required.

The critical architectural property — bounded fanout independent of
mesh size — is provided by both strategies. The interface between the
gossip layer and the rest of the system (Varde inbound verification,
storage, fan-out to connected nodes) is identical regardless of which
strategy is active.

### 4. Peer discovery and roster

Both strategies require each Varde to know a set of candidate peers
to gossip with. This set comes from the **roster** — the existing
mechanism by which Vardes learn about each other (distributed via
STATE_SNAPSHOT and ROSTER_ANNOUNCE).

Peer selection for gossip is **independent of** the rendezvous-hashing
used for node-to-Varde tunnel selection (ADR-0003, ADR-0004). Tunnel
selection determines which Varde a node connects to. Gossip selection
determines which Vardes a Varde exchanges events with. These are
orthogonal.

### 5. Impact on TLP distribution

This ADR applies **only to broadcast distribution** (GREEN, CLEAR,
AMBER without explicit recipients). TLP:RED and AMBER-with-recipients
objects use a separate direct delivery mechanism specified in
ADR-0024. They are never included in gossip responses or push
messages, regardless of which gossip strategy is active.

The gossip layer's TLP filtering rule is simple: **exclude any object
where `recipients` is non-empty from gossip push and pull responses.**
Objects with a recipients list are delivered exclusively through the
direct channel (ADR-0024).

### 6. Protocol messages

Both strategies require the following HTTP endpoints on each Varde:

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/events/since/{cursor}` | GET | Pull new events (existing, unchanged) |
| `/v1/events/push` | POST | Receive pushed events (new) |
| `/v1/events/ihave` | POST | Receive IHAVE ID-list (Strategy B only) |
| `/v1/events/graft` | POST | Request specific event by ID (Strategy B only) |

Strategy A uses only the first two. Strategy B uses all four.

## Consequences

- **Per-Varde gossip cost is bounded.** At gossip_fanout=15, each
  Varde makes ~15-25 HTTP requests per cycle regardless of mesh size.
  The mesh can grow to thousands of peers without per-node cost
  increasing.

- **Convergence is slower than flat gossip.** A new event reaches all
  400 Vardes in ~21-28 seconds (Strategy A) or ~14-21 seconds
  (Strategy B), compared to ~7 seconds with flat gossip. This is
  acceptable for the system's purpose — the original problem was
  30-60 minute delays; sub-30-second convergence is more than
  sufficient.

- **RED/AMBER-with-recipients distribution is decoupled from gossip.**
  These objects use direct delivery (ADR-0024), which is unaffected
  by gossip topology. This removes the architectural dependency
  between gossip topology and TLP-restricted distribution that existed
  in the flat model.

- **The mesh tolerates Varde failures gracefully.** Random peer
  selection (Strategy A) or lazy peer promotion (Strategy B) routes
  around failed Vardes without operator intervention. No single Varde
  is on the critical path for any other Varde's gossip.

- **UUID dedup absorbs redundancy.** Both strategies may deliver the
  same event to a Varde multiple times (via different gossip peers).
  The existing UUID-based dedup at the storage layer handles this
  identically to today — the dedup path is unchanged.

- **Gossip peer selection must be cryptographically random.** A
  predictable peer selection pattern could be exploited to partition
  the mesh (by taking down the specific peers a target Varde would
  select). Random selection using a CSPRNG prevents this.

## Alternatives considered

- **Flat all-to-all gossip (status quo).** Every Varde gossips with
  every other Varde. Fastest convergence (one cycle), simplest
  implementation. Rejected because it violates Tenet 3 (bounded
  fanout) and scales quadratically — at 400 peers each Varde makes
  399 requests per cycle, at 800 it would be 799. This is the design
  this ADR replaces.

- **Structured overlay (DHT-based, e.g., Scribe on Pastry).**
  Build a DHT and multicast tree on top. Optimal message efficiency
  for broadcast. Rejected because the implementation cost is very
  high (Pastry DHT alone is substantial), it's a poor fit for
  HTTP pull/push, and it provides no advantage over simpler
  gossip for our message rates and sizes. DHTs optimise for
  point-to-point routing, which we solve separately in ADR-0024.

- **Designated super-nodes (OSPF DR / BGP RR analog).** Elect a
  few "super Vardes" that all others gossip through. Reduces fanout
  to 2-3 (connect to your super-nodes). Rejected because it creates
  single points of failure, requires election protocols, and
  concentrates metadata at the super-nodes — violating the mesh's
  decentralised trust model.

- **Hierarchical gossip (NICE-style clustering).** Organise Vardes
  into clusters, gossip within clusters, elect cluster heads that
  gossip between clusters. Reduces per-node fanout but introduces
  leader election, cluster maintenance, and multi-level routing.
  Rejected for v1.x due to complexity; may be reconsidered if the
  mesh grows beyond ~2000 peers where single-level gossip's
  convergence time becomes unacceptable.

## Open Questions

### Group A — parameter tuning

- What are the optimal values for `gossip_fanout`, `push_fanout`,
  and gossip interval at 400 peers? Simulation or testbed
  measurement is needed before production deployment.
- Should parameters auto-tune based on observed mesh size (from
  roster), or remain static per deployment?

### Group B — protocol details

- Should the push endpoint (`/v1/events/push`) accept batches, or
  one event per request? Batching reduces HTTP overhead but adds
  latency for the first event in the batch.
- How should a Varde respond to a push from an unknown peer (not in
  roster)? Reject (strict) or accept-and-verify (permissive)?

### Group C — migration from flat gossip

- Is the migration from flat to bounded gossip a flag flip, or does
  it require a coordinated rollout across all Vardes? (Expected:
  a flag flip is safe — a Varde that stops pulling from 384 peers
  simply stops; those peers' cursors go stale but that has no
  negative effect.)

### Group D — monitoring

- How is gossip health observed? Metrics needed: convergence time
  (time from first appearance at any Varde to saturation),
  message delivery ratio (fraction of Vardes that receive each
  event within T seconds), push failure rate.

## References

- `docs/design-tenets.md` (Tenet 3 — bounded fanout, Tenet 4 —
  convergence, Tenet 6 — operational realism)
- ADR-0004 (Top-N tunnels per node) — bounded fanout precedent
- ADR-0009 (Anti-entropy pull at Varde layer) — the ADR this
  supersedes for inter-Varde gossip
- ADR-0020 (TLP enforcement) — TLP filtering in gossip responses
- ADR-0024 (RED/AMBER direct delivery) — the separate channel
  for recipient-restricted objects
- Leitão, Pereira, Rodrigues (2007), "Epidemic Broadcast Trees"
  — Plumtree protocol
- Leitão, Pereira, Rodrigues (2007), "HyParView: A Membership
  Protocol for Reliable Gossip-Based Broadcast" — partial view
  management
- Birman, Hayden, Ozsoyoglu, Xiao, Budiu, Minsky (1999),
  "Bimodal Multicast" — gossip repair on top of tree delivery
