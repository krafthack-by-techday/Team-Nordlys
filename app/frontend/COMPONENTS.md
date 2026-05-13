# Components

All shared components in `src/lib/components/`. Each component uses Svelte 5 runes (`$props`, `$state`, `$derived`). Style-kit CSS classes are noted where applicable.

---

## Layout & Shell

### `Aurora`

Atmospheric background effect — animated gradient blobs with grain overlay. No props. Renders behind all content in the root layout.

**Style-kit:** Uses custom keyframes and absolute positioning. No specific class.

---

### `DashboardHeader`

Top-level header with logo, navigation, demo mode ribbon, connection status, and theme toggle.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stats` | `Stats \| null` | required | Node stats (for node name display) |
| `online` | `boolean` | required | Whether SSE is connected |

---

### `MeshNav`

Sidebar/bottom navigation between main routes. No props — reads current route from SvelteKit's `$page`.

---

### Page titles — there is no `PageHeader`

Pages do **not** render their own `<h1>` or any "page header" component. The
breadcrumb in `+layout.svelte` (driven by `getRouteLabel()` in
`shell-context.ts`) is the page title for the entire app. If you need to
identify which page you're on, look at — or update — the breadcrumb.

The `<title>` HTML tag (via `<svelte:head>`) handles the browser-tab title
separately and may include sub-state (e.g. `"Generelt — Innstillinger — Nordlys"`).

For sub-page navigation within a single route (like the Settings tabs),
use `SegmentedControl` and sync the active tab to the URL hash. Do not
reintroduce a per-page header component.

---

### `SectionLabel`

Mono-styled uppercase section divider.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Section text |

**Style-kit:** `.mono-label`

---

### `ThemeToggle`

Dark/light theme switch. No props — toggles `data-theme` on `<html>`.

---

## Data Display

### `KpiCard`

Summary metric card with label, value, and accent colour.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Metric name |
| `value` | `number \| string` | required | Metric value |
| `href` | `string` | required | Link target on click |
| `accent` | `'mint' \| 'arctic' \| 'lichen'` | — | Left border accent |
| `children` | `Snippet` | — | Optional extra content |

**Style-kit:** `.card`, `.card--accent-mint` / `arctic` / `lichen`

---

### `CounterStrip`

Horizontal strip of summary counters from the Stats object.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stats` | `Stats \| null` | required | Dashboard counters |

---

### `DataTable<T>`

Generic data table with search, sort, pagination, and custom cell rendering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | required | Full dataset |
| `columns` | `Column<T>[]` | required | Column definitions |
| `cell` | `Snippet<[T, Column<T>]>` | — | Custom cell renderer |
| `onrowclick` | `(row: T) => void` | — | Row click handler |
| `pageSize` | `number` | `25` | Items per page (0 = no pagination) |
| `pageSizeOptions` | `number[]` | — | Page size dropdown options |
| `searchable` | `boolean` | `true` | Show search input |
| `searchPlaceholder` | `string` | — | Search placeholder text |
| `searchFn` | `(row: T, q: string) => boolean` | — | Custom filter function |
| `dense` | `boolean` | `false` | Compact row padding |
| `zebra` | `boolean` | `true` | Alternating row tints |
| `stickyHeader` | `boolean` | `true` | Fixed header on scroll |
| `emptyMessage` | `string` | — | Empty state message |
| `toolbar` | `Snippet` | — | Extra toolbar content |
| `defaultSortKey` | `string` | — | Initial sort column key |
| `defaultSortDir` | `'ascending' \| 'descending'` | `'descending'` | Initial sort direction |

**Column<T> interface** (`datatable.types.ts`):

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Data field key |
| `label` | `string` | Column header text |
| `sortable` | `boolean` | Enable sorting |
| `sortFn` | `(a: T, b: T) => number` | Custom sort comparator |
| `headerClass` | `string` | Extra header cell class |
| `cellClass` | `string` | Extra body cell class |
| `searchable` | `boolean` | Include in default text search |

**Style-kit:** `.table-wrapper`, `.table`, `.table--dense`, `.table--zebra`, `.table--sticky-header`, cell variants

---

### `DetailField`

Label-value pair for detail views.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Field label |
| `value` | `string` | required | Field value |
| `mono` | `boolean` | `false` | Monospace value rendering |

**Style-kit:** `.mono-label` for label

---

### `InfoTip`

Tooltip-style info icon with glass popover.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | required | Tooltip content |

**Style-kit:** `.glass--tooltip`

---

### `Pagination`

Table pagination controls with page numbers and prev/next.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `total` | `number` | required | Total item count |
| `pageSize` | `number` | required | Items per page |
| `page` | `number` | required | Current page (1-indexed) |
| `onchange` | `(page: number) => void` | required | Page change callback |

**Style-kit:** `.pagination`, `.pagination__btn`, `.pagination__ellipsis`

---

### `EmptyState`

Placeholder shown when a list has no items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | — | Custom empty message |

---

### `SegmentedControl<T extends string>`

Toggle between 2-4 options (tab-like control).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `{ value: T; label: string }[]` | required | Available options |
| `value` | `T` | required | Currently selected value |
| `onchange` | `(value: T) => void` | required | Selection callback |
| `size` | `'sm' \| 'xs'` | — | Compact size variant |

---

## Events

### `EventFeed`

Self-contained event feed that reads from `liveStore`. Supports compact/detail variants.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `detail` | `'compact' \| 'detail'` | — | Display density |
| `headless` | `boolean` | — | Hide header section |
| `pageSize` | `number` | — | Items to show |

---

### `EventRow`

