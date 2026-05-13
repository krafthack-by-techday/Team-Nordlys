<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string };

	interface Props {
		options: Option[];
		value: T;
		onchange: (value: T) => void;
		size?: 'md' | 'sm' | 'xs';
	}

	let { options, value, onchange, size = 'sm' }: Props = $props();
</script>

<div class="seg glass--controls seg--{size}">
	{#each options as opt (opt.value)}
		<button
			class="seg__btn"
			class:active={value === opt.value}
			onclick={() => onchange(opt.value)}
		>
			{opt.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: flex;
		gap: 2px;
		border-radius: 4px;
		padding: 3px;
	}
	.seg__btn {
		font-family: var(--font-mono);
		text-transform: uppercase;
		border: 1px solid transparent;
		border-radius: 3px;
		background: none;
		color: var(--color-fg-dim);
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s,
			border-color 0.15s;
		letter-spacing: 0.08em;
	}
	.seg--xs .seg__btn {
		padding: 4px 8px;
		font-size: 0.62rem;
	}
	.seg--sm .seg__btn {
		padding: 5px 11px;
		font-size: 0.68rem;
	}
	.seg--md .seg__btn {
		padding: 9px 16px;
		font-size: 0.78rem;
		letter-spacing: 0.1em;
	}
	.seg__btn:hover {
		color: var(--color-fg);
		background: rgb(from var(--color-aurora-mint) r g b / 0.06);
	}
	.seg__btn.active {
		color: var(--color-aurora-mint);
		border-color: var(--color-aurora-mint);
		background: rgb(from var(--color-aurora-mint) r g b / 0.08);
	}
</style>
