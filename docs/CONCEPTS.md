# Nordlys — Concepts & Glossary

A central reference for the terms used across this repo. Read this once before
diving into service-level docs (`app/be/README.md`), the architecture overview
(`docs/architecture-overview.md`), or the ADR index (`docs/adr/README.md`).
Service-specific docs assume the vocabulary defined here.

---

## What Nordlys is

A decentralised security-information-sharing mesh for the Norwegian power
sector. When a coordinated cyber-attack hits multiple utilities at once, the
status quo is: phone calls, Teams chats, 30–60 minutes before someone notices
the pattern. A central reporting platform is an attractive DoS target.

Nordlys instead has every utility run its own node, sign its own events
cryptographically, and gossip them across a peer-owned relay layer. KraftCERT
is the trust anchor (issues identities, can revoke), but is not a central
server — the mesh keeps working if KraftCERT is offline. Scale target:
**400 nodes**.

---

## Roles and entities

### Peer (organisation)

A single organisation participating in the mesh — a power company, KraftCERT,
Statnett, or similar. Each peer is identified by a `node_id` (its Node's
identifier in the mesh) and a human-readable `company` field.

In v1.0 a peer has exactly one Node and exactly one Varde. The data model
allows multiple, but operational simplicity drives one-of-each.

### Node

The full backend stack inside one peer's internal network zone. Seven
containers: `api-gateway`, `core-svc`, `mesh-svc`, `collector-svc`,
`scanner-svc`, `frontend`, `postgres`+`redis`.

The Node holds the peer's **Ed25519 private key** in `core-svc`. It signs
every event/indicator/chat originating from the peer.

The Node exposes **no ports to the internet**. Its only outbound connection
is a WebSocket tunnel from `mesh-svc` to its own Varde — and even that goes
over the internal bridge into the DMZ, not over the internet.

### Varde

A peer-owned relay container (`varde-svc`) that lives in the peer's DMZ. It
is publicly reachable on the internet (DNS + TLS), and:

- Accepts **inbound WebSocket** from the peer's own Node (and only that Node)
- Accepts **inbound HTTP** from other peers' Varder (gossip)
- Initiates **outbound HTTP** to other peers' Varder (gossip)

All Varder together form the **Varde mesh** — a layer where each
Varde gossips with a bounded subset of peers (random-k fanout, default
~10–15 peers) rather than all-to-all. See ADR-0023 for the bounded
gossip topology. TLP:RED and AMBER-with-recipients objects bypass
gossip entirely and are delivered directly to named recipients with
envelope encryption (ADR-0024).

The Varde does **not** sign events. It verifies signatures from the trust
register, deduplicates on UUID, persists for retention, and forwards to
connected Nodes and other Varder. It is a relay, not an authority.

### Operator

The human in a peer organisation's SOC who reads the dashboard, marks
incidents, posts chat messages, requests scans. Operators authenticate to
their own `api-gateway` (Bearer API key in v1.0; mTLS / SSO in v1.1).
Operators do not authenticate to other peers' systems — trust between peers
is purely cryptographic, not user-level.

### KraftCERT

A peer like any other — same container stack, same Varde-in-DMZ topology.
What sets KraftCERT apart:

- `core-svc` runs with `ROLE=kraftcert`, which exposes `POST /invites` and
  `POST /revoke` endpoints
- KraftCERT's `node_id` is listed in every Varde's `KRAFTCERT_NODE_IDS`
  config so that Varder forward `INVITE_VALIDATION_FORWARD` requests to
  KraftCERT's WS session

KraftCERT being offline blocks new-peer onboarding, but does not affect
event flow between already-onboarded peers. The mesh is not centralised on
KraftCERT.

---

## Domain objects

### Event

A discrete security incident or observation: "ABB Relion brute-force from
185.220.101.34", "SCADA setpoint tampered", "phishing email cluster". Has
`severity` (low/medium/high/critical), a `source` (siem/manual/scanner/
syslog/...), and a UUID.

Every Event is signed by the originating Node's Ed25519 private key over
its JCS-canonicalized form. Receivers verify against the signer's public
key from their local identity register. The Varde mesh fans events out to
all connected Nodes by default; if `recipients: [...]` is set on the event,
only those Nodes receive it (used for selective distribution, e.g.
TLP:RED).

### Indicator (IoC) and TLP

A piece of evidence: an IP, a domain, a hash, a TTP. Tagged with **TLP**
(Traffic Light Protocol):

- **TLP:RED** — share with named recipients only
- **TLP:AMBER+STRICT** — share with the receiving organisation only;
  recipients must not share beyond their own organisation
- **TLP:AMBER** — share with the receiving organisation and its clients
- **TLP:GREEN** — share within the community (the mesh)
- **TLP:CLEAR** — public, no sharing restrictions

Nordlys uses FIRST TLP v2.0 terminology. The former "TLP:WHITE" label is
replaced by "TLP:CLEAR". AMBER+STRICT is a FIRST-defined variant of AMBER
with stricter sharing rules. See ADR-0020 for the full enforcement
architecture.

