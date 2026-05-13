/**
 * Relative time formatting utilities.
 * Single source of truth — used by PeerCard, PeerDetail, TopologyGraph, etc.
 */

/**
 * Format an ISO timestamp as a relative "time ago" string.
 * @param iso - ISO 8601 timestamp or undefined
 * @param short - Use short labels (e.g. "3m" vs "3 min siden")
 * @returns Norwegian relative time string
 */
export function timeAgo(iso: string | undefined, short = false): string {
	if (!iso) return short ? 'ukjent' : 'Ukjent';
	const diff = Date.now() - new Date(iso).getTime();
	const sec = Math.floor(diff / 1000);
	if (sec < 60) return short ? 'nå' : 'Akkurat nå';
	const min = Math.floor(sec / 60);
	if (min < 60) return short ? `${min}m siden` : `${min} min siden`;
	const hrs = Math.floor(min / 60);
	if (hrs < 24) return short ? `${hrs}t siden` : `${hrs} timer siden`;
	const days = Math.floor(hrs / 24);
	return short ? `${days}d siden` : `${days} dager siden`;
}
