<script lang="ts">
	import type { SignedEvent } from '$lib/api/types';
	import { fmtTime, fmtDate } from '$lib/utils/format';
	import SeverityBadge from './SeverityBadge.svelte';

	type Variant = 'compact' | 'detail';

	interface Props {
		event: SignedEvent;
		variant?: Variant;
	}

	let { event, variant = 'compact' }: Props = $props();
</script>

{#if variant === 'compact'}
	<div class="row-compact">
		<span class="time">{fmtTime(event.created_at)}</span>
		<span class="body">
			<span class="src">{event.source ?? event.node_id ?? '?'}</span>
			{event.title ?? event.description ?? '-'}
		</span>
		<SeverityBadge severity={event.severity ?? 'info'} />
	</div>
{:else}
	<article class="card card--compact card--interactive row-detail">
		<div class="row-detail__top">
			<div class="row-detail__main">
				<span class="row-detail__title">{event.title}</span>
				{#if event.description}
					<span class="row-detail__desc">{event.description}</span>
				{/if}
			</div>
			<SeverityBadge severity={event.severity ?? 'info'} />
		</div>
		<div class="row-detail__meta">
			<span class="meta-item"><b>{event.company}</b></span>
			<span class="meta-item">{event.source}</span>
			<span class="meta-item">{fmtDate(event.created_at)} {fmtTime(event.created_at)}</span>
			{#if event.external_ref}
				<span class="meta-item mono">{event.external_ref}</span>
			{/if}
			{#if event.scenario_id}
				<span class="meta-item mono">{event.scenario_id}</span>
			{/if}
		</div>
	</article>
{/if}

<style>
	/* ── Compact (feed row) ── */
	.row-compact {
		display: grid;
		grid-template-columns: 68px 1fr auto;
		gap: 10px;
		align-items: center;
		padding: 10px 20px;
		border-bottom: 1px solid var(--color-line);
		font-size: 0.82rem;
		animation: feed-in 0.35s ease-out;
	}
	.row-compact:hover {
		background: rgb(from var(--color-aurora-mint) r g b / 0.03);
	}
	.time {
		color: var(--color-fg-dim);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.body {
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.src {
		color: var(--color-aurora-mint);
		font-weight: 500;
	}

	/* ── Detail (card row) ── */
	.row-detail {
		animation: feed-in 0.35s ease-out;
	}
	.row-detail__top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}
	.row-detail__main {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.row-detail__title {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: var(--text-ui);
		color: var(--color-fg);
	}
	.row-detail__desc {
		font-size: var(--text-ui-sm);
		color: var(--color-fg-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.row-detail__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.8rem;
		margin-top: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.row-detail__meta b {
		color: var(--color-fg);
		font-weight: 500;
	}
	.meta-item + .meta-item::before {
		content: '\00b7';
		margin-right: 0.8rem;
		opacity: 0.4;
	}
	.mono {
		font-family: var(--font-mono);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	@keyframes feed-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
