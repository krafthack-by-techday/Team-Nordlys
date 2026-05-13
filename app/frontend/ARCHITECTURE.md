# Architecture

How the Nordlys frontend is structured and why.

## High-level overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (SvelteKit SPA)                                        │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │  Routes   │───▶│  Components  │◀───│  liveStore (runes)    │  │
│  │ +page.svelte│  │  $lib/comp/  │    │  $lib/stores/live.*   │  │
│  └──────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                   │              │
│                                      ┌────────────▼────────────┐ │
│                                      │  SSE Client ($lib/api/) │ │
│                                      │  EventSource → /api/v1/ │ │
│                                      └────────────┬────────────┘ │
└───────────────────────────────────────────────────┼──────────────┘
                                                    │
                                    BFF proxy (SvelteKit server)
                                                    │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │  api-gateway (port 3000)  │
                                    │  ElysiaJS + Redis pub/sub │
                                    └───────────────────────────┘
```

## Data flow: Real-time updates

1. Backend services publish events to **Redis pub/sub** channels (`nordlys:event`, `nordlys:indicator`, `nordlys:chat`, `nordlys:stats`, `nordlys:peer`, `nordlys:health`)
2. `api-gateway` subscribes to all channels and fans out via **SSE** at `GET /v1/stream`
3. SvelteKit's BFF proxy forwards `/api/v1/stream` → `localhost:3000/v1/stream`
4. `$lib/api/sse.ts` creates an `EventSource` connection with auto-reconnect (exponential backoff, max 30s)
5. `$lib/stores/live.svelte.ts` receives typed messages and updates reactive `$state` variables
6. Components read from `liveStore.events`, `liveStore.stats`, etc. — reactivity propagates automatically via Svelte 5 runes

### SSE event types

| Event name | Payload type | Updates |
|------------|-------------|---------|
| `event` | `SignedEvent` | `liveStore.events` |
| `indicator` | `SignedIndicator` | `liveStore.indicators` |
| `chat` | `SignedChatMessage` | `liveStore.chatMessages` |
| `stats` | `Stats` | `liveStore.stats` |
| `peer` | `PeerWithStatus` | `liveStore.peers` |
| `connected` | `{ clients: number }` | Connection state |

All collections are capped at 500 items in memory. Deduplication by `id` field.

## Data flow: Initial page load

1. `+layout.svelte` calls `liveStore.start(data.stats, data.events)` with server-loaded seed data
2. Individual pages can seed additional collections (e.g. topology page calls `liveStore.seedPeers(peers)`)
3. After seeding, SSE takes over for real-time updates

## Routing model

**Static SPA** — `ssr = false`, `prerender = false` in `+layout.ts`. The entire app is client-rendered.

```
src/routes/
├── +layout.ts              # SPA config
├── +layout.svelte          # Shell (Aurora bg, header, nav)
├── +page.svelte            # / — Dashboard
├── events/+page.svelte     # /events — Event table
├── vulnerabilities/        # /vulnerabilities — CVE list + detail modal
├── health/                 # /health — Peer health table
├── topology/               # /topology — Mesh graph + packet animations
└── api/                    # BFF proxy routes (server-only)
```

Despite being an SPA, `+page.server.ts` files exist for initial data loading — SvelteKit runs these during client-side navigation to fetch data before rendering.

## Style architecture

```
style-kit/src/tokens.css          → Design tokens (CSS custom properties)
style-kit/src/components/*.css    → Reusable CSS classes (.badge, .card, .table, ...)
          ↓ imported via Vite alias
app/frontend/src/routes/layout.css → Tailwind + all style-kit imports
          ↓ @theme block registers tokens
app/frontend/src/lib/components/  → Svelte components use token utilities + CSS classes
```

**Rule:** Svelte components never redefine colours or spacing. They use:
- Tailwind utilities backed by style-kit tokens (`bg-bg`, `text-aurora-mint`, `font-display`)
- Style-kit component classes (`.badge`, `.card`, `.table`, `.glass`)
- Scoped CSS only for layout that Tailwind cannot express

## State management

No external state library. All state lives in:

| Location | Scope | Mechanism |
|----------|-------|-----------|
| `liveStore` | Global singleton | Module-level `$state` variables with getter exports |
| Page-level | Per route | Local `$state` in `+page.svelte` |
| Component-level | Per instance | `$state` inside component `<script>` |

The `liveStore` pattern (module-level singletons with rune reactivity) replaces what would traditionally be a Svelte store or Redux. It works because Svelte 5 runes are reactive at the variable level — no subscription boilerplate needed.

## Architecture Decision Records

### ADR-1: Bun adapter instead of static adapter

**Decision:** Use `svelte-adapter-bun` for production serving.

**Context:** Originally planned as `adapter-static` (see CLAUDE.md), but switched to Bun adapter to support the BFF proxy pattern — the SPA needs a thin server layer to proxy API requests and SSE streams to the backend without exposing the api-gateway directly.

**Trade-off:** Requires a Bun runtime in production (not just static files), but eliminates CORS complexity and allows SSE proxying with proper connection handling.

### ADR-2: SSE over WebSocket

**Decision:** Use Server-Sent Events for real-time updates, not WebSocket.

**Context:** The data flow is unidirectional (server → client). SSE provides:
- Automatic reconnection (built into `EventSource`)
- Works through HTTP proxies without upgrade negotiation
- Simpler server implementation (just write to stream)
- Named event types map cleanly to domain objects

**Trade-off:** No client-to-server streaming (not needed — writes go via REST POST).

### ADR-3: Paraglide over other i18n solutions

**Decision:** Use Paraglide (inlang) for internationalisation.

**Context:** Paraglide compiles messages to tree-shakeable functions — only used messages are bundled. No runtime dictionary lookup. Fits the "small, deterministic build" requirement for per-node deployment.

**Trade-off:** Smaller ecosystem than i18next, but better bundle size and type safety.

### ADR-4: Style-kit as separate package

**Decision:** Design tokens and CSS components live in a separate `style-kit/` package, not inside the frontend.

**Context:** Allows the design system to be developed and previewed independently (via `style-kit/index.html`). Could be consumed by other frontends if the mesh grows. Clear separation of "what it looks like" vs "how it behaves".

**Trade-off:** Extra Vite alias configuration. Developers need to know which package to edit for visual vs behavioural changes.

### ADR-5: Module-level $state singletons over Svelte stores

**Decision:** Use Svelte 5 rune-based module singletons (`$state` at module top-level) instead of `writable()`/`readable()` stores.

**Context:** Svelte 5 runes make any variable reactive. A module-level `$state` with exported getters gives the same global reactivity as stores, with less boilerplate and better TypeScript inference.

**Trade-off:** Breaks from Svelte 4 conventions — developers expecting `$store` auto-subscription syntax will need to adjust.

## API contract

The backend auto-generates **OpenAPI/Swagger** at `http://localhost:3000/openapi`.

Types are shared via `@nordlys/contracts` (TypeBox schemas) — the same schemas validate requests on the backend and provide TypeScript types on the frontend. See `app/be/packages/contracts/src/` for the authoritative type definitions.

Frontend re-exports the subset it needs in `$lib/api/types.ts`.

## Deployment model

Each Nordlys node (Hafslund, Glitrenett, KraftCERT, etc.) runs its own instance:

```
┌──────────────────────────┐
│  Node (e.g. Hafslund)    │
│                          │
│  ┌────────────────────┐  │
│  │  Frontend (Bun)    │◀─── Browser
│  │  port 5173/3001    │  │
│  └────────┬───────────┘  │
│           │ proxy         │
│  ┌────────▼───────────┐  │
│  │  api-gateway       │  │
│  │  port 3000         │  │
│  └────────────────────┘  │
│  + core-svc, mesh-svc…   │
└──────────────────────────┘
```

No shared CDN, no external cloud dependencies. The build must be self-contained.

## App version

The app version is sourced from `package.json` and exposed at runtime via
SvelteKit's built-in `$app/environment` module:

```svelte
<script>
  import { version } from '$app/environment';
</script>

<p>{version}</p>
```

This is configured in `svelte.config.js` under `kit.version.name`. To bump the
version, update the `"version"` field in `package.json` — it propagates
automatically to all components that import from `$app/environment`.
