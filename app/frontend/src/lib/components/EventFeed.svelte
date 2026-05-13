<script lang="ts">
	import type { SignedEvent } from '$lib/api/types';
	import { alertSound, unlockAudio } from '$lib/audio';
	import { worstSeverity } from '$lib/utils/severity';
	import { liveStore } from '$lib/stores/live.svelte';
	import EventRow from './EventRow.svelte';
	import EventTable from './EventTable.svelte';
	import EventTimeline from './EventTimeline.svelte';
	import Pagination from './Pagination.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import EmptyState from './EmptyState.svelte';
	import { m } from '$lib/paraglide/messages.js';

	type ViewMode = 'list' | 'timeline' | 'table';

	interface Props {
		/** Which detail level for list mode */
		detail?: 'compact' | 'detail';
		/** Hide header (title + mode switcher) — useful in tight sidebars */
		headless?: boolean;
		/** Items per page (default 10) */
		pageSize?: number;
	}

	let { detail = 'compact', headless = false, pageSize = 10 }: Props = $props();

	let mode = $state<ViewMode>('list');
	let page = $state(0);
	let allEvents = $derived(liveStore.events.slice(0, 200));
	let events = $derived(allEvents.slice(page * pageSize, (page + 1) * pageSize));

	// Reset page when new events push count changes significantly
	$effect(() => {
		void allEvents.length;
		page = 0;
	});
	let prevCount = $state(liveStore.events.length);

	// ── Audio alerts for new events ──
	$effect(() => {
		const unlock = () => unlockAudio();
		document.addEventListener('click', unlock, { once: true });
		document.addEventListener('keydown', unlock, { once: true });

		return () => {
			document.removeEventListener('click', unlock);
			document.removeEventListener('keydown', unlock);
		};
	});

	// Play sound when new events arrive via SSE
	$effect(() => {
		const count = liveStore.events.length;
		if (count > prevCount) {
			const newEvents = liveStore.events.slice(0, count - prevCount);
			const best = worstSeverity(newEvents.map((ev) => ev.severity ?? 'info'));
			if (best && best !== 'info') alertSound(best);
		}
		prevCount = count;
	});

	const modes: { value: ViewMode; label: string }[] = [
		{ value: 'list', label: m.feed_view_list() },
		{ value: 'timeline', label: m.feed_view_timeline() },
		{ value: 'table', label: m.feed_view_table() }
	];
</script>

<section class="feed glass">
	{#if !headless}
	<div class="feed-hdr">
		<div class="feed-hdr__left">
			<span class="live-dot"></span>
			<span>{m.feed_events()}</span>
		</div>
		<SegmentedControl options={modes} value={mode} onchange={(v) => (mode = v)} size="xs" />
	</div>
	{/if}

	<div class="feed-body scroll-thin">
		{#if mode === 'list'}
			{#if allEvents.length === 0}
				<EmptyState message={m.feed_no_events_yet()} />
			{:else}
				<ul class="feed-list">
					{#each events as ev (ev.id)}
						<li><EventRow event={ev} variant={detail} /></li>
					{/each}
				</ul>
			{/if}
		{:else if mode === 'timeline'}
			<EventTimeline events={allEvents} />
		{:else}
			<EventTable events={allEvents} />
		{/if}
	</div>

	{#if mode === 'list'}
		<Pagination total={allEvents.length} {pageSize} {page} onchange={(p) => (page = p)} />
	{/if}
</section>

<style>
	.feed {
		overflow: hidden;
		flex: 1;
		min-height: 260px;
		display: flex;
		flex-direction: column;
	}
	.feed-hdr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 20px;
		border-bottom: 1px solid var(--color-line);
	}
	.feed-hdr__left {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-display);
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-danger);
		box-shadow: 0 0 8px var(--color-danger);
		animation: pulse-r 1.6s ease-out infinite;
	}
	@keyframes pulse-r {
		0% {
			transform: scale(1);
			opacity: 0.5;
		}
		100% {
			transform: scale(2.5);
			opacity: 0;
		}
	}
	.feed-body {
		flex: 1;
		overflow-y: auto;
	}
	.feed-list {
		padding: 0;
		list-style: none;
	}
	.feed-list li {
		list-style: none;
	}
</style>
