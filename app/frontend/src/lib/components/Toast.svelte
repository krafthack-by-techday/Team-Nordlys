<script module lang="ts">
	/**
	 * Toast notification system. Renders a stack of dismissible toasts.
	 *
	 * Usage:
	 *   import { toast } from '$lib/components/Toast.svelte';
	 *
	 *   toast.success('Event submitted');
	 *   toast.error('Connection lost');
	 *   toast.info('New peer joined the mesh');
	 *   toast.warning('API key expires in 24h');
	 *
	 * Place <Toast /> once in +layout.svelte to render the toast stack.
	 */

	interface ToastItem {
		id: number;
		message: string;
		type: 'success' | 'error' | 'warning' | 'info';
		duration: number;
	}

	let toasts = $state<ToastItem[]>([]);
	let nextId = 0;

	function add(message: string, type: ToastItem['type'], duration = 4000): void {
		const id = nextId++;
		toasts = [...toasts, { id, message, type, duration }];
		if (duration > 0) {
			setTimeout(() => dismiss(id), duration);
		}
	}

	function dismiss(id: number): void {
		toasts = toasts.filter((t) => t.id !== id);
	}

	export function getToasts(): ToastItem[] {
		return toasts;
	}

	export const toast = {
		success: (msg: string, duration?: number) => add(msg, 'success', duration),
		error: (msg: string, duration?: number) => add(msg, 'error', duration ?? 6000),
		warning: (msg: string, duration?: number) => add(msg, 'warning', duration),
		info: (msg: string, duration?: number) => add(msg, 'info', duration),
		dismiss,
	};
</script>

<script lang="ts">
	const items = $derived(getToasts());
</script>

<div class="toast-stack" aria-live="polite" aria-relevant="additions removals">
	{#each items as t (t.id)}
		<output class="toast toast--{t.type}">
			<span class="toast__icon">
				{#if t.type === 'success'}✓
				{:else if t.type === 'error'}✕
				{:else if t.type === 'warning'}⚠
				{:else}ℹ
				{/if}
			</span>
			<span class="toast__message">{t.message}</span>
			<button class="toast__dismiss" onclick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
		</output>
	{/each}
</div>

<style>
	.toast-stack {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 9999;
		display: flex;
		flex-direction: column-reverse;
		gap: 0.5rem;
		max-width: 380px;
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		background: var(--color-bg-raised);
		border: 1px solid var(--color-line);
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px rgb(0 0 0 / 0.3);
		pointer-events: auto;
		animation: ds-slide-in-up 200ms var(--ease-out);
	}

	.toast--success { border-color: var(--color-success); }
	.toast--error { border-color: var(--color-danger); }
	.toast--warning { border-color: var(--color-warning); }
	.toast--info { border-color: var(--color-info); }

	.toast__icon {
		flex-shrink: 0;
		width: 1.2rem;
		text-align: center;
	}
	.toast--success .toast__icon { color: var(--color-success); }
	.toast--error .toast__icon { color: var(--color-danger); }
	.toast--warning .toast__icon { color: var(--color-warning); }
	.toast--info .toast__icon { color: var(--color-info); }

	.toast__message {
		flex: 1;
		color: var(--color-fg);
	}

	.toast__dismiss {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-fg-dim);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.25rem;
		border-radius: 4px;
	}
	.toast__dismiss:hover {
		color: var(--color-fg);
		background: rgb(from var(--color-fg) r g b / 0.1);
	}
</style>
