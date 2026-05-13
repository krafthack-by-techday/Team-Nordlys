<script lang="ts">
	import type { Stats } from '$lib/api/types';
	import StatusDot from './StatusDot.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { dummyMode } from '$lib/dummy/mode.svelte';

	interface Props {
		stats: Stats | null;
		online: boolean;
		user: { id: string; email: string; name: string; role: string } | null;
	}

	let { stats, online, user }: Props = $props();

	let loggingOut = $state(false);

	async function handleLogout() {
		if (loggingOut) return;
		loggingOut = true;
		try {
			await fetch('/api/v1/auth/logout', { method: 'POST' });
		} catch {
			// best-effort; redirect regardless so client state is cleared
		} finally {
			window.location.href = '/login';
		}
	}
</script>

<header class="header glass">
	<div class="brand">
		<a href="/dashboard" class="brand-row">
			<span class="logo-wrap">
				<span class="logo shimmer-text">Nordlys</span>
				{#if dummyMode.enabled}
					<span class="demo-ribbon">DEMO</span>
				{/if}
			</span>
			<span class="logo-caption">Security Toolkit</span>
		</a>
		{#if stats}
			<div class="brand-meta">
				<b>{stats.company}</b>
				&middot; <b>{stats.node_display_name ?? stats.node_id}</b>
				&middot; <span class="role-pill" class:kraftcert={stats.role === 'kraftcert'} class:peer={stats.role !== 'kraftcert'}>{stats.role}</span>
			</div>
		{/if}
	</div>
	<div class="flex-1"></div>
	<div class="hdr-block">
		<div class="hdr-status" class:offline={!online}>
			<StatusDot status={online ? 'online' : 'offline'} size={11} pulse={online} />
			<span>{online ? m.status_online() : m.status_offline()}</span>
		</div>
		{#if stats}
			<div class="hdr-meta">
				{m.header_peers_and_events({ peers: String(stats.peers.online), events: String(stats.events.total) })}
			</div>
		{/if}
		{#if user}
			<div class="hdr-user">
				<span class="hdr-user__name" title={user.email}>{user.name}</span>
				<button
					class="hdr-logout"
					type="button"
					onclick={handleLogout}
					disabled={loggingOut}
				>{m.logout()}</button>
			</div>
		{/if}
	</div>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		gap: clamp(12px, 1.4vw, 20px);
		padding: clamp(8px, 0.8vw, 12px) clamp(16px, 2vw, 28px);
		position: relative;
		overflow: visible;
	}
	.header::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at top right,
			rgb(from var(--color-aurora-mint) r g b / 0.06) 0%,
			transparent 60%
		);
		pointer-events: none;
	}
	.brand {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.brand-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		text-decoration: none;
		color: inherit;
	}
	.logo-wrap {
		position: relative;
		display: inline-flex;
		align-items: baseline;
		overflow: visible;
	}
	.demo-ribbon {
		position: absolute;
		top: -4px;
		right: calc(100% - 24px);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.15em;
		color: var(--color-bg);
		background: var(--color-warning);
		padding: 2px 14px;
		border-radius: 3px;
		transform: rotate(-20deg);
		pointer-events: none;
		z-index: 10;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
		text-shadow: none;
	}
	.logo {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(1.3rem, 1.8vw, 1.8rem);
		letter-spacing: -0.03em;
	}
	.logo-caption {
		font-family: var(--font-mono);
		font-size: clamp(0.55rem, 0.2vw + 0.5rem, 0.68rem);
		color: var(--color-fg-dim);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.brand-meta {
		font-family: var(--font-mono);
		font-size: clamp(0.72rem, 0.25vw + 0.68rem, 0.9rem);
		color: var(--color-fg-dim);
		letter-spacing: 0.05em;
		margin-top: 2px;
	}
	.brand-meta b {
		color: var(--color-fg);
		font-weight: 500;
	}
	.role-pill {
		font-size: clamp(0.62rem, 0.2vw + 0.56rem, 0.76rem);
		padding: 3px 10px;
		border-radius: 3px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 500;
	}
	.kraftcert {
		background: rgb(from var(--color-aurora-arctic) r g b / 0.14);
		color: var(--color-aurora-arctic);
		border: 1px solid rgb(from var(--color-aurora-arctic) r g b / 0.3);
	}
	.peer {
		background: rgb(from var(--color-aurora-mint) r g b / 0.12);
		color: var(--color-aurora-mint);
		border: 1px solid rgb(from var(--color-aurora-mint) r g b / 0.3);
	}
	.flex-1 {
		flex: 1;
	}
	.hdr-block {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.hdr-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(0.95rem, 0.3vw + 0.86rem, 1.1rem);
	}
	.offline {
		color: var(--color-fg-dim);
	}
	.hdr-meta {
		font-family: var(--font-mono);
		font-size: clamp(0.72rem, 0.25vw + 0.68rem, 0.9rem);
		color: var(--color-fg-dim);
		letter-spacing: 0.05em;
	}
	.hdr-meta b {
		font-weight: 500;
		color: var(--color-fg);
	}
	.hdr-user {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 2px;
	}
	.hdr-user__name {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-fg-dim);
		letter-spacing: 0.04em;
	}
	.hdr-logout {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--color-fg-dim);
		background: none;
		border: 1px solid var(--color-line-hi);
		border-radius: 3px;
		padding: 3px 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.hdr-logout:hover:not(:disabled) {
		color: var(--color-aurora-arctic);
		border-color: var(--color-aurora-arctic);
	}
	.hdr-logout:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (max-width: 1100px) {
		.header {
			flex-direction: column;
			align-items: flex-start;
		}
		.flex-1 {
			display: none;
		}
		.hdr-block {
			align-items: flex-start;
		}
	}
</style>
