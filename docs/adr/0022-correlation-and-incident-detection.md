# ADR-0022: Correlation and Incident Detection

**Status**: Proposed
**Date**: 2026-05-11
**Deciders**: (leave blank — to be filled by team)

## Context

Nordlys peers continuously exchange Ed25519-signed security events —
indicators, vulnerability reports, advisories — across a mesh of
roughly 400 nodes in the Norwegian energy sector. A natural next step
is to let nodes detect patterns across these events: "three peers
reported the same C2 domain within 24 hours" or "a vulnerability
advisory arrived shortly after matching exploit indicators." We call
these derived observations *correlations* (pattern matches across
events) and *incidents* (operator-escalated correlations that warrant
coordinated response).

Naive implementation — every node runs correlation rules, signs the
results, and gossips them — introduces four compounding problems.
First, **amplification**: if N peers independently detect the same
pattern and each publishes a signed correlation event, the mesh
carries up to N × N duplicates as every node receives and
re-evaluates every other node's correlation. At 400 peers this is
catastrophic for bounded fanout (Tenet 3). Second, **TLP metadata
leakage**: a correlation that references TLP:RED events reveals their
existence to peers who lack clearance for RED material. Even a
correlation's mere presence — "Hafslund correlated three events at
14:07" — leaks timing and scope information that the original TLP
classification was designed to contain. Third, an **authority gap**:
auto-generated correlations are machine interpretations, not
operator-attested observations. Signing them with the node's Ed25519
key gives them identical cryptographic standing to human-created
events, making it impossible for recipients to distinguish analyst
judgment from scripted heuristics. Fourth, the absence of **shadow
mode** means new or experimental correlation rules immediately publish
results to the mesh, with no opportunity for local review or tuning —
a single noisy rule can flood the network with false positives before
anyone notices.

These problems are interconnected. Amplification worsens leakage
(more copies, more exposure). The authority gap makes amplification
harder to suppress (every correlation looks authoritative). And
without shadow mode, operators cannot iterate on rules without risking
all three failure modes at once.

The YAML scenario engine introduced in ADR-0014 already provides a
shadow-mode pattern for scenario evaluation. The trust-ranked
deduplication model in ADR-0015 shows how to collapse duplicates.
ADR-0019's composable extension points give us a hook for correlation
as a pluggable capability. ADR-0020's TLP high-water mark rule and
ADR-0021's RBAC model supply the access-control primitives. This ADR
composes those building blocks into a safe correlation architecture.

## Decision

### 1. Object model: correlations and incidents

Two new event kinds are introduced alongside the existing Nordlys
event types:

- **Correlation** (`kind: correlation`): a machine-generated assertion
  that two or more existing events match a named rule. A correlation
  references source events by their content-hash identifiers and
  carries the rule name, match parameters, and a confidence score
  (0.0–1.0). Correlations are *opinions*, not facts.
- **Incident** (`kind: incident`): an operator-created or
  operator-promoted event that declares a coordinated response
  situation. An incident may reference correlations, raw events, or
  both. Incidents carry the promoting operator's identity and an
  explicit severity assignment.

Both kinds are Ed25519-signed and use the standard Nordlys event
envelope. The key distinction is in the `origin` field (see §6).

### 2. Lifecycle: local → shadow → promoted

Every correlation passes through a three-stage lifecycle:

1. **Local.** The correlation engine evaluates rules against the
   node's local event store. Resulting correlations are persisted
   locally with `scope: local`. They are never gossiped. Operators
   can query, review, and dismiss them through the local dashboard.
   This is the default and only automatic state.
