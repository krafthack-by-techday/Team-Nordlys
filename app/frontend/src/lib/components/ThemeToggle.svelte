<script lang="ts">
	let dark = $state(true);

	$effect(() => {
		// Read initial theme from DOM (set by inline script in app.html)
		dark = document.documentElement.getAttribute('data-theme') !== 'light';
	});

	function toggle() {
		dark = !dark;
		const theme = dark ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('nordlys-theme', theme);
	}
</script>

<button
	onclick={toggle}
	aria-label={dark ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
	class="theme-toggle"
>
	{#if dark}
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="5" />
			<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
		</svg>
	{:else}
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		position: fixed;
		top: 12px;
		right: 14px;
		z-index: 100;
		width: 36px;
		height: 36px;
		border-radius: 6px;
		border: 1px solid var(--color-line-hi);
		background: var(--color-bg-raised);
		color: var(--color-fg-dim);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s, background 0.2s;
	}
	.theme-toggle:hover {
		color: var(--color-aurora-mint);
		background: var(--color-bg);
	}
</style>
