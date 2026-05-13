# Development Guide

Getting started as a new developer on the Nordlys frontend.

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 22+ | Vite, build tooling |
| Bun | 1.1+ | Runtime adapter (`svelte-adapter-bun`), backend services |
| npm | 10+ | Package manager (do not use bun install for frontend) |

## First-time setup

```bash
# 1. Install frontend dependencies (use --legacy-peer-deps if you hit TS version conflicts)
cd app/frontend
npm install

# 2. Start the dev server
npm run dev
# → http://localhost:5173 (or 5174 if port taken)
```

### Dummy mode (no backend needed)

The app ships with a **dummy mode** toggle in the header. When active (`localStorage.dummyMode = 'true'`), realistic demo data is generated client-side — no backend required. This is the fastest way to explore the UI.

Toggle it from the dashboard header ribbon.

### With backend

```bash
# In a separate terminal — start the backend (all services + Redis + Postgres)
cd app/be
bun run dev

# The frontend proxies /api/* to localhost:3000 via SvelteKit's BFF
```

The BFF proxy is defined in `src/routes/api/` — requests to `/api/v1/*` are forwarded to `localhost:3000/v1/*`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_API_BASE_URL` | (empty — uses BFF proxy) | Override to point directly at a remote api-gateway |

No `.env` file is required for local development with dummy mode or when running the backend locally.

## Key commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build → `build/` |
| `npm run preview` | Serve production build locally |
| `npm run check` | TypeScript + Svelte type checking |
| `npm run lint` | Prettier + ESLint check |
| `npm run format` | Auto-fix formatting |
| `npm run test:unit` | Vitest (browser + node projects) |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test` | All tests (unit + e2e) |
| `npm run styleguide` | Component catalog at http://localhost:5173/styleguide |

## Project dependencies

```
Team-Nordlys/
├── style-kit/          ← Design tokens + CSS component classes
├── app/
│   ├── frontend/       ← This project (SvelteKit)
│   └── be/             ← Backend (Bun + ElysiaJS microservices)
```

The frontend depends on:

1. **`@nordlys/style-kit`** — CSS design system. Imported via Vite alias (no npm publish). Changes to `style-kit/src/` are picked up by HMR instantly.

2. **`@nordlys/contracts`** — TypeBox schemas from `app/be/packages/contracts/`. Provides TypeScript types for all API responses. Resolved via Bun workspaces.

## i18n (Paraglide)

User-facing strings live in `messages/en.json` (base) and `messages/nb-NO.json`.

After adding or changing keys:
```bash
npx @inlang/paraglide-js compile --project ./project.inlang
```

The dev server auto-compiles on change, but CI needs the explicit compile step.

## Common issues

| Problem | Solution |
|---------|----------|
| `Cannot resolve @nordlys/style-kit` | Make sure you're running from repo root or that `../../style-kit/src` exists relative to `app/frontend/` |
| Port 5173 in use | Dev server auto-increments — check terminal output |
| Storybook peer dep warnings | Install with `npm install --legacy-peer-deps` (TS 6 vs adapter-bun TS 5 conflict) |
| Types from contracts not updating | Restart the Vite dev server (types resolve from source, but Vite caches module graph) |
| Paraglide compile errors | Run `npx @inlang/paraglide-js compile --project ./project.inlang` manually |
| SSE not connecting | Ensure backend is running on port 3000, or switch to dummy mode |

## Editor setup

- **VS Code**: Install Svelte for VS Code + Tailwind CSS IntelliSense
- **IntelliJ/WebStorm**: Svelte plugin + Tailwind CSS plugin
- Enable "format on save" with Prettier as formatter
