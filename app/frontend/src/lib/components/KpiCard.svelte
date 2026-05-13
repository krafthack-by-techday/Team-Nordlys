<script lang="ts">
	import type { Snippet } from 'svelte';

	type Accent = 'mint' | 'arctic' | 'lichen';
	type Tone = 'default' | 'warning' | 'danger' | 'success';

	interface Props {
		/** KPI label (uppercase mono) */
		label: string;
		/** Primary big number */
		value: number | string;
		/** Optional link target. Omit for static cards. */
		href?: string;
		/** Card accent bar colour */
		accent?: Accent;
		/** Colour the value text. Use for severity emphasis. */
		tone?: Tone;
		/** Optional detail lines rendered below the value */
		children?: Snippet;
	}

	let { label, value, href, accent = 'mint', tone = 'default', children }: Props = $props();

	const toneClass: Record<Tone, string> = {
		default: '',
		warning: 'kpi__value--warning',
		danger: 'kpi__value--danger',
		success: 'kpi__value--success'
	};
</script>

{#snippet body()}
	<span class="kpi__label">{label}</span>
	<span class="kpi__value {toneClass[tone]}">{value}</span>
	{#if children}
		<div class="kpi__details">
			{@render children()}
		</div>
	{/if}
{/snippet}

{#if href}
	<a {href} class="card card--interactive card--compact card--accent-{accent} kpi">{@render body()}</a>
{:else}
	<article class="card card--compact card--accent-{accent} kpi">{@render body()}</article>
{/if}

<style>
	.kpi {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-decoration: none;
		color: inherit;
	}
	.kpi__label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.kpi__value {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(2rem, 1vw + 1.65rem, 2.9rem);
		color: var(--color-fg);
		line-height: 1;
		flex: 1;
		display: flex;
		align-items: flex-end;
	}
	.kpi__value--warning { color: var(--color-warning); }
	.kpi__value--danger { color: var(--color-danger); }
	.kpi__value--success { color: var(--color-success); }
	.kpi__details {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-family: var(--font-mono);
		font-size: clamp(0.62rem, 0.15vw + 0.58rem, 0.75rem);
		color: var(--color-fg-dim);
		letter-spacing: 0.04em;
	}
	.kpi__details :global(b) {
		color: var(--color-fg);
		font-weight: 500;
	}
</style>
