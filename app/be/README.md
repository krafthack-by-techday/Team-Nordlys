# Nordlys backend (`be/`)

Bun + ElysiaJS microservice stack for Nordlys v1.0.0. This is a greenfield implementation replacing the existing FastAPI monolith in `app/backend/`. Old code remains as reference, but no code has been ported — everything is built from scratch with modern choices.

## What is Nordlys?

Nordlys is a **decentralised security mesh for the Norwegian power sector**: each power company runs its own node, signs events cryptographically, and shares them with other nodes through a public Varde relay. KraftCERT is the trust anchor (issues identities, can revoke), but is not a central server — the mesh continues if KraftCERT goes down. Scale target: **400 nodes**.

See `/README.md` (repo root) for business context and legal overview, and `docs/TBD-TRANSPORT-ARKITEKTUR.md` for the transport layer.

---

## Architecture at a glance

```
                 ╔════════ INTERNET (public) ═════════╗
                 ║                                      ║
                 ║   ┌──────┐  HTTP   ┌──────┐         ║
                 ║   │Varde │◄───────►│Varde │   ...   ║   <-- Varde stack
                 ║   │ DNS  │ gossip  │ DNS  │              (operated by sector association,
                 ║   └──┬───┘         └──┬───┘                min. 5 in v1.0)
                 ╚══════│════════════════│══════════════╝
                        │ WS (TLS)       │ WS (TLS)
                        │ outbound only  │ outbound only
        ╔═══════════════│════════════════│══════════════╗
        ║ NODE STACK   ┌▼──────┐        ┌▼──────┐      ║
        ║ (Hafslund)   │ mesh- │        │ mesh- │ ...  ║
        ║              │ svc   │        │ svc   │      ║
        ║              └───┬───┘        └───┬───┘      ║
        ║          ┌───────▼─────┐  ┌──────▼────────┐  ║   <-- all external calls
        ║          │ api-gateway │  │ api-gateway   │  ║       go via gateway
        ║          │  (auth,     │  │  (auth,       │  ║
        ║          │  policy,    │  │  policy,      │  ║
        ║          │  audit)     │  │  audit)       │  ║
        ║          └──┬───┬───┬──┘  └──┬───┬───┬────┘  ║
        ║          core collec scan  core collec scan  ║
        ║          -svc -svc  -svc  -svc -svc  -svc    ║
        ║          postgres + redis  postgres + redis  ║
        ║          frontend          frontend          ║
        ║          (loopback)        (loopback)        ║
        ╚════════════════════════════════════════════════╝
```

**Two deployment types per peer:**

- **Node stack** — run by each organisation in its internal zone. Contains 7 containers: `api-gateway`, `core-svc`, `mesh-svc`, `collector-svc`, `scanner-svc`, `frontend`, `postgres`+`redis`. Exposes **no ports** to the internet — `mesh-svc` establishes only *outbound* WebSocket connections to the organisation's own Varde in the DMZ.
- **Varde stack** — one container (`varde-svc`) in the organisation's DMZ. **All Vardes are publicly reachable** and together form a flat Varde mesh that gossips HTTP between each other.

### Varde mesh: each peer owns its own Varde

There is no "public sector-operated Varde layer" and "private peer Vardes" as two tiers. **There is one flat mesh of peer-owned Vardes**, where each organisation (power company, KraftCERT, Statnett, ...) operates its own Varde in its own DMZ. All Vardes are on the internet and communicate with each other.

