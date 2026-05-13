# Nordlys Architecture Overview

**Status**: Draft for review
**Audience**: Engineers porting the system, security auditors, future maintainers
**Companion documents**: `adr/` for the decisions behind this overview

---

## Problem

Norwegian power companies, distribution system operators, and the sector
CSIRT need a shared real-time picture of cyber incidents affecting grid
operations. Today this picture is assembled by phone, email, and ad-hoc
chat after the fact, with delays of 30–60 minutes before separate
incidents at separate companies are recognised as a single coordinated
attack. A central reporting platform is unattractive: it concentrates
sector-critical signal in one location and is itself a high-value
target. Nordlys is the technical answer to that problem — a
decentralised mesh in which each peer (power company, transmission
operator, sector CSIRT) runs its own node, signs its own observations,
and shares them with other peers without a central server in the path.

---

## System overview

The mesh has three participant roles:

- **Node** — operated by one organisation in its internal network zone.
  Holds the organisation's signing key, persists its own and gossiped
  events, runs the operator dashboard.
- **Varde** — operated by the same organisation, deployed in its DMZ.
  Publicly reachable on the internet. Carries node-to-mesh traffic and
  gossips with other organisations' Vardes. Each peer owns its own
  Varde; there is no central operator.
- **KraftCERT** — a peer like any other (one node, one Varde) with the
  additional responsibility of issuing signed identities for new peers
  and signing revocations. The mesh continues to operate when KraftCERT
  is offline; only onboarding and revocation pause.

```
  ========================== INTERNET ============================

    +--------+  HTTP    +--------+  HTTP
    | Varde  |<-------->| Varde  |<-------->...     Varde mesh
    |   A    |  gossip  |   B    |  gossip          (bounded,
    +---+----+          +---+----+                   peer-owned)

  ================================================================
        |                   |
        | WS (TLS)          | WS (TLS)
        | outbound only     | outbound only
        |                   |
  ======|===================|=====================================
        |                   |
   Org A INTERNAL       Org B INTERNAL
   +----v-------------+ +---v--------------+
   | Node stack       | | Node stack       |
   | ---------------- | | ---------------- |
   | api-gateway      | | (same shape)     |
   | core-svc (key)   | |                  |
   | mesh-svc         | |                  |
   | collector-svc    | |                  |
   | scanner-svc      | |                  |
   | frontend         | |                  |
   | postgres + redis | |                  |
   +------------------+ +------------------+

  ================================================================
```

Two deployment artefacts per peer: a node stack of seven processes in
the internal zone, and one Varde process in the DMZ. The node stack
opens no inbound ports to the internet. The Varde is the only
internet-reachable component.

---

## Trust model

**Identity.** Every node owns a long-lived Ed25519 keypair held by its
core-svc. The private key never leaves that process. The public key is
embedded in a `SignedPeerIdentity` record that has been signed by
KraftCERT.

**Signing.** Four object types travelling on the mesh carry a signature
of the originator: events, threat indicators, chat messages, and peer
identities themselves. Revocations are signed by KraftCERT.

**Verification.** Every Varde verifies the signature on every inbound
event before persisting or forwarding it. Receiving nodes verify a
second time before storing locally. Verification looks up the signer's
public key in the local identity register and rejects (a) records from
unknown signers, (b) records whose canonical bytes do not match the
signature, and (c) records from signers present in the local
revocation list. Canonicalisation follows RFC 8785 (JCS) so the same
object yields the same bytes regardless of how it was constructed.

**Trust anchor.** KraftCERT is the sole identity issuer in v1.0. The
sector association road-map calls for a multi-anchor design (NVE, RME,
NSM as additional or alternative anchors) so that no single
organisation is structurally indispensable for onboarding. The
single-anchor model is a pragmatic v1.0 choice, not the end state.

**Trust boundary.** External callers cross the boundary at the
api-gateway (Bearer API key or session cookie). Mesh objects cross the
boundary at the Varde signature check. Internal calls between
co-located node services run over a Docker network and are trusted by
construction; this trust is what makes private-key isolation in
core-svc tractable.

**TLP enforcement.** Every signed object carries a TLP label
(CLEAR, GREEN, AMBER, AMBER+STRICT, or RED). The label is immutable
after signing and governs distribution at every layer: the API
gateway validates label-recipient consistency, the Varde enforces
gossip-vs-direct routing, and the database query layer filters by
TLP. See ADR-0020 for the full ten-layer enforcement architecture.

**Operator access control.** Operator identity is local to the node.
Operators authenticate via OIDC against the organisation's IdP or
via a local credential store (for air-gapped deployments and service
accounts). Role-based access control with TLP clearance per operator
is specified in ADR-0021 (pending).

---

## Topology

Two topologies coexist deliberately. **Inside one organisation** the
node services form a hub-and-spoke around the api-gateway: backend
services bind to internal addresses only, the gateway is the sole
externally reachable process, and every external request is
authenticated, audited, and rate-limited there before it reaches a
backend service. **Across organisations** the Vardes form a bounded
mesh: each Varde gossips with a random subset of peers (~10–15, not
all-to-all) using a pull-first protocol with eager push-on-receive
(ADR-0023). There is no hub Varde whose loss would partition the
sector.

