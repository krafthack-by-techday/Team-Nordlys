<script lang="ts">
	import KpiCard from '$lib/components/KpiCard.svelte';
	import ExtensionCard from '$lib/components/ExtensionCard.svelte';
	import ExtensionDetailModal from '$lib/components/ExtensionDetailModal.svelte';
	import { mockExtensions } from '$lib/dummy/extensions';
	import type { Extension, ExtensionKind, QualityRating } from '$lib/types/extension';

	type KindFilter = 'all' | ExtensionKind;
	type QualityFilter = 'all' | QualityRating;

	let filter = $state<KindFilter>('all');
	let qualityFilter = $state<QualityFilter>('all');
	let selectedExt = $state<Extension | null>(null);

	let filtered = $derived(
		mockExtensions.filter((e) => {
			if (filter !== 'all' && e.kind !== filter) return false;
			if (qualityFilter !== 'all' && e.qualityRating !== qualityFilter) return false;
			return true;
		})
	);

	const totalInstalled = mockExtensions.filter((e) => e.installed).length;
	const totalAnchorSigned = mockExtensions.filter((e) => e.trustTier === 'anchor-signed').length;

	const filters: { value: KindFilter; label: string }[] = [
		{ value: 'all', label: 'Alle' },
		{ value: 'isac', label: 'ISAC' },
		{ value: 'vendor-adapter', label: 'Vendor-adaptere' },
		{ value: 'scenario-pack', label: 'Deteksjon' },
		{ value: 'export', label: 'Eksport' },
		{ value: 'source', label: 'Kilder' },
		{ value: 'detector', label: 'Detektorer' }
	];

	const qualityFilters: { value: QualityFilter; label: string; icon: string }[] = [
		{ value: 'all', label: 'Alle', icon: '' },
		{ value: 'platinum', label: 'Platinum', icon: '💎' },
		{ value: 'gold', label: 'Gold', icon: '🥇' },
		{ value: 'silver', label: 'Silver', icon: '🥈' },
		{ value: 'bronze', label: 'Bronze', icon: '🥉' }
	];
</script>

<svelte:head>
	<title>Extensions — Nordlys</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<!-- Summary strip -->
	<div class="card-grid">
		<KpiCard label="Tilgjengelige" value={mockExtensions.length} accent="mint" />
		<KpiCard label="Installert" value={totalInstalled} accent="arctic" tone="success" />
		<KpiCard label="Anchor-signert" value={totalAnchorSigned} accent="lichen" />
		<KpiCard label="Oppdateringer" value={2} accent="mint" tone="warning" />
	</div>

	<!-- Category filter tabs -->
	<nav class="filter-tabs">
		{#each filters as f}
			<button
				class="filter-tab"
				class:active={filter === f.value}
				onclick={() => (filter = f.value)}
			>
				{f.label}
				{#if f.value !== 'all'}
					<span class="filter-count">{mockExtensions.filter((e) => e.kind === f.value).length}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Quality rating filter -->
	<nav class="filter-tabs">
		<span class="filter-label">Kvalitet:</span>
		{#each qualityFilters as q}
			<button
				class="filter-tab filter-tab--quality"
				class:active={qualityFilter === q.value}
				onclick={() => (qualityFilter = q.value)}
			>
				{#if q.icon}<span class="quality-icon">{q.icon}</span>{/if}
				{q.label}
				{#if q.value !== 'all'}
					<span class="filter-count">{mockExtensions.filter((e) => e.qualityRating === q.value).length}</span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Extension card grid -->
	<div class="card-grid ext-grid">
		{#each filtered as ext (ext.id)}
			<ExtensionCard extension={ext} onclick={() => (selectedExt = ext)} />
		{/each}
	</div>
</div>

<ExtensionDetailModal extension={selectedExt} onclose={() => (selectedExt = null)} />

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
	.filter-label {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		align-self: center;
		margin-right: 0.25rem;
	}
	.filter-tab--quality.active {
		background: rgb(from var(--color-aurora-arctic) r g b / 0.12);
		border-color: var(--color-aurora-arctic);
		color: var(--color-aurora-arctic);
	}
	.quality-icon {
		font-size: 0.8rem;
	}
	.ext-grid {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	}
</style>
