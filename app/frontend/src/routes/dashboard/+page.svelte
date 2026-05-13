<script lang="ts">
	import type { PageProps } from './$types';
	import CounterStrip from '$lib/components/CounterStrip.svelte';
	import EventFeed from '$lib/components/EventFeed.svelte';
	import { liveStore } from '$lib/stores/live.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { data }: PageProps = $props();

	// Live stats — SSE takes over from SSR data
	let stats = $derived(liveStore.stats ?? data.stats);
</script>

<svelte:head>
	<title>{m.index_page_title()}</title>
</svelte:head>

<CounterStrip {stats} />
<EventFeed />
