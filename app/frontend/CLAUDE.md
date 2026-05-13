# Nordlys Frontend

SvelteKit-basert frontend som serveres av hver Nordlys-node ved siden av FastAPI-backenden. Denne katalogen er **produksjonsorientert** — i motsetning til resten av repoet (som fortsatt er hackathon-PoC) bygges frontend mot produksjonskvalitet fra start.

## Arkitektur i korte trekk

- **Static SPA** — bygges med `@sveltejs/adapter-static` til en flat mappe (`build/`) bestående av `index.html` + immutable assets. Ingen Node-runtime i prod; output kan serveres som statiske filer av FastAPI eller en hvilken som helst HTTP-server.
- **Ren frontend** — Python/FastAPI eier alt API. SvelteKit har ingen server-load, ingen form actions, ingen `+server.ts`/`+page.server.ts` og ingen `hooks.server.ts`. All datahenting skjer fra browseren mot FastAPI-endepunkter (`/events`, `/peers`, `/identity`, `/.well-known/stk`, m.fl.).
- **Per-node deployment** — hver peer (Hafslund, Glitrenett, KraftCERT, …) serverer sin egen frontend-bygg. Frontend må derfor være liten, deterministisk og kunne kjøres uten ekstern avhengighet på CDN eller skytjenester.

### SPA-konfigurasjonen

Tre ting holder SPA-modusen sammen — endre én og du må forstå de to andre:

1. **`svelte.config.js`** — `adapter({ fallback: 'index.html', strict: false })`. `fallback` genererer SPA-shellen; `strict: false` lar ruter være ikke-prerenderet uten å feile builden.
2. **`src/routes/+layout.ts`** — `ssr = false`, `prerender = false`, `trailingSlash = 'never'`. Slår av all SSR/prerender; alt rendres i browseren.
3. **`src/app.html`** — hardkodet `lang="en" dir="ltr"`. Initial verdier som klienten oppdaterer.

Hvis SSR eller server-routes blir nødvendig senere er valget `adapter-node` + dedikert Node-prosess foran FastAPI, *ikke* å gjenåpne hooks.server her.

## Stack

| Lag | Verktøy | Versjon (per scaffold) |
|---|---|---|
| Rammeverk | SvelteKit 2 + Svelte 5 (runes mode) | 2.58 / 5.55 |
| Språk | TypeScript strict | 6.x |
| Bygg | Vite | 8.x |
| Adapter | `@sveltejs/adapter-static` | 3.x |
| Styling | Tailwind v4 (CSS-first config) + `@tailwindcss/forms`, `@tailwindcss/typography` | 4.x |
| i18n | Paraglide (inlang) | 2.x |
| Unit/komponent-tester | Vitest (browser-mode via Playwright-provider for `*.svelte.{test,spec}.ts`, Node-mode for resten) | 4.x |
| E2E-tester | Playwright (`*.e2e.ts` mot `vite preview`) | 1.59 |
| Linting/formatering | ESLint 10, Prettier 3, `prettier-plugin-svelte`, `prettier-plugin-tailwindcss` | — |

Runes-modus er tvunget på (se `compilerOptions.runes` i `svelte.config.js`) — bruk `$state`, `$derived`, `$effect`, `$props`, ikke legacy reactive declarations.

## Mappestruktur

```
app/frontend/
├── src/
│   ├── app.html                  SPA-shell, hardkodet lang/dir
│   ├── app.d.ts                  Globale typer (App.Locals, App.Error, …)
│   ├── hooks.ts                  Universelt reroute (deLocalizeUrl)
│   ├── lib/
│   │   ├── paraglide/            Auto-generert av Paraglide — IKKE rediger manuelt
│   │   └── …                     Delte komponenter, API-klient, stores, types
│   └── routes/
│       ├── +layout.ts            ssr=false, prerender=false, trailingSlash=never
│       ├── +layout.svelte        Sett <html lang>/dir reaktivt fra getLocale()
│       ├── +page.svelte
│       └── …                     Per-side ruter
├── messages/
│   ├── en.json                   Base locale
│   └── nb-NO.json                Norsk Bokmål (BCP-47, kanonisk casing)
├── project.inlang/settings.json  Locales: ["en", "nb-NO"]
├── static/                       Filer som kopieres rått til build-roten
├── playwright.config.ts          E2E mot `npm run build && preview`
├── vite.config.ts                Vitest dual-project (client browser + server node)
└── svelte.config.js              adapter-static SPA-config
```

## i18n-modell

