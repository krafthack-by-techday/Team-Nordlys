# @nordlys/style-kit

Design tokens and component library for Nordlys — the cybersecurity mesh dashboard for the Nordic energy sector. Built on Tailwind CSS v4. This is the **single source of truth** for all visual design — colours, typography, atmosphere effects, and reusable component classes. Consumed by `app/frontend/` (SvelteKit).

## Structure

```
style-kit/
├── src/
│   ├── tokens.css            Design tokens (CSS custom properties + Tailwind @theme binding)
│   ├── components.css        Core components (.badge, .tile, .url-pill, .atmosphere, …)
│   ├── components/
│   │   ├── badges.css        Severity, TLP, status, and generic aurora badge modifiers
│   │   ├── buttons.css       Button variants (.btn, .btn--ghost, .btn--danger, .btn--sm)
│   │   ├── cards.css         Card layout (.card, .card--compact, .card--accent-*)
│   │   ├── combobox.css      WAI-ARIA 1.2 combobox pattern
│   │   ├── dialog.css        Native <dialog> modal system
│   │   ├── feedback.css      Toast / alert feedback patterns
│   │   ├── forms.css         Form inputs, selects, textareas
│   │   ├── pagination.css    Pagination nav (.pagination, .pagination__btn)
│   │   ├── tables.css        Data tables with sort, density, zebra, sticky header
│   │   ├── tabs.css          Tab navigation
│   │   ├── tags.css          Tag pills
│   │   └── utilities.css     Glass surfaces, .mono-label, .sep-dot, .scroll-thin, keyframes
│   └── input.css             Tailwind entry point — imports all of the above
├── index.html                Standalone reference page
└── package.json              Tailwind CLI for build/watch
```

## Visual reference

Two ways to explore the design system visually:

1. **Histoire** (recommended) — run from `app/frontend/`:
   ```bash
   cd app/frontend && npm run story:dev
   ```
   Includes design token swatches, typography scale, glass surfaces, badge/button variants, and all Svelte components that use style-kit classes.

2. **Standalone reference page** — lightweight HTML preview:
   ```bash
   cd style-kit && npm run dev
   # → http://localhost:4180
   ```

---

## Running the reference page

```sh
cd style-kit
npm install
npm run dev       # Tailwind watch + local server at http://localhost:4180
npm run build     # One-off production build → dist/style-kit.css
```

## Consuming from app/frontend

Tailwind v4 picks up `@theme` blocks from all imports. The frontend uses a Vite alias:

```ts
// app/frontend/vite.config.ts
resolve: {
  alias: {
    '@nordlys/style-kit': fileURLToPath(new URL('../../style-kit/src', import.meta.url))
  }
}
```

Then in `app/frontend/src/routes/layout.css`:

```css
@import 'tailwindcss';
@import '@nordlys/style-kit/tokens.css';
@import '@nordlys/style-kit/components.css';
@import '@nordlys/style-kit/components/buttons.css';
@import '@nordlys/style-kit/components/badges.css';
/* ... etc */
```

---

## Component Reference

### Badges (`badges.css`)

Base class: `.badge` (defined in `components.css`) — frosted-glass pill with monospace text.

**Size modifiers:**
| Class | Use case |
|-------|----------|
| `.badge--xs` | Dense table cells, inline tags |
| `.badge--sm` | Compact rows, sidebar status |
| `.badge--md` | Default (no class needed) |
| `.badge--lg` | Hero KPI, header indicators |

**Severity modifiers:**
| Class | Colour |
|-------|--------|
| `.badge--severity-low` | Green — muted |
| `.badge--severity-medium` | Amber |
| `.badge--severity-high` | Orange-red |
| `.badge--severity-critical` | Full red, pulsing dot |

**TLP (Traffic Light Protocol):**
| Class | Meaning |
|-------|---------|
| `.badge--tlp-clear` | Unrestricted sharing |
| `.badge--tlp-green` | Community sharing |
| `.badge--tlp-amber` | Recipients + org only |
| `.badge--tlp-red` | Recipients only |

**Status modifiers:**
| Class | Icon |
|-------|------|
| `.badge--status-verified` | ✓ |
| `.badge--status-pending` | ⏳ |
| `.badge--status-revoked` | ✕ |
| `.badge--status-active` | Pulsing dot |

**Generic aurora:** `.badge--mint`, `.badge--arctic`, `.badge--lichen`

Sub-element: `.badge__dot` — animated status dot inside badges.

