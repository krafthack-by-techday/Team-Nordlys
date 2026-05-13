<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SectionLabel from '$lib/components/SectionLabel.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import type { Column } from '$lib/components/datatable.types';
	import { mapError } from '$lib/utils/errors';
	import { timeAgo } from '$lib/utils/time';
	import { m } from '$lib/paraglide/messages.js';
	import type { PeerWithStatus } from '$lib/api/types';

	type ListedInvite = {
		token_prefix: string;
		company: string;
		status: 'pending' | 'consumed' | 'expired';
		created_at: string;
		expires_at: string;
		used_at: string | null;
		used_by: string | null;
	};

	let isHub = $derived(page.data.stats?.role === 'kraftcert');

	// ── Approve access-request ──
	let accessRequestRaw = $state('');
	let approveError = $state('');
	let approveLoading = $state(false);
	let approvedToken = $state('');
	let approvedCompany = $state('');
	let approvedExpires = $state('');

	async function approveAccessRequest() {
		approveError = '';
		approvedToken = '';
		approveLoading = true;
		try {
			const parsed = JSON.parse(accessRequestRaw.trim());
			const resp = await fetch('/api/v1/access-requests/approve', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(parsed)
			});
			const data = await resp.json();
			if (!resp.ok) {
				approveError = mapError(data.error);
				return;
			}
			approvedToken = data.token;
			approvedCompany = data.company ?? parsed.company ?? '';
			approvedExpires = data.expires_at ?? '';
			accessRequestRaw = '';
			await loadInvites();
		} catch (e) {
			approveError = e instanceof SyntaxError
				? m.peers_error_invalid_json()
				: m.error_server_unreachable();
		} finally {
			approveLoading = false;
		}
	}

	// ── Active peers + revoke ──
	let peers = $state<PeerWithStatus[]>([]);
	let peersError = $state('');

	let revokeTarget = $state<PeerWithStatus | null>(null);
	let revokeReason = $state('');
	let revokeError = $state('');
	let revokeLoading = $state(false);

	async function loadPeers() {
		try {
			const resp = await fetch('/api/v1/peers');
			peers = resp.ok ? await resp.json() : [];
		} catch {
			peersError = m.peers_error_load_peers();
		}
	}

	async function confirmRevoke() {
		if (!revokeTarget) return;
		revokeError = '';
		revokeLoading = true;
		try {
			const resp = await fetch('/api/v1/revoke', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					node_id: revokeTarget.node_id,
					company: revokeTarget.company,
					reason: revokeReason.trim() || undefined
				})
			});
			if (!resp.ok) {
				const data = await resp.json();
				revokeError = mapError(data.error);
				return;
			}
			revokeTarget = null;
			revokeReason = '';
			await loadPeers();
		} catch {
			revokeError = m.error_server_unreachable();
		} finally {
			revokeLoading = false;
		}
	}

	// ── Issued invites ──
	let invites = $state<ListedInvite[]>([]);
	let invitesError = $state('');

	async function loadInvites() {
		try {
			const resp = await fetch('/api/v1/invites');
			invites = resp.ok ? await resp.json() : [];
		} catch {
			invitesError = m.peers_error_load_invites();
		}
	}

	function inviteStatusClass(s: ListedInvite['status']): string {
		return s === 'pending'
			? 'badge badge--xs badge--status-pending'
			: s === 'consumed'
				? 'badge badge--xs badge--status-active'
				: 'badge badge--xs badge--status-revoked';
	}

	function inviteStatusLabel(s: ListedInvite['status']): string {
		return s === 'pending'
			? m.peers_invite_status_pending()
			: s === 'consumed'
				? m.peers_invite_status_consumed()
				: m.peers_invite_status_expired();
	}

	let peerColumns = $derived<Column<PeerWithStatus>[]>([
		{ key: 'company', label: m.peers_col_company(), sortable: true },
		{ key: 'node_id', label: m.peers_col_node_id(), sortable: true, cellClass: 'table__cell--mono' },
		{ key: 'last_seen_at', label: m.peers_col_last_seen(), sortable: true, searchable: false },
		{ key: '_actions', label: '', searchable: false }
	]);

	let inviteColumns = $derived<Column<ListedInvite>[]>([
		{ key: 'company', label: m.peers_col_company(), sortable: true },
		{ key: 'status', label: m.peers_col_status(), sortable: true, searchable: false },
		{ key: 'created_at', label: m.peers_col_created(), sortable: true, searchable: false },
		{ key: 'used_by', label: m.peers_col_used_by(), sortable: true, cellClass: 'table__cell--mono' }
	]);

	let pendingInvites = $derived(invites.filter((i) => i.status === 'pending').length);

	onMount(() => {
		if (!isHub) return;
		loadPeers();
		loadInvites();
		const iv = setInterval(loadPeers, 30000);
		return () => clearInterval(iv);
	});
</script>

