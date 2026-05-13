<script lang="ts">
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import { m } from '$lib/paraglide/messages.js';
</script>

<section class="auth-settings">
	<SectionLabel label={m.auth_section_local()} />
	<p class="auth-settings__desc">
		{m.auth_local_desc()}
	</p>
	<p class="field__hint auth-settings__placeholder">{m.auth_local_placeholder()}</p>

	<SectionLabel label={m.auth_section_oidc()} />
	<p class="auth-settings__desc">
		{m.auth_oidc_desc()}
	</p>
	<div class="field">
		<label class="field__label" for="oidc-client-id">{m.auth_label_client_id()}</label>
		<input type="text" id="oidc-client-id" class="input" placeholder={m.auth_placeholder_unconfigured()} disabled />
	</div>
	<div class="field">
		<label class="field__label" for="oidc-tenant-id">{m.auth_label_tenant_id()}</label>
		<input type="text" id="oidc-tenant-id" class="input" placeholder={m.auth_placeholder_unconfigured()} disabled />
	</div>
	<p class="field__hint auth-settings__placeholder">{m.auth_oidc_placeholder()}</p>
</section>

<style>
	.auth-settings__desc {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		margin: 0;
	}
	.auth-settings__placeholder {
		font-style: italic;
	}
</style>
