<script lang="ts" generics="T">
	import { m } from '$lib/paraglide/messages.js';
	import Pagination from './Pagination.svelte';
	import type { Snippet } from 'svelte';

	import type { Column } from './datatable.types';

	interface Props {
		/** The full data array */
		data: T[];
		/** Column definitions */
		columns: Column<T>[];
		/** Optional custom cell renderer — receives (row, column) */
		cell?: Snippet<[T, Column<T>]>;
		/** Optional row click handler */
		onrowclick?: (row: T) => void;
		/** Page size (0 = no pagination) */
		pageSize?: number;
		/** Available page size options (shows a dropdown if provided) */
		pageSizeOptions?: number[];
		/** Enable search input */
		searchable?: boolean;
		/** Search placeholder text */
		searchPlaceholder?: string;
		/** Custom search function — overrides default field search */
		searchFn?: (row: T, query: string) => boolean;
		/** Table style modifiers */
		dense?: boolean;
		zebra?: boolean;
		stickyHeader?: boolean;
		/** Empty state message */
		emptyMessage?: string;
		/** Optional slot for toolbar extras (filters, etc.) rendered between search and table */
		toolbar?: Snippet;
		/** Default sort column key */
		defaultSortKey?: string;
		/** Default sort direction */
		defaultSortDir?: 'ascending' | 'descending';
	}

	let {
		data,
		columns,
		cell,
		onrowclick,
		pageSize: initialPageSize = 25,
		pageSizeOptions,
		searchable = true,
		searchPlaceholder,
		searchFn,
		dense = false,
		zebra = true,
		stickyHeader = true,
		emptyMessage,
		toolbar,
		defaultSortKey,
		defaultSortDir = 'descending'
	}: Props = $props();

	// ── Internal state ──
	let query = $state('');
	let page = $state(0);
	let currentPageSize = $state(initialPageSize);
	let sortKey = $state<string | null>(defaultSortKey ?? null);
	let sortDir = $state<'ascending' | 'descending'>(defaultSortDir);

	// Reset page when query changes
	$effect(() => {
		query;
		page = 0;
	});

	// ── Filtering ──
	let filtered = $derived(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data;
		if (searchFn) return data.filter((row) => searchFn(row, q));
		// Default: search all searchable columns
		const searchCols = columns.filter((c) => c.searchable !== false);
		return data.filter((row) =>
			searchCols.some((col) => {
				const val = (row as Record<string, unknown>)[col.key];
				if (val == null) return false;
				return String(val).toLowerCase().includes(q);
			})
		);
	});

	// ── Sorting ──
	let sorted = $derived(() => {
		const items = filtered();
		if (!sortKey) return items;
		const col = columns.find((c) => c.key === sortKey);
		if (!col) return items;

		const dir = sortDir === 'ascending' ? 1 : -1;
		return [...items].sort((a, b) => {
			if (col.sortFn) return col.sortFn(a, b) * dir;
			const va = (a as Record<string, unknown>)[col.key];
			const vb = (b as Record<string, unknown>)[col.key];
			if (va == null && vb == null) return 0;
			if (va == null) return 1;
			if (vb == null) return -1;
			if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
			return String(va).localeCompare(String(vb)) * dir;
		});
	});

	// ── Pagination ──
	let paged = $derived(() => {
		const all = sorted();
		if (currentPageSize <= 0) return all;
		return all.slice(page * currentPageSize, (page + 1) * currentPageSize);
	});

	let totalFiltered = $derived(sorted().length);

	// ── Sort handler ──
	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 'ascending' ? 'descending' : 'ascending';
		} else {
			sortKey = key;
			sortDir = 'descending';
		}
		page = 0;
	}

	function getSortAttr(col: Column<T>): 'none' | 'ascending' | 'descending' | undefined {
		if (!col.sortable) return undefined;
		if (col.key !== sortKey) return 'none';
		return sortDir;
	}

	function defaultCellValue(row: T, col: Column<T>): string {
		const val = (row as Record<string, unknown>)[col.key];
		if (val == null) return '—';
		return String(val);
	}
</script>

<div class="datatable">
	{#if searchable || toolbar || pageSizeOptions}
		<div class="datatable__toolbar">
			{#if searchable}
				<input
					type="search"
					class="datatable__search"
					placeholder={searchPlaceholder ?? m.vuln_search_placeholder()}
					bind:value={query}
				/>
				<span class="datatable__count">
					{totalFiltered} / {data.length}
				</span>
			{/if}
			{#if pageSizeOptions}
				<select
					class="datatable__pagesize"
					bind:value={currentPageSize}
					onchange={() => (page = 0)}
				>
					{#each pageSizeOptions as size}
						<option value={size}>{m.table_page_size_option({ size: String(size) })}</option>
					{/each}
				</select>
			{/if}
			{#if toolbar}
				{@render toolbar()}
			{/if}
		</div>
	{/if}

	<div class="table-wrapper scroll-thin">
		<table
			class="table"
			class:table--dense={dense}
			class:table--zebra={zebra}
			class:table--sticky-header={stickyHeader}
		>
			<thead>
				<tr>
					{#each columns as col}
						<th
							class={col.headerClass ?? ''}
							aria-sort={getSortAttr(col)}
							onclick={col.sortable ? () => toggleSort(col.key) : undefined}
							tabindex={col.sortable ? 0 : undefined}
							onkeydown={col.sortable ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col.key); } } : undefined}
						>
							{col.label}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if paged().length === 0}
					<tr>
						<td class="table__empty" colspan={columns.length}>
							{emptyMessage ?? m.vuln_empty()}
						</td>
					</tr>
				{:else}
					{#each paged() as row}
						<tr
							role={onrowclick ? 'button' : undefined}
							tabindex={onrowclick ? 0 : undefined}
							onclick={onrowclick ? () => onrowclick(row) : undefined}
							onkeydown={onrowclick ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onrowclick!(row); } } : undefined}
						>
							{#each columns as col}
								<td class={col.cellClass ?? ''}>
									{#if cell}
										{@render cell(row, col)}
									{:else}
										{defaultCellValue(row, col)}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if currentPageSize > 0 && totalFiltered > currentPageSize}
		<Pagination total={totalFiltered} pageSize={currentPageSize} {page} onchange={(p) => (page = p)} />
	{/if}
</div>

<style>
	.datatable {
		display: flex;
		flex-direction: column;
		gap: 0;
		overflow: hidden;
	}
	.datatable__toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--color-line);
		background: rgb(from var(--color-bg-raised) r g b / 0.3);
	}
	.datatable__search {
		flex: 1;
		min-width: 180px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--color-line);
		border-radius: 4px;
		background: rgb(from var(--color-bg) r g b / 0.5);
		color: var(--color-fg);
		outline: none;
		transition: border-color 0.15s;
	}
	.datatable__search::placeholder {
		color: var(--color-fg-dim);
		opacity: 0.6;
	}
	.datatable__search:focus {
		border-color: var(--color-aurora-mint);
	}
	.datatable__count {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--color-fg-dim);
		letter-spacing: 0.06em;
		white-space: nowrap;
	}
	.datatable__pagesize {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--color-line);
		border-radius: 4px;
		background: rgb(from var(--color-bg) r g b / 0.5);
		color: var(--color-fg);
		cursor: pointer;
		outline: none;
		transition: border-color 0.15s;
	}
	.datatable__pagesize:focus {
		border-color: var(--color-aurora-mint);
	}
</style>
