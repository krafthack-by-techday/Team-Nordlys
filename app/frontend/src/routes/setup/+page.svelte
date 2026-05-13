<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import { mapError } from '$lib/utils/errors';
	import { m } from '$lib/paraglide/messages.js';
	import Version from '$lib/components/Version.svelte';

	let { data }: PageProps = $props();

	// ── Wizard steps ──
	type Step = 'org' | 'account' | 'verify' | 'access';
	let step = $state<Step>(data.nodeStatus === 'pending' ? 'verify' : 'org');
	let direction = $state<1 | -1>(1);

	// ── Form state ──
	let company = $state('');
	let nodeName = $state('');
	let email = $state('');
	let fullName = $state('');
	let password = $state('');
	let passwordConfirm = $state('');

	// ── Verify state ──
	let verifyCommand = $state('');
	let verifyCode = $state('');
	let error = $state('');
	let polling = $state(false);

	// ── Access request state ──
	let accessRequestBlob = $state('');
	let accessRequestLoading = $state(false);

	// ── Slug generation ──
	function slugify(str: string): string {
		return str
			.toLowerCase()
			.replace(/æ/g, 'ae')
			.replace(/ø/g, 'oe')
			.replace(/å/g, 'aa')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	let generatedNodeId = $derived(
		company && nodeName
			? `${slugify(company)}-${slugify(nodeName)}`
			: ''
	);

	// ── Validation ──
	let orgValid = $derived(company.length >= 2 && nodeName.length >= 2 && generatedNodeId.length >= 5);
	let passwordsMatch = $derived(password === passwordConfirm);
	let passwordValid = $derived(password.length >= 12);
	let accountValid = $derived(email.includes('@') && fullName.length > 0 && passwordValid && passwordsMatch);

	// ── Mini mesh preview data ──
	const existingPeers = [
		{ id: 'kraftcert', label: 'KraftCERT', x: 180, y: 70, isHub: true },
		{ id: 'peer1', label: 'Hafslund Kraft', x: 70, y: 170 },
		{ id: 'peer2', label: 'BKK', x: 290, y: 150 },
		{ id: 'peer3', label: 'Agder Energi', x: 100, y: 280 },
		{ id: 'peer4', label: 'Glitre Nett', x: 270, y: 270 }
	];

	const existingLinks: [string, string][] = [
		['kraftcert', 'peer1'],
		['kraftcert', 'peer2'],
		['kraftcert', 'peer3'],
		['kraftcert', 'peer4'],
		['peer1', 'peer3'],
		['peer2', 'peer4']
	];

	const newNodePos = { x: 180, y: 370 };

	// ── Navigation ──
	const steps: Step[] = ['org', 'account', 'verify', 'access'];

	function goTo(target: Step) {
		direction = steps.indexOf(target) > steps.indexOf(step) ? 1 : -1;
		step = target;
	}

	// ── Setup submission (creates admin + generates verify code) ──
	async function submitSetup() {
		error = '';
		try {
			const resp = await fetch('/api/v1/setup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					company,
					nodeName,
					email,
					name: fullName,
					password
				})
			});
			const result = await resp.json();
			if (!resp.ok) {
				error = mapError(result.error);
				return;
			}
			verifyCommand = result.verification.command;
			verifyCode = result.verification.code;
			goTo('verify');
			startPolling();
		} catch (e) {
			error = m.error_server_unreachable();
		}
	}

	// ── Verification polling ──
	function startPolling() {
		polling = true;
		const interval = setInterval(async () => {
			try {
				const resp = await fetch('/api/v1/setup/status');
				const result = await resp.json();
				if (result.status === 'active') {
					polling = false;
					clearInterval(interval);
					generateAccessRequest();
				}
			} catch {}
		}, 2000);
	}

	// ── Generate access request after verification ──
	async function generateAccessRequest() {
		// KraftCERT nodes are self-sovereign — skip access request, go to dashboard
		if (generatedNodeId.includes('kraftcert')) {
			// Trigger self-registration so core-svc picks up the new identity
			try { await fetch('/api/v1/setup/self-activate', { method: 'POST' }); } catch {}
			window.location.href = '/dashboard';
			return;
		}

		accessRequestLoading = true;
		goTo('access');
		try {
			const resp = await fetch('/api/v1/access-request', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					contact: { name: fullName, email }
				})
			});
			if (resp.ok) {
				const result = await resp.json();
				accessRequestBlob = JSON.stringify(result, null, 2);
			} else {
				// Backend not implemented yet — generate a placeholder
				accessRequestBlob = JSON.stringify({
					node_id: generatedNodeId,
					company,
					public_key: '(genereres av serveren)',
					contact: { name: fullName, email },
					signature: '(genereres av serveren)'
				}, null, 2);
			}
		} catch {
			// Backend not available — show placeholder
			accessRequestBlob = JSON.stringify({
				node_id: generatedNodeId,
				company,
				public_key: '(genereres av serveren)',
				contact: { name: fullName, email },
				signature: '(genereres av serveren)'
			}, null, 2);
		} finally {
			accessRequestLoading = false;
		}
	}

	// If page loads in pending state, start polling immediately
	$effect(() => {
		if (data.nodeStatus === 'pending' && !polling) {
			startPolling();
		}
	});