Paraglide v2 i klient-modus. Locale plukkes fra URL/cookie og settes med `setLocale()`. `+layout.svelte` har et `$effect` som speiler aktuell locale til `<html lang>` og `<html dir>` slik at lesere/skjermlesere får korrekt språk uten SSR.

Locale-listen er **`["en", "nb-NO"]`**. Norsk er primærspråk i UI; engelsk er base for fallback og utviklingsergonomikk. Legg til `nn-NO` (Nynorsk) hvis det blir aktuelt — ikke gjenåpne `no`-macrolanguage-taggen.

## Backend-kontrakt

FastAPI eier OpenAPI-spec. Plan: generer TS-typer og typed klient i CI (f.eks. `openapi-typescript` + `openapi-fetch`) slik at brudd på kontrakten fanges som type-errors. Ingen klient-genering er på plass ennå — frontend kaller foreløpig `fetch()` direkte.

API-base-URL leses fra `PUBLIC_API_BASE_URL` (Vite-eksponert env-var). Lag `.env.example` når den første reelle integrasjonen kommer.

## Tester og kvalitetsporter

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Vite dev-server med HMR |
| `npm run build` | Produksjonsbygg til `build/` |
| `npm run preview` | Server bygd `build/` lokalt for røyktest |
| `npm run check` | `svelte-kit sync && svelte-check` (TS + Svelte type-sjekk) |
| `npm run lint` | Prettier check + ESLint |
| `npm run format` | Prettier write |
| `npm run test:unit` | Vitest (begge prosjekter) |
| `npm run test:e2e` | Playwright mot `vite preview` |
| `npm run test` | unit (én gang) + e2e |

Produksjonsmål: alle disse skal kjøres i CI på hver PR. CI-workflow finnes ikke ennå.

## Designsystem

Statisk referanse ligger i [`stage/style-kit.html`](../../stage/style-kit.html) (utenfor denne katalogen). Plan er å porte tokens (farger, typografi, spacing, badges, status-pillere) inn i Tailwind v4 sin `@theme`-blokk i en delt `src/lib/styles/tokens.css`, og bygge Svelte-komponenter mot den. Storybook er ikke ønsket — en intern `/styleguide`-rute som rendrer komponentene mot reelle props brukes som dokumentasjon når komponentbiblioteket vokser.

## Konvensjoner

- **TypeScript strict** — `any` er en kodelukt, ikke en flukt. Bruk `unknown` + narrowing.
- **Runes** — bare `$state`/`$derived`/`$effect`/`$props`. Ingen `let x = …; $: …`-mønstre.
- **Komponentnavn** — PascalCase i `src/lib/`, kebab-case for ruter (SvelteKit-konvensjon).
- **Styling** — Tailwind først; komponent-scoped CSS bare når Tailwind ikke når.
- **Accessibility** — WCAG 2.2 AA er målet. Tab-rekkefølge, ARIA-roller, og kontrast må holde uten unntak. `eslint-plugin-svelte` håndhever det grunnleggende.
- **Norsk i UI, engelsk i kode** — alle brukervendte strenger via Paraglide-meldinger; identifikatorer og kommentarer på engelsk.

## Hva som *ikke* er på plass ennå

- API-klient-generering fra FastAPI OpenAPI
- `.env.example`
- CI-workflow (lint → check → vitest → playwright → build)
- CSP-strategi avtalt med backend
- Observability-hook (klient-logging, error-tracking)
- Porting av designsystemet til Tailwind-tokens og Svelte-komponenter
- Auth-flyt (peer-session/token-modell)

Disse er kjent og venter — adresser dem eksplisitt før første reelle PR mot main.

---

# Svelte MCP Tools

Du har tilgang til Svelte MCP-server med Svelte 5 og SvelteKit-dokumentasjon:

## 1. list-sections

Bruk denne FØRST for å oppdage tilgjengelige dokumentasjonsseksjoner. Returnerer titler, use_cases og paths.
Når brukeren spør om Svelte/SvelteKit, kjør denne tidlig i samtalen.

## 2. get-documentation

Henter full dokumentasjon for spesifikke seksjoner. Etter `list-sections`, analyser use_cases og hent ALLE relevante seksjoner.

## 3. svelte-autofixer

Analyserer Svelte-kode for issues. **MÅ** brukes på all Svelte-kode du skriver, gjentatt til ingen issues gjenstår.

## 4. playground-link

Genererer Svelte Playground-link. Bare etter brukerens samtykke, og **aldri** når koden er skrevet til filer i prosjektet.
