<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { liveStore } from '$lib/stores/live.svelte';
	import { dummyMode } from '$lib/dummy/mode.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import type { Column } from '$lib/components/datatable.types';

	interface VardeHealth {
		varde_id: string;
		score: number;
		rtt_avg_ms: number | null;
		uptime_pct: number;
		disconnects_24h: number;
		delivery_latency_ms: number | null;
		status: 'healthy' | 'degraded' | 'critical';
		connected?: boolean;
	}

	function deriveHealthFromPeers(): VardeHealth[] {
		const peers = liveStore.peers;
		if (!peers.length) return [];
		const step = Math.max(1, Math.floor(peers.length / 12));
		const vardes: VardeHealth[] = [];
		for (let i = 0; i < peers.length && vardes.length < 12; i += step) {
			const p = peers[i];
			const isOnline = p.last_seen_at ? Date.now() - new Date(p.last_seen_at).getTime() < 60_000 : false;
			const hash = p.node_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
			const baseScore = 40 + (hash % 55);
			const score = isOnline ? baseScore : Math.max(20, baseScore - 40);
			vardes.push({
				varde_id: p.node_id,
				score,
				rtt_avg_ms: isOnline ? 30 + (hash % 350) : null,
				uptime_pct: isOnline ? 92 + (hash % 8) : 60 + (hash % 20),
				disconnects_24h: isOnline ? hash % 3 : 3 + (hash % 5),
				delivery_latency_ms: isOnline ? 80 + (hash % 600) : null,
				status: score >= 70 ? 'healthy' : score >= 30 ? 'degraded' : 'critical'
			});
		}
		return vardes;
	}

	let liveHealth = $state<VardeHealth[]>([]);
	let loadError = $state(false);

	async function fetchHealth() {
		try {
			const resp = await fetch('/api/v1/varde-health');
			if (resp.ok) {
				liveHealth = await resp.json();
				loadError = false;
			}
		} catch {
			loadError = true;
		}
	}

	onMount(() => {
		fetchHealth();
		const iv = setInterval(fetchHealth, 10_000);
		return () => clearInterval(iv);
	});

	let healthData = $derived(dummyMode.enabled ? deriveHealthFromPeers() : liveHealth);

	function scoreBadgeClass(score: number): string {
		if (score >= 70) return 'badge badge--sm badge--severity-low';
		if (score >= 30) return 'badge badge--sm badge--severity-medium';
		return 'badge badge--sm badge--severity-critical';
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'healthy': return 'badge badge--xs badge--status-active';
			case 'degraded': return 'badge badge--xs badge--severity-medium';
			case 'critical': return 'badge badge--xs badge--severity-critical';
			default: return 'badge badge--xs';
		}
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'healthy': return m.health_healthy();
			case 'degraded': return m.health_degraded();
			case 'critical': return m.health_critical();
			default: return status;
		}
	}

	const columns: Column<VardeHealth>[] = [
		{ key: 'status', label: m.health_col_status(), sortable: true, cellClass: 'table__cell--status', searchable: false },
		{ key: 'varde_id', label: m.health_col_varde(), sortable: true, cellClass: 'table__cell--mono' },
		{ key: 'score', label: m.health_col_score(), sortable: true, searchable: false },
		{ key: 'rtt_avg_ms', label: m.health_col_rtt(), sortable: true, cellClass: 'table__cell--num', searchable: false },
		{ key: 'uptime_pct', label: m.health_col_uptime(), sortable: true, cellClass: 'table__cell--num', searchable: false },
		{ key: 'disconnects_24h', label: m.health_col_disconnects(), sortable: true, cellClass: 'table__cell--num', searchable: false },
		{ key: 'delivery_latency_ms', label: m.health_col_latency(), sortable: true, cellClass: 'table__cell--num', searchable: false }
	];
</script>

<svelte:head>
	<title>{m.health_page_title()}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<!-- Summary cards -->
	<div class="card-grid">
		<KpiCard
			label={m.health_healthy()}
			value={healthData.filter((v) => v.status === 'healthy').length}
			accent="mint"
			tone="success"
		/>
		<KpiCard
			label={m.health_degraded()}
			value={healthData.filter((v) => v.status === 'degraded').length}
			accent="lichen"
			tone="warning"
		/>
		<KpiCard
			label={m.health_critical()}
			value={healthData.filter((v) => v.status === 'critical').length}
			accent="arctic"
			tone="danger"
		/>
	</div>

	<!-- Health table -->
	<section class="glass health-table-section">
		<DataTable
			data={healthData}
			{columns}
			defaultSortKey="score"
			defaultSortDir="ascending"
			searchPlaceholder={m.health_search_placeholder()}
			pageSize={0}
			dense
		>
			{#snippet cell(row, col)}
				{#if col.key === 'status'}
					<span class={statusBadgeClass(row.status)}>
						<span class="badge__dot"></span>
						{statusLabel(row.status)}
					</span>
				{:else if col.key === 'varde_id'}
					{row.varde_id}
				{:else if col.key === 'score'}
					<span class={scoreBadgeClass(row.score)}>{row.score.toFixed(0)}</span>
				{:else if col.key === 'rtt_avg_ms'}
					{row.rtt_avg_ms != null ? `${row.rtt_avg_ms.toFixed(0)} ms` : '—'}
				{:else if col.key === 'uptime_pct'}
					{row.uptime_pct.toFixed(1)}%
				{:else if col.key === 'disconnects_24h'}
					{row.disconnects_24h}
				{:else if col.key === 'delivery_latency_ms'}
					{row.delivery_latency_ms != null ? `${row.delivery_latency_ms.toFixed(0)} ms` : '—'}
				{/if}
			{/snippet}
		</DataTable>
	</section>
</div>

<style>
	.health-table-section {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 260px;
		overflow: hidden;
	}
</style>
