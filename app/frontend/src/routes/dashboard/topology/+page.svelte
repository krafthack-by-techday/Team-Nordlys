<script lang="ts">
	import type { PageProps } from './$types';
	import type { PeerWithStatus } from '$lib/api/types';
	import TopologyGraph from '$lib/components/TopologyGraph.svelte';
	import PeerCard from '$lib/components/PeerCard.svelte';
	import PeerDetail from '$lib/components/PeerDetail.svelte';
	import EventFeed from '$lib/components/EventFeed.svelte';
	import { liveStore } from '$lib/stores/live.svelte';
	import { dummyMode } from '$lib/dummy/mode.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { data }: PageProps = $props();

	let graphRef: TopologyGraph | undefined = $state();

	// Seed live store with SSR peers on first load (skip in dummy mode)
	$effect(() => {
		if (!dummyMode.enabled && data.peers.length > 0) liveStore.seedPeers(data.peers);
	});

	// Live data — SSE takes over from SSR
	let peers = $derived(liveStore.peers.length > 0 ? liveStore.peers : data.peers);
	let events = $derived(liveStore.events.length > 0 ? liveStore.events : data.events);
	let selfNodeId = $derived(liveStore.stats?.node_id ?? data.stats?.node_id);

	let selectedId = $state<string | null>(null);
	let searchQuery = $state('');
	let isFullscreen = $state(false);
	let containerEl: HTMLDivElement | undefined = $state();

	function toggleFullscreen() {
		if (!containerEl) return;
		if (!document.fullscreenElement) {
			containerEl.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}

	$effect(() => {
		const handler = () => { isFullscreen = !!document.fullscreenElement; };
		document.addEventListener('fullscreenchange', handler);
		return () => document.removeEventListener('fullscreenchange', handler);
	});	let selectedPeer = $derived<PeerWithStatus | null>(
		peers.find((p) => p.node_id === selectedId) ?? null
	);

	let onlineCount = $derived(peers.filter(p => {
		if (!p.last_seen_at) return false;
		return Date.now() - new Date(p.last_seen_at).getTime() < 3600_000;
	}).length);

	const MAX_VISIBLE = 20;
	let filteredPeers = $derived(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return [];
		return peers
			.filter(p => p.node_id.toLowerCase().includes(q) || p.company.toLowerCase().includes(q))
			.slice(0, MAX_VISIBLE);
	});
	let visiblePeers = $derived(filteredPeers());

	function selectPeer(id: string) {
		selectedId = selectedId === id ? null : id;
	}

	// ── Trail animation: react to new events from live store ──
	$effect(() => {
		if (!graphRef) return;
		const unsub = liveStore.onEvent((event) => {
			const path = event.path ?? [event.node_id, selfNodeId ?? ''];
			graphRef!.showTrail(path, event.severity as 'low' | 'medium' | 'high' | 'critical');
		});
		return unsub;
	});
</script>

<svelte:head>
	<title>{m.topology_page_title()}</title>
</svelte:head>

<div class="topology-main" bind:this={containerEl}>
	<div class="graph-area">
		<TopologyGraph bind:this={graphRef} {peers} {selfNodeId} {selectedId} onselect={selectPeer} />
		<button class="fs-toggle" onclick={toggleFullscreen} title={isFullscreen ? m.exit_fullscreen() : m.topology_enter_fullscreen()}>
			{isFullscreen ? '⤓' : '⤢'}
		</button>
	</div>

	<div class="sidebar">
		<div class="sb-section">
			{m.topology_peers({ count: String(peers.length) })}
			<span class="sb-online">{m.topology_peers_online({ count: String(onlineCount) })}</span>
		</div>
		<div class="peer-search">
			<input
				type="text"
				class="input peer-search__input"
				placeholder={m.topology_peers_search()}
				bind:value={searchQuery}
			/>
		</div>
		<div class="peer-list">
			{#if searchQuery.trim()}
				{#each visiblePeers as peer (peer.node_id)}
					<PeerCard
						{peer}
						{selfNodeId}
						selected={peer.node_id === selectedId}
						onclick={() => selectPeer(peer.node_id)}
					/>
				{:else}
					<div class="empty">{m.topology_no_peers()}</div>
				{/each}
			{:else if peers.length === 0}
				<div class="empty">{m.topology_no_peers()}</div>
			{/if}
		</div>

		<div class="sb-section">{m.topology_events()}</div>
		<div class="event-area">
			<EventFeed detail="compact" headless />
		</div>
	</div>
</div>

<PeerDetail peer={selectedPeer} {selfNodeId} onclose={() => (selectedId = null)} />

<style>
	.topology-main {
		display: flex;
		flex: 1;
		overflow: hidden;
		min-height: 500px;
		border: 1px solid var(--color-line-hi);
		border-radius: 6px;
	}
	.graph-area {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
	}
	.fs-toggle {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 10;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		background: rgb(from var(--color-bg) r g b / 0.7);
		border: 1px solid var(--color-line);
		border-radius: 4px;
		color: var(--color-fg-dim);
		cursor: pointer;
		transition: all 0.15s;
		backdrop-filter: blur(4px);
	}
	.fs-toggle:hover {
		color: var(--color-aurora-arctic);
		border-color: var(--color-aurora-arctic);
	}
	.topology-main:fullscreen {
		background: var(--color-bg);
		border: none;
		border-radius: 0;
	}
	.sidebar {
		width: 340px;
		border-left: 1px solid var(--color-line-hi);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
		background: rgb(from var(--color-bg-raised) r g b / 0.3);
	}
	.sb-section {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		color: var(--color-fg-dim);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		padding: 10px 14px 6px;
		border-bottom: 1px solid var(--color-line);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.sb-online {
		font-weight: 400;
		opacity: 0.7;
	}
	.peer-search {
		padding: 6px;
	}
	.peer-search__input {
		width: 100%;
	}
	.peer-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px;
		overflow-y: auto;
		max-height: 45%;
		scrollbar-width: thin;
		scrollbar-color: var(--color-line-hi) transparent;
	}
	.event-area {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.empty {
		text-align: center;
		padding: 30px 10px;
		color: var(--color-fg-dim);
		font-size: 0.7rem;
		font-style: italic;
	}
	@media (max-width: 900px) {
		.sidebar {
			width: 280px;
		}
	}
	@media (max-width: 700px) {
		.sidebar {
			display: none;
		}
	}
</style>