TLP:RED and AMBER-with-recipients objects bypass gossip entirely and
are delivered directly to named recipients with envelope encryption
(ADR-0024). This two-channel design — bounded gossip for broadcast,
direct delivery for restricted — keeps sensitive material off the
gossip layer by construction.

A flat mesh between nodes was rejected because it would require every
internal-zone node to accept inbound internet traffic; security
operations teams will not open those firewall rules. An all-to-all
gossip mesh between Vardes was rejected because it does not scale
to 400 peers (each Varde would need ~399 outbound connections). A
pure star with one central server was rejected because that server
is then the sector's single point of failure and a high-value target.
Hub-spoke inside the organisation, bounded mesh between
organisations, gives each peer the network properties of its zone:
locked-down internal, publicly-exposed DMZ.

---

## Data flow: a single event lifecycle

1. An OT system or SIEM emits a syslog or webhook to the local
   collector-svc with a `(source, external_ref)` pair.
2. Collector-svc reserves the `(source, external_ref)` in its dedup
   table; if the pair was already seen, it returns the prior event id
   and stops here.
3. Collector-svc matches the input against its YAML scenario library
   and constructs an unsigned candidate event.
4. Collector-svc forwards the candidate to core-svc over the local
   network. Collector-svc does not write to the events table itself.
5. Core-svc checks the per-severity rate cap. If exceeded, it returns
   429 to collector-svc, which records the drop and returns 200 to the
   SIEM (a duplicate-style response).
6. Core-svc canonicalises the event under JCS, signs it with the
   node's Ed25519 key, and inserts it into the events table.
7. Core-svc publishes the signed event over a local Redis channel for
   the operator dashboard, and forwards it to mesh-svc for fan-out.
8. Mesh-svc sends the event as a `EVENT` frame over each of its open
   WebSocket tunnels to its top-N selected Vardes.
9. The receiving Varde verifies the signature against the signer's
    identity, checks revocation, deduplicates on UUID, persists, and
    forwards the event to locally-connected node sessions and to its
    bounded set of peer Vardes through gossip (ADR-0023). For
    TLP:RED or AMBER-with-recipients events, step 8–9 is replaced
    by direct HTTP POST with envelope encryption to named recipient
    Vardes only (ADR-0024); the event never enters the gossip layer.
10. A receiving mesh-svc on another node forwards the event to its own
    core-svc, which re-verifies the signature and inserts into the
    local events table. The local frontend renders the new event over
    Server-Sent Events.

End-to-end latency under normal load is under one second for direct
delivery. For gossip-distributed events, propagation completes within
3–4 gossip rounds across the bounded mesh.

---

## Components

**api-gateway.** Owns: external authentication (Bearer API key and
session cookie), audit logging, request validation against the shared
contracts package, OpenAPI aggregation. Does NOT own: signing keys,
mesh transport, scenario matching, the events table.

**core-svc.** Owns: the node's Ed25519 private key, all writes to the
events / indicators / chat / peers / revocations tables, signing,
TLP enforcement at signing time (ADR-0020), per-severity rate cap
enforcement, the KraftCERT-only endpoints (invite issuance,
revocation, access-request approval). Does NOT own: external
authentication, the WebSocket transport, scenario matching.

**mesh-svc.** Owns: the WebSocket tunnels to selected Vardes, top-N
tunnel selection via rendezvous hashing, reconnect with exponential
backoff and jitter, replay detection on the receive path, RESYNC
catchup on reconnect, forwarding inbound mesh objects to core-svc for
re-verification and persistence. Does NOT own: signing keys, persistent
storage of events, identity issuance.

**collector-svc.** Owns: the SIEM/webhook ingress endpoint,
`(source, external_ref)` deduplication, the YAML scenario engine
(matching, shadow mode, title/description templating). Does NOT own:
signing, persistence of finished events, mesh transport.

**scanner-svc.** Owns: nmap execution under a CIDR allow-list, scan
job lifecycle records. Does NOT own: signing (scan results enter the
mesh as ordinary events through core-svc), networking outside the
allow-list.

**varde-svc.** Owns: the public WebSocket server for nodes in its
organisation, signature verification on inbound mesh objects, UUID
deduplication, persistence of events / identities / roster, fan-out to
locally-connected nodes, bounded gossip to a random subset of peer
Vardes (ADR-0023), direct delivery of recipient-scoped objects with
envelope encryption (ADR-0024), state-snapshot bootstrap for newly
connected nodes, partition management of the events and audit_log
tables. Does NOT own: external auth (the API gateway is unrelated to
the WS layer), the node's signing key, scenario matching.

---

## Multi-sector deployment model

