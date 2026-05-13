<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import InfoTip from './InfoTip.svelte';
	import { severityBadge, statusBadge, statusLabel } from '$lib/utils/vuln';
	import { fmtDateTime } from '$lib/utils/format';
	import type { Vulnerability, VulnChangelogEntry } from '$lib/api/types';

	interface Props {
		vuln: Vulnerability | null;
		onclose: () => void;
	}

	let { vuln, onclose }: Props = $props();
	let dialogEl: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (vuln && dialogEl) {
			dialogEl.showModal();
		} else if (!vuln && dialogEl?.open) {
			dialogEl.close();
		}
	});

	function handleClose() {
		onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) {
			dialogEl?.close();
		}
	}

	function actionLabel(action: VulnChangelogEntry['action']): string {
		switch (action) {
			case 'initial_import': return m.vuln_changelog_initial();
			case 'merge_high_trust': return m.vuln_changelog_merge_high();
			case 'merge_low_trust': return m.vuln_changelog_merge_low();
			case 'manual_edit': return m.vuln_changelog_manual();
			case 'status_change': return m.vuln_changelog_status();
			default: return action;
		}
	}

	function actionIcon(action: VulnChangelogEntry['action']): string {
		switch (action) {
			case 'initial_import': return '⊕';
			case 'merge_high_trust': return '⇑';
			case 'merge_low_trust': return '⇣';
			case 'manual_edit': return '✎';
			case 'status_change': return '◉';
			default: return '•';
		}
	}
</script>

<dialog
	class="dialog dialog--xl"
	bind:this={dialogEl}
	onclose={handleClose}
	oncancel={handleClose}
	onclick={handleBackdropClick}
