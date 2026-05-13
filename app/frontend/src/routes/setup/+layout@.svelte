<script lang="ts">
	import type { LayoutProps } from './$types';
	import '../layout.css';
	import Aurora from '$lib/components/Aurora.svelte';

	let { children }: LayoutProps = $props();
</script>

<Aurora />
{@render children()}
