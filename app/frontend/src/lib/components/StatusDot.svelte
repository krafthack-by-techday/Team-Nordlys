<script lang="ts">
	type Status = 'online' | 'offline' | 'revoked';

	interface Props {
		status?: Status;
		/** Size in pixels */
		size?: number;
		/** Animate pulse */
		pulse?: boolean;
	}

	let { status = 'online', size = 8, pulse = true }: Props = $props();
</script>

<span
	class="dot"
	class:online={status === 'online'}
	class:offline={status === 'offline'}
	class:revoked={status === 'revoked'}
	class:pulse
	style:width="{size}px"
	style:height="{size}px"
></span>

<style>
	.dot {
		display: inline-block;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--color-fg-dim);
	}
	.online {
		background: var(--color-success);
		box-shadow: 0 0 6px var(--color-success);
	}
	.online.pulse {
		animation: dot-pulse 2.4s ease-in-out infinite;
	}
	.offline {
		background: var(--color-line-hi);
		box-shadow: none;
	}
	.revoked {
		background: var(--color-danger);
		box-shadow: 0 0 6px var(--color-danger-dim);
	}
	@keyframes dot-pulse {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.3);
		}
	}
</style>
