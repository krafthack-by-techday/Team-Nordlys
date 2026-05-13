<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Generic reusable dialog component wrapping the native <dialog> element.
	 * Uses style-kit's .dialog classes. Handles open/close reactivity,
	 * backdrop click dismiss, and ESC key (native browser behaviour).
	 *
	 * Usage:
	 *   <Dialog open={showDialog} onclose={() => showDialog = false} width="wide" title="Confirm">
	 *     <p>Are you sure?</p>
	 *     {#snippet footer()}
	 *       <button class="btn" onclick={() => showDialog = false}>Cancel</button>
	 *     {/snippet}
	 *   </Dialog>
	 */

	interface Props {
		/** Controls visibility. When true, dialog opens via showModal(). */
		open: boolean;
		/** Called when the dialog is closed (ESC, backdrop, or programmatic). */
		onclose: () => void;
		/** Dialog width variant. */
		width?: 'narrow' | 'default' | 'wide' | 'xl';
		/** Whether to show a danger accent (red top border). */
		danger?: boolean;
		/** Dialog title (rendered as h2). */
		title?: string;
		/** Optional subtitle (mono uppercase). */
		subtitle?: string;
		/** Body content. */
		children: Snippet;
		/** Footer slot (typically action buttons). */
		footer?: Snippet;
	}

	let { open, onclose, width = 'default', danger = false, title, subtitle, children, footer }: Props = $props();

	let dialogEl: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (open && dialogEl && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl?.open) {
			dialogEl.close();
		}
	});

	function handleClose() {
		onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) {
			dialogEl?.close();
		}
	}

	const widthClass = $derived(width === 'default' ? '' : `dialog--${width}`);
</script>

<dialog
	class="dialog {widthClass}"
	class:dialog--danger={danger}
	bind:this={dialogEl}
	onclose={handleClose}
	oncancel={handleClose}
	onclick={handleBackdropClick}
>
	<div class="dialog__form">
		{#if title}
			<header class="dialog__header">
				<div>
					<h2 class="dialog__title">{title}</h2>
					{#if subtitle}
						<p class="dialog__subtitle">{subtitle}</p>
					{/if}
				</div>
				<button class="dialog__close" type="button" onclick={handleClose} aria-label="Close">
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M4 4l8 8M12 4l-8 8" />
					</svg>
				</button>
			</header>
		{/if}

		<div class="dialog__body scroll-thin">
			{@render children()}
		</div>

		{#if footer}
			<footer class="dialog__footer">
				{@render footer()}
			</footer>
		{/if}
	</div>
</dialog>
