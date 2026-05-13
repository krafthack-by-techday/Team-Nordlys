# ADR-0020: TLP v2.0 enforcement architecture

**Status**: Proposed
**Date**: 2026-05-11
**Deciders**: (leave blank — to be filled by team)

## Context

Tenet 10 (distribution is access control, not metadata) commits
Nordlys to enforcing TLP at every propagation boundary with defence
in depth. This ADR specifies the concrete enforcement architecture:
where TLP is checked, what each check does, and what happens when a
check fails.

The FIRST Traffic Light Protocol v2.0 (authoritative from August
2022) defines four labels — RED, AMBER (with the AMBER+STRICT
variant), GREEN, CLEAR — and places the sharing obligation on the
source and the compliance obligation on the recipient. The standard
explicitly leaves automated-exchange enforcement to platform
designers but requires that automated exchanges comply with the
normative sharing rules.

Nordlys is such a platform. In an automated mesh where events
gossip between 400 peers, a single enforcement gap can propagate a
restricted object to the entire sector in seconds. The standard's
person-to-person trust model does not transfer to machine-mediated
gossip without explicit engineering. This ADR is that engineering.

Three lessons from other platforms inform the design:

1. **MISP** decouples TLP labels from distribution settings — the
   label is metadata, the distribution level is the enforcement
   mechanism. Misconfiguration causes silent oversharing. Nordlys
   must not decouple label from enforcement; the label *is* the
   enforcement input.

2. **STIX/TAXII** defines TLP as a marking-definition object but
   provides no enforcement semantics. Every implementation builds
   its own. Nordlys must specify enforcement as part of the
   architecture, not as an implementation detail.

3. **OpenCTI** enforces TLP via RBAC with a maximum marking level
   per user — the strongest model among the three. Nordlys adopts
   a similar approach at the operator level (ADR-0021) and extends
   it to the mesh level, the extension level, and the database
   query level.

## Decision

### 1. Normalised TLP enum

Nordlys uses FIRST TLP v2.0 exclusively. The canonical enum is
ordered from most restrictive to least restrictive:

```
RED > AMBER+STRICT > AMBER > GREEN > CLEAR
```

Each level is assigned a numeric rank (RED=4, AMBER+STRICT=3,
AMBER=2, GREEN=1, CLEAR=0) for programmatic comparison. This
ordering is a first-class constant in the contracts package, used
by every enforcement point.

The legacy label `WHITE` (TLP v1.0) is accepted on inbound and
normalised to `CLEAR` with an audit-log entry. It is never emitted
by Nordlys. Unrecognised labels on inbound objects are rejected.

### 2. Nordlys-specific TLP semantics

FIRST TLP v2.0 requires each platform to define "community,"
"organisation," and "clients" for its context:

| TLP level | FIRST definition | Nordlys meaning |
|---|---|---|
| **RED** | Named individual recipients only, no further disclosure. | Delivered only to peers listed in the `recipients` field. Not stored on intermediary Vardes beyond the originator's own. Not queryable by non-recipient peers. Within a recipient peer, visible only to operators with RED clearance (ADR-0021). |
| **AMBER+STRICT** | Need-to-know within the organisation only, no clients. | Stays within the originating peer's node. Not gossiped to the mesh. Not forwarded to any Varde other than for local persistence. Visible only to operators with AMBER clearance or higher within the originating organisation. |
| **AMBER** | Need-to-know within the organisation and its clients. | If `recipients` is set: delivered only to listed peers. If `recipients` is empty: delivered to all mesh peers. In both cases, each receiving peer restricts visibility to operators with AMBER clearance or higher. "Clients" in the energy sector are entities the utility provides grid services to. In practice, AMBER without explicit recipients means "all peers may see it, but none may share it outside the mesh." |
| **GREEN** | Within the community. | All peers in this mesh deployment. No `recipients` filtering. Cannot be shared outside the mesh (no export to external systems without explicit re-publication as CLEAR). |
| **CLEAR** | No restrictions. | All peers. May be exported, published, shared freely, subject to standard copyright. |