```
                    ╔══════════════════ INTERNET ═══════════════════╗
                    ║                                                ║
                    ║   ┌─────────┐  HTTP   ┌─────────┐  HTTP        ║
                    ║   │Hafslund │◄───────►│Glitren- │◄────►...     ║
                    ║   │ Varde   │ gossip  │ett Varde│              ║
                    ║   │ (DMZ)   │         │ (DMZ)   │              ║
                    ║   └────▲────┘         └────▲────┘              ║
                    ║        │ ▲                │ ▲                  ║
                    ║        │ │                │ │ all ↔ all        ║
                    ║        │ └────────────────┘ │                  ║
                    ║        │   ┌─────────────┐  │                  ║
                    ║        │   │ KraftCERT   │  │                  ║
                    ║        │   │ Varde (DMZ) │◄─┘                  ║
                    ║        │   └────▲────────┘                     ║
                    ╚════════│════════│═══════════════════════════════╝
                             │ WS     │ WS    (TLS, outbound only
                             │        │        from internal zone)
        ╔════════════════════│════════│═══════════════════════════════╗
        ║ Hafslund INTERNAL  │        │   KraftCERT INTERNAL ZONE      ║
        ║ ┌──────────────────▼┐       │ ┌────────────────────▼───┐    ║
        ║ │ Node stack        │       │ │ Node stack             │    ║
        ║ │ VARDE_BOOTSTRAP=  │       │ │ VARDE_BOOTSTRAP=       │    ║
        ║ │  wss://varde.     │       │ │  wss://varde.          │    ║
        ║ │  hafslund.no/ws   │       │ │  kraftcert.no/ws       │    ║
        ║ └───────────────────┘       │ │ ROLE=kraftcert         │    ║
        ║                             │ └────────────────────────┘    ║
        ║                             │     ... and similarly for      ║
        ║                             │     Glitrenett, Statnett, ...  ║
        ╚═════════════════════════════════════════════════════════════╝
```

**What each peer sets up:**

1. **One `varde-svc` container in its DMZ** — DNS-exposed (`varde.<org>.no`), TLS terminated via Caddy/sidecar. Open for inbound and outbound HTTP from/to other organisations' Vardes, and open for inbound WS from the organisation's own internal nodes.
2. **Configures `VARDE_PEERS`** on its Varde with the URLs of other known Vardes (`VARDE_PEERS=https://varde.glitrenett.no,https://varde.kraftcert.no,...`). The roster converges over time via `/v1/roster/announce` gossip.
3. **Node stack in internal zone** with `VARDE_BOOTSTRAP=wss://varde.<own-org>.no/ws` (or internal bridge into the DMZ). Mesh-svc connects only outward to the organisation's own Varde — not directly to other organisations' Vardes.

**Why:**

- The incident-response team sits deep in the internal zone and cannot open outbound internet. The WS tunnel to the *own* DMZ Varde goes over an internal bridge, not over the internet.
- The DMZ is already a zone that *can* expose TLS services to the internet — that is what a DMZ is. Adding one service there is not a security change.
- Ownership: the peer controls its own Varde, its own TLS cert, its own operations. No central operator to negotiate SLA with.
- Resilience: no central failure point. Kill one Varde and the rest of the mesh continues — the only node that loses mesh access is the one in the same organisation, and only until their own Varde is back.

**KraftCERT is a peer like any other.** The KraftCERT organisation operates its own Varde and its own node stack. The only difference is `ROLE=kraftcert` on core-svc and an entry in other Vardes' `KRAFTCERT_NODE_IDS` config.

**Peers that cannot or do not want to operate their own Varde:** can connect to another organisation's Varde by agreement, or to a sector-operated shared Varde. Both are valid, but each-peer-owns-its-own is the recommended pattern — it removes the dependency on a third party.

**Known limitation in v1.0:** `INVITE_VALIDATION_FORWARD` is routed over WS *within one Varde* — the Varde forwards to a KraftCERT-tagged session that is WS-connected to the same Varde. When KraftCERT is on its own Varde and the candidate is on another, the request must cross the Varde↔Varde boundary. The gossip covers events/identity/revocations, but not per-corr_id request/response — that is TODO #43, planned for v1.1. Practical in v1.0: the candidate connects to KraftCERT's own DMZ Varde (`wss://varde.kraftcert.no/ws`) during initial onboarding; once the identity has propagated the node can switch back to its own Varde.

---

## Service descriptions

