<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Version from '$lib/components/Version.svelte';

	const REPO_URL = 'https://github.com/krafthack-by-techday/Team-Nordlys';

	const initiative = [
		{ key: 'statnett', name: 'Statnett', url: 'https://www.statnett.no' },
		{ key: 'skagerak', name: 'Skagerak Energi', url: 'https://www.skagerakenergi.no' },
		{ key: 'hafslund', name: 'Hafslund', url: 'https://www.hafslund.no' },
		{ key: 'elhub', name: 'Elhub', url: 'https://elhub.no' },
		{ key: 'aenergi', name: 'Å Energi', url: 'https://www.aenergi.no' }
	];

	let problem = $derived([
		{ meta: m.landing_problem_1_meta(), title: m.landing_problem_1_title(), body: m.landing_problem_1_body() },
		{ meta: m.landing_problem_2_meta(), title: m.landing_problem_2_title(), body: m.landing_problem_2_body() },
		{ meta: m.landing_problem_3_meta(), title: m.landing_problem_3_title(), body: m.landing_problem_3_body() }
	]);

	let manifesto = $derived([
		{ num: '01', body: m.landing_what_p1() },
		{ num: '02', body: m.landing_what_p2() },
		{ num: '03', body: m.landing_what_p3() }
	]);

	let whyJoin = $derived([
		{ idx: 'A', title: m.landing_why_1_title(), body: m.landing_why_1_body() },
		{ idx: 'B', title: m.landing_why_2_title(), body: m.landing_why_2_body() },
		{ idx: 'C', title: m.landing_why_3_title(), body: m.landing_why_3_body() },
		{ idx: 'D', title: m.landing_why_4_title(), body: m.landing_why_4_body() }
	]);

	let features = $derived([
		{ idx: 'I',   title: m.landing_feature_1_title(), body: m.landing_feature_1_body() },
		{ idx: 'II',  title: m.landing_feature_2_title(), body: m.landing_feature_2_body() },
		{ idx: 'III', title: m.landing_feature_3_title(), body: m.landing_feature_3_body() },
		{ idx: 'IV',  title: m.landing_feature_4_title(), body: m.landing_feature_4_body() }
	]);

	let model = $derived([
		{ kpi: m.landing_model_cost_kpi(),    title: m.landing_model_cost_title(),    body: m.landing_model_cost_body() },
		{ kpi: m.landing_model_plugins_kpi(), title: m.landing_model_plugins_title(), body: m.landing_model_plugins_body() },
		{ kpi: m.landing_model_open_kpi(),    title: m.landing_model_open_title(),    body: m.landing_model_open_body() }
	]);

	let quickstart = $derived([
		{ meta: m.landing_quickstart_1_meta(), title: m.landing_quickstart_1_title(), body: m.landing_quickstart_1_body() },
		{ meta: m.landing_quickstart_2_meta(), title: m.landing_quickstart_2_title(), body: m.landing_quickstart_2_body() },
		{ meta: m.landing_quickstart_3_meta(), title: m.landing_quickstart_3_title(), body: m.landing_quickstart_3_body() }
	]);

	let audiences = $derived([
		m.landing_audience_ciso(),
		m.landing_audience_soc(),
		m.landing_audience_ot(),
		m.landing_audience_compliance()
	]);
</script>

<svelte:head>
	<title>{m.landing_page_title()}</title>
</svelte:head>

<svg class="aurora-arc" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
	<defs>
		<linearGradient id="auroraStroke" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0%" stop-color="var(--color-aurora-arctic)" stop-opacity="0" />
			<stop offset="35%" stop-color="var(--color-aurora-mint)" stop-opacity="0.55" />
			<stop offset="65%" stop-color="var(--color-aurora-arctic)" stop-opacity="0.5" />
			<stop offset="100%" stop-color="var(--color-aurora-lichen)" stop-opacity="0" />
		</linearGradient>
		<filter id="auroraBlur"><feGaussianBlur stdDeviation="3" /></filter>
	</defs>
	<path
		d="M-50 540 Q 380 380, 760 480 T 1660 360"
		fill="none"
		stroke="url(#auroraStroke)"
		stroke-width="1.6"
		filter="url(#auroraBlur)"
	/>
	<path
		d="M-50 580 Q 360 460, 700 540 T 1660 420"
		fill="none"
		stroke="url(#auroraStroke)"
		stroke-width="0.8"
		stroke-dasharray="2 6"
		opacity="0.5"
	/>