<section class="peers-admin">
	{#if !isHub}
		<p class="field__hint">{m.peers_only_kraftcert()}</p>
	{:else}
		<!-- KPI strip -->
		<div class="card-grid">
			<KpiCard label={m.peers_kpi_active()} value={peers.length} accent="arctic" />
			<KpiCard
				label={m.peers_kpi_active_invites()}
				value={pendingInvites}
				accent="lichen"
				tone={pendingInvites > 0 ? 'warning' : 'default'}
			/>
			<KpiCard label={m.peers_kpi_total_issued()} value={invites.length} accent="mint" />
		</div>

		<!-- 1. Approve access-request -->
		<SectionLabel label={m.peers_section_approve()} />
		<p class="peers-admin__desc">{m.peers_approve_desc()}</p>
		<div class="field">
			<label class="field__label" for="access-request">{m.peers_label_access_request()}</label>
			<textarea
				class="textarea"
				id="access-request"
				bind:value={accessRequestRaw}
				placeholder={m.peers_placeholder_access_request()}
				rows="8"
			></textarea>
			{#if approveError}
				<span class="field__error">{approveError}</span>
			{/if}
		</div>
		<div>
			<button
				class="btn btn--primary"
				disabled={!accessRequestRaw.trim() || approveLoading}
				onclick={approveAccessRequest}
			>
				{approveLoading ? m.peers_btn_approving() : m.peers_btn_approve()}
			</button>
		</div>
		{#if approvedToken}
			<article class="card card--accent-mint card--compact peers-admin__token-card">
				<div class="card__body">
					<div class="peers-admin__token-meta">
						<span><b>{m.peers_label_company_token()}</b> {approvedCompany}</span>
						{#if approvedExpires}
							<span><b>{m.peers_label_expires_token()}</b> {new Date(approvedExpires).toLocaleString()}</span>
						{/if}
					</div>
					<div class="peers-admin__token-row">
						<code class="peers-admin__token">{approvedToken}</code>
						<CopyButton value={approvedToken} />
					</div>
					<p class="field__hint">{m.peers_token_hint()}</p>
				</div>
			</article>
		{/if}

		<!-- 2. Active peers -->
		<SectionLabel label={m.peers_section_active()} />
		{#if peersError}
			<p class="field__error">{peersError}</p>
		{/if}
		<section class="glass peers-admin__table-section">
			<DataTable
				data={peers}
				columns={peerColumns}
				defaultSortKey="last_seen_at"
				defaultSortDir="descending"
				searchPlaceholder={m.peers_search_placeholder()}
				pageSize={0}
				emptyMessage={m.peers_empty()}
				dense
			>
				{#snippet cell(row, col)}
					{#if col.key === 'last_seen_at'}
						{timeAgo(row.last_seen_at)}
					{:else if col.key === '_actions'}
						<button
							class="btn btn--danger btn--sm"
							onclick={() => { revokeTarget = row; revokeReason = ''; revokeError = ''; }}
						>{m.peers_btn_revoke()}</button>
					{:else if col.key === 'node_id'}
						{row.node_id}
					{:else if col.key === 'company'}
						{row.company}
					{/if}
				{/snippet}
			</DataTable>
		</section>

		<!-- 3. Issued invites -->
		<SectionLabel label={m.peers_section_invites()} />
		{#if invitesError}
			<p class="field__error">{invitesError}</p>
		{/if}
		<section class="glass peers-admin__table-section">
			<DataTable
				data={invites}
				columns={inviteColumns}
				defaultSortKey="created_at"
				defaultSortDir="descending"
				searchPlaceholder={m.peers_invites_search()}
				pageSize={0}
				emptyMessage={m.peers_invites_empty()}
				dense
			>
				{#snippet cell(row, col)}
					{#if col.key === 'status'}
						<span class={inviteStatusClass(row.status)}>
							<span class="badge__dot"></span>
							{inviteStatusLabel(row.status)}
						</span>
					{:else if col.key === 'created_at'}
						{timeAgo(row.created_at)}
					{:else if col.key === 'used_by'}
						{row.used_by ?? '—'}
					{:else if col.key === 'company'}
						{row.company}
					{/if}
				{/snippet}
			</DataTable>
		</section>
	{/if}
</section>

<Dialog
	open={revokeTarget !== null}
	onclose={() => { revokeTarget = null; revokeReason = ''; revokeError = ''; }}
	title={m.peers_revoke_dialog_title()}
	width="default"
	danger
>
	{#if revokeTarget}
		<p><b>{revokeTarget.company}</b> (<code>{revokeTarget.node_id}</code>)</p>
		<p class="field__hint">{m.peers_revoke_dialog_warning()}</p>
		<div class="field">
			<label class="field__label" for="revoke-reason">{m.peers_revoke_label_reason()}</label>
			<input
				type="text"
				class="input"
				id="revoke-reason"
				bind:value={revokeReason}
				placeholder={m.peers_revoke_placeholder_reason()}
			/>
			{#if revokeError}
				<span class="field__error">{revokeError}</span>
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		<button class="btn btn--ghost" onclick={() => { revokeTarget = null; }}>{m.peers_revoke_btn_cancel()}</button>
		<button class="btn btn--danger" disabled={revokeLoading} onclick={confirmRevoke}>
			{revokeLoading ? m.peers_revoke_btn_confirming() : m.peers_revoke_btn_confirm()}
		</button>
	{/snippet}
</Dialog>

<style>
	/* Outer rhythm comes from settings__content's :global(> section).
	   Override here for tighter form-field spacing within the page. */
	.peers-admin {
		gap: var(--space-md);
	}
	.peers-admin__desc {
		color: var(--color-fg-dim);
		font-size: 0.85rem;
		margin: 0;
		line-height: 1.5;
	}
	.peers-admin__table-section {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.peers-admin__token-card { margin-top: var(--space-sm); }
	.peers-admin__token-meta {
		display: flex;
		gap: var(--space-md);
		font-size: 0.85rem;
		color: var(--color-fg);
		margin-bottom: var(--space-sm);
	}
	.peers-admin__token-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
	}
	.peers-admin__token {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		word-break: break-all;
		padding: var(--space-sm);
		background: var(--color-bg-sunken);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
	}
</style>