**Key decision: AMBER+STRICT objects are never gossiped.** They
exist only on the originating node. If an operator explicitly
chooses to share an AMBER+STRICT object more widely, a new object
is created at AMBER with appropriate recipients and signed as a
new publication. This avoids the dangerous pattern of "the mesh
carries it but nobody should read it."

### 3. TLP × recipients invariants

These invariants are enforced at signing time by the core service
and re-verified at every inbound verification boundary. Violation
results in rejection with a structured error.

| TLP | `recipients` field | Rule |
|---|---|---|
| RED | Required, non-empty. | Every `node_id` in `recipients` must exist in the local identity register and not be revoked. |
| AMBER+STRICT | Forbidden. | Object never leaves the node; a recipients field is a contradiction. |
| AMBER | Optional. | If set, scoped delivery. If empty, mesh-wide delivery with per-organisation visibility. |
| GREEN | Forbidden. | Community-wide by definition; setting recipients is a contradiction. |
| CLEAR | Forbidden. | Unrestricted by definition; setting recipients is a contradiction. |

An inbound object that violates these invariants (e.g. `tlp=RED`
with empty `recipients`) is rejected and an audit alert is logged.
This indicates either a bug in the signing peer's implementation
or a tampered object.

### 4. Defence-in-depth enforcement layers

Every layer independently enforces TLP. Each layer assumes
upstream is compromised. An object must pass every layer to reach
a consumer.

**Layer 0 — Signing time (core service).** Validates TLP ×
recipients invariants. TLP is canonicalised into the signed
payload (Tenet 1); it cannot be altered in transit without
invalidating the signature. AMBER+STRICT objects are persisted
locally but not forwarded to the mesh service. The write path
ends here for AMBER+STRICT.

**Layer 1 — Mesh service outbound (node → Varde tunnels).**
Before sending any signed object frame, the mesh service reads
`tlp` and `recipients` from the signed payload. RED and AMBER
with recipients: these objects are **not sent via gossip** — they
use the direct delivery channel specified in ADR-0024 (HTTP POST
to recipient Vardes with envelope encryption). AMBER+STRICT:
reject (should not reach the mesh service; belt-and-suspenders).
AMBER without recipients, GREEN, CLEAR: send via the bounded
gossip channel (ADR-0023).

**Layer 2 — Varde inbound verification (from WebSocket or HTTP
gossip).** Before persisting or forwarding any inbound object:
verify signature (existing), verify TLP × recipients invariants,
verify that this Varde's owner is in `recipients` for RED objects.
If not, reject and do not persist. AMBER+STRICT: reject
unconditionally on inbound — these objects should never appear on
the wire.

**Layer 3 — Varde WebSocket fan-out (Varde → connected nodes).**
All object types (events, indicators, chat) are filtered by
distribution: RED and AMBER-with-recipients are sent only to
WebSocket sessions whose `node_id` is in `recipients`. GREEN,
CLEAR, AMBER-without-recipients: fan out to all sessions.

**Layer 4 — Varde HTTP gossip outbound (Varde → peer Vardes).**
Gossip query responses never include objects with a non-empty
`recipients` field — such objects use direct delivery (ADR-0024)
and are excluded from the gossip channel entirely (ADR-0023).
This layer enforces the invariant as a belt-and-suspenders check:
if an object with `recipients` somehow entered local gossip
storage, it is excluded from outbound gossip responses regardless.

**Layer 5 — Varde HTTP gossip inbound (peer Varde → this Varde).**
Same checks as Layer 2. An inbound RED object where this Varde's
owner is not in `recipients` is rejected.

**Layer 6 — Core service inbound re-verification (mesh service →
core service).** Re-checks TLP × recipients invariants after
signature verification. For RED: verifies that the local
`node_id` is in `recipients`. If not, rejects. This is the last
line of defence — if mesh service, Varde fan-out, and gossip all
failed to filter, the core service catches it here.

**Layer 7 — Internal publish (core service → API gateway).** The
core service publishes objects to internal channels only after
Layer 6 verification has passed. The channel itself needs no
filtering — the boundary is the core service's decision to
publish. Defence is at the writer, not the bus.

