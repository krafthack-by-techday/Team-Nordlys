<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { dummyMode } from '$lib/dummy/mode.svelte';
	import LocaleSwitcher from './LocaleSwitcher.svelte';
	import Version from './Version.svelte';

	const links = [
		{ label: m.nav_events(), href: '/dashboard/events' },
		{ label: m.nav_vulnerabilities(), href: '/dashboard/vulnerabilities' },
		{ label: m.nav_topology(), href: '/dashboard/topology' },
		{ label: m.nav_health(), href: '/dashboard/health' },
		{ label: m.nav_settings(), href: '/dashboard/settings' }
	];
</script>

<nav class="mesh" aria-label={m.mesh_nav_label()}>
	<div class="mesh-links">
		{#each links as l}
			<a class="mesh-link" href={l.href}>{l.label}</a>
		{/each}
	</div>
	<div class="mesh-right">
		<Version class="mesh-version" />
		<span class="mesh-sep"></span>
		<button class="mesh-link demo-toggle" class:active={dummyMode.enabled} onclick={() => dummyMode.toggle()}>
			DEMO
		</button>
		<span class="mesh-sep"></span>
		<LocaleSwitcher />
	</div>
</nav>

<style>
	.mesh {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: rgb(from var(--color-bg-raised) r g b / 0.55);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-line-hi);
		flex-wrap: wrap;
		margin-top: auto;
		gap: 12px;
	}
	.mesh-links {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.mesh-link {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		background: none;
		border: none;
		padding: 5px 10px;
		border-radius: 3px;
		text-decoration: none;
		transition: all 0.15s ease;
	}
	.mesh-link:hover {
		background: rgb(from var(--color-aurora-arctic) r g b / 0.08);
		color: var(--color-aurora-arctic);
	}
	.mesh-right {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
	}
	.mesh-sep {
		width: 1px;
		height: 12px;
		background: var(--color-line-hi);
		margin: 0 4px;
	}
	:global(.mesh-version) {
		padding: 0 4px;
	}
	.demo-toggle {
		cursor: pointer;
		opacity: 0.5;
	}
	.demo-toggle.active {
		opacity: 1;
		color: var(--color-aurora-solar);
	}
</style>
