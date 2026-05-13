<script lang="ts">
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<section class="integrations">
	<SectionLabel label={m.integrations_section_apikeys()} />
	<p class="integrations__desc">
		{m.integrations_apikeys_desc()}
	</p>
	<p class="field__hint integrations__placeholder">{m.integrations_apikeys_placeholder()}</p>

	<SectionLabel label={m.integrations_section_docs()} />
	<p class="integrations__desc">
		{m.integrations_docs_desc()}
	</p>
	<div>
		<a href="/api/openapi/" target="_blank" rel="noopener" class="btn btn--secondary">
			{m.integrations_docs_link()} ↗
		</a>
	</div>
</section>

<style>
	.integrations__desc {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		margin: 0;
		line-height: 1.5;
	}
	.integrations__placeholder {
		font-style: italic;
	}
</style>