**Layer 8 — API gateway (to frontend).** Server-Sent Events and
REST endpoints verify that the object's distribution permits
local consumption. For RED and AMBER-with-recipients: verify that
`recipients` includes the local `node_id`. Additionally, operator
TLP clearance (ADR-0021) is enforced here — an operator with
GREEN clearance never sees AMBER or RED objects.

**Layer 9 — Database query layer.** All queries for mesh objects
route through a mandatory TLP-aware filter. The filter ensures
that RED objects are returned only if the querying peer is a
recipient, and AMBER+STRICT objects are returned only if they
were locally originated. This filter is applied as a mandatory
scope that individual queries cannot bypass — implemented as
database-level row security or as a query wrapper that is the
sole entry point to mesh-object tables. A query-layer bug in the
API gateway cannot leak restricted objects if the database layer
correctly enforces distribution.

**Layer 10 — RESYNC and STATE_SNAPSHOT.** RESYNC responses are
filtered with the same rules as gossip outbound (Layer 4). RED
objects are included only if the requesting node is a recipient.
STATE_SNAPSHOT contains identities, revocations, and roster —
none of which carry TLP — and requires no filtering. If future
snapshot types include mesh objects, they must be TLP-filtered.

### 5. Secure-by-default behaviour

| Condition | Behaviour |
|---|---|
| TLP field missing from inbound signed object | Reject. A missing TLP on a signed object indicates a buggy signer or a tampered object. Log audit alert. |
| TLP field set to unrecognised value | Reject. Forward-compatibility for future TLP values requires a deliberate code and contract update, not silent acceptance. |
| TLP field missing at creation time (operator omits) | Default to GREEN. The operator can override. GREEN is the most restrictive level that still permits mesh sharing — the system's primary purpose. RED and AMBER require explicit operator intent. |
| `recipients` field present but containing unknown `node_id`s | Accept the object but deliver only to known, non-revoked recipients. Log a warning for each unknown `node_id`. Do not reject the object — the unknown peer may be known to other parts of the mesh. |

### 6. High-water mark for derived objects

When an object is derived from or references other objects with
different TLP levels, the derived object's TLP is the maximum
restriction of its inputs. This is enforced at signing time by
the core service.

- An Incident referencing one GREEN and one AMBER event is AMBER.
- A chat message on a RED event is RED.
- An indicator extracted from a RED event is RED unless the
  operator explicitly downgrades, which is a re-publication
  requiring a new signature and producing an audit record with a
  mandatory justification field.

Downgrading is never automatic. It requires explicit human action,
produces an immutable audit record, and the operator accepts
accountability for the decision.

### 7. Audit

Every TLP enforcement decision is logged:

| Action | Logged fields |
|---|---|
| TLP check passed (object delivered) | `object_id`, `tlp`, `recipients`, `destination`, `layer`, `decision=allow` |
| TLP check blocked (object filtered) | Same, plus `reason` (e.g. "node not in recipients"). |
| TLP invariant violation (malformed object rejected) | Same, plus `reason`, `severity=alert`. Indicates bug or attack. |
| TLP downgrade by operator | `object_id`, `old_tlp`, `new_tlp`, `operator_id`, `justification` |
| Legacy WHITE normalised to CLEAR | `object_id`, `source_node_id` |

Blocks and violations at Layers 2, 5, and 6 are logged at alert
severity and should trigger operational alerting — they indicate
either a compromised peer or a bug in an upstream enforcement
layer.

Allow decisions are logged at debug level (configurable
retention). Block and violation decisions are logged at info/alert
level (mandatory retention). The audit schema supports both; the
partition retention policy (ADR-0012) applies.

## Consequences

- Every signed object type in Nordlys (events, indicators, chat
  messages, and any future mesh object types) carries a TLP label
  as part of its signed canonical form. The label is immutable
  after signing.

- RED material can be shared through the mesh with cryptographic
  confidence that only named recipients receive it. The defence-in-
  depth architecture means that a single-layer failure (bug,
  misconfiguration, compromised relay) does not result in
  oversharing.

- AMBER+STRICT material never enters the mesh. Peers that need to
  share AMBER+STRICT material more widely must explicitly
  re-publish at AMBER, which is a deliberate, auditable action.

