<script lang="ts">
	import type { SignedEvent } from '$lib/api/types';
	import { fmtTime, fmtDate } from '$lib/utils/format';
	import SeverityBadge from './SeverityBadge.svelte';
	import EmptyState from './EmptyState.svelte';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		events: SignedEvent[];
	}

	let { events }: Props = $props();

	// Group events by date
	let grouped = $derived(() => {
		const groups = new Map<string, SignedEvent[]>();
		for (const ev of events) {
			const key = fmtDate(ev.created_at);
			const arr = groups.get(key);
			if (arr) arr.push(ev);
			else groups.set(key, [ev]);
		}
		return groups;
	});
</script>

<div class="timeline scroll-thin">
	{#each grouped() as [date, dayEvents] (date)}
		<div class="timeline__group">
			<div class="timeline__date">{date}</div>
			{#each dayEvents as ev (ev.id)}
				<div class="timeline__entry">
					<div class="timeline__rail">
						<div class="timeline__dot severity-{ev.severity ?? 'info'}"></div>
						<div class="timeline__line"></div>
					</div>
					<div class="timeline__content">
						<div class="timeline__top">
							<span class="timeline__time">{fmtTime(ev.created_at)}</span>
							<SeverityBadge severity={ev.severity ?? 'info'} />
						</div>
						<div class="timeline__title">{ev.title}</div>
						{#if ev.description}
							<div class="timeline__desc">{ev.description}</div>
						{/if}
						<div class="timeline__meta">
							<span>{ev.company}</span>
							<span>{ev.source}</span>
							{#if ev.external_ref}
								<span class="mono">{ev.external_ref}</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<EmptyState message={m.feed_no_events()} />
	{/each}
</div>

<style>
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		flex: 1;
		overflow-y: auto;
		padding: 1rem 1.2rem;
	}
	.timeline__group {
		display: flex;
		flex-direction: column;
	}
	.timeline__date {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-line);
		margin-bottom: 0.5rem;
	}
	.timeline__entry {
		display: flex;
		gap: 1rem;
		animation: fade-in 0.3s ease-out;
	}
	.timeline__rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 12px;
		flex-shrink: 0;
		padding-top: 6px;
	}
	.timeline__dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-fg-dim);
		flex-shrink: 0;
	}
	.timeline__dot.severity-critical {
		background: var(--color-danger);
		box-shadow: 0 0 8px var(--color-danger-dim);
	}
	.timeline__dot.severity-high {
		background: var(--color-warning);
		box-shadow: 0 0 6px var(--color-warning-dim);
	}
	.timeline__dot.severity-medium {
		background: var(--color-info);
	}
	.timeline__dot.severity-low {
		background: var(--color-success);
	}
	.timeline__line {
		flex: 1;
		width: 1px;
		background: var(--color-line);
		margin: 4px 0;
	}
	.timeline__content {
		flex: 1;
		padding-bottom: 1.2rem;
		min-width: 0;
	}
	.timeline__top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 4px;
	}
	.timeline__time {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--color-fg-dim);
		font-variant-numeric: tabular-nums;
	}
	.timeline__title {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: var(--text-ui);
		color: var(--color-fg);
	}
	.timeline__desc {
		font-size: var(--text-ui-sm);
		color: var(--color-fg-dim);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.timeline__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.7rem;
		margin-top: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.timeline__meta span + span::before {
		content: '\00b7';
		margin-right: 0.7rem;
		opacity: 0.4;
	}
	.mono {
		text-transform: none;
		letter-spacing: 0.02em;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
