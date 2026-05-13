/**
 * Global dummy-mode toggle.
 *
 * When enabled, all views are populated with realistic demo data
 * instead of relying on the live backend. State is persisted in
 * localStorage so it survives page reloads.
 *
 * Usage:
 *   import { dummyMode } from '$lib/dummy/mode.svelte';
 *   dummyMode.enabled   // reactive boolean
 *   dummyMode.toggle()  // flip on/off
 */

const STORAGE_KEY = 'nordlys-dummy-mode';

function readInitial(): boolean {
	if (typeof window === 'undefined') return false;
	return localStorage.getItem(STORAGE_KEY) === '1';
}

let enabled = $state(readInitial());

export const dummyMode = {
	get enabled() { return enabled; },
	toggle() {
		enabled = !enabled;
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
		}
		// Full reload so server load functions also see the change isn't needed —
		// we seed the liveStore client-side and it overrides SSR data.
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}
};
