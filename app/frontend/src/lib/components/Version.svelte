<script lang="ts">
	import { version } from '$app/environment';

	interface Props {
		/** Optional class to add for layout/positioning. */
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<span class="version {className}" title="Nordlys version">v{version}</span>

<style>
	.version {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		color: var(--color-fg-dim);
		opacity: 0.5;
	}
</style>