| Service | Port | Role |
|---|---|---|
| `api-gateway` | 3000 | The only external entry point. Auth (Bearer API key), audit log, OpenAPI aggregation, request validation, routing to backend services. Backend services expose no ports externally. |
| `core-svc` | 3010 | Holds the node's **Ed25519 private key**. Signs events/indicators/chat. Identity registry, KraftCERT role (invites, revoke). Inbound endpoints for verified mesh objects. The only service with write access to the peer/revocations tables. |
| `mesh-svc` | 3011 | WS client towards the Varde mesh. Top-N (default 3) tunnels selected with rendezvous hashing. Reconnect with exponential backoff + jitter. Bridge between core-svc (outbound events) and Varde mesh (inbound events). |
| `collector-svc` | 3012 | SIEM webhook (`/ingest/siem`), manual events, IoCs. YAML scenario engine for matching/aggregation/shadow mode. Postgres-based idempotency on `(source, external_ref)`. Forwards to core-svc for signing. |
| `scanner-svc` | 3013 | nmap runner (TBD — stub in v1.0). Scan results go the same route as SIEM events. |
| `varde-svc` | 3020 | Peer-owned Varde in the organisation's DMZ — publicly reachable (TLS). WS server for the organisation's own nodes, HTTP gossip to other peers' Vardes, local Postgres storage of events/identity/roster, signed `STATE_SNAPSHOT`. |
| `frontend` | (loopback) | SvelteKit dashboard. Points to `api-gateway`. |

---

## Design decisions

### Bun + ElysiaJS

TypeScript-first stack with built-in WebSocket support in the runtime (`Bun.WebSocket`, `bun:test`, `Bun.serve`). Elysia provides end-to-end typed contracts via TypeBox and automatic OpenAPI generation. The frontend (SvelteKit) shares language and types with the backend, and the monorepo package `@nordlys/contracts` is the **single source of truth** for all data types.

**Not** Node.js (Bun gives better WS performance and faster boot), **not** Go (loses the Elysia ecosystem and typed contracts against SvelteKit).

### Ed25519 instead of RSA

- 32-byte keys (vs 256+ for RSA-2048)
- Faster sign/verify
- Standard in modern protocols (SSH, Tor, libp2p)
- Built into `node:crypto` — no third-party crypto library

JCS (RFC 8785) is used for canonicalisation before signing, so the same object produces the same bytes regardless of key order.

### Varde mesh instead of peer-to-peer gossip

The incident-response team in a power company sits deep inside the network zone. The IT manager will not open inbound ports to the internet for a sharing network, and will not open outbound internet from that zone either. Therefore:

- Each peer operates its own Varde in its own DMZ — a zone already intended for exposing/consuming internet services
- Nodes in the internal zone connect only **outbound** WS to the organisation's own Varde (internal bridge, not over the internet)
- DMZ Vardes gossip HTTP between each other over the internet — one flat mesh, no central operator
- KraftCERT is a peer like any other — only `ROLE=kraftcert` on its core-svc and an entry in other Vardes' `KRAFTCERT_NODE_IDS` distinguishes it

Details: `docs/TBD-TRANSPORT-ARKITEKTUR.md` and the "Varde mesh" section above.

### API gateway in front of all backend services

Centralised authentication, audit logging, rate limiting, and request validation in one place. Backend services do not need to implement this themselves. Defence in depth: backend services expose no ports externally — only the gateway reaches them.

### API versioning

All domain endpoints are exposed under `/v1/*` (e.g. `/v1/events`, `/v1/ingest/siem`). System endpoints (`/health`, `/metrics`, `/openapi`) are directly under root without a version — they are used by infrastructure tools that do not understand versioning. Breaking changes (new required field, renamed field, removed endpoint) are introduced under a new version (`/v2/*`), never in an existing one. Old versions are supported for a minimum of 6 months after a new version is available.

### API-first — contracts before implementation