`api-gateway` enforces TLP at signing time: TLP:RED objects must include a
non-empty `recipients` list, TLP:AMBER+STRICT/AMBER may,
TLP:GREEN/CLEAR never set `recipients`.

### Chat message

A free-text comment attached to a specific event, used for cross-peer
coordination ("we're seeing the same pattern", "blocking now"). Signed
like an event. Replicates across the mesh as messages with a
`parent_event_id`.

### Vulnerability

A CVE/CVSS record local to one peer's `core-svc` — not gossiped across
the mesh in v1.0. Used by the dashboard to show "open vulns affecting our
assets". Future versions may share Vulnerabilities cross-peer when an
attack pattern matches a known CVE.

### Scan

A network scan job (nmap) requested by an operator. Targets must match the
peer's policy whitelist. Results are emitted as a signed Event with
`source=scanner` and propagate normally through the mesh.

### Tool (manifest)

A pointer to an external defensive tool packaged as a YAML manifest.
Stored in the local `tools` table; not executed by Nordlys. The Tool Store
is a curated catalogue, signed by its publisher, that operators can use to
discover and install tools.

---

## Identity and trust

### Identity (SignedPeerIdentity)

The authoritative record of a peer in the mesh. Fields: `node_id`,
`company`, `public_key`, `registered_at`, `registered_by`, plus a
signature. Signed by KraftCERT during onboarding (or self-signed for
bootstrap records). Replicated to every Varde and every Node.

When a Varde or Node receives a signed Event/Indicator/Chat, it looks up
the originator's `public_key` in its local identity register and verifies
the signature. No identity record → reject. Revoked identity → reject.

### Invite token

A single-use, time-limited (1 hour TTL) credential that a Node presents to
prove it has permission to onboard. KraftCERT mints invites via
`POST /invites` (typically out-of-band, after a contract is signed). The
candidate Node ships the token in its first `HELLO` message. The Varde
forwards to KraftCERT for validation; on success, KraftCERT signs a fresh
SignedPeerIdentity and the candidate is admitted.

### Revocation

An entry in the `revocations` table that says "trust nothing signed by
this `node_id` going forward". Issued by KraftCERT (`POST /revoke`).
Replicated across the mesh through the same channels as identities.
Receivers reject any event where the signer is revoked, regardless of
whether the signature itself verifies.

### Ed25519 + JCS canonicalization

All cryptographic signatures are **Ed25519** over the **JCS-canonicalized**
JSON of the object (RFC 8785). Properties:

- 32-byte public keys (raw form), 64-byte signatures
- Same JSON object always produces the same bytes regardless of property
  order
- Faster sign/verify than RSA-2048; smaller keys on the wire

`packages/crypto/` is the single implementation. Every service that
verifies (mesh-svc, varde-svc, core-svc) imports from it.

---

## Mesh and transport

### The mesh

The graph of peers, edges given by the Varde mesh. Every event eventually
reaches every Node, subject to TLP-based recipient filtering and rate caps.

### Varde-mesh topology (bounded, peer-owned)

Not a hierarchy. There is no "public sector layer" and "private peer
layer". One layer of peer-owned Varder, all on the internet, each
gossiping with a bounded random subset of peers (not all-to-all):

```
Internet:    [Hafslund Varde] ↔ [KraftCERT Varde] ↔ [Glitrenett Varde] ↔ ...

DMZ + WS bridge:
                  ▲                    ▲                  ▲
                  │ outbound WS        │                  │
Internal:    [Hafslund Node]      [KraftCERT Node]   [Glitrenett Node]
```

Each peer's Node connects only to its own Varde. Cross-peer traffic flows
Node → own Varde → other peer's Varde → other peer's Node.

### Gossip (Varde ↔ Varde)

HTTP-based, pull-first with eager push-on-receive. Each Varde gossips
with a bounded random subset of peers (~10–15, not all 399). Endpoints
(`/v1/events/since/{cursor}`, `/v1/identity/sync`,
`/v1/revocations/sync`, `/v1/roster/announce`) exchange events,
identities, revocations, and roster updates. Each Varde keeps a per-peer
`last_seen` cursor in memory; on restart the cursor resets to 0 and
dedup at the DB layer (UUID PK) absorbs the overlap. Within 3–4 gossip
rounds, events propagate to all peers. See ADR-0023.

### WebSocket tunnel (Node ↔ own Varde)

Persistent, outbound from `mesh-svc`. PING every 25 s; reconnect with
exponential backoff + jitter (1 s..60 s, capped at 6 doublings). On
reconnect, `mesh-svc` issues a `RESYNC` against `core-svc`'s
`/last-event-cursor` so missed messages catch up.

The Node holds tunnels to **top-N** Varder (default N=3) chosen by
**rendezvous hashing**. In a single-Varde-per-peer deployment this is
just "your own Varde"; the top-N machinery is there for future
multi-Varde deployments and for failover.

