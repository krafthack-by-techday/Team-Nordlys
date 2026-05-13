<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		message?: string;
	}

	let { message = m.empty_no_data() }: Props = $props();
</script>

<div class="empty">{message}</div>

<style>
	.empty {
		padding: 40px 20px;
		text-align: center;
		color: var(--color-fg-dim);
		font-style: italic;
	}
</style>
