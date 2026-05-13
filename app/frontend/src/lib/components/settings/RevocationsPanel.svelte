<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import type { Column } from '$lib/components/datatable.types';
	import { timeAgo } from '$lib/utils/time';
	import { m } from '$lib/paraglide/messages.js';
	import type { Revocation } from '$lib/api/types';

	let isHub = $derived(page.data.stats?.role === 'kraftcert');

	let revocations = $state<Revocation[]>([]);
	let error = $state('');

	async function load() {
		try {
			const resp = await fetch('/api/v1/revocations');
			revocations = resp.ok ? await resp.json() : [];
		} catch {
			error = m.revocations_error_load();
		}
	}

	let columns = $derived<Column<Revocation>[]>([
		{ key: 'company', label: m.peers_col_company(), sortable: true },
		{ key: 'node_id', label: m.peers_col_node_id(), sortable: true, cellClass: 'table__cell--mono' },
		{ key: 'reason', label: m.revocations_col_reason(), sortable: true },
		{ key: 'revoked_at', label: m.revocations_col_revoked_at(), sortable: true, searchable: false },
		{ key: 'signed_by', label: m.revocations_col_signed_by(), sortable: true, cellClass: 'table__cell--mono' }
	]);

	onMount(() => {
		if (isHub) load();
	});
</script>

<section class="revocations">
	{#if !isHub}
		<p class="field__hint">{m.peers_only_kraftcert()}</p>
	{:else}
		<div class="card-grid">
			<KpiCard label={m.revocations_kpi()} value={revocations.length} accent="mint" />
		</div>

		<SectionLabel label={m.revocations_section()} />
		<p class="revocations__desc">{m.revocations_desc()}</p>

		{#if error}
			<p class="field__error">{error}</p>
		{/if}

		<section class="glass revocations__table-section">
			<DataTable
				data={revocations}
				{columns}
				defaultSortKey="revoked_at"
				defaultSortDir="descending"
				searchPlaceholder={m.revocations_search()}
				pageSize={0}
				emptyMessage={m.revocations_empty()}
				dense
			>
				{#snippet cell(row, col)}
					{#if col.key === 'reason'}
						{row.reason || '—'}
					{:else if col.key === 'revoked_at'}
						{timeAgo(row.revoked_at)}
					{:else if col.key === 'company'}
						{row.company}
					{:else if col.key === 'node_id'}
						{row.node_id}
					{:else if col.key === 'signed_by'}
						{row.signed_by}
					{/if}
				{/snippet}
			</DataTable>
		</section>
	{/if}
</section>

<style>
	.revocations {
		gap: var(--space-md);
	}
	.revocations__desc {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0;
	}
	.revocations__table-section {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