`packages/contracts/` defines TypeBox schemas for all data types (Event, Indicator, Peer, Identity, Vulnerability, etc.). The schemas provide:
- Runtime validation in Elysia routes
- Type inference for handler bodies and responses
- Automatic OpenAPI generation
- Shared types for all services

### Shared Postgres + Redis per node

Postgres for stable state (events, indicators, peers, audit_log). Redis for ephemeral state (rate windows, sync cursors, mesh activity). Drizzle ORM with schema in `packages/db/`. Each node stack has its own instance; the Varde stack has its own separately.

### Rendezvous hashing (HRW) for Varde selection

With 400 nodes × 3 tunnels / 5 Vardes = ~240 tunnels per Varde. Naive hashing produces skewed distribution and massive reshuffling on roster changes. Rendezvous (Highest Random Weight) gives uniform distribution and minimal reshuffling — ~N/M nodes move when a new Varde is added.

---

## Repo structure

```
be/
├── package.json                # Bun workspaces root
├── tsconfig.base.json          # shared TS config
├── docker-compose.dev.yml      # full dev stack (all 7 svc + db + redis)
├── Dockerfile.svc              # generic Dockerfile (SERVICE_DIR arg)
├── TODO.md                     # outstanding tasks towards v1.0.0
├── packages/
│   ├── contracts/              # @nordlys/contracts — TypeBox schemas
│   ├── crypto/                 # @nordlys/crypto — Ed25519 + JCS
│   ├── db/                     # @nordlys/db — drizzle Postgres schema
│   ├── health-score/           # @nordlys/health-score — peer health computation
│   ├── vuln-dedup/             # @nordlys/vuln-dedup — vulnerability dedup/merge with trust-based resolution
│   └── ws-protocol/            # @nordlys/ws-protocol — WS messages
└── services/
    ├── api-gateway/
    ├── core-svc/
    ├── mesh-svc/
    ├── collector-svc/
    ├── scanner-svc/
    └── varde-svc/
```

Each `services/*/test/smoke.ts` is a runnable end-to-end test for that service. Copy the structure when adding tests for new features.

---

## Getting started

### Prerequisites

- Bun ≥ 1.3 (`brew install oven-sh/bun/bun`)
- Docker Desktop (for Postgres/Redis in dev)

### First time

```bash
cd app/be
bun install                       # installs all workspaces
bun run --filter '*' typecheck    # confirms TS health
bun test packages/crypto          # 14 unit tests on crypto
```

### Start the dev stack (Postgres + Redis)

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
DATABASE_URL=postgres://nordlys:nordlys@localhost:5432/nordlys \
  bun packages/db/src/migrate.ts
```

### Run one service locally

```bash
# core-svc
DATABASE_URL=postgres://nordlys:nordlys@localhost:5432/nordlys \
  PORT=3010 NODE_ID=hafslund-1 COMPANY=Hafslund ROLE=peer \
  bun services/core-svc/src/index.ts

# api-gateway (in another terminal)
PORT=3000 CORE_SVC_URL=http://localhost:3010 \
  API_KEYS="dev-key:dev-secret" \
  bun services/api-gateway/src/index.ts

# OpenAPI available at http://localhost:3000/openapi
# Domain endpoints are under /v1, e.g. http://localhost:3000/v1/events
```

### Run smoke tests

```bash
# Varde alone + 2 simulated WS clients
DATABASE_URL=postgres://nordlys:nordlys@localhost:5432/nordlys \
  PORT=3020 VARDE_ID=varde-1 VARDE_TEST_MODE=true \
  PUBLIC_URL=http://localhost:3020 \
  bun services/varde-svc/src/index.ts &

bun services/varde-svc/test/smoke.ts

# Full mesh flow: 2 nodes + 1 Varde, end-to-end event propagation
bun services/mesh-svc/test/smoke.ts
```

---

## How an event flows through the system

```
SIEM webhook
    │ POST /v1/ingest/siem (Bearer API key)
    ▼
api-gateway
    │ auth, validate against contract, audit log
    │ POST /ingest/siem
    ▼
