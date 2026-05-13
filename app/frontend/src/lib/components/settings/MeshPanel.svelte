<script lang="ts">
	import { page } from '$app/state';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { mapError } from '$lib/utils/errors';
	import { m } from '$lib/paraglide/messages.js';

	let isHub = $derived(page.data.stats?.role === 'kraftcert');

	let inviteToken = $state('');
	let registerError = $state('');
	let registerSuccess = $state(false);
	let loading = $state(false);

	let contactName = $state('');
	let contactEmail = $state('');
	let contactPhone = $state('');
	let accessRequest = $state('');

	let inviteCompany = $state('');
	let generatedInvite = $state('');
	let inviteError = $state('');

	async function generateAccessRequest() {
		try {
			const resp = await fetch('/api/v1/access-request', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					contact: {
						name: contactName,
						email: contactEmail,
						phone: contactPhone || undefined
					}
				})
			});
			const data = await resp.json();
			accessRequest = JSON.stringify(data, null, 2);
		} catch {
			accessRequest = m.mesh_error_request_gen();
		}
	}

	async function redeemInvite() {
		loading = true;
		registerError = '';
		try {
			const resp = await fetch('/api/v1/register', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: inviteToken.trim() })
			});
			if (!resp.ok) {
				const data = await resp.json();
				registerError = mapError(data.error);
				return;
			}
			registerSuccess = true;
		} catch {
			registerError = m.error_server_unreachable();
		} finally {
			loading = false;
		}
	}

	async function generateInviteToken() {
		inviteError = '';
		generatedInvite = '';
		try {
			const resp = await fetch('/api/v1/invites', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ company: inviteCompany.trim() })
			});
			if (!resp.ok) {
				const data = await resp.json();
				inviteError = mapError(data.error);
				return;
			}
			const data = await resp.json();
			generatedInvite = data.token;
		} catch {
			inviteError = m.error_server_unreachable();
		}
	}
</script>

<section class="mesh-settings">
	{#if isHub}
		<SectionLabel label={m.mesh_section_hub()} />
		<p class="mesh-settings__desc">{m.mesh_hub_desc()}</p>
		<a href="/dashboard/settings#peers" class="btn btn--primary mesh-settings__cta">
			{m.mesh_hub_cta()}
		</a>

		<SectionLabel label={m.mesh_section_manual_invite()} />
		<p class="mesh-settings__desc">{m.mesh_manual_invite_desc()}</p>
		<div class="field">
			<label class="field__label" for="invite-company">{m.mesh_label_org()}</label>
			<input
				type="text"
				id="invite-company"
				class="input"
				bind:value={inviteCompany}
				placeholder={m.mesh_placeholder_org()}
			/>
			{#if inviteError}
				<span class="field__error">{inviteError}</span>
			{/if}
		</div>
		<div>
			<button
				class="btn btn--secondary"
				disabled={!inviteCompany.trim()}
				onclick={generateInviteToken}
			>
				{m.mesh_btn_generate_invite()}
			</button>
		</div>

		{#if generatedInvite}
			<article class="card card--accent-mint card--compact">
				<div class="card__body mesh-settings__code-row">
					<code class="mesh-settings__code">{generatedInvite}</code>
					<CopyButton value={generatedInvite} />
				</div>
			</article>
			<p class="field__hint">{m.mesh_invite_hint()}</p>
		{/if}
	{:else}
		<SectionLabel label={m.mesh_section_access_request()} />
		<p class="mesh-settings__desc">{m.mesh_access_request_desc()}</p>

		<div class="field">
			<label class="field__label field__label--required" for="contact-name">{m.mesh_label_contact_name()}</label>
			<input type="text" id="contact-name" class="input" bind:value={contactName} placeholder={m.mesh_placeholder_contact_name()} />
		</div>
		<div class="field">
			<label class="field__label field__label--required" for="contact-email">{m.mesh_label_email()}</label>
			<input type="email" id="contact-email" class="input" bind:value={contactEmail} placeholder={m.mesh_placeholder_email()} />
		</div>
		<div class="field">
			<label class="field__label" for="contact-phone">{m.mesh_label_phone()}</label>
			<input type="tel" id="contact-phone" class="input" bind:value={contactPhone} placeholder={m.mesh_placeholder_phone()} />
		</div>
		<div>
			<button
				class="btn btn--primary"
				disabled={!contactName || !contactEmail}
				onclick={generateAccessRequest}
			>
				{m.mesh_btn_generate_request()}
			</button>
		</div>

		{#if accessRequest}
			<article class="card card--compact">
				<div class="card__body mesh-settings__code-row">
					<pre class="mesh-settings__pre">{accessRequest}</pre>
					<CopyButton value={accessRequest} />
				</div>
			</article>
			<p class="field__hint">{m.mesh_request_hint()}</p>
		{/if}

		<SectionLabel label={m.mesh_section_redeem()} />
		<p class="mesh-settings__desc">{m.mesh_redeem_desc()}</p>

		{#if registerSuccess}
			<article class="card card--accent-mint card--compact">
				<div class="card__body mesh-settings__success">
					{m.mesh_redeem_success()}
				</div>
			</article>
		{:else}
			<div class="field-group">
				<input
					type="text"
					class="input"
					bind:value={inviteToken}
					placeholder={m.mesh_placeholder_invite_token()}
				/>
				<button
					class="btn btn--primary"
					disabled={!inviteToken.trim() || loading}
					onclick={redeemInvite}
				>
					{loading ? m.mesh_btn_redeeming() : m.mesh_btn_redeem()}
				</button>
			</div>
			{#if registerError}
				<p class="field__error">{registerError}</p>
			{/if}
		{/if}
	{/if}
</section>

<style>
	.mesh-settings__desc {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		margin: 0;
		line-height: 1.5;
	}
	.mesh-settings__cta {
		align-self: flex-start;
		text-decoration: none;
	}
	.mesh-settings__code-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
	}
	.mesh-settings__code,
	.mesh-settings__pre {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		word-break: break-all;
		margin: 0;
		white-space: pre-wrap;
	}
	.mesh-settings__success {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-aurora-mint);
	}
</style>
