<script lang="ts">
	import EventFeed from '$lib/components/EventFeed.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.events_page_title()}</title>
</svelte:head>

<section class="events-page">
	<EventFeed detail="detail" pageSize={20} />
</section>

<style>
	.events-page {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>
