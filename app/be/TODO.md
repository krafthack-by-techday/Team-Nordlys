# Nordlys backend — TODO towards v1.0.0

Outstanding tasks in the `be/` stack. Each task can be picked up independently.

Last updated: 2026-05-02.

## Status

✅ Completed since v0.1.0:

**Stack skeleton**
- Monorepo (Bun workspaces, **5 packages**, 6 services)
- `packages/contracts` — TypeBox schemas (single source of truth)
- `packages/crypto` — Ed25519 + JCS canonicalisation
- `packages/db` — drizzle Postgres schema + migrations, **events partitioned per week, audit_log per month**
- `packages/ws-protocol` — WS messages incl. INVITE_VALIDATION_FORWARD/RESPONSE
- `packages/metrics` — Prometheus text-format renderer

**Services**
- `core-svc` — Ed25519 sign/verify, identity, KraftCERT role, /inbound for mesh traffic, /register for invite redemption
- `mesh-svc` — WS client, rendezvous hashing, reconnect, replay detection, **auto-RESYNC after WELCOME**, **INVITE_VALIDATION_FORWARD handler**
- `varde-svc` — WS server, HTTP gossip, STATE_SNAPSHOT, signed roster, **peer gossip loop, accept throttle, WS health check, partition maintenance, retention, INVITE_VALIDATION flow**
- `collector-svc` — SIEM webhook, scenario engine (YAML), idempotency
- `scanner-svc` — nmap runner with whitelist policy and mock fallback
- `api-gateway` — auth, audit log to Postgres, OpenAPI with dropdown-rendered enums, **/v1/* versioning**, ingest+read+write routing, /metrics
- `frontend` — typed API client and /events page

**Cross-cutting**
- Full docker-compose stack: all 7 containers build and run end-to-end
- **140 unit tests** green (crypto, contracts, ws-protocol, rendezvous, scanner policy, scenario engine, throttle, auth, audit, metrics)
- **3 smoke tests**: varde-svc HELLO/EVENT/PING, mesh-svc full mesh flow, varde-svc invite flow
- **Observability**: Prometheus metrics on api-gateway + varde-svc, minimal Grafana dashboard

🔲 Remaining: 3 tasks, all on hold.

---

## On hold

### INVITE_VALIDATION across Varde↔Varde boundaries (TODO #43)
The current invite flow only works within one Varde (KraftCERT must be WS-connected to the same Varde as the candidate node). When KraftCERT sits behind a private Varde in its own DMZ — which is the realistic production pattern — `INVITE_VALIDATION_FORWARD` and `INVITE_VALIDATION_RESPONSE` must cross Varde boundaries.

Implementation proposal: HTTP endpoints `/v1/invite-validation/forward` and `/v1/invite-validation/respond` on varde-svc with corr_id queue + 5 min TTL. Initiating Varde polls or receives via existing `Varde↔Varde` gossip tick.

Practical consequence in v1.0: KraftCERT must be connected to the same public Varde as the candidate at invite time, or the candidate retries until it connects to a Varde where KraftCERT is present. Documented in README under "Varde deployments".

**Files:** `services/varde-svc/src/routes/gossip.ts`, new `invite-bridge.ts`, update of `pending-invites.ts`.

### Capacity test 400 nodes + reconnect storm (TODO #39)
Simulation with 400 synthetic nodes + 5 Vardes in staging. Acceptance criteria: all WS tunnels stable for 1 hour, end-to-end latency < 5s under 100 events/min/node, no Varde OOM, Postgres IO < 70% saturation. Reconnect storm: kill 1 Varde, verify graceful reconnect without cascade failure.

**Files:** New `services/varde-svc/test/capacity.ts` or separate `tools/load-test/`.

### mTLS between mesh-svc and varde-svc (TODO #37)
KraftCERT-issued client/server certificates. Replace `ws://` with `wss://` + cert validation. Marked v1.1.

**Files:** Requires PKI flow on the KraftCERT side first.

---

## How to pick up a task

1. Choose one and comment your PR with the task title.
2. Check dependencies — several tasks have notes on what they build on.
3. Run `bun run --filter '*' typecheck && bun test` before committing.
4. The smoke test pattern is established in:
   - `services/varde-svc/test/smoke.ts` (basic HELLO/EVENT/PING)
   - `services/varde-svc/test/invite-smoke.ts` (full KraftCERT flow)
   - `services/mesh-svc/test/smoke.ts` (full mesh end-to-end)
5. Update this TODO.md when you are done — move from the open section to the status list at the top.
