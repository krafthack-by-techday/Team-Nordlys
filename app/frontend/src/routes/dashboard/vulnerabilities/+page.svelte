<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { liveStore } from '$lib/stores/live.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import VulnDetailModal from '$lib/components/VulnDetailModal.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import type { Column } from '$lib/components/datatable.types';
	import { severityBadge, statusBadge, statusLabel } from '$lib/utils/vuln';
	import { timeAgo } from '$lib/utils/time';
	import type { Vulnerability } from '$lib/api/types';

	type StatusFilter = 'all' | Vulnerability['status'];

	let filter = $state<StatusFilter>('all');
	let selectedVuln = $state<Vulnerability | null>(null);

	let tableData = $derived(
		filter === 'all'
			? liveStore.vulnerabilities
			: liveStore.vulnerabilities.filter((v) => v.status === filter)
	);

	let columns = $derived<Column<Vulnerability>[]>([
		{ key: 'cvss_score', label: m.vuln_col_cvss(), sortable: true, cellClass: 'table__cell--num', headerClass: 'table__cell--num', searchable: false },
		{ key: 'title', label: m.vuln_col_title(), sortable: true },
		{ key: 'cve_id', label: m.vuln_col_cve(), sortable: true, cellClass: 'table__cell--mono' },
		{ key: 'severity', label: m.vuln_col_severity(), sortable: true, searchable: false },
		{ key: 'asset', label: m.vuln_col_asset(), sortable: true },
		{ key: 'status', label: m.vuln_col_status(), sortable: true, searchable: false },
		{ key: 'created_at', label: m.vuln_col_discovered(), sortable: true, searchable: false }
	]);

	function searchVuln(row: Vulnerability, q: string): boolean {
		return (
			row.title.toLowerCase().includes(q) ||
			(row.cve_id?.toLowerCase().includes(q) ?? false) ||
			(row.advisory_id?.toLowerCase().includes(q) ?? false) ||
			(row.asset?.toLowerCase().includes(q) ?? false) ||
			(row.description?.toLowerCase().includes(q) ?? false)
		);
	}

	const filters: { value: StatusFilter; label: () => string; tip: () => string }[] = [
		{ value: 'all', label: () => m.vuln_filter_all(), tip: () => '' },
		{ value: 'new', label: () => m.vuln_status_new(), tip: () => m.vuln_tip_status_new() },
		{ value: 'acknowledged', label: () => m.vuln_status_acknowledged(), tip: () => m.vuln_tip_status_acknowledged() },
		{ value: 'in_progress', label: () => m.vuln_status_in_progress(), tip: () => m.vuln_tip_status_in_progress() },
		{ value: 'mitigated', label: () => m.vuln_status_mitigated(), tip: () => m.vuln_tip_status_mitigated() },
		{ value: 'exploited', label: () => m.vuln_status_exploited(), tip: () => m.vuln_tip_status_exploited() },
		{ value: 'not_applicable', label: () => m.vuln_status_not_applicable(), tip: () => m.vuln_tip_status_not_applicable() }
	];
</script>

<svelte:head>
	<title>{m.vuln_page_title()}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<!-- Summary cards -->
	<div class="card-grid">
		<article class="card card--compact card--accent-arctic">
			<div class="card__body">
				<span class="block font-mono text-[2rem] font-bold text-danger">
					{liveStore.vulnerabilities.filter((v) => v.severity === 'critical').length}
				</span>
				<span class="font-mono text-mono-sm tracking-widest uppercase text-fg-dim">{m.vuln_severity_critical()}<InfoTip text={m.vuln_tip_critical()} /></span>
			</div>
		</article>
		<article class="card card--compact card--accent-lichen">
			<div class="card__body">
				<span class="block font-mono text-[2rem] font-bold text-warning">
					{liveStore.vulnerabilities.filter((v) => v.severity === 'high').length}
				</span>
				<span class="font-mono text-mono-sm tracking-widest uppercase text-fg-dim">{m.vuln_severity_high()}<InfoTip text={m.vuln_tip_high()} /></span>
			</div>
		</article>
		<article class="card card--compact card--accent-mint">
			<div class="card__body">
				<span class="block font-mono text-[2rem] font-bold text-fg">
					{liveStore.vulnerabilities.filter((v) => v.status === 'new' || v.status === 'acknowledged' || v.status === 'in_progress').length}
				</span>
				<span class="font-mono text-mono-sm tracking-widest uppercase text-fg-dim">{m.vuln_unresolved()}<InfoTip text={m.vuln_tip_unresolved()} /></span>
			</div>
		</article>
	</div>

	<!-- Filter tabs (status) -->
	<nav class="filter-tabs">
		{#each filters as f}
			<button
				class="filter-tab"
				class:active={filter === f.value}
				onclick={() => (filter = f.value)}
			>
				{f.label()}
				{#if f.value !== 'all'}
					<span class="filter-count">{liveStore.vulnerabilities.filter(v => v.status === f.value).length}</span>
				{/if}
				{#if f.tip()}<InfoTip text={f.tip()} />{/if}
			</button>
		{/each}
	</nav>

	<!-- Data table -->
	<section class="glass table-section">
		<DataTable
			data={tableData}
			{columns}
			searchFn={searchVuln}
			searchPlaceholder={m.vuln_search_placeholder()}
			defaultSortKey="cvss_score"
			defaultSortDir="descending"
			onrowclick={(row) => (selectedVuln = row)}
			pageSizeOptions={[10, 25, 50, 100]}
			dense
		>
			{#snippet cell(row, col)}
				{#if col.key === 'cvss_score'}
					<span class={severityBadge(row.severity)}>{row.cvss_score.toFixed(1)}</span>
				{:else if col.key === 'severity'}
					<span class={severityBadge(row.severity)}>{row.severity.toUpperCase()}</span>
				{:else if col.key === 'status'}
					<span class={statusBadge(row.status)}>{statusLabel(row.status)}</span>
				{:else if col.key === 'cve_id'}
					<code>{row.cve_id || '—'}</code>
				{:else if col.key === 'created_at'}
					{timeAgo(row.created_at, true)}
				{:else if col.key === 'title'}
					<span class="advisory-title">{row.title}</span>
					{#if row.tlp}
						<span class="badge badge--xs badge--tlp-{row.tlp.toLowerCase()}">TLP:{row.tlp}</span>
					{/if}
				{:else if col.key === 'asset'}
					{row.asset ?? '—'}
				{:else}
					{(row as Record<string, unknown>)[col.key] ?? '—'}
				{/if}
			{/snippet}
		</DataTable>
	</section>
</div>

<VulnDetailModal vuln={selectedVuln} onclose={() => (selectedVuln = null)} />

<style>
	.filter-tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.filter-tab {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.4rem 1rem;
		border-radius: 4px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-fg-dim);
		cursor: pointer;
		transition: all 0.15s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.filter-tab:hover {
		border-color: var(--color-fg-dim);
		color: var(--color-fg);
	}
	.filter-tab.active {
		background: rgb(from var(--color-aurora-mint) r g b / 0.12);
		border-color: var(--color-aurora-mint);
		color: var(--color-aurora-mint);
	}
	.filter-count {
		font-size: 0.62rem;
		background: rgb(from var(--color-fg) r g b / 0.1);
		padding: 1px 6px;
		border-radius: 3px;
	}
	.table-section {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		max-height: calc(100vh - 380px);
	}
	.advisory-title {
		font-weight: 500;
		color: var(--color-fg);
	}
</style>
