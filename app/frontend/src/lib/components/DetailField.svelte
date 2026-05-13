<script lang="ts">
	interface Props {
		label: string;
		value: string;
		mono?: boolean;
	}

	let { label, value, mono = false }: Props = $props();
</script>

<div class="field">
	<span class="field__label mono-label">{label}</span>
	<span class="field__val" class:mono>{value}</span>
</div>

<style>
	.field__val {
		display: block;
		font-size: 0.92rem;
		color: var(--color-fg);
		margin-top: 2px;
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		word-break: break-all;
	}
</style>
