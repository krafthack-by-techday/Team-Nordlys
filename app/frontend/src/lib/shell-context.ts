import { getContext, setContext } from 'svelte';
import type { Snippet } from 'svelte';
import { m } from '$lib/paraglide/messages.js';

const SHELL_KEY = 'shell-context';

export interface ShellContext {
	readonly fullscreen: boolean;
	toggleFullscreen: () => void;
}

export function setShellContext(ctx: ShellContext) {
	setContext(SHELL_KEY, ctx);
}

export function getShellContext(): ShellContext {
	return getContext<ShellContext>(SHELL_KEY);
}

/** Route label map for breadcrumb — calls Paraglide at render time. */
export function getRouteLabel(pathname: string): string {
	const labels: Record<string, () => string> = {
		'/': () => 'Nordlys',
		'/dashboard': () => m.nav_dashboard(),
		'/dashboard/topology': () => m.nav_topology(),
		'/dashboard/events': () => m.nav_events(),
		'/dashboard/vulnerabilities': () => m.nav_vulnerabilities(),
		'/dashboard/health': () => m.nav_health(),
		'/dashboard/settings': () => m.nav_settings(),
		'/styleguide': () => 'Styleguide'
	};
	return labels[pathname]?.() ?? pathname.slice(1);
}

/** Route caption/subtitle for display below breadcrumb. */
export function getRouteCaption(pathname: string): string | null {
	const captions: Record<string, () => string> = {
		'/dashboard/events': () => m.events_caption(),
		'/dashboard/vulnerabilities': () => m.vuln_subtitle(),
		'/dashboard/health': () => m.health_subtitle(),
		'/dashboard/topology': () => m.topology_caption(),
	};
	return captions[pathname]?.() ?? null;
}
