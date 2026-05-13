<script lang="ts">
	interface Props {
		severity: string;
	}

	let { severity }: Props = $props();

	const cls = $derived(() => {
		const s = severity.toLowerCase();
		if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low') return s;
		return 'low'; // fallback for 'info' etc.
	});
</script>

<span class="badge badge--xs badge--severity-{cls()}">{severity}</span>