Nordlys is designed for sector-specific deployment. The Norwegian
energy sector is the first and reference deployment, anchored by
KraftCERT in v1.0 with a planned evolution to multi-anchor
(KraftCERT alongside NVE and possibly NSM as co-equal anchors)
before broader rollout. The choice of anchor is not an
implementation detail; it reflects the actual authority structure
of the sector the deployment serves.

Other sectors — finance, health, transportation among them — can
run their own independent Nordlys deployments. Each sector
deployment has its own trust anchors, its own Varde infrastructure,
its own peer organisations, its own audit log, and its own threat
model. The same code runs in each deployment; what differs is the
configuration that names the anchors and the scenario library that
encodes the sector's detection knowledge.

Sector deployments do not share state, do not share trust, and do
not federate by default. A peer in one deployment sees no events
from another deployment, and a Varde in one deployment is not a
known peer to a Varde in another. Each deployment is its own closed
mesh.

Cross-sector event federation — a path that would let a curated
subset of events cross between sector deployments — is a possible
future feature. It would require its own architectural decision
covering the federation trust model, classification rules for what
crosses, and audit treatment on both sides. It is out of scope for
the current version.

---

## Failure modes

**A Varde dies mid-session.** All node WebSocket connections to that
Varde close. Each affected node's mesh-svc enters exponential backoff
and retries. The dead Varde's peers detect the failure during HTTP
gossip and back off the affected peer to one-in-three cycles after
five consecutive failures, but never exclude it. Events that were
in-flight to the dead Varde during the disconnect window are dropped:
mesh-svc has no on-disk queue. They will be recovered on reconnect
through the RESYNC catchup against the events the Varde already
gossiped to peer Vardes — provided at least one other Varde received
them.

**KraftCERT is offline.** Existing identities continue to verify.
Revocations issued before the outage continue to apply. New nodes
cannot complete onboarding: the Varde returns
`kraftcert_offline_retry_later` to any HELLO carrying an invite token
and the candidate is asked to retry. New revocations cannot be
issued. The mesh is otherwise unaffected.

**A node is compromised.** KraftCERT issues a signed Revocation. The
revocation gossips through the mesh as an ordinary mesh object. Each
Varde and each receiving node, on seeing the revocation, refuses
further objects signed by the revoked key and stops fanning out
in-flight objects. Already-persisted events from the now-revoked
signer are not retroactively deleted; they remain in the historical
record with their original signature.

**The mesh partitions.** Each partition continues to accept events
from the nodes connected to it. Within a partition, gossip and fan-out
work normally. Across partitions, no objects flow until network
connectivity is restored. On reconnection, gossip pull reconciles the
two halves; deduplication on UUID prevents double-insertion. There is
no epoch or term tracking — Nordlys assumes partitions resolve in
minutes-to-hours, not days.

**A peer queues days of events while disconnected.** The disconnected
node's mesh-svc has no offline queue, so events the node itself
produced during the outage were either persisted locally only (no
mesh fan-out happened) or never created (collector-svc was also
offline). On reconnect the node sends RESYNC with the
last-event-cursor it remembers; the Varde returns up to 500 events per
response, and the node iterates if needed. Locally-produced events
that never reached a Varde must be re-published by the local
application; mesh-svc does not retry them.

---

## Out of scope

Nordlys does not do, and does not aim to do, the following:

- **Graded information** under the Norwegian Security Act
  (`sikkerhetsloven`). Graded material belongs on NSM's own channels.
  Nordlys is bounded to ungraded and power-sensitive material.
- **Real-time control** of OT systems. Nordlys is read-only with
  respect to grid equipment. The collector consumes syslog; nothing
  in the system writes back to a relay or RTU.
- **Replacement of statutory NIS2 / digitalsikkerhetsloven
  reporting.** Nordlys can support such reporting by exporting
  records, but the legal duty to notify NSM, RME, and the sector
  CSIRT is unchanged.
- **Automatic PII sanitisation** of OT log data. Operator judgement is
  required before any record is shared.
- **Automatic legal classification** under the power preparedness
  regulation (`kraftberedskapsforskriften`). Classification is the
  peer's responsibility.
- **A central audit log across organisations.** Each peer keeps its
  own audit log. There is no sector-wide audit aggregator.
- **Multi-tenant deployment.** One Nordlys instance serving multiple
  sectors side by side. "Multi-sector" in this design means multiple
  independent deployments, not a single deployment multiplexing
  tenants.
- **Cross-sector event federation.** A path letting curated events
  cross between sector deployments. A possible future feature; would
  require its own architectural decision covering the federation
  trust model, classification rules, and audit treatment on both
  sides.
- **STIX/TAXII export** of indicators in v1.0. The internal indicator
  type does not currently map to STIX; an export adapter is on the
  road-map.

---

## Related documents

- **Architecture Decision Records:** `docs/adr/README.md` — grouped
  index of all ADRs (0001–0024)
- **Design tenets:** `docs/design-tenets.md` — 14 tenets governing
  architectural choices
- **Technical introduction:** `docs/README.md` — worked examples
  (GREEN broadcast, RED encrypted delivery)
- **Concepts and glossary:** `docs/CONCEPTS.md`
