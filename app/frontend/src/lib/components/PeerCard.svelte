<script lang="ts">
	import type { PeerWithStatus } from '$lib/api/types';
	import { timeAgo } from '$lib/utils/time';
	import { isPeerStale, isKraftcert as checkKraftcert } from '$lib/utils/peer';
	import StatusDot from './StatusDot.svelte';

	interface Props {
		peer: PeerWithStatus;
		selfNodeId?: string;
		selected?: boolean;
		onclick?: () => void;
	}

	let { peer, selfNodeId, selected = false, onclick }: Props = $props();

	let kraftcert = $derived(checkKraftcert(peer));
	let isSelf = $derived(peer.node_id === selfNodeId);
	let lastSeen = $derived(timeAgo(peer.last_seen_at, true));
	let stale = $derived(isPeerStale(peer.last_seen_at, undefined, isSelf));
	let dotStatus = $derived(stale ? 'offline' as const : 'online' as const);
</script>

<button
	class="peer-card card card--compact card--interactive"
	class:selected
	class:kraftcert
	{onclick}
	type="button"
>
	<div class="peer-card__top">
		<StatusDot status={dotStatus} size={6} />
		<span class="peer-card__name">{peer.company}</span>
		{#if kraftcert}
			<span class="peer-card__role badge badge--xs badge--arctic">KraftCERT</span>
		{/if}
	</div>
	<div class="peer-card__meta">
		<span>{peer.node_id}</span>
		<span>Sist sett {lastSeen}</span>
	</div>
</button>

<style>
	.peer-card {
		width: 100%;
		text-align: left;
		position: relative;
		overflow: hidden;
	}
	.peer-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, var(--color-aurora-mint), var(--color-success));
		opacity: 0.6;
		transition: opacity 0.2s;
	}
	.peer-card.kraftcert::before {
		background: linear-gradient(90deg, var(--color-aurora-arctic), var(--color-info));
	}
	.peer-card.selected {
		border-color: var(--color-aurora-mint);
	}
	.peer-card__top {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.peer-card__name {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.85rem;
		flex: 1;
	}
	.peer-card__role {
		flex-shrink: 0;
	}
	.peer-card__meta {
		display: flex;
		gap: 12px;
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--color-fg-dim);
	}
</style>