### STATE_SNAPSHOT

The signed bootstrap message a Varde sends right after a node's `HELLO` /
`WELCOME`. Contains the full identity register, the full revocation list,
and the current Varde roster — all in one frame. Lets a fresh Node skip
hundreds of round-trips on first connect.

### RESYNC

A WebSocket message from Node to Varde meaning "replay anything I missed
since `from_cursor` on these channels". Issued automatically after every
WELCOME (so reconnects catch up) and on demand from operator UI.

### INVITE_VALIDATION_FORWARD / RESPONSE

The two messages that carry an invite-token validation request from a
candidate Node, through its bootstrap Varde, to KraftCERT, and back. See
`app/be/README.md` "Slik onboarder en ny node" / "How to onboard a new
node" for the full sequence.

In v1.0 this flow works only when KraftCERT is WS-attached to the same
Varde as the candidate. Cross-Varde invite forwarding is TODO #43, due
in v1.1.

---

## Algorithms and patterns

### Rendezvous hashing (HRW)

Used by `mesh-svc` to pick which top-N Varder to keep tunnels open
against. For each candidate Varde, hash `(node_id || varde_id)` and pick
the N highest scores. Adding or removing a Varde re-routes only ~N/M
nodes — important at 400-node scale to avoid storm-restarts when the
roster changes.

### Replay detection (`seq`)

Every WS message has a per-sender monotonically-increasing `seq`
counter. The receiver tracks last-seen-`seq` per tunnel and drops any
message whose `seq` is not strictly greater. Defends against replay if
TLS terminates somewhere unexpected.

### Per-severity rate caps

`core-svc` enforces caps before signing: **20/h low, 10/h medium, 5/h
high, 2/h critical** (configurable). The Varde additionally applies a
per-source-Node cap (default 60 events/min) on inbound. A misbehaving
collector or a runaway scanner cannot flood the mesh.

### Idempotency on `(source, external_ref)`

`collector-svc` keeps a small `ingest_dedup` table keyed on the SIEM's
identifier for the alert. Retries from the SIEM (which all SIEMs do)
collapse onto the same Event. Manual events with empty `external_ref`
bypass dedup (every operator post is a new Event).

### Partition retention

The `events` and `audit_log` tables are partitioned by `created_at`/`ts`
(weekly and monthly respectively). `varde-svc` runs a daily job that
DROPs partitions older than the retention window (default 30 days for
events, 90 days for audit). Avoids VACUUM overhead on a flat 1.2 M-row
table.

### Selective distribution (recipients list)

Events and Indicators may include a `recipients: [node_id, ...]` field.
For TLP:RED and AMBER-with-recipients, the message is delivered directly
to named recipients via HTTP POST with envelope encryption (ADR-0024) —
it never enters the gossip layer. The payload is encrypted with an
ephemeral symmetric key, and that key is encrypted per-recipient using
X25519 key agreement derived from the recipients' Ed25519 public keys.
Other Nodes never see the ciphertext. Used for TLP:RED, TLP:AMBER+STRICT
with explicit recipients, and sensitive cross-peer coordination.

---

## Onboarding flow (concise)

```
1. Operator gets an invite token from KraftCERT (out-of-band).
2. New Node opens WS to KraftCERT's Varde with HELLO + invite_token.
3. KraftCERT's Varde parks the connection, forwards INVITE_VALIDATION_FORWARD
   to its WS-attached KraftCERT Node.
4. KraftCERT calls core-svc /register → consumes the token, signs a fresh
   SignedPeerIdentity, persists locally.
5. KraftCERT ships INVITE_VALIDATION_RESPONSE back to the Varde with the
   signed identity.
6. Varde persists the identity, sends WELCOME + STATE_SNAPSHOT to the
   waiting Node, and broadcasts IDENTITY_UPDATE so other connected Nodes
   learn the new peer.
7. The new Node disconnects from KraftCERT's Varde and reconnects to its
   own Varde (going forward it operates as a normal peer).
```

The full sequence with timing and WS message types is in `app/be/README.md`.

---

## Where to read more

- **Service-level architecture, getting started, and contributor guide:**
  `app/be/README.md`
- **Architecture overview and design tenets:** `docs/architecture-overview.md`,
  `docs/design-tenets.md`
- **Architecture Decision Records:** `docs/adr/README.md`
- **Technical introduction with examples:** `docs/README.md`
- **Transport-layer design (historical reference):**
  `docs/archive/TBD-TRANSPORT-ARKITEKTUR.md` — partially superseded by
  ADR-0023 and ADR-0024
- **Open work toward v1.0.0:** `app/be/TODO.md`
- **Roadmap and product priorities:** `ROADMAP.md` (repo root)
- **Domain background, legal context, FAQ:** `README.md`, `FAQ.md` (repo root)
- **Reference implementation (Python FastAPI, no longer maintained):**
  `app/backend/`