</svg>

<main class="landing">
	<aside class="landing__stamp" aria-hidden="true">
		<div class="landing__stamp-line">N°&nbsp;01 / NORDLYS</div>
		<div class="landing__stamp-line landing__stamp-line--dim">EST. 2026 · OSLO</div>
	</aside>

	<!-- Hero — compressed: tagline + lead + CTAs only -->
	<section class="landing__hero">
		<div class="landing__hero-left">
			<span class="landing__eyebrow">{m.landing_eyebrow()}</span>
			<h1 class="landing__title">
				<span class="landing__title-row">Nord</span>
				<span class="landing__title-row landing__title-row--accent">lys.</span>
			</h1>
			<div class="landing__rule" aria-hidden="true"></div>
			<p class="landing__tagline">{m.landing_tagline()}</p>
			<p class="landing__lead">{m.landing_lead()}</p>
			<div class="landing__hero-cta">
				<a class="btn btn--primary" href="#problem">↓ {m.landing_problem_heading()}</a>
				<a class="btn btn--ghost" href={REPO_URL} target="_blank" rel="noopener">
					{m.landing_btn_github()} ↗
				</a>
			</div>
		</div>
		<aside class="landing__hero-right">
			<div class="landing__meta">
				<dl class="landing__meta-list">
					<div><dt>Project</dt><dd>Nordlys</dd></div>
					<div><dt>Trust&nbsp;anchor</dt><dd>KraftCERT</dd></div>
					<div><dt>License</dt><dd>MIT</dd></div>
					<div><dt>Version</dt><dd><Version /></dd></div>
				</dl>
			</div>
		</aside>
	</section>

	<!-- § 01 — THE PROBLEM (call to adventure) -->
	<section class="landing__section landing__section--problem" id="problem">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 01</span>
			<h2 class="landing__h2">{m.landing_problem_heading()}</h2>
		</header>
		<p class="landing__lede">{m.landing_problem_intro()}</p>
		<ol class="landing__problem">
			{#each problem as p, i}
				<li class="landing__problem-row" style="--row-index: {i}">
					<div class="landing__problem-meta">
						<span class="landing__problem-num">0{i + 1}</span>
						<span class="landing__problem-tag">{p.meta}</span>
					</div>
					<div class="landing__problem-content">
						<h3 class="landing__problem-title">{p.title}</h3>
						<p class="landing__problem-body">{p.body}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<!-- § 02 — THE SOLUTION (manifesto) -->
	<section class="landing__section landing__section--manifesto">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 02</span>
			<h2 class="landing__h2">{m.landing_what_heading()}</h2>
		</header>
		<ol class="landing__manifesto">
			{#each manifesto as item, i}
				<li class="landing__principle" style="--row-index: {i}">
					<span class="landing__principle-num">{item.num}</span>
					<span class="landing__principle-body">{item.body}</span>
				</li>
			{/each}
		</ol>
	</section>

	<!-- § 03 — Why join -->
	<section class="landing__section">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 03</span>
			<h2 class="landing__h2">{m.landing_why_heading()}</h2>
		</header>
		<p class="landing__lede">{m.landing_why_intro()}</p>
		<div class="landing__why">
			{#each whyJoin as w, i}
				<article class="landing__why-card" style="--row-index: {i}">
					<span class="landing__why-idx">{w.idx}</span>
					<h3 class="landing__why-title">{w.title}</h3>
					<p class="landing__why-body">{w.body}</p>
				</article>
			{/each}
		</div>

		<aside class="landing__audience">
			<h3 class="landing__audience-h">{m.landing_audience_heading()}</h3>
			<ul class="landing__audience-list">
				{#each audiences as label, i}
					<li class="landing__audience-item" style="--row-index: {i}">
						<span class="landing__audience-bullet" aria-hidden="true">→</span>
						<span>{label}</span>
					</li>
				{/each}
			</ul>
		</aside>
	</section>

	<!-- § 04 — Model -->
	<section class="landing__section">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 04</span>
			<h2 class="landing__h2">{m.landing_model_heading()}</h2>
		</header>
		<p class="landing__lede">{m.landing_model_intro()}</p>
		<div class="landing__model">
			{#each model as item, i}
				<article class="landing__model-row" style="--row-index: {i}">
					<div class="landing__model-kpi">{item.kpi}</div>
					<div class="landing__model-content">
						<h3 class="landing__model-title">{item.title}</h3>
						<p class="landing__model-body">{item.body}</p>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<!-- § 05 — Capabilities -->
	<section class="landing__section">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 05</span>
			<h2 class="landing__h2">{m.landing_features_heading()}</h2>
		</header>
		<div class="landing__features">
			{#each features as f, i}
				<article class="landing__feature" style="--row-index: {i}">
					<span class="landing__feature-idx">{f.idx}</span>
					<h3 class="landing__feature-title">{f.title}</h3>
					<p class="landing__feature-body">{f.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<!-- § 06 — Initiative (driven by individuals at these companies) -->
	<section class="landing__section">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 06</span>
			<h2 class="landing__h2">{m.landing_initiative_heading()}</h2>
		</header>
		<p class="landing__lede">{m.landing_initiative_lead()}</p>
		<div class="landing__logos">
			{#each initiative as company, i (company.key)}
				<a
					class="landing__logo"
					href={company.url}
					target="_blank"
					rel="noopener"
					aria-label={company.name}
					style="--row-index: {i}"
				>
					<span class="landing__logo-bracket">[</span>
					<span class="landing__logo-text">{company.name}</span>
					<span class="landing__logo-bracket">]</span>
				</a>
			{/each}
		</div>
	</section>

	<!-- § 07 — Quickstart -->
	<section class="landing__section">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 07</span>
			<h2 class="landing__h2">{m.landing_quickstart_heading()}</h2>
		</header>
		<p class="landing__lede">{m.landing_quickstart_intro()}</p>
		<ol class="landing__quickstart">
			{#each quickstart as q, i}
				<li class="landing__qs-step" style="--row-index: {i}">
					<div class="landing__qs-meta">{q.meta}</div>
					<div class="landing__qs-content">
						<h3 class="landing__qs-title">{q.title}</h3>
						<p class="landing__qs-body">{q.body}</p>
					</div>
					<div class="landing__qs-rail" aria-hidden="true"></div>
				</li>
			{/each}
		</ol>
	</section>

	<!-- § 08 — Status + final CTA -->
	<section class="landing__section landing__section--status">
		<header class="landing__section-head">
			<span class="landing__section-num">§ 08</span>
			<h2 class="landing__h2">{m.landing_status_heading()}</h2>
		</header>
		<p class="landing__lede landing__lede--wide">{m.landing_status_body()}</p>

		<aside class="landing__final-cta">
			<div class="landing__final-cta-text">
				<h3 class="landing__final-cta-title">{m.landing_cta_join_heading()}</h3>
				<p class="landing__final-cta-body">{m.landing_cta_join_body()}</p>
			</div>
			<div class="landing__final-cta-actions">
				<a class="btn btn--primary" href={REPO_URL} target="_blank" rel="noopener">
					GitHub ↗
				</a>
				<a class="btn btn--ghost" href="/login">{m.landing_btn_login()} →</a>
			</div>
		</aside>
	</section>

	<footer class="landing__footer">
		<div class="landing__horizon" aria-hidden="true"></div>
		<div class="landing__footer-row">
			<a href={REPO_URL} target="_blank" rel="noopener" class="landing__footer-link">GitHub ↗</a>
			<span class="landing__footer-sep">·</span>
			<span class="landing__footer-text">
				{m.landing_footer_oss({ license: 'MIT' })}
			</span>
			<span class="landing__footer-sep">·</span>
			<Version />
			<span class="landing__footer-sep">·</span>
			<span class="landing__footer-coords">59°55′ N 10°44′ E</span>
		</div>
	</footer>
</main>

<style>
	/* ── Page atmosphere ──────────────────────────────────────────────── */
	.aurora-arc {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 3;
		opacity: 0.85;
	}
	.aurora-arc path {
		animation: aurora-drift 18s ease-in-out infinite alternate;
	}
	.aurora-arc path:nth-child(2) {
		animation-duration: 24s;
		animation-direction: alternate-reverse;
	}
	@keyframes aurora-drift {
		0%   { transform: translateY(0)    scaleX(1);    opacity: 0.7; }
		50%  { transform: translateY(-22px) scaleX(1.05); opacity: 1;   }
		100% { transform: translateY(14px)  scaleX(0.97); opacity: 0.8; }
	}

	/* ── Layout shell ─────────────────────────────────────────────────── */
	.landing {
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(64px, 9vw, 128px) clamp(24px, 5vw, 72px) clamp(48px, 7vw, 96px);
		display: flex;
		flex-direction: column;
		gap: clamp(56px, 7vw, 104px);
		position: relative;
		z-index: 5;
		min-height: 100vh;
	}

	/* ── Letterhead corner stamp ──────────────────────────────────────── */
	.landing__stamp {
		position: fixed;
		top: clamp(12px, 1.6vw, 22px);
		left: clamp(16px, 2vw, 28px);
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		z-index: 25;
		opacity: 0;
		animation: stamp-in 0.6s 0.1s ease-out forwards;
	}
	.landing__stamp-line { white-space: nowrap; }
	.landing__stamp-line--dim { opacity: 0.55; }
	@keyframes stamp-in {
		from { opacity: 0; transform: translateY(-6px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* ── Hero ─────────────────────────────────────────────────────────── */
	.landing__hero {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr);
		gap: clamp(32px, 4vw, 64px);
		align-items: start;
		opacity: 0;
		animation: hero-in 0.9s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}
	@keyframes hero-in {
		from { opacity: 0; transform: translateY(14px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.landing__hero-left { display: flex; flex-direction: column; gap: 18px; }
	.landing__eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.landing__title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(3.4rem, 11vw, 8rem);
		line-height: 0.86;
		letter-spacing: -0.05em;
		margin: 0;
		color: var(--color-fg);
	}
	.landing__title-row { display: block; }
	.landing__title-row--accent {
		color: var(--color-aurora-mint);
		font-style: italic;
	}
	.landing__rule {
		width: clamp(80px, 12vw, 160px);
		height: 2px;
		background: linear-gradient(90deg,
			var(--color-aurora-mint),
			var(--color-aurora-arctic) 60%,
			transparent);
		margin: 6px 0 4px;
	}
	.landing__tagline {
		font-family: var(--font-mono);
		font-size: clamp(0.78rem, 0.9vw, 0.95rem);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--color-aurora-arctic);
		margin: 0;
	}
	.landing__lead {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.1rem, 1.45vw, 1.4rem);
		line-height: 1.55;
		color: var(--color-fg);
		max-width: 38ch;
		margin: 4px 0 0;
	}
	.landing__hero-right {
		display: flex;
		flex-direction: column;
		gap: 26px;
		padding-top: clamp(8px, 1.5vw, 24px);
	}
	.landing__meta {
		border-top: 1px solid var(--color-line-hi);
		border-bottom: 1px solid var(--color-line-hi);
		padding: 14px 0;
	}
	.landing__meta-list {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
		margin: 0;
	}
	.landing__meta-list > div {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 12px;
		align-items: baseline;
	}
	.landing__meta-list dt {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.landing__meta-list dd {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--color-fg);
		margin: 0;
		text-align: right;
	}
	.landing__hero-cta {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 14px;
	}
	.landing__cta { display: flex; flex-direction: column; gap: 10px; }
	.landing__cta :global(.btn) {
		justify-content: space-between;
		text-align: left;
		font-size: 0.85rem;
		padding: 14px 18px;
	}

	/* ── § 01 — Problem (call to adventure) ───────────────────────────── */
	.landing__section--problem {
		scroll-margin-top: 24px;
	}
	.landing__problem {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.landing__problem-row {
		display: grid;
		grid-template-columns: 160px 1fr;
		gap: clamp(18px, 3vw, 40px);
		padding: clamp(24px, 3vw, 36px) 0;
		border-bottom: 1px solid var(--color-line);
		opacity: 0;
		animation: row-in 0.55s ease-out forwards;
		animation-delay: calc(0.3s + var(--row-index) * 0.1s);
	}
	.landing__problem-row:last-child { border-bottom: none; }
	.landing__problem-meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 4px;
	}
	.landing__problem-num {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: clamp(1.6rem, 2.4vw, 2.2rem);
		letter-spacing: -0.02em;
		color: var(--color-aurora-mint);
		line-height: 1;
	}
	.landing__problem-tag {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
	}
	.landing__problem-content { display: flex; flex-direction: column; gap: 10px; }
	.landing__problem-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.25rem, 1.8vw, 1.55rem);
		letter-spacing: -0.015em;
		line-height: 1.2;
		color: var(--color-fg);
		margin: 0;
	}
	.landing__problem-body {
		font-family: var(--font-display);
		font-size: clamp(0.98rem, 1.15vw, 1.08rem);
		line-height: 1.6;
		color: var(--color-fg-dim);
		margin: 0;
		max-width: 64ch;
	}
	@media (max-width: 720px) {
		.landing__problem-row { grid-template-columns: 1fr; gap: 12px; }
	}

	/* ── Section heading ──────────────────────────────────────────────── */
	.landing__section { display: flex; flex-direction: column; gap: 24px; }
	.landing__section-head {
		display: flex;
		align-items: baseline;
		gap: 18px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--color-line-hi);
	}
	.landing__section-num {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-aurora-mint);
	}
	.landing__h2 {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.35rem, 1.8vw, 1.7rem);
		letter-spacing: -0.015em;
		color: var(--color-fg);
		margin: 0;
	}

	/* ── Manifesto principles ─────────────────────────────────────────── */
	.landing__manifesto {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.landing__principle {
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: clamp(18px, 2vw, 32px);
		align-items: baseline;
		padding: 22px 0;
		border-bottom: 1px solid var(--color-line);
		opacity: 0;
		animation: row-in 0.5s ease-out forwards;
		animation-delay: calc(0.4s + var(--row-index) * 0.08s);
	}
	.landing__principle:last-child { border-bottom: none; }
	.landing__principle-num {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: clamp(1.4rem, 2vw, 1.9rem);
		letter-spacing: -0.02em;
		color: var(--color-aurora-arctic);
	}
	.landing__principle-body {
		font-family: var(--font-display);
		font-size: clamp(1rem, 1.3vw, 1.18rem);
		line-height: 1.55;
		color: var(--color-fg);
		max-width: 60ch;
	}

	@keyframes row-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* ── Why-join cards ───────────────────────────────────────────────── */
	.landing__why {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: clamp(16px, 2vw, 24px);
	}
	.landing__why-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: clamp(22px, 2.6vw, 30px) clamp(20px, 2.4vw, 28px);
		background: rgb(from var(--color-bg-raised) r g b / 0.6);
		border: 1px solid var(--color-line-hi);
		opacity: 0;
		animation: row-in 0.5s ease-out forwards;
		animation-delay: calc(0.3s + var(--row-index) * 0.07s);
		transition: border-color 0.25s, transform 0.25s, background 0.25s;
	}
	.landing__why-card::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 2px;
		background: linear-gradient(90deg, var(--color-aurora-mint), transparent);
		transform: scaleX(0.2);
		transform-origin: left;
		transition: transform 0.4s ease;
	}
	.landing__why-card:hover {
		border-color: var(--color-aurora-mint);
		background: rgb(from var(--color-bg-raised) r g b / 0.85);
		transform: translateY(-2px);
	}
	.landing__why-card:hover::before { transform: scaleX(1); }
	.landing__why-idx {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.22em;
		color: var(--color-aurora-mint);
	}
	.landing__why-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.05rem, 1.3vw, 1.18rem);
		letter-spacing: -0.01em;
		color: var(--color-fg);
		margin: 0;
	}
	.landing__why-body {
		font-family: var(--font-display);
		font-size: 0.92rem;
		line-height: 1.6;
		color: var(--color-fg-dim);
		margin: 0;
	}

	/* ── Audience callout ─────────────────────────────────────────────── */
	.landing__audience {
		margin-top: clamp(8px, 1vw, 16px);
		padding: clamp(16px, 2vw, 24px) clamp(20px, 2.4vw, 28px);
		border: 1px dashed var(--color-line-hi);
		background: transparent;
	}
	.landing__audience-h {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		margin: 0 0 12px;
		font-weight: 500;
	}
	.landing__audience-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 8px 24px;
	}
	.landing__audience-item {
		display: grid;
		grid-template-columns: 18px 1fr;
		gap: 10px;
		font-family: var(--font-display);
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--color-fg);
		opacity: 0;
		animation: row-in 0.4s ease-out forwards;
		animation-delay: calc(0.5s + var(--row-index) * 0.05s);
	}
	.landing__audience-bullet {
		font-family: var(--font-mono);
		color: var(--color-aurora-arctic);
	}

	/* ── Lede paragraph ───────────────────────────────────────────────── */
	.landing__lede {
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.6;
		color: var(--color-fg);
		max-width: 56ch;
		margin: 0;
	}
	.landing__lede--wide { max-width: 72ch; }

	/* ── Model rows (cost / plugins / openness) ───────────────────────── */
	.landing__model {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.landing__model-row {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: clamp(20px, 3vw, 48px);
		padding: clamp(22px, 2.6vw, 30px) 0;
		border-bottom: 1px solid var(--color-line);
		align-items: start;
		opacity: 0;
		animation: row-in 0.5s ease-out forwards;
		animation-delay: calc(0.3s + var(--row-index) * 0.08s);
	}
	.landing__model-row:last-child { border-bottom: none; }
	.landing__model-kpi {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-aurora-mint);
		padding-top: 6px;
		border-left: 2px solid var(--color-aurora-mint);
		padding-left: 14px;
	}
	.landing__model-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.landing__model-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.1rem, 1.4vw, 1.25rem);
		letter-spacing: -0.01em;
		color: var(--color-fg);
		margin: 0;
	}
	.landing__model-body {
		font-family: var(--font-display);
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--color-fg-dim);
		margin: 0;
		max-width: 64ch;
	}
	@media (max-width: 720px) {
		.landing__model-row { grid-template-columns: 1fr; gap: 14px; }
		.landing__model-kpi { padding-top: 0; }
	}

	/* ── Capabilities grid ────────────────────────────────────────────── */
	.landing__features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1px;
		background: var(--color-line);
		border: 1px solid var(--color-line);
	}
	.landing__feature {
		background: rgb(from var(--color-bg-raised) r g b / 0.55);
		padding: clamp(20px, 2.4vw, 32px);
		display: flex;
		flex-direction: column;
		gap: 12px;
		opacity: 0;
		animation: row-in 0.5s ease-out forwards;
		animation-delay: calc(0.4s + var(--row-index) * 0.06s);
		transition: background 0.3s ease;
	}
	.landing__feature:hover {
		background: rgb(from var(--color-bg-raised) r g b / 0.85);
	}
	.landing__feature-idx {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.22em;
		color: var(--color-aurora-mint);
	}
	.landing__feature-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.05rem;
		letter-spacing: -0.01em;
		color: var(--color-fg);
		margin: 0;
	}
	.landing__feature-body {
		font-family: var(--font-display);
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--color-fg-dim);
		margin: 0;
	}

	/* ── Initiative wordmark plates ───────────────────────────────────── */
	.landing__logos {
		display: flex;
		flex-wrap: wrap;
		gap: clamp(10px, 1.4vw, 18px);
	}
	.landing__logo {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 14px 18px;
		background: transparent;
		border: 1px solid var(--color-line-hi);
		text-decoration: none;
		opacity: 0;
		animation: row-in 0.4s ease-out forwards;
		animation-delay: calc(0.5s + var(--row-index) * 0.08s);
		transition: border-color 0.2s, background 0.2s, transform 0.2s;
	}
	.landing__logo:hover {
		border-color: var(--color-aurora-mint);
		background: rgb(from var(--color-aurora-mint) r g b / 0.06);
		transform: translateY(-1px);
	}
	.landing__logo:hover .landing__logo-bracket { color: var(--color-aurora-mint); }
	.landing__logo-bracket {
		font-family: var(--font-mono);
		font-size: 1.05rem;
		color: var(--color-fg-dim);
		transition: color 0.2s;
	}
	.landing__logo-text {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: -0.005em;
		color: var(--color-fg);
		padding: 0 6px;
	}

	/* ── Quickstart timeline ──────────────────────────────────────────── */
	.landing__quickstart {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.landing__qs-step {
		position: relative;
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: clamp(20px, 3vw, 40px);
		padding: 24px 0 26px;
		border-bottom: 1px solid var(--color-line);
		opacity: 0;
		animation: row-in 0.5s ease-out forwards;
		animation-delay: calc(0.3s + var(--row-index) * 0.1s);
	}
	.landing__qs-step:last-child { border-bottom: none; }
	.landing__qs-meta {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-aurora-arctic);
		padding-top: 6px;
	}
	.landing__qs-content { display: flex; flex-direction: column; gap: 8px; }
	.landing__qs-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.1rem, 1.4vw, 1.25rem);
		letter-spacing: -0.01em;
		color: var(--color-fg);
		margin: 0;
	}
	.landing__qs-body {
		font-family: var(--font-display);
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--color-fg-dim);
		margin: 0;
		max-width: 60ch;
	}
	.landing__qs-rail {
		position: absolute;
		left: 76px;
		top: 36px;
		bottom: -1px;
		width: 1px;
		background: linear-gradient(180deg,
			var(--color-aurora-arctic) 0%,
			rgb(from var(--color-aurora-arctic) r g b / 0.25) 100%);
	}
	.landing__qs-step:last-child .landing__qs-rail { display: none; }
	@media (max-width: 720px) {
		.landing__qs-step { grid-template-columns: 1fr; }
		.landing__qs-rail { display: none; }
	}

	/* ── Final CTA panel ──────────────────────────────────────────────── */
	.landing__final-cta {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: clamp(20px, 3vw, 40px);
		align-items: center;
		padding: clamp(24px, 3vw, 36px);
		border: 1px solid var(--color-aurora-mint);
		background: linear-gradient(135deg,
			rgb(from var(--color-aurora-mint) r g b / 0.06),
			transparent 60%);
	}
	.landing__final-cta-text { display: flex; flex-direction: column; gap: 8px; }
	.landing__final-cta-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.15rem, 1.5vw, 1.35rem);
		letter-spacing: -0.01em;
		color: var(--color-fg);
		margin: 0;
	}
	.landing__final-cta-body {
		font-family: var(--font-display);
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--color-fg-dim);
		margin: 0;
		max-width: 50ch;
	}
	.landing__final-cta-actions { display: flex; gap: 10px; flex-wrap: wrap; }
	@media (max-width: 720px) {
		.landing__final-cta { grid-template-columns: 1fr; }
		.landing__final-cta-actions :global(.btn) { flex: 1; }
	}

	/* ── Footer with horizon line ─────────────────────────────────────── */
	.landing__footer { margin-top: clamp(24px, 4vw, 48px); }
	.landing__horizon {
		height: 1px;
		background: linear-gradient(90deg,
			transparent,
			var(--color-aurora-arctic) 30%,
			var(--color-aurora-mint) 50%,
			var(--color-aurora-arctic) 70%,
			transparent);
		opacity: 0.5;
		margin-bottom: 16px;
	}
	.landing__footer-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: var(--color-fg-dim);
	}
	.landing__footer-link {
		color: var(--color-aurora-arctic);
		text-decoration: none;
	}
	.landing__footer-link:hover { text-decoration: underline; }
	.landing__footer-sep { opacity: 0.4; }
	.landing__footer-coords {
		font-feature-settings: 'tnum' 1;
		opacity: 0.6;
	}

	/* ── Responsive ───────────────────────────────────────────────────── */
	@media (max-width: 720px) {
		.landing__hero { grid-template-columns: 1fr; }
		.landing__hero-right { padding-top: 0; }
		.landing__principle { grid-template-columns: 48px 1fr; }
		.landing__stamp { font-size: 0.55rem; }
	}

	@media (prefers-reduced-motion: reduce) {
		.aurora-arc path,
		.landing__stamp,
		.landing__hero,
		.landing__problem-row,
		.landing__principle,
		.landing__feature,
		.landing__why-card,
		.landing__model-row,
		.landing__audience-item,
		.landing__qs-step,
		.landing__logo {
			animation: none;
			opacity: 1;
		}
	}
</style>
