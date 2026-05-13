<script lang="ts">
	import type { Stats } from '$lib/api/types';
	import KpiCard from './KpiCard.svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		stats: Stats | null;
	}

	let { stats }: Props = $props();

	let adoptionPct = $derived(
		stats ? Math.round((stats.peers.total / 375) * 100 * 10) / 10 : 0
	);
</script>

<section class="counters">
	{#if stats}
		<KpiCard label={m.kpi_peers_online()} value={stats.peers.online} href="/dashboard/topology" accent="arctic">
			<span>{m.kpi_peers_of_registered({ total: String(stats.peers.total), pct: String(adoptionPct) })}</span>
		</KpiCard>

		<KpiCard label={m.kpi_events_24h()} value={stats.events.last_24h} href="/dashboard/events" accent="mint">
			<span>{m.kpi_events_critical({ critical: String(stats.events.critical_24h), open: String(stats.incidents.open) })}</span>
			<span>{m.kpi_events_total_node({ total: String(stats.events.total) })}</span>
		</KpiCard>

		<KpiCard label={m.kpi_indicators()} value={stats.indicators.total} href="/dashboard/topology" accent="lichen">
			<span><b>{stats.indicators.tlp_red}</b> TLP RED &middot; <b>{stats.indicators.tlp_amber}</b> AMBER</span>
		</KpiCard>

		<KpiCard label={m.kpi_vulnerabilities()} value={stats.vulnerabilities.open} href="/dashboard/vulnerabilities" accent="lichen">
			<span>{m.kpi_critical_open({ count: String(stats.vulnerabilities.critical) })}</span>
		</KpiCard>
	{:else}
		{#each Array(4) as _}
			<div class="card card--compact placeholder">
				<span class="ph-label">&nbsp;</span>
				<span class="ph-value">&ndash;</span>
				<span class="ph-sub">&nbsp;</span>
			</div>
		{/each}
	{/if}
</section>

<style>
	.counters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		align-items: stretch;
	}
	.placeholder {
		opacity: 0.5;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.ph-label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-fg-dim);
	}
	.ph-value {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(2rem, 1vw + 1.65rem, 2.9rem);
		color: var(--color-fg);
		line-height: 1;
		flex: 1;
	}
	.ph-sub {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-fg-dim);
	}
</style>
