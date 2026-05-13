<script lang="ts">
	import type { Extension, TrustTier, QualityRating } from '$lib/types/extension';
	import Dialog from './Dialog.svelte';
	import InfoTip from './InfoTip.svelte';

	interface Props {
		extension: Extension | null;
		onclose: () => void;
	}

	let { extension, onclose }: Props = $props();

	const trustLabel: Record<TrustTier, string> = {
		'anchor-signed': 'Anchor-signert (KraftCERT)',
		'publisher-signed': 'Publisher-signert'
	};

	const qualityLabel: Record<QualityRating, string> = {
		platinum: 'Platinum — høyeste kvalitet',
		gold: 'Gold — produksjonsklar',
		silver: 'Silver — fungerer, noen mangler',
		bronze: 'Bronze — eksperimentell'
	};

	const trustDesc: Record<TrustTier, string> = {
		'anchor-signed':
			'Signert av KraftCERT som trust anchor. Kode er gjennomgått, kapabiliteter verifisert, og extension er godkjent for bruk i sektoren.',
		'publisher-signed':
			'Signert av publisher med kjent identitet. KraftCERT har attestert publisher, men ikke nødvendigvis gjennomgått koden.'
	};

	const capabilityDesc: Record<string, string> = {
		'event.read': 'Kan lese hendelser fra den lokale noden.',
		'event.publish': 'Kan publisere nye hendelser til meshet på vegne av noden.',
		'indicator.read': 'Kan lese indikatorer (IOC-er) lagret lokalt.',
		'indicator.publish': 'Kan publisere nye indikatorer til meshet.',
		'indicator.enrich': 'Kan berike eksisterende indikatorer med tilleggskontekst.',
		'outbound.http': 'Kan gjøre utgående HTTP-kall til endepunkter deklarert i manifestet. Tillatte mål er fastsatt av utvikler og verifisert ved signering.',
		'report.generate': 'Kan generere rapporter basert på lokal data.',
		'report.export': 'Kan eksportere rapporter til eksterne formater/systemer.',
		'scenario.register': 'Kan registrere deteksjonsscenarier i collector.',
		'vulnerability.publish': 'Kan publisere sårbarheter til lokal database.',
		'device.discover': 'Kan oppdage og registrere enheter på nettverket.',
		'exercise.manage': 'Kan opprette og styre øvelser med simulerte hendelser.',
		'ui.render': 'Kan vise egne UI-elementer i dashboardet.'
	};

	type RiskLevel = 'low' | 'medium' | 'high';

	const capabilityRisk: Record<string, RiskLevel> = {
		'event.read': 'low',
		'indicator.read': 'low',
		'report.generate': 'low',
		'ui.render': 'low',
		'event.publish': 'medium',
		'indicator.publish': 'medium',
		'indicator.enrich': 'medium',
		'vulnerability.publish': 'medium',
		'scenario.register': 'medium',
		'report.export': 'medium',
		'exercise.manage': 'medium',
		'outbound.http': 'high',
		'device.discover': 'high'
	};

	const riskLabel: Record<RiskLevel, string> = {
		low: 'LAV',
		medium: 'MEDIUM',
		high: 'HØY'
	};
</script>

