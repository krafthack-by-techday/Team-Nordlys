<script lang="ts">
	import { page } from '$app/state';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Aurora from '$lib/components/Aurora.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import DashboardHeader from '$lib/components/DashboardHeader.svelte';
	import MeshNav from '$lib/components/MeshNav.svelte';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import type { LayoutProps } from './$types';
	import { setShellContext, getRouteLabel, getRouteCaption } from '$lib/shell-context';
	import { liveStore } from '$lib/stores/live.svelte';
	import { dummyMode } from '$lib/dummy/mode.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { data, children }: LayoutProps = $props();

	// Live SSE-powered stats (falls back to SSR data)
	let stats = $derived(liveStore.stats ?? data.stats);
	let online = $derived(liveStore.online || data.online);

	// Track fullscreen mode — pages can toggle this via context
	let fullscreen = $state(false);

	setShellContext({
		get fullscreen() { return fullscreen; },
		toggleFullscreen: () => { fullscreen = !fullscreen; }
	});

	let pathname = $derived(page.url.pathname);
	let isAuthPage = $derived(pathname.startsWith('/login') || pathname.startsWith('/setup'));
	let isLandingPage = $derived(pathname === '/');
	let isSubpage = $derived(pathname.startsWith('/dashboard/') && pathname !== '/dashboard');
	let pageLabel = $derived(getRouteLabel(pathname));
	let pageCaption = $derived(getRouteCaption(pathname));

	// Mesh disconnected: node is a peer (not kraftcert) with 0 peers registered
	let meshDisconnected = $derived(
		stats && stats.role !== 'kraftcert' && stats.peers.total === 0
	);

	// Start SSE connection or dummy mode (client-side only, once)
	$effect(() => {
		if (dummyMode.enabled) {
			liveStore.startDummy();
		} else {
			liveStore.start(data.stats);
		}
		return () => liveStore.stop();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Aurora />

{#if isAuthPage || isLandingPage}
	<div class="auth-backdrop"></div>
	<div class="auth-locale">
		<LocaleSwitcher />
	</div>
	{@render children()}
{:else}
	<ThemeToggle />

	{#if !fullscreen}
		<div class="shell">
			{#if meshDisconnected}
				<div class="mesh-banner">
					<span class="mesh-banner__icon">&#9679;</span>
					<span>{m.mesh_banner_text()}</span>
					<a href="/dashboard/settings#mesh" class="mesh-banner__link">{m.mesh_banner_link()}</a>
				</div>
			{/if}
			<DashboardHeader {stats} {online} user={data.user} />
			{#if isSubpage}
				<nav class="breadcrumb" aria-label={m.breadcrumb_label()}>
					<a class="breadcrumb__link" href="/dashboard">{m.nav_dashboard()}</a>
					<span class="breadcrumb__sep">/</span>
					<span class="breadcrumb__current">{pageLabel}</span>
					{#if pageCaption}
						<span class="breadcrumb__caption">{pageCaption}</span>
					{/if}
				</nav>
			{/if}
			<main class="main-content">
				{@render children()}
			</main>
			<MeshNav />
		</div>
	{:else}
		<div class="fullscreen-shell">
			<button class="exit-fs" onclick={() => (fullscreen = false)} aria-label={m.exit_fullscreen()}>
				&#x2715; {m.exit_fullscreen()}
			</button>
			{@render children()}
		</div>
	{/if}
{/if}


<style>
	.auth-backdrop {
		position: fixed;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background: rgb(from var(--color-bg) r g b / 0.55);
	}
	.auth-locale {
		position: fixed;
		top: clamp(12px, 1.6vw, 20px);
		right: clamp(12px, 1.6vw, 20px);
		z-index: 20;
	}
	.shell {
		max-width: 1700px;
		margin: 0 auto;
		padding: clamp(18px, 2.6vw, 34px) clamp(18px, 3.2vw, 48px) clamp(48px, 6vw, 84px);
		display: flex;
		flex-direction: column;
		gap: clamp(18px, 2.2vw, 34px);
		flex: 1;
		width: 100%;
		position: relative;
		z-index: 5;
		min-height: 100vh;
	}
	.main-content {
		display: flex;
		flex-direction: column;
		gap: clamp(18px, 2.2vw, 34px);
		flex: 1;
	}
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		color: var(--color-fg-dim);
	}
	.breadcrumb__link {
		color: var(--color-fg-dim);
		text-decoration: none;
		transition: color 0.15s;
	}
	.breadcrumb__link:hover {
		color: var(--color-aurora-arctic);
	}
	.breadcrumb__sep {
		opacity: 0.4;
	}
	.breadcrumb__current {
		color: var(--color-fg);
		font-weight: 600;
		font-family: var(--font-display);
		font-size: clamp(1rem, 1.2vw, 1.3rem);
		letter-spacing: -0.01em;
	}
	.breadcrumb__caption {
		margin-left: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		opacity: 0.7;
	}
	.fullscreen-shell {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		flex-direction: column;
		background: var(--color-bg);
	}
	.exit-fs {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 110;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		color: var(--color-fg-dim);
		background: rgb(from var(--color-bg-raised) r g b / 0.7);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-line-hi);
		border-radius: 4px;
		padding: 6px 12px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.exit-fs:hover {
		color: var(--color-fg);
		background: rgb(from var(--color-bg-raised) r g b / 0.9);
	}

	/* Mesh disconnected banner */
	.mesh-banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		background: rgb(from var(--color-status-warning) r g b / 0.08);
		border: 1px solid rgb(from var(--color-status-warning) r g b / 0.25);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--color-fg-dim);
		letter-spacing: 0.02em;
	}
	.mesh-banner__icon {
		color: var(--color-status-warning);
		font-size: 0.6rem;
		animation: pulse-dot 2s infinite;
	}
	.mesh-banner__link {
		margin-left: auto;
		color: var(--color-aurora-arctic);
		text-decoration: none;
		font-weight: 500;
		transition: color var(--motion-duration) var(--motion-ease);
	}
	.mesh-banner__link:hover {
		color: var(--color-fg);
	}
	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
</style>