2. **Shadow.** An operator (or the node's configuration) may enable
   shadow mode for specific rules, following the pattern established
   in ADR-0014. Shadow correlations are tagged `scope: shadow` and
   are written to a dedicated shadow log. They are still never
   gossiped. Shadow mode exists so that new rules can be evaluated
   against live traffic over a burn-in period (recommended: 7 days
   minimum) before promotion is considered.
3. **Promoted.** An operator with sufficient RBAC clearance (per
   ADR-0021, minimum role: `analyst`) explicitly promotes a
   correlation to `scope: mesh`. Only at this point is the event
   eligible for gossip via the Varde relay layer. Promotion requires
   the operator to re-sign the event with their personal key, adding
   a co-signature alongside the node key. Bulk promotion is
   deliberately unsupported in the initial implementation to force
   human review.

Incidents skip the shadow stage — they are created directly by
operators and are mesh-eligible from creation, subject to TLP rules.

### 3. TLP enforcement at correlation time

Correlations inherit TLP classification from their source events using
the **high-water mark rule** (Tenet 10, ADR-0020): if a correlation
references one TLP:AMBER event and two TLP:GREEN events, the
correlation itself is TLP:AMBER. This is enforced at creation time by
the correlation engine, not left to gossip-layer filtering.

When a correlation is promoted to mesh scope, the engine applies
**reference redaction**. Source event references are partitioned by
the recipient's clearance level. If a peer lacks clearance for a
referenced event's TLP level, that reference is replaced with a
cryptographic commitment (SHA-256 hash of the event ID salted with a
per-correlation nonce). This allows the peer to verify the reference
later if they independently obtain the event, without leaking the
event's identity in the meantime.

A correlation whose high-water mark TLP exceeds TLP:GREEN is never
auto-promotable — it requires explicit operator action regardless of
any future automation policy.

### 4. Amplification prevention

The primary defence against amplification is the **local-only
default** (§2): correlations do not enter the mesh unless a human
promotes them. This reduces the amplification factor from N × N to at
most N (one promoted correlation per detecting org, not per node).

Further deduplication applies at the mesh layer. When a promoted
correlation arrives via gossip, the receiving node checks whether it
already holds a local or received correlation covering the same
source-event set (by content-hash intersection ≥ 80%) and the same
rule family. If so, the incoming correlation is stored but not
re-gossiped, following ADR-0015's trust-ranked dedup model. The
correlation with the highest trust score (per the originating peer's
trust rank) is surfaced as the canonical version.

Varde relays enforce bounded fanout (Tenet 3) for correlation events
identically to other event kinds — no special relay behaviour is
introduced.

### 5. Rate limiting

Each node enforces the following rate caps on machine-generated
correlations:

| Scope | Limit | Window |
|---|---|---|
| Local correlations per rule | 50 | 1 hour |
| Total local correlations | 500 | 1 hour |
| Promoted correlations (mesh-bound) | 10 | 1 hour |
| Promoted correlations per rule | 3 | 1 hour |

Rate caps are configured in the node's correlation configuration and
are enforced before signing. When a cap is hit, the engine logs a
warning and drops subsequent matches for that window. Operators can
adjust caps upward, but the defaults are deliberately conservative —
a runaway rule should produce noise locally, not across the mesh.

The mesh-bound promotion limits provide a hard ceiling independent of
operator action. Even if an operator attempts to bulk-promote via the
API, the rate limiter rejects excess promotions.

### 6. Authority marking in the signed payload

Every Nordlys event envelope gains an `origin` field with the
following structure:

```
origin:
  type: "machine" | "operator"
  engine: "correlator/v1"    # only for machine-generated
  rule: "lateral-movement-3"  # only for machine-generated
  operator_id: null           # set on promotion or operator-created events
  promoted_by: null           # operator who promoted (correlations only)
  promoted_at: null           # ISO-8601 timestamp of promotion
```

The `origin.type` field is included in the signed payload — it cannot
be stripped or altered without invalidating the Ed25519 signature.
This allows any receiving peer to programmatically distinguish
machine-generated correlations from operator-attested events
(addressing the authority gap identified in the Context). UI
implementations MUST render machine-generated events with a distinct
visual treatment.

Operator-created incidents have `origin.type: "operator"` and no
`engine` or `rule` fields.

### 7. Shadow mode

Shadow mode reuses the evaluation infrastructure from ADR-0014's
scenario engine. A correlation rule can be placed in shadow mode via
configuration:

```yaml
rules:
  lateral-movement-3:
    enabled: true
    scope: shadow       # local | shadow | disabled
    shadow_expires: "2026-06-01"
```

Shadow-mode rules execute identically to local rules but write output
to a separate shadow correlations table. The shadow log records match
count, false-positive rate (if operator feedback is provided), and
rule latency. No shadow correlation can be promoted — the rule must
first be moved to `scope: local` after review.

Shadow expiry dates prevent forgotten experimental rules from running
indefinitely. When `shadow_expires` passes, the rule is automatically
disabled and the operator is notified.

### 8. Audit trail

All correlation lifecycle transitions are recorded in the node's
append-only audit log (Tenet 8):

| Action | Logged fields |
|---|---|
| Creation | Rule name, source event hashes, confidence score, computed TLP, timestamp |
| Shadow evaluation | Same as creation, tagged with `shadow: true` |
| Promotion | Promoting operator ID, original correlation hash, new mesh-scope event hash, TLP at promotion time, redacted reference list |
| Dismissal | Operator ID, reason code (false-positive, duplicate, irrelevant), timestamp |
| Rate-limit hit | Rule name, current count, cap, window, timestamp |

Audit records are signed by the node key and retained for the
duration specified in the node's retention policy (default: 180
days). They are local-only and never gossiped — the audit trail
documents *this node's* decisions, not the mesh's.

## Consequences

