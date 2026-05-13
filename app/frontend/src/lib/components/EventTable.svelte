<script lang="ts">
	import type { SignedEvent } from '$lib/api/types';
	import { fmtDateTimeShort } from '$lib/utils/format';
	import { sevRank } from '$lib/utils/severity';
	import SeverityBadge from './SeverityBadge.svelte';
	import DataTable from './DataTable.svelte';
	import type { Column } from './datatable.types';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		events: SignedEvent[];
		pageSize?: number;
	}

	let { events, pageSize = 25 }: Props = $props();

	const columns: Column<SignedEvent>[] = [
		{ key: 'created_at', label: m.table_col_time(), sortable: true, cellClass: 'table__cell--mono', searchable: false },
		{ key: 'severity', label: m.table_col_severity(), sortable: true, sortFn: (a, b) => sevRank(a.severity ?? 'info') - sevRank(b.severity ?? 'info'), searchable: false },
		{ key: 'source', label: m.table_col_source(), sortable: true },
		{ key: 'title', label: m.table_col_event(), sortable: true, cellClass: 'table__cell--truncate' },
		{ key: 'company', label: m.table_col_company(), sortable: true }
	];
</script>

<DataTable
	data={events}
	{columns}
	{pageSize}
	pageSizeOptions={[10, 25, 50, 100]}
	searchPlaceholder={m.table_search_placeholder()}
	emptyMessage={m.table_no_events()}
	defaultSortKey="created_at"
	defaultSortDir="descending"
	dense
>
	{#snippet cell(row, col)}
		{#if col.key === 'created_at'}
			{fmtDateTimeShort(row.created_at)}
		{:else if col.key === 'severity'}
			<SeverityBadge severity={row.severity ?? 'info'} />
		{:else if col.key === 'title'}
			{row.title}
		{:else if col.key === 'source'}
			{row.source}
		{:else if col.key === 'company'}
			{row.company}
		{:else}
			{(row as Record<string, unknown>)[col.key] ?? '—'}
		{/if}
	{/snippet}
</DataTable>
