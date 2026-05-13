<script lang="ts">
	/**
	 * Skeleton loading placeholder. Renders animated pulse bars
	 * to indicate content is loading.
	 *
	 * Usage:
	 *   <Skeleton />                  — single line
	 *   <Skeleton lines={3} />        — paragraph placeholder
	 *   <Skeleton variant="card" />   — card-shaped placeholder
	 *   <Skeleton variant="circle" /> — avatar placeholder
	 */

	interface Props {
		/** Number of lines to render (for 'line' variant). */
		lines?: number;
		/** Shape variant. */
		variant?: 'line' | 'card' | 'circle';
		/** Width (CSS value). Only for line/card. */
		width?: string;
		/** Height (CSS value). Only for card/circle. */
		height?: string;
	}

	let { lines = 1, variant = 'line', width, height }: Props = $props();
</script>

{#if variant === 'circle'}
	<div
		class="skeleton skeleton--circle"
		style:width={width ?? '2.5rem'}
		style:height={height ?? '2.5rem'}
	></div>
{:else if variant === 'card'}
	<div
		class="skeleton skeleton--card"
		style:width={width ?? '100%'}
		style:height={height ?? '120px'}
	></div>
{:else}
	{#each Array(lines) as _, i}
		<div
			class="skeleton skeleton--line"
			style:width={i === lines - 1 && lines > 1 ? '70%' : (width ?? '100%')}
		></div>
	{/each}
{/if}

<style>
	.skeleton {
		background: linear-gradient(
			90deg,
			rgb(from var(--color-fg) r g b / 0.06) 25%,
			rgb(from var(--color-fg) r g b / 0.12) 50%,
			rgb(from var(--color-fg) r g b / 0.06) 75%
		);
		background-size: 200% 100%;
		animation: skeleton-pulse 1.5s ease-in-out infinite;
		border-radius: 6px;
	}

	.skeleton--line {
		height: 0.85rem;
		margin-bottom: 0.5rem;
	}
	.skeleton--line:last-child {
		margin-bottom: 0;
	}

	.skeleton--card {
		border-radius: 12px;
	}

	.skeleton--circle {
		border-radius: 50%;
	}

	@keyframes skeleton-pulse {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