- The high-water mark rule prevents accidental distribution
  widening through derived objects. An extension that processes
  AMBER material cannot produce GREEN output without explicit
  operator intervention.

- Operator-level TLP clearance (ADR-0021) is a dependency for
  deployments handling AMBER or RED material. Without RBAC, all
  operators at a peer see all objects that peer received — which
  satisfies the mesh-level distribution rules but not the FIRST
  TLP v2.0 requirement that RED is for "individual recipients
  only."

- The normalisation from WHITE to CLEAR is a one-time migration
  cost. After migration, Nordlys emits only TLP v2.0 labels.
  Interoperability with TLP v1.0 systems is handled at the ingest
  boundary, not throughout the stack.

- Audit volume increases. Every enforcement decision at every
  layer produces a log entry. Debug-level allow logs can be
  retained at reduced duration; alert-level block/violation logs
  are retained at full audit duration.

- The gossip protocol must be extended to carry TLP-aware queries.
  The existing `/v1/events/since/{cursor}` endpoints must filter
  responses by TLP before sending, which requires knowing the
  destination peer's identity. This is a protocol change that
  affects all Varde implementations.

- Extensions that handle restricted material must declare their
  maximum TLP level in their manifest (Tenet 9, Tenet 10). The
  core service enforces this at the query boundary: an extension
  declared as GREEN-only never receives AMBER or RED objects.

## Alternatives considered

- **TLP as advisory metadata (the MISP model).** TLP labels are
  stored and displayed but not enforced by the transport.
  Distribution is controlled by a separate mechanism (MISP's
  distribution levels). Simpler to implement; well-proven at
  scale. Rejected because the decoupling between label and
  enforcement is the root cause of MISP's most common failure
  mode — silent oversharing when distribution settings do not
  match TLP labels. In a mesh serving critical infrastructure,
  silent oversharing of RED material is unacceptable.

- **TLP enforcement at a single layer (e.g. Varde fan-out only).**
  One enforcement point is simpler to implement and reason about.
  Rejected because a single enforcement point is a single point
  of failure for access control. A bug in Varde fan-out filtering
  would expose RED material to the entire mesh with no fallback.
  Defence in depth is more expensive to implement but provides the
  property that no single bug results in oversharing.

- **Exclude RED from the mesh entirely.** RED material is handled
  out-of-band (encrypted point-to-point, phone, secure email).
  The mesh carries only GREEN and CLEAR; AMBER is the most
  restrictive mesh-carried label. Simplifies enforcement
  significantly. Rejected because the mesh's value proposition is
  speed — 30–60 minutes of delay is the problem Nordlys exists to
  solve. Forcing RED material out-of-band reintroduces the delay
  for the most time-critical information. If the mesh cannot carry
  RED material safely, it cannot serve its purpose during the
  incidents that matter most.

- **Coarse-grained enforcement (RED/not-RED binary).** Enforce
  recipients filtering for RED; treat everything else as
  unrestricted within the mesh. Simpler than full five-level
  enforcement (four FIRST labels plus the AMBER+STRICT variant).
  Rejected because AMBER and AMBER+STRICT have
  distinct sharing rules that matter in a regulated sector.
  Ignoring the distinction between AMBER (org + clients) and
  GREEN (community) would violate FIRST TLP v2.0 and would
  misrepresent the system's compliance posture.

## References

- `docs/design-tenets.md` (Tenet 1, Tenet 3, Tenet 8, Tenet 9,
  Tenet 10, Tenet 11)
- FIRST Traffic Light Protocol v2.0,
  `https://www.first.org/tlp/` — normative reference
- ADR-0021 (RBAC) — dependency for operator-level TLP clearance
- ADR-0017 (Plugin trust model) — extension manifest must declare
  maximum TLP level
- ADR-0019 (Composable extension points) — sub-extensions inherit
  parent's TLP ceiling
- ADR-0023 (Bounded gossip topology) — gossip carries only
  GREEN/CLEAR/AMBER-without-recipients; RED is excluded from gossip
- ADR-0024 (Direct delivery with envelope encryption) — the
  delivery mechanism for RED and AMBER-with-recipients, providing
  both routing isolation and cryptographic confidentiality
