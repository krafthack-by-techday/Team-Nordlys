<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();
	let visible = $state(false);
</script>

<span
	class="info-tip"
	role="tooltip"
	onmouseenter={() => (visible = true)}
	onmouseleave={() => (visible = false)}
>
	<svg class="info-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/>
		<path d="M8 7v4M8 5.5v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
	</svg>
	{#if visible}
		<span class="tip-bubble glass--tooltip">{text}</span>
	{/if}
</span>

<style>
	.info-tip {
		position: relative;
		display: inline-flex;
		align-items: center;
		cursor: help;
		margin-left: 0.4rem;
		vertical-align: middle;
	}
	.info-icon {
		width: 15px;
		height: 15px;
		color: var(--color-fg-dim);
		opacity: 0.6;
		transition: opacity 0.15s, color 0.15s;
	}
	.info-tip:hover .info-icon {
		opacity: 1;
		color: var(--color-aurora-arctic);
	}
	.tip-bubble {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--color-bg-raised, #1a1a2e);
		backdrop-filter: blur(12px);
		border: 1px solid var(--color-line-hi, #333);
		border-radius: 4px;
		padding: 0.5rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		line-height: 1.5;
		color: var(--color-fg);
		white-space: normal;
		width: max-content;
		max-width: 260px;
		z-index: 100;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.4);
		pointer-events: none;
		animation: tip-in 0.12s ease-out;
	}
	@keyframes tip-in {
		from { opacity: 0; transform: translateX(-50%) translateY(4px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}
</style>
