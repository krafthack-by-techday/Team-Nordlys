# Nordlys frontend

SvelteKit 2 dashboard for the Nordlys security mesh. Displays events, vulnerabilities, mesh topology, peer health, and indicators for a single node operator. Communicates exclusively through the `api-gateway` — never directly with backend services.

## Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 (Svelte 5, runes mode) |
| Styling | Tailwind CSS 4 + `@nordlys/style-kit` (shared design tokens & components) |
| i18n | Paraglide (base: `en`, secondary: `nb-NO`) |
| Adapter | `@sveltejs/adapter-static` (pre-rendered SPA) |
| Types | Shared from `@nordlys/contracts` (TypeBox schemas) |
| Testing | Vitest (unit/component) + Playwright (e2e) |

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — KPIs, event timeline, peer summary |
| `/events` | Full event table with severity filter and pagination |
| `/vulnerabilities` | KraftCERT advisories with CVSS, TLP, status filter, detail modal with changelog timeline |
| `/health` | Peer health table derived from live mesh state |
| `/topology` | Interactive mesh topology graph with packet animation |

## Key architecture decisions

- **Single API entry point** — all data fetched via `$lib/api` which calls the `api-gateway`. No direct backend calls.
- **Dummy mode** — client-side toggle (localStorage) generates realistic Nordic energy sector demo data. All company names are real Norwegian konsesjonaerer from NVE's official list. Toggle causes full page reload to re-seed stores.
- **Svelte 5 runes** — `$state`, `$derived`, `$effect` throughout. Never mutate `$state` arrays in templates — use `$derived` with `.toSorted()` etc.
- **Style-kit classes** — `.glass`, `.card`, `.table`, `.badge`, `.dialog`, `.glass--tooltip` etc. No custom scoped CSS duplicating what style-kit provides.
- **Native `<dialog>`** — modals use the HTML `<dialog>` element with style-kit's `.dialog` classes and `.showModal()`.
- **Cookie-only locale** — strategy is `['cookie', 'baseLocale']`, no URL prefix.
- **Breadcrumb in layout** — page title + caption handled by `+layout.svelte` via `getRouteCaption()` in `shell-context.ts`. Individual pages do not render their own `<h1>`.

## Project structure

```
frontend/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte        # Shell: header, nav, breadcrumb, Aurora bg
│   │   ├── +page.svelte           # Dashboard
│   │   ├── events/                # Event table page
│   │   ├── vulnerabilities/       # Vuln list + detail modal
│   │   ├── health/                # Peer health table
│   │   ├── topology/              # Mesh topology graph
│   │   └── layout.css             # Tailwind + style-kit imports
│   ├── lib/
│   │   ├── api/                   # Typed API client (types re-exported from @nordlys/contracts)
│   │   ├── components/            # 23 shared Svelte components
│   │   ├── dummy/                 # Demo data generators (seeded, deterministic)
│   │   ├── stores/                # Svelte stores (live data, dummy mode)
│   │   ├── paraglide/             # Compiled i18n messages (auto-generated)
│   │   ├── shell-context.ts       # Layout helpers (route caption, nav state)
│   │   └── utils/                 # Shared utilities
│   └── app.html
├── messages/
│   ├── en.json                    # English i18n keys
│   └── nb-NO.json                 # Norwegian i18n keys
├── project.inlang/                # Paraglide config
├── static/                        # Static assets
└── package.json
```

## Components

Key reusable components in `src/lib/components/`:

| Component | Purpose |
|---|---|
| `Aurora.svelte` | Atmospheric background blobs + grain overlay |
| `DashboardHeader.svelte` | Logo, nav, DEMO ribbon, theme toggle |
| `MeshNav.svelte` | Sidebar/bottom navigation |
| `TopologyGraph.svelte` | Canvas-based mesh topology with packet animation |
| `EventTimeline.svelte` | Compact event feed with severity badges |
| `VulnDetailModal.svelte` | Vulnerability detail dialog with changelog timeline |
| `InfoTip.svelte` | Reusable (i) tooltip with glass styling |
| `KpiCard.svelte` | Summary metric card |
| `PeerCard.svelte` / `PeerDetail.svelte` | Peer status display |
| `Pagination.svelte` | Table pagination controls |

## Developing

```bash
cd app/frontend
npm install
npm run dev              # starts on port 5173 (or 5174)
```

### After adding/changing i18n keys

```bash
npx @inlang/paraglide-js compile --project ./project.inlang
```

### After changing contracts

The frontend imports types from `@nordlys/contracts` via workspace resolution. After changing contract types, the dev server picks them up automatically (Vite resolves from source).

### Type-check

```bash
npm run check            # svelte-check
```

## Style-kit integration

The frontend imports style-kit CSS directly from source via Vite alias:

```css
/* src/routes/layout.css */
@import '@nordlys/style-kit/tokens.css';
@import '@nordlys/style-kit/components.css';
@import '@nordlys/style-kit/components/buttons.css';
@import '@nordlys/style-kit/components/badges.css';
@import '@nordlys/style-kit/components/dialog.css';
/* ... etc */
```

Alias configured in `vite.config.ts`:
```ts
'@nordlys/style-kit': fileURLToPath(new URL('../../style-kit/src', import.meta.url))
```

## Dummy mode

When toggled on (via header control), `localStorage.dummyMode = 'true'` activates client-side demo data generators in `$lib/dummy/data.ts`. Data includes:

- 12 realistic KraftCERT advisories (real CVEs, HMS Networks, PAN-OS, Siemens, ABB, etc.)
- ~50 peers with real Norwegian company names, ~92% online
- Events with simulated gossip relay paths
- Vulnerability changelog showing trust-based merge history (NVD → KraftCERT override → CISA enrichment)

All generators are seeded for deterministic output across reloads.

## Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Getting started, prerequisites, env vars, common issues |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Data flow, routing, state management, ADRs |
| [COMPONENTS.md](./COMPONENTS.md) | All components with props tables and style-kit mapping |
| [/styleguide](http://localhost:5173/styleguide) | Interactive component catalog with design tokens (built-in route) |

## References

- Style-kit: [`../../style-kit/README.md`](../../style-kit/README.md) — design tokens & CSS components
- Backend API: [`../be/README.md`](../be/README.md) — services, endpoints, architecture
- Contracts: [`../be/packages/contracts/`](../be/packages/contracts/) — shared TypeBox schemas
- Swagger UI: `http://localhost:3000/openapi` (when backend running)
- Roadmap: [`../../ROADMAP.md`](../../ROADMAP.md)
