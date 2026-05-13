<script lang="ts">
	interface Props {
		label: string;
	}

	let { label }: Props = $props();
</script>

<div class="section-label mono-label">{label}</div>

<style>
	.section-label {
		padding-bottom: 4px;
		border-bottom: 1px solid var(--color-line);
		margin-top: 2px;
	}
</style>