- **Correlations are safe by default.** No machine-generated content
  reaches the mesh without explicit human promotion, eliminating
  amplification and accidental TLP leakage for the common case.

- **Operators retain authority.** The `origin.type` field and
  co-signature requirement make machine vs. human provenance
  cryptographically verifiable. Trust models can weight correlations
  lower than operator-attested events.

- **New rules can be tested safely.** Shadow mode provides a burn-in
  period that mirrors ADR-0014's scenario engine, reducing the risk
  of noisy rules disrupting the mesh.

- **TLP guarantees are preserved.** The high-water mark rule is
  enforced at creation time and reference redaction at promotion
  time, maintaining ADR-0020's invariants even for derived content.

- **Rate caps provide a hard ceiling.** Even a compromised or
  misconfigured node cannot flood the mesh with correlations beyond
  the promotion rate limit.

- **Complexity increases.** The three-stage lifecycle, reference
  redaction, and dual-signature promotion add implementation and UX
  complexity. Operators must learn a new workflow.

- **Correlation coverage is deliberately limited.** Local-only default
  means the mesh does not benefit from a correlation until a human
  acts. Time-sensitive patterns (e.g., fast-spreading worm
  indicators) may be delayed by the promotion gate.

- **No cross-node correlation.** This design correlates events visible
  to a single node. Federated correlation (combining observations
  that no single node can see) is explicitly out of scope and
  deferred to a future ADR.

## Alternatives considered

- **Full mesh correlation — every node publishes all correlations.**
  Every node runs rules and immediately gossips results as signed
  events. Simplest implementation and fastest detection-to-sharing
  latency. Produces N × N amplification, violates TLP boundaries by
  default, and conflates machine output with operator attestation.
  Rejected because it violates Tenets 3, 10, and 11 simultaneously.

- **Designated correlator nodes.** A small set of trusted nodes (e.g.,
  one per sector: hydro, grid, wind) runs correlation on behalf of
  the mesh. Other nodes forward events to their sector correlator.
  Reduces amplification to a fixed constant but introduces
  centralisation (single point of failure and compromise), requires
  forwarding potentially TLP-restricted events to the correlator,
  and conflicts with Nordlys's decentralised trust model. Rejected
  because it reintroduces the hub-and-spoke topology that Nordlys
  was designed to avoid.

- **Correlation as unsigned metadata.** Correlations are shared as
  unsigned annotations attached to events rather than as first-class
  signed objects. Avoids the authority gap (no signature = no false
  authority) but makes correlations untraceable and unaccountable.
  Any node could inject or modify correlations without detection.
  Rejected because it violates Tenet 1 and Tenet 8.

- **Automatic promotion with confidence threshold.** Correlations
  above a configurable confidence score (e.g., ≥ 0.9) are
  automatically promoted to mesh scope without operator review.
  Optimises for speed but reintroduces amplification risk for any
  rule that produces high-confidence false positives — and in
  practice, confidence calibration is unreliable for new rules.
  Deferred rather than rejected: once shadow-mode telemetry provides
  empirical false-positive rates per rule, automatic promotion may
  be revisited with a per-rule opt-in and mandatory shadow burn-in.

## Open Questions

### Group A — promotion workflow

- Should bulk promotion (selecting multiple local correlations for
  mesh publication) be supported in v1, or should we force
  one-at-a-time review to establish discipline?
- What is the minimum RBAC role for promotion? The current proposal
  is `analyst`; should TLP:RED correlations require `senior_analyst`
  or higher?

### Group B — cross-node correlation

- Should a future ADR explore secure multi-party correlation (e.g.,
  private set intersection) so the mesh can detect patterns no single
  node can see?
- If so, does the `origin` model need a third type (`federated`)
  reserved now to avoid a breaking schema change later?

### Group C — confidence calibration

- How should confidence scores be defined — per-rule static
  assignment, or dynamic calibration based on shadow-mode
  false-positive rates?
- Should confidence scores be visible to receiving peers, or only to
  the originating node?

### Group D — retention and expiry

- Should promoted correlations carry a TTL after which they are
  automatically retracted from the mesh?
- How should the mesh handle a retraction — tombstone event, or
  silent expiry?

## References

- `docs/design-tenets.md` (Tenet 1, Tenet 3, Tenet 4, Tenet 6,
  Tenet 8, Tenet 9, Tenet 10, Tenet 11)
- ADR-0014 (YAML scenario engine with shadow mode) — shadow mode
  pattern
- ADR-0015 (Trust-ranked vulnerability deduplication) — dedup pattern
- ADR-0019 (Composable extension points) — correlation as extension
- ADR-0020 (TLP v2.0 enforcement architecture) — high-water mark
  rule, TLP enforcement layers
- ADR-0021 (Role-based access control) — operator clearance for
  promotion