---

### Buttons (`buttons.css`)

| Class | Description |
|-------|-------------|
| `.btn` | Base button |
| `.btn--ghost` | Transparent background, border on hover |
| `.btn--danger` | Red accent |
| `.btn--sm` | Small size |

---

### Cards (`cards.css`)

| Class | Description |
|-------|-------------|
| `.card` | Base card with glass background |
| `.card__body` | Content area |
| `.card--compact` | Reduced padding |
| `.card--accent-mint` | Mint left border accent |
| `.card--accent-arctic` | Arctic left border accent |
| `.card--accent-lichen` | Lichen left border accent |

Layout helper: `.card-grid` — responsive CSS grid for summary cards.

---

### Tables (`tables.css`)

Full data table system with sorting, density, zebra striping, sticky headers, and cell variants.

| Class | Description |
|-------|-------------|
| `.table-wrapper` | Scrollable container |
| `.table` | Base table |
| `.table--dense` | Compact padding |
| `.table--zebra` | Alternating row tints |
| `.table--sticky-header` | Fixed header on scroll |

**Sortable headers** use `aria-sort` attribute (`none` / `ascending` / `descending`) — indicators rendered via `::after` pseudo-elements automatically.

**Cell variants:**
| Class | Description |
|-------|-------------|
| `.table__cell--num` | Right-aligned, tabular figures |
| `.table__cell--mono` | Monospace font |
| `.table__cell--actions` | Right-aligned action buttons |
| `.table__cell--truncate` | Ellipsis overflow (max 30ch) |
| `.table__cell--status` | Narrow badge/pill column |
| `.table__empty` | Empty state message row |

**Selection:** `tr[aria-selected="true"]` — mint left accent + tint.

---

### DataTable (Svelte component)

`$lib/components/DataTable.svelte` — generic reusable table that wraps the style-kit table classes.

**Features:**
- Column definitions with `Column<T>` interface (from `datatable.types.ts`)
- Built-in text search (default field search or custom `searchFn`)
- Sortable columns with `aria-sort` indicators
- Pagination with configurable page size
- Rows-per-page selector via `pageSizeOptions` prop
- Snippet-based cell rendering for full control
- Row click handler with keyboard a11y
- Toolbar slot for extra controls

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | required | Full data array |
| `columns` | `Column<T>[]` | required | Column definitions |
| `cell` | `Snippet<[T, Column<T>]>` | — | Custom cell renderer |
| `onrowclick` | `(row: T) => void` | — | Row click handler |
| `pageSize` | `number` | `25` | Items per page (0 = no pagination) |
| `pageSizeOptions` | `number[]` | — | Show page size dropdown (e.g. `[10, 25, 50, 100]`) |
| `searchable` | `boolean` | `true` | Show search input |
| `searchPlaceholder` | `string` | — | Placeholder text |
| `searchFn` | `(row: T, q: string) => boolean` | — | Custom search function |
| `dense` | `boolean` | `false` | Dense mode |
| `zebra` | `boolean` | `true` | Zebra striping |
| `stickyHeader` | `boolean` | `true` | Sticky header |
| `emptyMessage` | `string` | — | Empty state text |
| `toolbar` | `Snippet` | — | Extra toolbar content |
| `defaultSortKey` | `string` | — | Initial sort column |
| `defaultSortDir` | `'ascending' \| 'descending'` | `'descending'` | Initial sort direction |

**Usage:**
```svelte
<DataTable
  data={vulnerabilities}
  columns={columns}
  pageSize={25}
  pageSizeOptions={[10, 25, 50, 100]}
  searchFn={mySearchFn}
  defaultSortKey="cvss_score"
  onrowclick={(row) => openDetail(row)}
  dense
>
  {#snippet cell(row, col)}
    {#if col.key === 'severity'}
      <span class={severityBadge(row.severity)}>{row.severity}</span>
    {:else}
      {row[col.key]}
    {/if}
  {/snippet}
</DataTable>
```

---

### Dialog (`dialog.css`)

Native `<dialog>` modal system using `.showModal()`.

| Class | Description |
|-------|-------------|
| `.dialog` | Outer wrapper on `<dialog>` element |
| `.dialog--narrow` | 400px max-width |
| `.dialog--wide` | 720px max-width |
| `.dialog--xl` | 1200px max-width |
| `.dialog--danger` | Red accent top-line |
| `.dialog__form` | Visual surface (frosted glass, rounded corners) |
| `.dialog__header` | Title + optional close button |
| `.dialog__title` | `<h2>` title |
| `.dialog__subtitle` | Mono uppercase subtitle |
| `.dialog__close` | Close button (styles internal SVG at 1rem) |
| `.dialog__body` | Scrollable content area |
| `.dialog__footer` | Action buttons |

