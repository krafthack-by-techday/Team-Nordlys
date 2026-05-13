<script lang="ts">
	import type { Extension, TrustTier, QualityRating, ExtensionKind } from '$lib/types/extension';

	interface Props {
		extension: Extension;
		onclick: () => void;
	}

	let { extension, onclick }: Props = $props();

	const kindLabel: Record<ExtensionKind, string> = {
		isac: 'ISAC',
		'vendor-adapter': 'VENDOR',
		'scenario-pack': 'DETEKSJON',
		export: 'EKSPORT',
		source: 'KILDE',
		scanner: 'SKANNER',
		detector: 'DETEKTOR'
	};

	const kindAccent: Record<ExtensionKind, string> = {
		isac: 'mint',
		'vendor-adapter': 'arctic',
		'scenario-pack': 'lichen',
		export: 'arctic',
		source: 'mint',
		scanner: 'lichen',
		detector: 'arctic'
	};

	const trustLabel: Record<TrustTier, string> = {
		'anchor-signed': 'Anchor-signert',
		'publisher-signed': 'Publisher-signert'
	};

	const trustClass: Record<TrustTier, string> = {
		'anchor-signed': 'trust--anchor',
		'publisher-signed': 'trust--publisher'
	};

	const qualityIcon: Record<QualityRating, string> = {
		platinum: '◆',
		gold: '★',
		silver: '☆',
		bronze: '○'
	};
</script>

<button
	class="card card--interactive card--compact card--accent-{kindAccent[extension.kind]} ext-card"
	type="button"
	{onclick}
>
	<div class="ext-card__header">
		<span class="ext-card__kind badge badge--xs">{kindLabel[extension.kind]}</span>
		<span class="ext-card__version">{extension.version}</span>
	</div>
	<div class="ext-card__body">
		<h3 class="ext-card__name">{extension.name}</h3>
		<p class="ext-card__desc">{extension.description}</p>
	</div>
	<div class="ext-card__footer">
		<span class="ext-card__author">{extension.author}</span>
		<div class="ext-card__badges">
			<span class="trust-badge {trustClass[extension.trustTier]}" title={trustLabel[extension.trustTier]}>
				{#if extension.trustTier === 'anchor-signed'}
					<svg viewBox="0 0 16 16" class="trust-icon"><path d="M8 1l2 3h3.5l-1 3.5L14 11H10l-2 4-2-4H2l1.5-3.5L2.5 4H6z" fill="currentColor"/></svg>
				{/if}
				{trustLabel[extension.trustTier]}
			</span>
			<span class="quality-badge quality--{extension.qualityRating}" title="{extension.qualityRating}">
				{qualityIcon[extension.qualityRating]}
			</span>
			{#if extension.installed}
				<span class="installed-badge">✓ Installert</span>
			{/if}
		</div>
	</div>
</button>

<style>
	.ext-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-align: left;
		cursor: pointer;
		min-height: 180px;
	}
	.ext-card__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.ext-card__kind {
		background: rgb(from var(--color-fg) r g b / 0.08);
		color: var(--color-fg-dim);
	}
	.ext-card__version {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-fg-dim);
	}
	.ext-card__body {
		flex: 1;
	}
	.ext-card__name {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 700;
		margin: 0 0 4px;
		color: var(--color-fg);
	}
	.ext-card__desc {
		font-size: 0.82rem;
		color: var(--color-fg-dim);
		line-height: 1.4;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.ext-card__footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.ext-card__author {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-fg-dim);
	}
	.ext-card__badges {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.trust-badge {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		padding: 2px 8px;
		border-radius: 3px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.trust-icon {
		width: 10px;
		height: 10px;
	}
	.trust--anchor {
		background: rgb(from var(--color-aurora-mint) r g b / 0.15);
		color: var(--color-aurora-mint);
	}
	.trust--publisher {
		background: rgb(from var(--color-aurora-arctic) r g b / 0.15);
		color: var(--color-aurora-arctic);
	}
	.trust--community {
		background: rgb(from var(--color-fg) r g b / 0.08);
		color: var(--color-fg-dim);
	}
	.quality-badge {
		font-size: 0.85rem;
		line-height: 1;
	}
	.quality--platinum {
		color: var(--color-aurora-mint);
	}
	.quality--gold {
		color: var(--color-warning);
	}
	.quality--silver {
		color: var(--color-fg-dim);
	}
	.quality--bronze {
		color: var(--color-warning-dim);
	}
	.installed-badge {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--color-success);
		letter-spacing: 0.05em;
	}
</style>
