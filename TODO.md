Topology 'Topologi'-view should group peers based on the following peer-category:

O: Kraftomsetning sluttbruker og/eller kraftomsetning engros
P: Vannkraft, vindkraft, solkraft og/eller annen kraftproduksjon
D: Distribusjonsnett
R: Regionalnett
S: Transmisjonsnett (sentralnett)
K: Videresalg av konsesjonskraft
A: Aggregatorvirksomhet


# Plugin System for Nordlys — TechDay 2026 Demo Plan

## Context

Nordlys is the federated mesh-of-nodes platform built for KraftCERT and the Norwegian energy sector. ROADMAP item **2.4 "Tool Store med plugin-manifest"** (Should, currently UI-skall) and 8 items on the v1.1+ wishlist (W3, W6, W8, W14, W16, W22, plus hybrids) call for an extensibility model. The v0.2 line is explicit: **"Ikke utførelse — bare metadata"** for now.

Today the substrate already exists in skeleton form:

- `app/be/packages/contracts/src/tool.ts:4` — `ToolManifest` TypeBox schema (id, name, version, publisher, manifest_url, manifest_hash, Ed25519 signature)
- `app/be/packages/db/src/schema.ts:164` — `tools` table mirrors the schema
- `app/be/services/api-gateway/src/routes/read.ts:167` + `app/be/services/core-svc/src/routes/stats.ts:114` — `GET /tools` end-to-end (read-only)
- `app/be/packages/crypto/` — Ed25519 sign/verify already used for events
- `kollektor/scenarios/*.yaml` — existing v0.1 plugin-shaped extension for collectors
- ElysiaJS `.use(plugin)` registration pattern in `api-gateway/src/index.ts`

What's missing: write path (`POST /v1/tools`), signature verification on install, gossip of manifests, frontend Tool Store, an actual extension contract beyond bare metadata, and concrete hook points.

The intended demo outcome (TechDay 2026): KraftCERT publishes a signed plugin manifest → it appears on every node in the mesh via gossip → operator clicks Enable → a UI panel renders, an outbound webhook fires on the next event, and a new collector scenario starts parsing logs.

Priority per project memory: **stable demo > edge cases**. This plan picks the simplest mechanism that lets that story land on stage.

---

## Approach (recommended)

**Manifest-only, KraftCERT-signed, statically-curated catalog. In-process Elysia `.use()` + dynamic Svelte chunks. No runtime container spawning, no code gossip.**

Plugins are bundled in the monorepo at `app/plugins/<id>/`. "Install" = a row in the `tools` table referencing a known bundled id, gated on Ed25519 signature verification. Manifests gossip as a new signed event type `tool.published`; **code never travels through Varde**.

Three plugin kinds for the demo: **collector (YAML scenario)**, **outbound webhook**, **UI panel**.

### 1. Manifest contract — extend existing `ToolManifest`

Add an inner `spec` discriminated by `kind`. File: `app/be/packages/contracts/src/tool.ts`.

```ts
spec: {
  kind: 'collector' | 'webhook' | 'ui-panel',
  capabilities: string[],          // e.g. ['event.read','indicator.publish']
  permissions: string[],           // declared, KraftCERT-reviewed at signing
  hooks: HookBinding[],            // see §3
  config_schema: TJSONSchema,      // settings UI auto-generation
  runtime: { type: 'in-process', entry: string },
  ui?: { slot: 'dashboard' | 'settings', component: string }
}
```

`manifest_hash` covers the whole envelope; signature stays envelope-level.

### 2. Backend — install + verify + gossip

- **Add `POST /v1/tools`** — gateway route (write.ts pattern) + core-svc handler. Verify Ed25519 against KraftCERT pubkey using `@nordlys/crypto`. Insert into `tools` with `enabled=false`.
  - `app/be/services/api-gateway/src/routes/write.ts` (new sub-route file `tools.ts`)
  - `app/be/services/core-svc/src/routes/` (new `tools.ts`, sibling of `stats.ts`)
- **Add `POST /v1/tools/:id/enable` and `/disable`** — flips DB flag; loader picks it up.
- **Add `tool.published` gossip event** — serialize the signed manifest envelope, gossip via existing mesh-svc pipeline (`app/be/services/mesh-svc/`), receivers verify + upsert into local `tools`.
- **Plugin loader in api-gateway** — on startup and on enable-events, scan `app/plugins/<id>/`, dynamic-import the entry, call `.use(pluginRouter)` for webhook plugins. New file: `app/be/services/api-gateway/src/plugins.ts`.
- **Schema migration** — add `spec jsonb`, `enabled boolean default false`, `installed_at` to `tools` table in `app/be/packages/db/src/schema.ts`. Drizzle migration generated via existing flow.

### 3. Hook points (concrete files)

| Hook | Location | Used by |
|---|---|---|
| Collector YAML loader glob | `kollektor/scenario_loader.py` (legacy) **or** equivalent in current collector-svc | collector plugins |
| Post-ingest event bus | `app/be/services/collector-svc/src/` — emit on existing Redis channel | webhook plugins |
| Gateway sub-router | `app/be/services/api-gateway/src/plugins.ts` (new) | webhook plugins (config endpoints) |
| UI dashboard slot | `app/frontend/src/routes/dashboard/+page.svelte` | ui-panel plugins |
| UI settings slot | `app/frontend/src/routes/dashboard/settings/+page.svelte` | ui-panel plugins |

### 4. Frontend — Tool Store + slot rendering

