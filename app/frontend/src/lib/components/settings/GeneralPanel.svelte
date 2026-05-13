<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import DetailField from '$lib/components/DetailField.svelte';
	import { mapError } from '$lib/utils/errors';
	import { m } from '$lib/paraglide/messages.js';

	let stats = $derived(page.data.stats);

	let nodeName = $state('');
	let initialNodeName = $state('');
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state('');

	async function loadSettings() {
		try {
			const resp = await fetch('/api/v1/settings');
			if (!resp.ok) return;
			const data = (await resp.json()) as Record<string, string>;
			nodeName = data.node_name ?? '';
			initialNodeName = nodeName;
		} catch {
			// silent — input stays empty
		}
	}

	async function saveNodeName() {
		const trimmed = nodeName.trim();
		if (trimmed === initialNodeName) return;
		saveStatus = 'saving';
		saveError = '';
		try {
			const resp = await fetch('/api/v1/settings/node_name', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ value: trimmed })
			});
			if (!resp.ok) {
				const data = await resp.json().catch(() => ({}));
				saveError = mapError(data.error);
				saveStatus = 'error';
				return;
			}
			initialNodeName = trimmed;
			saveStatus = 'saved';
			setTimeout(() => { if (saveStatus === 'saved') saveStatus = 'idle'; }, 2000);
		} catch {
			saveError = m.error_server_unreachable();
			saveStatus = 'error';
		}
	}

	onMount(loadSettings);
</script>

<section class="general">
	<SectionLabel label={m.general_section_identity()} />
	<p class="general__desc">
		{m.general_identity_desc()}
	</p>
	<div class="general__identity">
		<DetailField label={m.general_label_node_id()} value={stats?.node_id ?? '—'} mono />
		<DetailField label={m.general_label_company()} value={stats?.company ?? '—'} />
		<DetailField label={m.general_label_role()} value={stats?.role ?? '—'} mono />
	</div>

	<SectionLabel label={m.general_section_display_name()} />
	<div class="field">
		<label class="field__label" for="node-name">{m.general_label_node_name()}</label>
		<input
			type="text"
			id="node-name"
			class="input"
			bind:value={nodeName}
			onblur={saveNodeName}
			placeholder={m.general_placeholder_node_name()}
		/>
		{#if saveStatus === 'error'}
			<span class="field__error">{saveError}</span>
		{:else if saveStatus === 'saving'}
			<span class="field__hint">{m.general_status_saving()}</span>
		{:else if saveStatus === 'saved'}
			<span class="field__hint general__saved">{m.general_status_saved()}</span>
		{:else}
			<span class="field__hint">{m.general_node_name_hint()}</span>
		{/if}
	</div>
</section>

<style>
	.general__desc {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		margin: 0;
		line-height: 1.5;
	}
	.general__identity {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-md);
	}
	.general__saved {
		color: var(--color-aurora-mint);
	}
</style>
