<script lang="ts">
	/**
	 * Copy-to-clipboard button. Shows a checkmark on success.
	 * Designed for inline use next to hashes, IPs, CVE IDs, node IDs.
	 *
	 * Usage:
	 *   <CopyButton value="CVE-2024-3400" />
	 *   <CopyButton value={peer.node_id} label="Copy node ID" />
	 */

	interface Props {
		/** The text value to copy to clipboard. */
		value: string;
		/** Accessible label for the button. */
		label?: string;
		/** Size variant. */
		size?: 'sm' | 'md';
	}

	let { value, label = 'Copy to clipboard', size = 'sm' }: Props = $props();
	let copied = $state(false);
	let timeout: ReturnType<typeof setTimeout> | null = null;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(() => { copied = false; }, 2000);
		} catch {
			// Fallback: no-op, clipboard API not available
		}
	}
</script>

<button
	class="copy-btn"
	class:copy-btn--sm={size === 'sm'}
	class:copy-btn--copied={copied}
	type="button"
	onclick={copy}
	aria-label={label}
	title={label}
>
	{#if copied}
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M3 8.5l3.5 3.5L13 4.5" />
		</svg>
	{:else}
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<rect x="5" y="5" width="8" height="8" rx="1.5" />
			<path d="M3 11V3a1.5 1.5 0 011.5-1.5H11" />
		</svg>
	{/if}
</button>

<style>
	.copy-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--color-fg-dim);
		cursor: pointer;
		transition: color 150ms, background 150ms;
	}

	.copy-btn--sm {
		width: 1.3rem;
		height: 1.3rem;
	}

	.copy-btn:hover {
		color: var(--color-fg);
		background: rgb(from var(--color-fg) r g b / 0.08);
	}

	.copy-btn--copied {
		color: var(--color-success);
	}

	.copy-btn svg {
		width: 70%;
		height: 70%;
	}
</style>
