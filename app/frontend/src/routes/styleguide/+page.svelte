<script lang="ts">
	import StatusDot from '$lib/components/StatusDot.svelte';
	import SeverityBadge from '$lib/components/SeverityBadge.svelte';
	import TlpBadge from '$lib/components/TlpBadge.svelte';
	import CopyButton from '$lib/components/CopyButton.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import KpiCard from '$lib/components/KpiCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Dialog from '$lib/components/Dialog.svelte';
	import { toast } from '$lib/components/Toast.svelte';

	// Interactive state for demos
	let segValue = $state<'all' | 'critical' | 'high'>('all');
	let paginationPage = $state(0);
	let dialogOpen = $state(false);

	// Sections for the sidebar nav
	const sections = [
		'tokens', 'badges', 'status', 'buttons', 'cards',
		'controls', 'feedback', 'loading', 'dialog', 'layout'
	] as const;

	let activeSection = $state<string>('tokens');
</script>

<svelte:head>
	<title>Styleguide — Nordlys</title>
</svelte:head>

<div class="sg">
	<aside class="sg__nav">
		<h2 class="sg__title">Component Catalog</h2>
		<nav>
			{#each sections as section}
				<a
					href="#{section}"
					class="sg__nav-link"
					class:active={activeSection === section}
					onclick={() => activeSection = section}
				>{section}</a>
			{/each}
		</nav>
	</aside>

	<main class="sg__content">
		<!-- TOKENS -->
		<section class="sg__section" id="tokens">
			<h2 class="sg__heading">Design Tokens</h2>
			<p class="sg__desc">Colors from style-kit. These CSS custom properties are available globally.</p>

			<div class="sg__group">
				<h3 class="sg__subheading">Aurora Palette</h3>
				<div class="sg__swatches">
					<div class="sg__swatch" style="background: var(--color-aurora-mint)"><span>mint</span></div>
					<div class="sg__swatch" style="background: var(--color-aurora-arctic)"><span>arctic</span></div>
					<div class="sg__swatch" style="background: var(--color-aurora-lichen)"><span>lichen</span></div>
				</div>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Semantic Colors</h3>
				<div class="sg__swatches">
					<div class="sg__swatch" style="background: var(--color-success)"><span>success</span></div>
					<div class="sg__swatch" style="background: var(--color-warning)"><span>warning</span></div>
					<div class="sg__swatch" style="background: var(--color-danger)"><span>danger</span></div>
					<div class="sg__swatch" style="background: var(--color-info)"><span>info</span></div>
				</div>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Surfaces</h3>
				<div class="sg__surfaces">
					<div class="sg__surface" style="background: var(--color-bg)">--color-bg</div>
					<div class="sg__surface" style="background: var(--color-bg-raised)">--color-bg-raised</div>
					<div class="sg__surface" style="background: var(--color-bg-sunken)">--color-bg-sunken</div>
				</div>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Typography</h3>
				<p style="font-family: var(--font-display); font-size: 1.5rem; font-weight: 700;">Display (Inter)</p>
				<p style="font-family: var(--font-sans); font-size: 1rem;">Sans (Inter)</p>
				<p style="font-family: var(--font-mono); font-size: 0.85rem; letter-spacing: 0.04em;">Mono (JetBrains Mono)</p>
			</div>
		</section>

		<!-- BADGES -->
		<section class="sg__section" id="badges">
			<h2 class="sg__heading">Badges</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">SeverityBadge</h3>
				<p class="sg__desc">Renders CVSS-style severity levels. Maps to style-kit <code>.badge--severity-*</code>.</p>
				<div class="sg__row">
					<SeverityBadge severity="critical" />
					<SeverityBadge severity="high" />
					<SeverityBadge severity="medium" />
					<SeverityBadge severity="low" />
				</div>
				<pre class="sg__code">&lt;SeverityBadge severity="critical" /&gt;</pre>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">TlpBadge</h3>
				<p class="sg__desc">Traffic Light Protocol classification badge.</p>
				<div class="sg__row">
					<TlpBadge tlp="RED" />
					<TlpBadge tlp="AMBER" />
					<TlpBadge tlp="GREEN" />
					<TlpBadge tlp="CLEAR" />
				</div>
				<div class="sg__row">
					<TlpBadge tlp="RED" size="xs" />
					<TlpBadge tlp="AMBER" size="sm" />
					<TlpBadge tlp="GREEN" size="lg" />
				</div>
				<pre class="sg__code">&lt;TlpBadge tlp="AMBER" size="sm" /&gt;</pre>
			</div>
		</section>

		<!-- STATUS -->
		<section class="sg__section" id="status">
			<h2 class="sg__heading">Status Indicators</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">StatusDot</h3>
				<p class="sg__desc">Animated status indicator for connectivity states.</p>
				<div class="sg__row">
					<span class="sg__label">online:</span> <StatusDot status="online" />
					<span class="sg__label">offline:</span> <StatusDot status="offline" />
					<span class="sg__label">revoked:</span> <StatusDot status="revoked" />
				</div>
				<div class="sg__row">
					<span class="sg__label">size=12:</span> <StatusDot status="online" size={12} />
					<span class="sg__label">no pulse:</span> <StatusDot status="online" pulse={false} />
				</div>
				<pre class="sg__code">&lt;StatusDot status="online" size=&#123;8&#125; pulse=&#123;true&#125; /&gt;</pre>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">InfoTip</h3>
				<p class="sg__desc">Hover tooltip for contextual help.</p>
				<div class="sg__row">
					<span>Some label</span>
					<InfoTip text="This is a helpful tooltip that appears on hover." />
				</div>
				<pre class="sg__code">&lt;InfoTip text="Helpful context" /&gt;</pre>
			</div>
		</section>

		<!-- BUTTONS -->
		<section class="sg__section" id="buttons">
			<h2 class="sg__heading">Buttons</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">CopyButton</h3>
				<p class="sg__desc">Inline clipboard copy with visual feedback.</p>
				<div class="sg__row">
					<code>CVE-2024-3400</code> <CopyButton value="CVE-2024-3400" />
					<code>192.168.1.1</code> <CopyButton value="192.168.1.1" size="md" />
				</div>
				<pre class="sg__code">&lt;CopyButton value="CVE-2024-3400" size="sm" /&gt;</pre>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Standard Buttons (style-kit)</h3>
				<div class="sg__row">
					<button class="btn">Default</button>
					<button class="btn btn--primary">Primary</button>
					<button class="btn btn--danger">Danger</button>
					<button class="btn btn--ghost">Ghost</button>
					<button class="btn" disabled>Disabled</button>
				</div>
				<pre class="sg__code">&lt;button class="btn btn--primary"&gt;Primary&lt;/button&gt;</pre>
			</div>
		</section>

		<!-- CARDS -->
		<section class="sg__section" id="cards">
			<h2 class="sg__heading">Cards</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">KpiCard</h3>
				<p class="sg__desc">Dashboard metric card with accent bar. Interactive (clickable).</p>
				<div class="sg__grid-3">
					<KpiCard label="Events" value={42} href="#cards" accent="mint">
						<span><b>12</b> critical</span>
					</KpiCard>
					<KpiCard label="Peers" value={7} href="#cards" accent="arctic">
						<span><b>5</b> online</span>
					</KpiCard>
					<KpiCard label="Vulns" value={128} href="#cards" accent="lichen" />
				</div>
				<pre class="sg__code">&lt;KpiCard label="Events" value=&#123;42&#125; href="/events" accent="mint"&gt;
  &lt;span&gt;&lt;b&gt;12&lt;/b&gt; critical&lt;/span&gt;
&lt;/KpiCard&gt;</pre>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Card CSS Classes (style-kit)</h3>
				<div class="sg__grid-3">
					<div class="card">.card (base)</div>
					<div class="card card--interactive">.card--interactive</div>
					<div class="card card--compact">.card--compact</div>
				</div>
			</div>
		</section>

		<!-- CONTROLS -->
		<section class="sg__section" id="controls">
			<h2 class="sg__heading">Controls</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">SegmentedControl</h3>
				<p class="sg__desc">Tab-like selector for filtering/modes. Generic over value type.</p>
				<SegmentedControl
					options={[
						{ value: 'all', label: 'All' },
						{ value: 'critical', label: 'Critical' },
						{ value: 'high', label: 'High' }
					]}
					value={segValue}
					onchange={(v) => segValue = v}
				/>
				<p class="sg__mono">Selected: {segValue}</p>
				<pre class="sg__code">&lt;SegmentedControl
  options=&#123;[&#123; value: 'all', label: 'All' &#125;, ...]&#125;
  value=&#123;segValue&#125;
  onchange=&#123;(v) =&gt; segValue = v&#125;
/&gt;</pre>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Pagination</h3>
				<p class="sg__desc">Page navigation with prev/next buttons.</p>
				<Pagination total={50} pageSize={10} page={paginationPage} onchange={(p) => paginationPage = p} />
				<pre class="sg__code">&lt;Pagination total=&#123;50&#125; pageSize=&#123;10&#125; page=&#123;page&#125; onchange=&#123;(p) =&gt; page = p&#125; /&gt;</pre>
			</div>
		</section>

		<!-- FEEDBACK -->
		<section class="sg__section" id="feedback">
			<h2 class="sg__heading">Feedback</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">Toast</h3>
				<p class="sg__desc">Notification toasts. Placed once in layout, triggered imperatively.</p>
				<div class="sg__row">
					<button class="btn" onclick={() => toast.success('Event submitted successfully')}>Success</button>
					<button class="btn" onclick={() => toast.error('Connection lost')}>Error</button>
					<button class="btn" onclick={() => toast.warning('API key expires in 24h')}>Warning</button>
					<button class="btn" onclick={() => toast.info('New peer joined the mesh')}>Info</button>
				</div>
				<pre class="sg__code">import &#123; toast &#125; from '$lib/components/Toast.svelte';
toast.success('Event submitted');
toast.error('Connection lost');
toast.warning('API key expires in 24h');</pre>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">EmptyState</h3>
				<p class="sg__desc">Placeholder shown when a data table or list has no items.</p>
				<EmptyState message="No vulnerabilities found for this filter." />
				<pre class="sg__code">&lt;EmptyState message="No vulnerabilities found." /&gt;</pre>
			</div>
		</section>

		<!-- LOADING -->
		<section class="sg__section" id="loading">
			<h2 class="sg__heading">Loading States</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">Skeleton</h3>
				<p class="sg__desc">Animated loading placeholders in various shapes.</p>

				<div class="sg__demo-col">
					<p class="sg__mono">variant="line" (default)</p>
					<Skeleton />
					<Skeleton lines={3} />
				</div>

				<div class="sg__demo-col">
					<p class="sg__mono">variant="card"</p>
					<Skeleton variant="card" height="80px" />
				</div>

				<div class="sg__demo-col">
					<p class="sg__mono">variant="circle"</p>
					<div class="sg__row">
						<Skeleton variant="circle" />
						<Skeleton variant="circle" width="3rem" height="3rem" />
					</div>
				</div>

				<pre class="sg__code">&lt;Skeleton lines=&#123;3&#125; /&gt;
&lt;Skeleton variant="card" height="80px" /&gt;
&lt;Skeleton variant="circle" /&gt;</pre>
			</div>
		</section>

		<!-- DIALOG -->
		<section class="sg__section" id="dialog">
			<h2 class="sg__heading">Dialog</h2>

			<div class="sg__group">
				<p class="sg__desc">Modal dialog wrapping native <code>&lt;dialog&gt;</code>. Supports backdrop click dismiss, ESC, and width variants.</p>
				<button class="btn btn--primary" onclick={() => dialogOpen = true}>Open Dialog</button>

				<Dialog
					open={dialogOpen}
					onclose={() => dialogOpen = false}
					title="Confirm Action"
					subtitle="STYLEGUIDE DEMO"
					width="default"
				>
					<p>This is a demo dialog. Press ESC, click the backdrop, or use the close button to dismiss.</p>
					{#snippet footer()}
						<button class="btn btn--ghost" onclick={() => dialogOpen = false}>Cancel</button>
						<button class="btn btn--primary" onclick={() => dialogOpen = false}>Confirm</button>
					{/snippet}
				</Dialog>

				<pre class="sg__code">&lt;Dialog open=&#123;showDialog&#125; onclose=&#123;() =&gt; showDialog = false&#125; title="Confirm" width="wide"&gt;
  &lt;p&gt;Content here&lt;/p&gt;
  &#123;#snippet footer()&#125;
    &lt;button class="btn" onclick=&#123;() =&gt; showDialog = false&#125;&gt;Cancel&lt;/button&gt;
  &#123;/snippet&#125;
&lt;/Dialog&gt;</pre>
			</div>
		</section>

		<!-- LAYOUT -->
		<section class="sg__section" id="layout">
			<h2 class="sg__heading">Layout &amp; Glass Effects</h2>

			<div class="sg__group">
				<h3 class="sg__subheading">Glass Classes (style-kit)</h3>
				<p class="sg__desc">Glassmorphism utility classes for frosted surfaces.</p>
				<div class="sg__grid-2">
					<div class="glass--panel" style="padding: 1.5rem;">.glass--panel</div>
					<div class="glass--controls" style="padding: 1rem;">.glass--controls</div>
				</div>
			</div>

			<div class="sg__group">
				<h3 class="sg__subheading">Spacing &amp; Layout Tokens</h3>
				<pre class="sg__code">--space-xs: 4px    --space-sm: 8px     --space-md: 16px
--space-lg: 24px   --space-xl: 32px    --space-2xl: 48px
--radius-sm: 4px   --radius-md: 8px    --radius-lg: 16px</pre>
			</div>
		</section>
	</main>
</div>

<style>
	.sg {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 2rem;
		min-height: 100vh;
	}

	.sg__nav {
		position: sticky;
		top: 0;
		height: fit-content;
		max-height: 100vh;
		overflow-y: auto;
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.sg__title {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-fg-dim);
		margin-bottom: 0.75rem;
	}

	.sg__nav-link {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: capitalize;
		color: var(--color-fg-dim);
		text-decoration: none;
		padding: 0.3rem 0.6rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}
	.sg__nav-link:hover {
		color: var(--color-fg);
		background: rgb(from var(--color-fg) r g b / 0.05);
	}
	.sg__nav-link.active {
		color: var(--color-aurora-mint);
		background: rgb(from var(--color-aurora-mint) r g b / 0.08);
	}

	.sg__content {
		display: flex;
		flex-direction: column;
		gap: 3rem;
		padding-bottom: 4rem;
	}

	.sg__section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.sg__heading {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-fg);
		border-bottom: 1px solid var(--color-line);
		padding-bottom: 0.5rem;
	}

	.sg__subheading {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-fg);
	}

	.sg__desc {
		font-size: 0.85rem;
		color: var(--color-fg-dim);
		line-height: 1.5;
	}
	.sg__desc code {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		background: rgb(from var(--color-fg) r g b / 0.08);
		padding: 0.15em 0.4em;
		border-radius: 3px;
	}

	.sg__group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sg__row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.sg__grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}
	.sg__grid-3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
	}

	.sg__label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-fg-dim);
		letter-spacing: 0.04em;
	}

	.sg__mono {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--color-fg-dim);
		letter-spacing: 0.04em;
	}

	.sg__code {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		line-height: 1.6;
		background: var(--color-bg-sunken);
		border: 1px solid var(--color-line);
		border-radius: 6px;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		white-space: pre;
		color: var(--color-fg-dim);
	}

	.sg__swatches {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.sg__swatch {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 6px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
	}
	.sg__swatch span {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: #fff;
		text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
	}

	.sg__surfaces {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.sg__surface {
		padding: 1rem 1.5rem;
		border-radius: 8px;
		border: 1px solid var(--color-line);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--color-fg-dim);
	}

	.sg__demo-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 400px;
	}

	@media (max-width: 768px) {
		.sg {
			grid-template-columns: 1fr;
		}
		.sg__nav {
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0.25rem;
		}
	}
</style>
