<script lang="ts">
	/**
	 * TLP (Traffic Light Protocol) badge.
	 * Renders a styled badge for TLP classification levels.
	 *
	 * Usage:
	 *   <TlpBadge tlp="AMBER" />
	 */

	interface Props {
		tlp: 'RED' | 'AMBER' | 'GREEN' | 'CLEAR' | 'WHITE';
		size?: 'xs' | 'sm' | 'md' | 'lg';
	}

	let { tlp, size }: Props = $props();

	const normalized = $derived(tlp === 'WHITE' ? 'clear' : tlp.toLowerCase());
	const sizeClass = $derived(size && size !== 'md' ? `badge--${size}` : '');
</script>

<span class="badge badge--tlp-{normalized} {sizeClass}">TLP:{tlp}</span>