>
	{#if vuln}
		<form method="dialog" class="dialog__form">
			<header class="dialog__header">
				<div>
					<h2 class="dialog__title">{vuln.title}</h2>
					{#if vuln.advisory_id}
						<p class="dialog__subtitle">{vuln.advisory_id}</p>
					{/if}
				</div>
			</header>

			<div class="dialog__body scroll-thin">
				<!-- Severity + Status row -->
				<div class="detail-row detail-row--badges">
					<span class={severityBadge(vuln.severity)}>
						{vuln.severity.toUpperCase()} · CVSS {vuln.cvss_score.toFixed(1)}
					</span>
					<span class={statusBadge(vuln.status)}>
						{statusLabel(vuln.status)}
					</span>
					{#if vuln.tlp}
						<span class="badge badge--sm badge--tlp-{vuln.tlp.toLowerCase()}">TLP:{vuln.tlp}</span>
					{/if}
				</div>

				<!-- CVE + Source -->
				<div class="detail-section">
					<h3 class="detail-label">{m.vuln_detail_identification()}</h3>
					<dl class="detail-grid">
						<dt>CVE</dt>
						<dd><code>{vuln.cve_id || '—'}</code></dd>
						<dt>{m.vuln_detail_source()}</dt>
						<dd>{vuln.source ?? 'unknown'}</dd>
						<dt>{m.vuln_detail_signed_by()}</dt>
						<dd><code>{vuln.signed_by ?? '—'}</code></dd>
						<dt>{m.vuln_detail_local_version()}<InfoTip text={m.vuln_tip_local_version()} /></dt>
						<dd>v{vuln.version ?? 1}</dd>
					</dl>
				</div>

				<!-- Description -->
				<div class="detail-section">
					<h3 class="detail-label">{m.vuln_detail_description()}</h3>
					<p class="detail-desc">{vuln.description || '—'}</p>
				</div>

				<!-- Affected products -->
				{#if vuln.affected_products?.length}
					<div class="detail-section">
						<h3 class="detail-label">{m.vuln_detail_affected()}</h3>
						<table class="table table--dense table--zebra">
							<thead>
								<tr>
									<th>{m.vuln_detail_product()}</th>
									<th>{m.vuln_detail_version()}</th>
								</tr>
							</thead>
							<tbody>
								{#each vuln.affected_products as ap}
									<tr>
										<td class="table__cell--mono">{ap.product}</td>
										<td>{ap.version}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<!-- Timestamps -->
				<div class="detail-section">
					<dl class="detail-grid">
						<dt>{m.vuln_detail_discovered()}</dt>
						<dd>{fmtDateTime(vuln.created_at)}</dd>
						<dt>{m.vuln_detail_last_updated()}</dt>
						<dd>{fmtDateTime(vuln.updated_at)}</dd>
						{#if vuln.updated_by}
							<dt>{m.vuln_detail_updated_by()}</dt>
							<dd><code>{vuln.updated_by}</code></dd>
						{/if}
					</dl>
				</div>

				<!-- Reference -->
				{#if vuln.reference_url}
					<div class="detail-section">
						<h3 class="detail-label">{m.vuln_detail_reference()}</h3>
						<a class="detail-link" href={vuln.reference_url} target="_blank" rel="noopener">
							{vuln.reference_url}
						</a>
					</div>
				{/if}

				<!-- Changelog -->
				{#if vuln.changelog?.length}
					<div class="detail-section">
						<h3 class="detail-label">{m.vuln_changelog_title()}<InfoTip text={m.vuln_changelog_tip()} /></h3>
						<ol class="timeline">
							{#each vuln.changelog.toReversed() as entry, idx}
								<li class="timeline__item" class:timeline__item--first={idx === 0}>
									<div class="timeline__marker">
										<span class="timeline__dot">{actionIcon(entry.action)}</span>
										{#if idx < (vuln.changelog?.length ?? 0) - 1}
											<span class="timeline__line"></span>
										{/if}
									</div>
									<div class="timeline__body">
										<div class="timeline__header">
											<span class="timeline__action">{actionLabel(entry.action)}</span>
											<span class="timeline__meta">v{entry.version} · {entry.source} · trust {entry.source_trust}</span>
										</div>
										{#if entry.changes.length}
											<ul class="timeline__changes">
												{#each entry.changes as change}
													<li>
														<code class="timeline__field">{change.field}</code>
														{#if change.old_value}
															<span class="timeline__old">{change.old_value}</span>
															<span class="timeline__arrow">→</span>
														{/if}
														<span class="timeline__new">{change.new_value ?? '—'}</span>
													</li>
												{/each}
											</ul>
										{/if}
										{#if entry.note}
											<p class="timeline__note">{entry.note}</p>
										{/if}
										<time class="timeline__time">{fmtDateTime(entry.timestamp)}</time>
									</div>
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</div>

			<footer class="dialog__footer">
				<button type="submit" value="close" class="btn btn--ghost">{m.vuln_detail_close()}</button>
			</footer>
		</form>
	{/if}
</dialog>

<style>
	.detail-row--badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}
	.detail-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.detail-label {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		margin: 0;
	}
	.detail-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 1.4rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		margin: 0;
	}
	.detail-grid dt {
		color: var(--color-fg-dim);
		font-weight: 500;
	}
	.detail-grid dd {
		color: var(--color-fg);
		margin: 0;
	}
	.detail-grid code {
		color: var(--color-aurora-arctic);
	}
	.detail-desc {
		font-size: 0.85rem;
		color: var(--color-fg);
		line-height: 1.6;
		margin: 0;
	}
	.detail-link {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-aurora-mint);
		text-decoration: none;
		word-break: break-all;
	}
	.detail-link:hover {
		text-decoration: underline;
	}

	/* Timeline */
	.timeline {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.timeline__item {
		display: flex;
		gap: 0.75rem;
		position: relative;
	}
	.timeline__marker {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
		width: 1.4rem;
	}
	.timeline__dot {
		width: 1.4rem;
		height: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		color: var(--color-aurora-mint);
		background: rgb(from var(--color-aurora-mint) r g b / 0.1);
		border: 1px solid rgb(from var(--color-aurora-mint) r g b / 0.3);
		border-radius: 50%;
		flex-shrink: 0;
	}
	.timeline__item--first .timeline__dot {
		background: rgb(from var(--color-aurora-mint) r g b / 0.2);
		border-color: var(--color-aurora-mint);
		box-shadow: 0 0 8px rgb(from var(--color-aurora-mint) r g b / 0.3);
	}
	.timeline__line {
		width: 1px;
		flex: 1;
		min-height: 1rem;
		background: var(--color-line-hi);
		margin: 0.25rem 0;
	}
	.timeline__body {
		flex: 1;
		min-width: 0;
		padding-bottom: 1rem;
	}
	.timeline__header {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.timeline__action {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-fg);
	}
	.timeline__meta {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-fg-dim);
	}
	.timeline__changes {
		list-style: none;
		padding: 0;
		margin: 0.35rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}
	.timeline__changes li {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.timeline__field {
		color: var(--color-aurora-arctic);
		font-weight: 500;
	}
	.timeline__old {
		color: var(--color-fg-dim);
		text-decoration: line-through;
		opacity: 0.7;
	}
	.timeline__arrow {
		color: var(--color-fg-dim);
	}
	.timeline__new {
		color: var(--color-fg);
	}
	.timeline__note {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-style: italic;
		color: var(--color-fg-dim);
		margin: 0.25rem 0 0;
	}
	.timeline__time {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-fg-dim);
		opacity: 0.7;
		display: block;
		margin-top: 0.25rem;
	}
</style>
