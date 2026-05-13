<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import { m } from '$lib/paraglide/messages.js';

	import GeneralPanel from '$lib/components/settings/GeneralPanel.svelte';
	import AuthPanel from '$lib/components/settings/AuthPanel.svelte';
	import ApiKeysPanel from '$lib/components/settings/ApiKeysPanel.svelte';
	import MeshPanel from '$lib/components/settings/MeshPanel.svelte';
	import PeersPanel from '$lib/components/settings/PeersPanel.svelte';
	import RevocationsPanel from '$lib/components/settings/RevocationsPanel.svelte';
	import AboutPanel from '$lib/components/settings/AboutPanel.svelte';

	type Tab =
		| 'general'
		| 'auth'
		| 'api-keys'
		| 'mesh'
		| 'peers'
		| 'revocations'
		| 'about';

	let isHub = $derived(page.data.stats?.role === 'kraftcert');

	let baseTabs = $derived<{ value: Tab; label: string }[]>([
		{ value: 'general', label: m.settings_tab_general() },
		{ value: 'auth', label: m.settings_tab_auth() },
		{ value: 'api-keys', label: m.settings_tab_api_keys() },
		{ value: 'mesh', label: m.settings_tab_mesh() }
	]);
	let hubTabs = $derived<{ value: Tab; label: string }[]>([
		{ value: 'peers', label: m.settings_tab_peers() },
		{ value: 'revocations', label: m.settings_tab_revocations() }
	]);
	let aboutTab = $derived<{ value: Tab; label: string }>({ value: 'about', label: m.settings_tab_about() });

	let tabs = $derived(isHub ? [...baseTabs, ...hubTabs, aboutTab] : [...baseTabs, aboutTab]);

	let activeTab = $state<Tab>('general');

	function readHash(): Tab {
		if (typeof window === 'undefined') return 'general';
		const h = window.location.hash.replace('#', '') as Tab;
		return tabs.some((t) => t.value === h) ? h : 'general';
	}

	function onTabChange(v: string) {
		activeTab = v as Tab;
		if (typeof window !== 'undefined') {
			history.replaceState(null, '', `#${v}`);
		}
	}

	onMount(() => {
		activeTab = readHash();
		const onHash = () => { activeTab = readHash(); };
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});

	let activeLabel = $derived(tabs.find((t) => t.value === activeTab)?.label ?? m.settings_label());
</script>

<svelte:head>
	<title>{activeLabel} — {m.settings_label()} — Nordlys</title>
</svelte:head>

<div class="settings">
	<div class="settings__tabs">
		<SegmentedControl
			options={[...tabs]}
			value={activeTab}
			onchange={onTabChange}
			size="md"
		/>
	</div>

	<div class="settings__panel card">
		{#if activeTab === 'general'}<GeneralPanel />
		{:else if activeTab === 'auth'}<AuthPanel />
		{:else if activeTab === 'api-keys'}<ApiKeysPanel />
		{:else if activeTab === 'mesh'}<MeshPanel />
		{:else if activeTab === 'peers'}<PeersPanel />
		{:else if activeTab === 'revocations'}<RevocationsPanel />
		{:else if activeTab === 'about'}<AboutPanel />
		{/if}
	</div>
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
	.settings__tabs {
		display: flex;
		justify-content: flex-start;
	}
	.settings__panel {
		padding: clamp(20px, 2vw, 32px);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
	.settings__panel :global(> section) {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
</style>
