<script lang="ts">
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import DetailField from '$lib/components/DetailField.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<section class="about">
	<SectionLabel label="Nordlys" />
	<div class="about__fields">
		<DetailField label={m.about_label_version()} value="0.2.0" />
		<DetailField label={m.about_label_runtime()} value="Bun + Elysia + SvelteKit" />
		<div class="field">
			<span class="field__label mono-label">{m.about_label_repository()}</span>
			<a
				class="about__repo-link"
				href="https://github.com/krafthack-by-techday/Team-Nordlys"
				target="_blank"
				rel="noopener"
			>github.com/krafthack-by-techday/Team-Nordlys ↗</a>
		</div>
	</div>

	<SectionLabel label={m.about_label_license()} />
	<p class="about__text">
		{m.about_text()}
	</p>
</section>

<style>
	.about__fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.about__text {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		margin: 0;
		line-height: 1.5;
	}
	.about__repo-link {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--color-aurora-arctic);
		text-decoration: none;
		margin-top: 2px;
	}
	.about__repo-link:hover {
		text-decoration: underline;
	}
</style>
