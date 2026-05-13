<script lang="ts">
	import { mapError } from '$lib/utils/errors';
	import { m } from '$lib/paraglide/messages.js';
	import Version from '$lib/components/Version.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		error = '';
		loading = true;
		try {
			const resp = await fetch('/api/v1/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await resp.json();
			if (!resp.ok) {
				error = mapError(data.error);
				return;
			}
			window.location.href = '/dashboard';
		} catch {
			error = m.login_error_server();
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{m.login_page_title()}</title>
</svelte:head>

<div class="login">
	<article class="card card--elevated login__card">
		<header class="login__header">
			<h1 class="login__title">Nordlys</h1>
			<p class="login__subtitle">{m.login_subtitle()}</p>
		</header>

		<form class="login__form" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
			<div class="field">
				<label class="field__label" for="login-email">{m.login_label_email()}</label>
				<input
					class="input"
					id="login-email"
					type="email"
					bind:value={email}
					autocomplete="email"
					required
				/>
			</div>
			<div class="field">
				<label class="field__label" for="login-password">{m.login_label_password()}</label>
				<input
					class="input"
					id="login-password"
					type="password"
					bind:value={password}
					autocomplete="current-password"
					required
				/>
			</div>

			{#if error}
				<p class="field__error">{error}</p>
			{/if}

			<button class="btn btn--primary btn--block" type="submit" disabled={loading} aria-busy={loading ? 'true' : undefined}>
				{loading ? m.login_btn_loading() : m.login_btn_default()}
			</button>
		</form>
	</article>

	<footer class="login__footer"><Version /></footer>
</div>

<style>
	.login {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		position: relative;
		z-index: 5;
	}

	.login__card {
		width: 100%;
		max-width: 400px;
		padding: 2.4rem 2rem;
	}

	.login__header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.login__title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.4rem, 2vw, 1.8rem);
		letter-spacing: -0.03em;
		color: var(--color-aurora-mint);
		margin: 0;
	}

	.login__subtitle {
		color: var(--color-fg-dim);
		font-size: var(--text-ui-sm);
		margin: 0.35rem 0 0;
	}

	.login__form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.login__footer {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
	}
</style>