---

### Pagination (`pagination.css`)

| Class | Description |
|-------|-------------|
| `.pagination` | Container |
| `.pagination__list` | Button list |
| `.pagination__btn` | Page button |
| `.pagination__btn--nav` | Prev/Next navigation |
| `.pagination__ellipsis` | Ellipsis indicator |
| `.pagination__summary` | "Page X of Y" text |
| `.pagination--compact` | Compact variant |
| `.pagination--simple` | Simple prev/next only |

---

### Utilities (`utilities.css`)

| Class | Description |
|-------|-------------|
| `.glass` | Frosted glass surface (bg + backdrop-filter + border) |
| `.glass--tooltip` | Denser glass for tooltips |
| `.glass--drawer` | Side drawer glass |
| `.glass--controls` | Control bar glass |
| `.mono-label` | Uppercase mono dim text (0.7rem) |
| `.mono-label--sm` | Smaller variant (0.65rem) |
| `.mono-label--xs` | Smallest variant (0.58rem) |
| `.sep-dot::before` | Inline dot separator (·) |
| `.scroll-thin` | Thin scrollbar styling |

**Keyframes:** `ds-pulse-ring`, `ds-slide-in-up`, `ds-fade-in`

---

### Combobox (`combobox.css`)

WAI-ARIA 1.2 compliant combobox pattern.

| Class | Description |
|-------|-------------|
| `.combobox` | Container |
| `.combobox__control` | Input wrapper |
| `.combobox__input` | Text input |
| `.combobox__clear` | Clear button |
| `.combobox__trigger` | Dropdown toggle |
| `.combobox__listbox` | Options panel |
| `.combobox__option` | Individual option |
| `.combobox__group` | Option group header |
| `.combobox__empty` | No results state |

---

## Token utilities (from `@theme`)

| Class pattern | Use |
|---|---|
| `bg-bg`, `bg-bg-raised` | Body background, raised surfaces |
| `text-fg`, `text-fg-dim` | Primary / secondary text |
| `text-success`, `text-warning`, `text-danger` | Semantic text colours |
| `text-aurora-mint`, `text-aurora-arctic`, `text-aurora-lichen` | Accent text |
| `border-line`, `border-line-hi` | Subtle / contrast borders |
| `font-display`, `font-mono` | Bricolage Grotesque / JetBrains Mono |
| `text-display`, `text-h1`, `text-h2`, `text-body-lg`, `text-body`, `text-mono`, `text-mono-sm` | Fluid type scale |

---

## Theme switching

Default theme is dark. Switch via `data-theme="light"` on `<html>`:

```html
<html data-theme="light">
```

All token-based utilities and component classes respond automatically — no rebuild needed.

---

## Design principles

1. **Single source of truth** — all colours and type scales live here, never in app code. New colour → add to `tokens.css` → available everywhere.
2. **Tailwind utilities for one-off layout, component classes for repetition** — reach for `.badge`, `.card`, etc. only when the pattern repeats.
3. **Tokens over raw values** — always use `var(--color-aurora-mint)` or utility classes, never `#7fdcb5`.
4. **`prefers-reduced-motion`** — all animations respect the user's motion preference.
5. **Accessibility** — WCAG 2.2 AA contrast, forced-colors support, aria attributes for interactive patterns.

---

## Status

- ✅ Design tokens (dark + light themes)
- ✅ Core components (badge, tile, atmosphere, cards, buttons)
- ✅ Severity badges (low/medium/high/critical with glow + pulse)
- ✅ TLP badges (clear/green/amber/red)
- ✅ Status badges (verified/pending/revoked/active)
- ✅ Data tables (sort, density, zebra, sticky header, cell variants, selection)
- ✅ Dialog/modal system (native `<dialog>`, 4 width variants)
- ✅ Pagination
- ✅ Combobox (WAI-ARIA 1.2)
- ✅ Forms & inputs
- ✅ Utilities (glass, mono-label, sep-dot, scroll-thin)
- ✅ Consumed by `app/frontend/` via Vite alias
- ✅ Light theme overrides for all components
- ✅ Forced-colors / high-contrast mode support