{#if extension}
	<Dialog open={true} {onclose} width="wide" title={extension.name} subtitle={`v${extension.version} · ${extension.author}`}>
		<div class="ext-detail">
			<p class="ext-detail__desc">{extension.description}</p>

			<div class="ext-detail__grid">
				<!-- Trust -->
				<section class="ext-detail__section">
					<h4 class="ext-detail__heading">Tillitsnivå</h4>
					<div class="ext-detail__trust">
						<span class="trust-tier trust--{extension.trustTier}">
							{trustLabel[extension.trustTier]}
						</span>
						<p class="ext-detail__subdesc">{trustDesc[extension.trustTier]}</p>
					</div>
				</section>

				<!-- Quality -->
				<section class="ext-detail__section">
					<h4 class="ext-detail__heading">Kvalitet</h4>
					<span class="quality-tier quality--{extension.qualityRating}">
						{qualityLabel[extension.qualityRating]}
					</span>
				</section>

				<!-- Capabilities -->
				<section class="ext-detail__section">
					<h4 class="ext-detail__heading">Kapabiliteter (tilganger)</h4>
					<ul class="capability-list">
						{#each extension.capabilities as cap}
							<li class="capability-item" class:cap--high={capabilityRisk[cap] === 'high'} class:cap--medium={capabilityRisk[cap] === 'medium'}>
								<div class="cap-header">
									<code>{cap}</code>
									<span class="cap-risk cap-risk--{capabilityRisk[cap] ?? 'low'}">{riskLabel[capabilityRisk[cap] ?? 'low']}</span>
									{#if capabilityDesc[cap]}
										<InfoTip text={capabilityDesc[cap]} />
									{/if}
								</div>
								{#if extension.capabilityJustifications?.[cap]}
									<p class="cap-justification">"{extension.capabilityJustifications[cap]}"</p>
								{/if}
							</li>
						{/each}
					</ul>
					{#if extension.allowedHosts?.length}
						<div class="allowed-hosts">
							<h5 class="allowed-hosts__label">
								<svg class="allowed-hosts__icon" viewBox="0 0 16 16" fill="none"><path d="M11.5 9.5L14 12l-2.5 2.5M4.5 9.5L2 12l2.5 2.5M9 9l-2 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="2" width="12" height="6" rx="1.5" stroke="currentColor" stroke-width="1.2"/><circle cx="5" cy="5" r="1" fill="currentColor"/></svg>
								Tillatte utgående mål
								<InfoTip text="Deklarert av utvikler i manifestet og verifisert ved signering. Noden tillater kun trafikk til disse endepunktene — alt annet blokkeres." />
							</h5>
							<p class="allowed-hosts__note">Deklarert av utvikler i extension-manifestet — kan ikke endres av operatør.</p>
							<ul class="allowed-hosts__list">
								{#each extension.allowedHosts as entry}
									<li class="allowed-hosts__item">
										<span class="allowed-hosts__proto">{entry.protocol}</span>
										<code>{entry.host}:{entry.port}</code>
									</li>
								{/each}
							</ul>
							<p class="allowed-hosts__block-note">⛔ All annen utgående trafikk blokkeres av noden.</p>
						</div>
					{/if}
				</section>

				<!-- TLP ceiling -->
				<section class="ext-detail__section">
					<h4 class="ext-detail__heading">Maks TLP-nivå</h4>
					<span class="badge badge--sm badge--tlp-{extension.maxTlp.toLowerCase()}">TLP:{extension.maxTlp}</span>
					<p class="ext-detail__subdesc">Extension kan ikke se data over dette TLP-nivået.</p>
				</section>

				<!-- Meta -->
				<section class="ext-detail__section">
					<h4 class="ext-detail__heading">Info</h4>
					<dl class="ext-meta">
						<dt>Installert av</dt>
						<dd>{extension.downloads} noder</dd>
						<dt>Sist oppdatert</dt>
						<dd>{extension.updatedAt}</dd>
					</dl>
				</section>
			</div>
		</div>

		{#snippet footer()}
			<div class="ext-detail__actions">
				{#if extension.installed}
					<button class="btn btn--danger btn--sm" onclick={onclose}>Avinstaller</button>
					<button class="btn btn--secondary btn--sm" onclick={onclose}>
						{extension.enabled ? 'Deaktiver' : 'Aktiver'}
					</button>
				{:else}
					<button class="btn btn--primary btn--sm" onclick={onclose}>Installer</button>
				{/if}
				<button class="btn btn--ghost btn--sm" onclick={onclose}>Lukk</button>
			</div>
		{/snippet}
	</Dialog>
{/if}

<style>
	.ext-detail {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.ext-detail__desc {
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--color-fg);
		margin: 0;
	}
	.ext-detail__grid {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.ext-detail__section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ext-detail__heading {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		margin: 0;
	}
	.ext-detail__subdesc {
		font-size: 0.78rem;
		color: var(--color-fg-dim);
		margin: 4px 0 0;
		line-height: 1.4;
	}
	.trust-tier {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		padding: 4px 10px;
		border-radius: 4px;
		display: inline-block;
		width: fit-content;
	}
	.trust--anchor-signed {
		background: rgb(from var(--color-aurora-mint) r g b / 0.12);
		color: var(--color-aurora-mint);
	}
	.trust--publisher-signed {
		background: rgb(from var(--color-aurora-arctic) r g b / 0.12);
		color: var(--color-aurora-arctic);
	}
	.trust--community {
		background: rgb(from var(--color-fg) r g b / 0.08);
		color: var(--color-fg-dim);
	}
	.quality-tier {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		padding: 4px 10px;
		border-radius: 4px;
		display: inline-block;
		width: fit-content;
	}
	.quality--platinum {
		background: rgb(from var(--color-aurora-mint) r g b / 0.12);
		color: var(--color-aurora-mint);
	}
	.quality--gold {
		background: rgb(from var(--color-warning) r g b / 0.12);
		color: var(--color-warning);
	}
	.quality--silver {
		background: rgb(from var(--color-fg) r g b / 0.08);
		color: var(--color-fg-dim);
	}
	.quality--bronze {
		background: rgb(from var(--color-warning-dim) r g b / 0.1);
		color: var(--color-warning-dim);
	}
	.capability-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.capability-item {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		background: rgb(from var(--color-fg) r g b / 0.06);
		border: 1px solid var(--color-line);
		padding: 6px 10px;
		border-radius: 3px;
	}
	.cap-header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
	}
	.cap-justification {
		margin: 4px 0 0;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		font-style: italic;
		color: var(--color-fg-dim);
		line-height: 1.4;
	}
	.capability-item code {
		font-size: inherit;
	}
	.cap-risk {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 1px 5px;
		border-radius: 2px;
		margin-left: 4px;
	}
	.cap-risk--low {
		background: rgb(from var(--color-success) r g b / 0.12);
		color: var(--color-success);
	}
	.cap-risk--medium {
		background: rgb(from var(--color-warning) r g b / 0.12);
		color: var(--color-warning);
	}
	.cap-risk--high {
		background: rgb(from var(--color-danger) r g b / 0.15);
		color: var(--color-danger);
	}
	.cap--high {
		border-color: rgb(from var(--color-danger) r g b / 0.3);
	}
	.cap--medium {
		border-color: rgb(from var(--color-warning) r g b / 0.25);
	}
	.allowed-hosts {
		margin-top: 10px;
		padding: 10px 12px;
		background: rgb(from var(--color-warning) r g b / 0.06);
		border: 1px dashed rgb(from var(--color-warning) r g b / 0.3);
		border-radius: 4px;
	}
	.allowed-hosts__icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.allowed-hosts__label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-warning);
		margin: 0 0 2px;
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.allowed-hosts__note {
		font-size: 0.7rem;
		color: var(--color-fg-dim);
		margin: 0 0 8px;
		font-style: italic;
	}
	.allowed-hosts__list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.allowed-hosts__item {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		background: rgb(from var(--color-fg) r g b / 0.06);
		border: 1px dashed var(--color-line-hi);
		padding: 3px 8px;
		border-radius: 3px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.allowed-hosts__item code {
		font-size: inherit;
	}
	.allowed-hosts__proto {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		padding: 1px 4px;
		border-radius: 2px;
		background: rgb(from var(--color-success) r g b / 0.12);
		color: var(--color-success);
	}
	.allowed-hosts__edit {
		font-size: 0.7rem;
		opacity: 0.5;
		cursor: pointer;
	}
	.allowed-hosts__block-note {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--color-danger);
		margin: 8px 0 0;
		font-weight: 600;
	}
	.ext-meta {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		font-size: 0.78rem;
		margin: 0;
	}
	.ext-meta dt {
		color: var(--color-fg-dim);
	}
	.ext-meta dd {
		margin: 0;
		color: var(--color-fg);
		font-family: var(--font-mono);
	}
	.ext-detail__actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
</style>
