<script lang="ts">
	import type { PeerWithStatus } from '$lib/api/types';
	import { timeAgo } from '$lib/utils/time';
	import { fmtDateTime } from '$lib/utils/format';
	import { isPeerStale, isKraftcert as checkKraftcert } from '$lib/utils/peer';
	import StatusDot from './StatusDot.svelte';
	import SectionLabel from './SectionLabel.svelte';
	import DetailField from './DetailField.svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		peer: PeerWithStatus | null;
		selfNodeId?: string;
		onclose: () => void;
	}

	let { peer, selfNodeId, onclose }: Props = $props();

	let kraftcert = $derived(peer ? checkKraftcert(peer) : false);
	let isSelf = $derived(peer?.node_id === selfNodeId);
	let stale = $derived(isPeerStale(peer?.last_seen_at, undefined, isSelf));
	let dotStatus = $derived(stale ? 'offline' as const : 'online' as const);
</script>

<aside class="detail glass--drawer" class:open={peer !== null}>
	{#if peer}
		<div class="detail__head">
			<span class="detail__company">{peer.company}</span>
			<button class="detail__close" onclick={onclose} aria-label={m.peer_close()}>&times;</button>
		</div>

		<div class="detail__badges">
			<span class="badge badge--sm badge--status-active">
				<StatusDot status={dotStatus} size={5} />
				{dotStatus === 'online' ? m.status_online() : m.status_offline()}
			</span>
			{#if kraftcert}
				<span class="badge badge--sm badge--arctic">KraftCERT</span>
			{/if}
		</div>

		<SectionLabel label={m.peer_details()} />
		<div class="detail__grid">
			<DetailField label={m.peer_node_id()} value={peer.node_id} />
			<DetailField label={m.peer_company()} value={peer.company} />
			<DetailField label={m.peer_last_seen()} value={peer.last_seen_at ? timeAgo(peer.last_seen_at) : m.peer_last_seen_never()} />
			<DetailField label={m.peer_registered()} value={fmtDateTime(peer.registered_at)} />
			<DetailField label={m.peer_registered_by()} value={peer.registered_by} />
			<DetailField label={m.peer_signed_by()} value={peer.signed_by} />
			<DetailField label={m.peer_public_key()} value="{peer.public_key.slice(0, 16)}..." mono />
		</div>

		<SectionLabel label={m.peer_signature()} />
		<div class="detail__sig">{peer.signature}</div>
	{/if}
</aside>

<style>
	.detail {
		position: fixed;
		top: 0;
		right: -400px;
		width: 380px;
		height: 100vh;
		z-index: 20;
		padding: 20px;
		overflow-y: auto;
		transition: right 0.3s ease;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.detail.open {
		right: 0;
	}
	.detail__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.detail__company {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.3rem;
	}
	.detail__close {
		background: none;
		border: none;
		color: var(--color-fg-dim);
		font-size: 1.3rem;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
	}
	.detail__close:hover {
		background: var(--color-bg-raised);
		color: var(--color-fg);
	}
	.detail__badges {
		display: flex;
		gap: 6px;
	}
	.detail__grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.detail__sig {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-fg-dim);
		word-break: break-all;
		line-height: 1.5;
		padding: 10px;
		background: rgb(from var(--color-bg-raised) r g b / 0.6);
		border: 1px solid var(--color-line);
		border-radius: 4px;
	}
	@media (max-width: 700px) {
		.detail {
			width: 100%;
		}
	}
</style>