Build-time plugin merging with dynamic `import()` of pre-bundled chunks, gated at runtime by enabled-tools list from BFF. Compatible with `adapter-static`.

- Plugins UI lives at `app/frontend/src/plugins/<id>/index.svelte`.
- Generated `app/frontend/src/plugins/registry.ts` maps id → `() => import('./<id>/index.svelte')`. Generated by a small build-step script reading `app/plugins/*/manifest.json`.
- New `<PluginSlot name="dashboard"/>` component (`app/frontend/src/lib/components/PluginSlot.svelte`) — fetches `/v1/tools?enabled=true` from BFF, looks up loader, renders via `<svelte:component>`.
- New Tool Store page at `app/frontend/src/routes/dashboard/tools/+page.svelte` — list with signature badge + enable/disable toggle. i18n strings in `app/frontend/messages/{en,nb-NO}.json`.

### 5. Bundled demo plugins (3)

Each lives in `app/plugins/<id>/` with `manifest.json` + entry file(s):

1. **`collector-cisco-ios`** — adds a YAML scenario for Cisco IOS syslog patterns.
2. **`webhook-servicenow`** — POSTs CVE context to a configurable URL on `vulnerability.published`.
3. **`ui-panel-mesh-pulse`** — small dashboard widget showing peer count + last gossip lag (reads existing live store).

A signing CLI (`app/be/scripts/sign-plugin.ts`) signs `manifest.json` with the KraftCERT dev key already on disk and writes `manifest.signed.json` for seeding.

---

## Out of scope for this plan

- Sidecar-container plugins (mirror scanner-svc pattern) — defer post-demo.
- WASM/JS sandbox — unnecessary while everything is KraftCERT-signed.
- OCI registry / signed-tarball code delivery — manifest-only for v0.2.
- Publisher co-signing (third-party trust UX).
- Plugin-driven outbound gossip (no plugin in the demo three needs it).

---

## Critical files

**Modify**
- `app/be/packages/contracts/src/tool.ts` — extend `ToolManifest` with `spec`
- `app/be/packages/db/src/schema.ts` — add `spec`, `enabled`, `installed_at` to `tools`
- `app/be/services/api-gateway/src/index.ts` — wire plugin loader
- `app/be/services/core-svc/src/routes/stats.ts:114` — already returns `tools`; ensure `enabled` filter
- `app/be/services/mesh-svc/` — add `tool.published` event type
- `app/frontend/src/routes/dashboard/+page.svelte` — embed `<PluginSlot>`
- `app/frontend/messages/{en,nb-NO}.json` — Tool Store strings

**Create**
- `app/be/services/core-svc/src/routes/tools.ts` — install/enable/disable handlers + Ed25519 verify
- `app/be/services/api-gateway/src/routes/tools.ts` — proxy with auth macro
- `app/be/services/api-gateway/src/plugins.ts` — plugin loader (`.use()` aggregator)
- `app/be/scripts/sign-plugin.ts` — manifest signing CLI
- `app/plugins/<id>/` × 3 — bundled demo plugins
- `app/frontend/src/lib/components/PluginSlot.svelte`
- `app/frontend/src/plugins/registry.ts` (generated)
- `app/frontend/src/routes/dashboard/tools/+page.svelte` — Tool Store UI

---

## Effort estimate

~12–15 dev-days end to end.

| Chunk | Days |
|---|---|
| Manifest schema extension + DB migration | 1 |
| `POST /v1/tools` + Ed25519 verify | 1 |
| `tool.published` gossip event + handler | 1–2 |
| Plugin loader in api-gateway | 2 |
| Webhook reference plugin | 1 |
| Collector YAML plugin | 1 |
| `<PluginSlot>` + registry codegen + 1 UI plugin | 2–3 |
| Tool Store frontend page (list/enable/badge) | 2 |
| Signing CLI + seeded catalog + demo polish | 1–2 |

---

## Verification (end-to-end demo path)

1. `bun run sign-plugin app/plugins/webhook-servicenow` → produces `manifest.signed.json`.
2. Bring up two nodes via `app/docker-compose.dev.yml` (kraftcert + peer).
3. On the kraftcert node: `curl -X POST localhost:3000/v1/tools -H 'authorization: …' --data @manifest.signed.json` → 200 OK; row appears in `tools`.
4. Watch peer node logs for `tool.published` gossip arrival; `GET /v1/tools` on the peer returns the same row.
5. Open peer frontend `/dashboard/tools` → manifest listed with green KraftCERT signature badge → click Enable.
6. Trigger an event that creates a `vulnerability.published` → confirm webhook plugin POSTs to its configured endpoint (point at `webhook.site` for the stage demo).
7. Open `/dashboard` on the peer → confirm the `mesh-pulse` UI panel renders in the dashboard slot.
8. Tail `collector-svc` logs while replaying a Cisco IOS syslog sample → confirm the new scenario matches and emits a structured event.

### Risks / traps to avoid

- Do **not** dynamic-import plugin chunks from URLs in SvelteKit — fights `adapter-static` and CSP. Use build-time registry codegen.
- Do **not** gossip plugin code/binaries through Varde — manifests only; Varde is a control-plane relay.
- Do **not** spawn containers at install time — docker-compose is declarative; runtime mutation is demo-fragile. Bundle plugins in the monorepo for v0.2.
- Do **not** let plugins write to the `events` table directly — route through existing core-svc handlers so signature/lineage invariants hold.