collector-svc
    │ scenario match (YAML), idempotency check on (source, external_ref)
    │ POST /events
    ▼
core-svc
    │ JCS canonicalise, Ed25519 sign, persist in Postgres
    │ POST /publish/event (best-effort)
    ▼
mesh-svc
    │ Send EVENT frame over WS to all open Varde tunnels (top-N)
    ▼
varde-svc (on a public Varde)
    │ Verify signature against identity registry, dedup on UUID,
    │ persist, fan-out to all other connected nodes
    ▼
mesh-svc (on another node)
    │ Receives EVENT, replay detection on seq
    │ POST /inbound/events
    ▼
core-svc (on the other node)
    │ Re-verify signature, persist in local Postgres
    ▼
GET /v1/events via api-gateway → frontend renders
```

Expected end-to-end latency: < 1 sec under normal load.

---

## How a new node onboards (invite flow)

```
[Operator]                                 [KraftCERT node]
  │ 1. Receives invite token (manually        │
  │    from KraftCERT operator, e.g. POST     │
  │    /invites on KraftCERT core-svc)        │
  │                                           │
[New node — fresh mesh-svc]                  │
  │ 2. Opens WS to *KraftCERT's* DMZ Varde   │
  │    (wss://varde.kraftcert.no/ws) for      │
  │    initial onboarding                     │
  │ 3. HELLO {node_id, company, public_key,   │
  │           invite_token}                   │
  │                                           │
[KraftCERT Varde-svc]                        │
  │ 4. Unknown node_id + invite_token →       │
  │    park HELLO with corr_id (5min TTL),    │
  │    find KraftCERT-tagged session          │
  │    (KraftCERT's own mesh-svc is WS-       │
  │    connected to this Varde)               │
  │ 5. If KraftCERT node is offline:          │
  │    REJECTED "kraftcert_offline_retry_     │
  │    later". Candidate retries.             │
  │ 6. Send INVITE_VALIDATION_FORWARD         │
  │    over WS to KraftCERT session ─────────►│
  │                                           │ 7. mesh-svc forwards to
  │                                           │    core-svc /register
  │                                           │ 8. core-svc validates token,
  │                                           │    signs SignedPeerIdentity,
  │                                           │    persists
  │ 9. INVITE_VALIDATION_RESPONSE ◄──────────│ 9. mesh-svc ships signed
  │    {accepted, identity}                   │    identity back
  │                                           │
  │ 10. Persist identity in local DB          │
  │ 11. WELCOME + STATE_SNAPSHOT to           │
  │     waiting new node                      │
  │ 12. IDENTITY_UPDATE broadcast to          │
  │     other connected sessions              │
[New node]                                   │
  │ 13. Receives WELCOME, enters normal ops   │
```

**Topological prerequisite in v1.0:** The candidate node must connect to *KraftCERT's own DMZ Varde* at invite time. This is because `INVITE_VALIDATION_FORWARD` is routed over WS within one Varde — the KraftCERT node must be WS-connected to the same Varde as the candidate. Cross-Varde invite routing (TODO #43) is planned for v1.1 and removes this limitation.

**After initial onboarding** the candidate has a signed identity that has propagated to all Vardes via gossip. The node can then switch `VARDE_BOOTSTRAP` to its own DMZ Varde and operate as a normal peer from there. The initial KraftCERT Varde connection is only for the invite flow.

**If the KraftCERT node is offline:** The Varde returns `REJECTED: kraftcert_offline_retry_later` (1013). Mesh-svc's exponential backoff retries. A 5-minute TTL queue on the Varde side is reserved for a future "hold request while KraftCERT comes back" pattern, but v1.0 asks the candidate to retry instead — simpler control and no risk of the request being forgotten.

**Each power company (peer) therefore needs:**
- A full **node stack** in its internal zone (api-gateway + core-svc + mesh-svc + collector-svc + scanner-svc + frontend + db/redis)
- Its **own Varde** in the DMZ (publicly reachable, owns the organisation's TLS cert)
- An invite token from KraftCERT (once, at initial onboarding)
- Roster URLs to other peers' Vardes (`VARDE_PEERS` on its own Varde)

See also `services/varde-svc/test/invite-smoke.ts` for a runnable end-to-end test of the flow.

---

## Contracts and schema

`packages/contracts/` is the **single source of truth** for data models:

- `Event`, `Indicator`, `ChatMessage` — signed mesh objects
- `PeerIdentity`, `Revocation`, `InviteToken` — identity registry
- `VardeIdentity`, `SignedVardeRoster` — the Varde layer
- `Vulnerability`, `VulnChangelogEntry`, `VulnFieldChange`, `ToolManifest`, `Scan` — v0.2 features
- `AuditLogEntry` — gateway audit
- `EventIngestInput`, `IndicatorIngestInput` — external input schemas

Import as types or TypeBox schemas:

```typescript
import { SignedEvent, EventIngestInput } from "@nordlys/contracts";

// As Elysia body validator (runtime + static):
.post("/foo", ({ body }) => /* body is SignedEvent */, { body: SignedEvent })

// As plain type:
function handle(event: SignedEvent) { ... }
```

`packages/db/src/schema.ts` defines drizzle Postgres tables. Migrations are generated with `bun x drizzle-kit generate` (in `packages/db/`).

`packages/vuln-dedup/` implements trust-based vulnerability deduplication and merge. When the same CVE arrives from multiple sources (NVD, CISA, KraftCERT), it resolves conflicts using source trust ranking (kraftcert:100 > cisa:80 > nvd:60 > vendor:50 > scanner:30 > manual:10). Higher-trust sources overwrite advisory fields; lower-trust sources only enrich missing data. Local status is never overwritten. Each merge generates a `VulnChangelogEntry` tracking field-level diffs.

`packages/health-score/` computes peer health scores from multiple signals (connectivity, latency, event freshness, certificate validity).

---

## Observability

Both exposed services have a Prometheus-compatible `/metrics` endpoint:

| Service | URL | Key metrics |
|---|---|---|
| `api-gateway` | `http://localhost:3000/metrics` | `nordlys_gateway_requests_total`, `nordlys_gateway_request_duration_seconds`, `nordlys_gateway_audit_writes_total` |
| `varde-svc` | `http://localhost:3020/metrics` | `nordlys_varde_ws_sessions`, `nordlys_varde_ws_messages_total`, `nordlys_varde_events_persisted_total`, `nordlys_varde_peer_gossip_pulls_total`, `nordlys_varde_partition_management_runs_total` |

The endpoints return Prometheus text format (v0.0.4). Scrape them with a standard `prometheus.yml` config.

The Grafana dashboard `grafana/dashboards/nordlys-overview.json` can be imported directly into Grafana (Dashboard → Import → Upload JSON). It requires a Prometheus data source named `Prometheus`. The dashboard shows:

- **Gateway request rate** grouped by HTTP status code
- **Gateway P95 latency** (5-minute window)
- **Active WS sessions** on Varde (gauge)
- **Events persisted/min** on Varde
- **Peer gossip pull rate** grouped by result (success/fail)

The metrics package (`packages/metrics`) is a zero-dependency TypeScript implementation of Prometheus exposition format with `Counter`, `Gauge`, and `Histogram`.

---

## What's missing

See [`TODO.md`](./TODO.md) for outstanding tasks grouped by topic (Varde operations hardening, mesh flow, API gateway, quality assurance, scale, security). Each task has dependencies and affected files documented.

---

## Common commands

```bash
# Type-check all workspaces
bun run --filter '*' typecheck

# Run all tests (when test suite is in place — TODO #38)
bun test

# Run tests in one package
bun test packages/crypto

# Generate a new DB migration after schema change
cd packages/db && bun x drizzle-kit generate

# Run migrations
DATABASE_URL=postgres://... bun packages/db/src/migrate.ts

# Build one Docker image
docker build -f Dockerfile.svc --build-arg SERVICE_DIR=services/api-gateway .
```

---

## Configuration (env vars)

Each service reads config from env. Common pattern:

| Service | Required | Recommended |
|---|---|---|
| `api-gateway` | `PORT`, `CORE_SVC_URL`, `API_KEYS` | `DATABASE_URL` (audit), `CORS_ORIGIN`, `MESH_SVC_URL`, `COLLECTOR_SVC_URL`, `SCANNER_SVC_URL` |
| `core-svc` | `PORT`, `DATABASE_URL`, `NODE_ID`, `COMPANY` | `ROLE` (`peer` \| `kraftcert`), `MESH_SVC_URL`, `NODE_PUBLIC_KEY`, `NODE_PRIVATE_KEY`, `RATE_CAP_*` |
| `mesh-svc` | `PORT`, `DATABASE_URL`, `NODE_ID`, `COMPANY`, `CORE_SVC_URL` | `VARDE_BOOTSTRAP`, `VARDE_TOP_N`, `RECONNECT_MIN_MS`, `PING_INTERVAL_MS` |
| `collector-svc` | `PORT`, `DATABASE_URL`, `CORE_SVC_URL` | `SCENARIOS_DIR`, `COLLECTOR_SHADOW` |
| `scanner-svc` | `PORT`, `DATABASE_URL`, `CORE_SVC_URL` | `SCANNER_WHITELIST`, `SCANNER_ALLOW_EXTERNAL`, `SCANNER_MOCK_WHEN_MISSING`, `SCAN_TIMEOUT_MS` |
| `varde-svc` | `PORT`, `DATABASE_URL` | `VARDE_ID`, `VARDE_PEERS`, `VARDE_PUBLIC_KEY`, `VARDE_PRIVATE_KEY`, `VARDE_TEST_MODE`, **`KRAFTCERT_NODE_IDS`**, `MAX_NEW_WS_PER_SEC`, `EVENT_RETENTION_DAYS` |

**Onboarding-relevant env vars in detail:**
- `core-svc` `ROLE=kraftcert` — marks the node as trust anchor. Grants access to `POST /invites` and `POST /revoke`. The KraftCERT node has the same stack as a regular peer; the role is only a flag.
- `mesh-svc` `VARDE_BOOTSTRAP=ws://varde-1:3020/ws,ws://varde-2:3020/ws,...` — comma-separated bootstrap list. Mesh-svc selects top-N with rendezvous hashing.
- `varde-svc` `KRAFTCERT_NODE_IDS=kraftcert-1,kraftcert-2` — which connected sessions the Varde forwards `INVITE_VALIDATION_FORWARD` to. Default: `kraftcert`. Must match the `NODE_ID` of actual KraftCERT nodes.

See each `services/*/src/config.ts` for the full list with defaults.

---

## How to contribute

1. Pick a task from `TODO.md` and create a branch.
2. Follow existing patterns — repos in `services/*/src/repos/`, routes in `services/*/src/routes/`, contracts in `@nordlys/contracts`.
3. Run `bun run --filter '*' typecheck` before committing.
4. The smoke test pattern is established in `services/varde-svc/test/smoke.ts` and `services/mesh-svc/test/smoke.ts` — copy the structure for new features.
5. Keep comments minimal: explain *why*, not *what*. The code is already self-explanatory.
6. Update `TODO.md` (check off or move forward) when you are done.

---

## References

- Business and legal context: `/README.md` (repo root)
- Transport architecture (Varde mesh): `docs/TBD-TRANSPORT-ARKITEKTUR.md`
- Roadmap: `/ROADMAP.md`
- Onboarding flow: see "How a new node onboards" above and `services/varde-svc/test/invite-smoke.ts`
- Planning document with full design decisions: `~/.claude/plans/jeg-har-startet-arbeid-steady-dove.md` (local to Claude Code session — not in repo)