</script>

<svelte:head>
	<title>{m.setup_page_title()}</title>
</svelte:head>

<div class="setup">
	<div class="setup__layout">
		<!-- Left: Wizard card -->
		<article class="card card--elevated setup__card">
			<header class="setup__header">
				<h1 class="setup__title">Nordlys</h1>
				<p class="setup__subtitle">{m.setup_subtitle()}</p>
			</header>

			<!-- Step indicators -->
			<nav class="setup__steps" aria-label={m.setup_aria_steps()}>
				{#each [
					{ key: 'org', label: m.setup_step_org(), num: '1' },
					{ key: 'account', label: m.setup_step_account(), num: '2' },
					{ key: 'verify', label: m.setup_step_verify(), num: '3' },
					{ key: 'access', label: m.setup_step_access(), num: '4' }
				] as s, i}
					{#if i > 0}
						<div class="setup__step-line" class:done={steps.indexOf(step) > i - 1}></div>
					{/if}
					<div class="setup__step" class:active={step === s.key} class:done={steps.indexOf(step) > i}>
						<span class="setup__step-num">{s.num}</span>
						<span class="setup__step-label">{s.label}</span>
					</div>
				{/each}
			</nav>

			<!-- Step 1: Organisation -->
			{#if step === 'org'}
				<div class="setup__form" in:fly={{ x: direction * 24, duration: 240, delay: 80 }} out:fade={{ duration: 120 }}>
					<div class="field">
						<label class="field__label field__label--required" for="company">{m.setup_label_org()}</label>
						<input
							class="input"
							id="company"
							type="text"
							placeholder={m.setup_placeholder_org()}
							bind:value={company}
						/>
						<span class="field__hint">{m.setup_hint_org()}</span>
					</div>
					<div class="field">
						<label class="field__label field__label--required" for="nodeName">{m.setup_label_node_name()}</label>
						<input
							class="input"
							id="nodeName"
							type="text"
							placeholder={m.setup_placeholder_node_name()}
							bind:value={nodeName}
						/>
						<span class="field__hint">{m.setup_hint_node_name()}</span>
					</div>

					{#if generatedNodeId}
						<div class="setup__slug-preview">
							<span class="setup__slug-label">{m.setup_node_id_label()}</span>
							<code class="setup__slug-value">{generatedNodeId}</code>
						</div>
					{/if}

					<div class="setup__actions">
						<button
							class="btn btn--primary btn--block"
							disabled={!orgValid}
							onclick={() => goTo('account')}
						>
							{m.setup_btn_next()}
						</button>
					</div>
				</div>
			{/if}

			<!-- Step 2: Admin account -->
			{#if step === 'account'}
				<div class="setup__form" in:fly={{ x: direction * 24, duration: 240, delay: 80 }} out:fade={{ duration: 120 }}>
					<div class="field">
						<label class="field__label field__label--required" for="fullName">{m.setup_label_full_name()}</label>
						<input class="input" id="fullName" type="text" placeholder={m.setup_placeholder_full_name()} bind:value={fullName} />
					</div>
					<div class="field">
						<label class="field__label field__label--required" for="email">{m.setup_label_email()}</label>
						<input class="input" id="email" type="email" placeholder={m.setup_placeholder_email()} bind:value={email} />
					</div>
					<div class="field">
						<label class="field__label field__label--required" for="password">{m.setup_label_password()}</label>
						<input class="input" id="password" type="password" bind:value={password} aria-invalid={password.length > 0 && !passwordValid ? 'true' : undefined} />
						{#if password.length > 0 && !passwordValid}
							<span class="field__error">{m.setup_error_password_short()}</span>
						{/if}
					</div>
					<div class="field">
						<label class="field__label field__label--required" for="passwordConfirm">{m.setup_label_password_confirm()}</label>
						<input class="input" id="passwordConfirm" type="password" bind:value={passwordConfirm} aria-invalid={passwordConfirm.length > 0 && !passwordsMatch ? 'true' : undefined} />
						{#if passwordConfirm.length > 0 && !passwordsMatch}
							<span class="field__error">{m.setup_error_password_mismatch()}</span>
						{/if}
					</div>

					{#if error}
						<p class="field__error">{error}</p>
					{/if}

					<div class="setup__actions">
						<button class="btn btn--ghost" onclick={() => goTo('org')}>{m.setup_btn_back()}</button>
						<button class="btn btn--primary" disabled={!accountValid} onclick={submitSetup}>
							{m.setup_btn_create()}
						</button>
					</div>
				</div>
			{/if}

			<!-- Step 3: Console verification -->
			{#if step === 'verify'}
				<div class="setup__form" in:fly={{ x: direction * 24, duration: 240, delay: 80 }} out:fade={{ duration: 120 }}>
					<p class="setup__desc">{m.setup_verify_desc()}</p>

					<div class="setup__code-block">
						<code>{verifyCommand || `docker exec nordlys verify ------`}</code>
						{#if verifyCommand}
							<CopyButton value={verifyCommand} />
						{/if}
					</div>

					<div class="setup__waiting">
						<span class="setup__spinner"></span>
						<span>{m.setup_verify_waiting()}</span>
					</div>

					<span class="field__hint">{m.setup_verify_hint()}</span>
				</div>
			{/if}

			<!-- Step 4: Access request -->
			{#if step === 'access'}
				<div class="setup__form" in:fly={{ x: direction * 24, duration: 240, delay: 80 }} out:fade={{ duration: 120 }}>
					<h2 class="setup__step-title">{m.setup_access_heading()}</h2>

					<p class="setup__desc">{m.setup_access_desc()}</p>

					<div class="setup__instructions">
						<div class="setup__instruction">
							<span class="setup__instruction-num">1</span>
							<span>{m.setup_access_step_1()}</span>
						</div>
						<div class="setup__instruction">
							<span class="setup__instruction-num">2</span>
							<span>{m.setup_access_step_2()}</span>
						</div>
						<div class="setup__instruction">
							<span class="setup__instruction-num">3</span>
							<span>{m.setup_access_step_3()}</span>
						</div>
						<div class="setup__instruction">
							<span class="setup__instruction-num">4</span>
							<span>{@html m.setup_access_step_4_html()}</span>
						</div>
					</div>

					{#if accessRequestLoading}
						<div class="setup__waiting">
							<span class="setup__spinner"></span>
							<span>{m.setup_access_generating()}</span>
						</div>
					{:else}
						<div class="setup__code-block setup__code-block--tall">
							<code>{accessRequestBlob}</code>
							<CopyButton value={accessRequestBlob} />
						</div>
					{/if}

					<div class="setup__info-box">
						<p>{@html m.setup_access_works_now_html()}</p>
					</div>

					<div class="setup__actions">
						<a href="/dashboard" class="btn btn--primary btn--block">{m.setup_btn_dashboard()}</a>
					</div>
				</div>
			{/if}
		</article>

		<!-- Right: Mini mesh preview -->
		<aside class="setup__mesh" aria-hidden="true">
			<svg viewBox="0 0 360 440" class="mesh__svg">
				<!-- Links between existing peers -->
				{#each existingLinks as [from, to]}
					{@const fromNode = existingPeers.find(p => p.id === from)}
					{@const toNode = existingPeers.find(p => p.id === to)}
					{#if fromNode && toNode}
						<line
							x1={fromNode.x} y1={fromNode.y}
							x2={toNode.x} y2={toNode.y}
							class="mesh__link"
						/>
					{/if}
				{/each}

				<!-- Dashed links from new node to hub + nearest peers -->
				<line
					x1={newNodePos.x} y1={newNodePos.y}
					x2={existingPeers[0].x} y2={existingPeers[0].y}
					class="mesh__link mesh__link--new"
				/>
				<line
					x1={newNodePos.x} y1={newNodePos.y}
					x2={existingPeers[3].x} y2={existingPeers[3].y}
					class="mesh__link mesh__link--new"
				/>
				<line
					x1={newNodePos.x} y1={newNodePos.y}
					x2={existingPeers[4].x} y2={existingPeers[4].y}
					class="mesh__link mesh__link--new"
				/>

				<!-- Existing peer nodes -->
				{#each existingPeers as peer}
					<g class="mesh__node" class:mesh__node--hub={peer.isHub}>
						<rect
							x={peer.x - 6} y={peer.y - 6}
							width="12" height="12"
							class="mesh__node-shape"
						/>
						<text x={peer.x} y={peer.y + 22} class="mesh__node-label">
							{peer.label}
						</text>
					</g>
				{/each}

				<!-- New node (the user's) -->
				<g class="mesh__node mesh__node--self">
					<rect
						x={newNodePos.x - 8} y={newNodePos.y - 8}
						width="16" height="16"
						class="mesh__node-shape"
					/>
					<!-- Pulse ring -->
					<rect
						x={newNodePos.x - 12} y={newNodePos.y - 12}
						width="24" height="24"
						class="mesh__pulse"
					/>
					<text x={newNodePos.x} y={newNodePos.y + 26} class="mesh__node-label mesh__node-label--self">
						{generatedNodeId || m.setup_node_preview_self()}
					</text>
				</g>
			</svg>

			<p class="mesh__caption">{m.setup_node_preview()}</p>
		</aside>
	</div>

	<footer class="setup__footer"><Version /></footer>
</div>

<style>
	.setup {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		position: relative;
		z-index: 5;
	}

	.setup__layout {
		display: flex;
		align-items: center;
		gap: 3rem;
		max-width: 920px;
		width: 100%;
	}

	.setup__card {
		width: 100%;
		max-width: 480px;
		padding: 2.4rem 2rem;
		flex-shrink: 0;
	}

	.setup__header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.setup__title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.4rem, 2vw, 1.8rem);
		letter-spacing: -0.03em;
		color: var(--color-aurora-mint);
		margin: 0;
	}

	.setup__subtitle {
		color: var(--color-fg-dim);
		font-size: var(--text-ui-sm);
		margin: 0.35rem 0 0;
	}

	/* Step indicators */
	.setup__steps {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		margin-bottom: 1.5rem;
	}

	.setup__step {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		opacity: 0.35;
		transition: opacity var(--motion-duration) var(--motion-ease);
	}

	.setup__step.active,
	.setup__step.done {
		opacity: 1;
	}

	.setup__step-num {
		width: 1.4rem;
		height: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 600;
		border: 1px solid var(--color-line-hi);
		background: transparent;
		color: var(--color-fg-dim);
		border-radius: 0;
		transition:
			background-color var(--motion-duration) var(--motion-ease-aurora),
			border-color var(--motion-duration) var(--motion-ease-aurora),
			color var(--motion-duration) var(--motion-ease-aurora);
	}

	.setup__step.active .setup__step-num {
		background: var(--color-aurora-mint);
		border-color: var(--color-aurora-mint);
		color: var(--color-bg);
	}

	.setup__step.done .setup__step-num {
		background: var(--color-success);
		border-color: var(--color-success);
		color: var(--color-bg);
	}

	.setup__step-label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}

	.setup__step-line {
		width: 1.2rem;
		height: 1px;
		background: var(--color-line-hi);
		margin: 0 0.3rem;
		transition: background-color var(--motion-duration) var(--motion-ease);
	}

	.setup__step-line.done {
		background: var(--color-success);
	}

	/* Form area */
	.setup__form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.setup__step-title {
		font-family: var(--font-display);
		font-size: var(--text-ui-title);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0;
	}

	.setup__actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 0.5rem;
	}

	.setup__desc {
		color: var(--color-fg);
		font-size: var(--text-ui);
		line-height: 1.55;
		margin: 0;
	}

	/* Slug preview */
	.setup__slug-preview {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--color-line-hi);
		background: rgb(from var(--color-bg) r g b / 0.6);
	}

	.setup__slug-label {
		font-family: var(--font-mono);
		font-size: var(--text-mono-sm);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}

	.setup__slug-value {
		font-family: var(--font-mono);
		font-size: var(--text-ui-sm);
		color: var(--color-aurora-mint);
		font-weight: 600;
	}

	/* Code block */
	.setup__code-block {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--color-line-hi);
		background: rgb(from var(--color-bg) r g b / 0.6);
		backdrop-filter: blur(8px);
		font-family: var(--font-mono);
		font-size: var(--text-ui-sm);
		overflow-x: auto;
	}

	.setup__code-block code {
		flex: 1;
		color: var(--color-aurora-arctic);
		white-space: pre-wrap;
		word-break: break-all;
	}

	.setup__code-block--tall {
		max-height: 180px;
		overflow-y: auto;
	}

	/* Instructions list */
	.setup__instructions {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.setup__instruction {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-size: var(--text-ui-sm);
		color: var(--color-fg);
		line-height: 1.4;
	}

	.setup__instruction-num {
		width: 1.2rem;
		height: 1.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 600;
		border: 1px solid var(--color-aurora-mint);
		color: var(--color-aurora-mint);
		flex-shrink: 0;
	}

	/* Info box */
	.setup__info-box {
		padding: 0.9rem 1rem;
		border: 1px solid var(--color-line);
		background: rgb(from var(--color-bg-raised) r g b / 0.4);
		font-size: var(--text-ui-xs);
		line-height: 1.5;
		color: var(--color-fg-dim);
	}

	.setup__info-box p {
		margin: 0;
	}

	.setup__info-box strong {
		color: var(--color-fg);
	}

	/* Waiting / spinner */
	.setup__waiting {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-fg-dim);
		font-size: var(--text-ui-sm);
	}

	.setup__spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--color-line-hi);
		border-top-color: var(--color-aurora-mint);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Footer */
	.setup__footer {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
	}

	/* ── Mini mesh preview ── */
	.setup__mesh {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.mesh__svg {
		width: 100%;
		max-width: 320px;
		height: auto;
	}

	.mesh__link {
		stroke: var(--color-line-hi);
		stroke-width: 1;
	}

	.mesh__link--new {
		stroke: var(--color-aurora-mint);
		stroke-width: 1.2;
		stroke-dasharray: 4 3;
		animation: dash-flow 1.2s linear infinite;
	}

	@keyframes dash-flow {
		to { stroke-dashoffset: -7; }
	}

	.mesh__node-shape {
		fill: var(--color-bg-raised);
		stroke: var(--color-line-hi);
		stroke-width: 1;
	}

	.mesh__node--hub .mesh__node-shape {
		fill: var(--color-aurora-lichen);
		stroke: var(--color-aurora-lichen);
	}

	.mesh__node--self .mesh__node-shape {
		fill: var(--color-aurora-mint);
		stroke: var(--color-aurora-mint);
	}

	.mesh__pulse {
		fill: none;
		stroke: var(--color-aurora-mint);
		stroke-width: 1.5;
		opacity: 0;
		animation: pulse-ring 2s var(--motion-ease-out) infinite;
	}

	@keyframes pulse-ring {
		0% { opacity: 0.7; }
		100% { opacity: 0; transform: scale(1.8); transform-origin: center; }
	}

	.mesh__node-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.05em;
		fill: var(--color-fg-dim);
		text-anchor: middle;
	}

	.mesh__node-label--self {
		fill: var(--color-aurora-mint);
		font-weight: 600;
		font-size: 11px;
	}

	.mesh__caption {
		font-family: var(--font-mono);
		font-size: var(--text-mono-sm);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		opacity: 0.7;
		margin: 0;
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.setup__layout {
			flex-direction: column;
			gap: 2rem;
		}

		.setup__mesh {
			order: -1;
			max-width: 240px;
		}

		.mesh__svg {
			max-width: 220px;
		}
	}
</style>