Single event row with severity badge, title, timestamp, and relay path.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `event` | `SignedEvent` | required | Event data |
| `variant` | `'compact' \| 'detail'` | — | Display mode |

**Style-kit:** `.badge--severity-*`

---

### `EventTable`

Full event table with sorting and pagination (wraps `DataTable`).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` | `SignedEvent[]` | required | Event data |
| `pageSize` | `number` | — | Override default page size |

---

### `EventTimeline`

Compact vertical timeline of recent events (dashboard widget).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` | `SignedEvent[]` | required | Events to display |

---

## Mesh & Topology

### `TopologyGraph`

Canvas-based interactive mesh topology visualization with animated packet relay paths.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `peers` | `PeerWithStatus[]` | required | All known peers |
| `selfNodeId` | `string` | — | This node's ID (highlighted) |
| `selectedId` | `string \| null` | — | Currently selected peer |
| `onselect` | `(nodeId: string) => void` | — | Peer selection callback |

---

### `PeerCard`

Compact peer status card for lists.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `peer` | `PeerWithStatus` | required | Peer data |
| `selfNodeId` | `string` | — | This node's ID |
| `selected` | `boolean` | — | Highlight as selected |
| `onclick` | `() => void` | — | Click handler |

**Style-kit:** `.card`, `.card--compact`

---

### `PeerDetail`

Full peer detail panel (slide-out or modal).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `peer` | `PeerWithStatus \| null` | required | Peer to display |
| `selfNodeId` | `string` | — | This node's ID |
| `onclose` | `() => void` | required | Close handler |

---

### `StatusDot`

Coloured status indicator dot (online/offline/revoked).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'online' \| 'offline' \| 'revoked'` | — | Dot colour |
| `size` | `number` | — | Diameter in px |
| `pulse` | `boolean` | — | Animate pulse |

**Style-kit:** `.badge__dot` pattern

---

## Vulnerabilities

### `SeverityBadge`

Renders a severity level as a styled badge pill.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `severity` | `string` | required | `'low' \| 'medium' \| 'high' \| 'critical'` |

**Style-kit:** `.badge`, `.badge--severity-low`, `.badge--severity-medium`, `.badge--severity-high`, `.badge--severity-critical`

---

### `VulnDetailModal`

Native `<dialog>` modal showing full vulnerability details with changelog timeline.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `vuln` | `Vulnerability \| null` | required | Vulnerability to show (null = closed) |
| `onclose` | `() => void` | required | Close handler |

**Style-kit:** `.dialog`, `.dialog--wide`, `.dialog__form`, `.dialog__header`, `.dialog__body`, `.dialog__footer`

---

## Generic UI

### `Dialog`

Generic reusable dialog wrapping native `<dialog>`. Handles open/close reactivity, backdrop click dismiss, ESC key, and focus management.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | required | Controls visibility (opens via `showModal()`) |
| `onclose` | `() => void` | required | Called when dialog is closed |
| `width` | `'narrow' \| 'default' \| 'wide' \| 'xl'` | `'default'` | Width variant |
| `danger` | `boolean` | `false` | Red accent top border |
| `title` | `string` | — | Dialog title (h2) |
| `subtitle` | `string` | — | Mono uppercase subtitle |
| `children` | `Snippet` | required | Body content |
| `footer` | `Snippet` | — | Footer slot (action buttons) |

**Style-kit:** `.dialog`, `.dialog--narrow`, `.dialog--wide`, `.dialog--xl`, `.dialog--danger`, `.dialog__form`, `.dialog__header`, `.dialog__body`, `.dialog__footer`

---

### `Toast`

Toast notification system. Renders a stack of dismissible toasts with auto-dismiss.

**No props** — place `<Toast />` once in `+layout.svelte`. Control via exported `toast` object:

```ts
import { toast } from '$lib/components/Toast.svelte';

toast.success('Event submitted');
toast.error('Connection lost');
toast.warning('API key expires in 24h');
toast.info('New peer joined the mesh');
```

| Method | Signature | Default duration |
|--------|-----------|-----------------|
| `toast.success` | `(msg: string, duration?: number) => void` | 4000ms |
| `toast.error` | `(msg: string, duration?: number) => void` | 6000ms |
| `toast.warning` | `(msg: string, duration?: number) => void` | 4000ms |
| `toast.info` | `(msg: string, duration?: number) => void` | 4000ms |
| `toast.dismiss` | `(id: number) => void` | — |

---

### `TlpBadge`

Traffic Light Protocol badge. Renders a styled TLP classification pill.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tlp` | `'RED' \| 'AMBER' \| 'GREEN' \| 'CLEAR' \| 'WHITE'` | required | TLP level |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | — | Size variant |

**Style-kit:** `.badge`, `.badge--tlp-red`, `.badge--tlp-amber`, `.badge--tlp-green`, `.badge--tlp-clear`

---

### `CopyButton`

One-click copy to clipboard with visual feedback. For inline use next to hashes, IPs, CVE IDs.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | Text to copy |
| `label` | `string` | `'Copy to clipboard'` | Accessible aria-label |
| `size` | `'sm' \| 'md'` | `'sm'` | Button size |

Shows a checkmark icon for 2 seconds after successful copy.

---

### `Skeleton`

Loading placeholder with animated pulse. Use while waiting for SSE data or API responses.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lines` | `number` | `1` | Number of text lines (for 'line' variant) |
| `variant` | `'line' \| 'card' \| 'circle'` | `'line'` | Shape variant |
| `width` | `string` | `'100%'` | CSS width |
| `height` | `string` | — | CSS height (card: `120px`, circle: `2.5rem`) |

Last line in a multi-line skeleton is automatically 70% width for a natural paragraph look.
