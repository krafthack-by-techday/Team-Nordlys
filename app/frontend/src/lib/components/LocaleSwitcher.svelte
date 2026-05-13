<script lang="ts">
	import { getLocale, setLocale, locales } from '$lib/paraglide/runtime';

	const localeLabel: Record<string, string> = { en: 'EN', 'nb-NO': 'NO' };
	let currentLocale = $derived(getLocale());
</script>

<div class="locale-switcher">
	{#each locales as locale (locale)}
		<button
			type="button"
			class="locale-switcher__btn"
			class:active={locale === currentLocale}
			onclick={() => setLocale(locale)}
			aria-pressed={locale === currentLocale}
		>{localeLabel[locale] ?? locale}</button>
	{/each}
</div>

<style>
	.locale-switcher {
		display: flex;
		gap: 2px;
	}
	.locale-switcher__btn {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		color: var(--color-fg-dim);
		background: none;
		border: none;
		padding: 4px 8px;
		border-radius: 3px;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.15s ease;
	}
	.locale-switcher__btn:hover {
		opacity: 1;
		color: var(--color-fg);
		background: rgb(from var(--color-aurora-arctic) r g b / 0.08);
	}
	.locale-switcher__btn.active {
		opacity: 1;
		color: var(--color-aurora-arctic);
	}
</style>
