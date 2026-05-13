<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		total: number;
		pageSize: number;
		page: number;
		onchange: (page: number) => void;
	}

	let { total, pageSize, page, onchange }: Props = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	let hasPrev = $derived(page > 0);
	let hasNext = $derived(page < totalPages - 1);
</script>

{#if totalPages > 1}
	<div class="pagination">
		<button class="pg-btn" disabled={!hasPrev} onclick={() => onchange(page - 1)}>
			{m.pagination_prev()}
		</button>
		<span class="pg-info">
			{m.pagination_page_of({ page: String(page + 1), total: String(totalPages) })}
		</span>
		<button class="pg-btn" disabled={!hasNext} onclick={() => onchange(page + 1)}>
			{m.pagination_next()}
		</button>
	</div>
{/if}

<style>
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 8px 12px;
		border-top: 1px solid var(--color-line);
	}
	.pg-btn {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		background: none;
		border: 1px solid var(--color-line);
		border-radius: 3px;
		padding: 4px 10px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.pg-btn:hover:not(:disabled) {
		color: var(--color-aurora-arctic);
		border-color: var(--color-aurora-arctic);
	}
	.pg-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.pg-info {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		color: var(--color-fg-dim);
	}
</style>
