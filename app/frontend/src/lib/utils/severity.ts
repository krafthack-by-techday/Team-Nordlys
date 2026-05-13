/**
 * Severity ordering and comparison utilities.
 * Single source of truth — used by EventFeed, EventTable, etc.
 */

export const SEV_RANK: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4
};

/** Get numeric rank for a severity string (lower = more severe). */
export function sevRank(severity: string): number {
	return SEV_RANK[severity.toLowerCase()] ?? 4;
}

/** Compare two severity strings (for sorting). Negative = a is more severe. */
export function compareSeverity(a: string, b: string): number {
	return sevRank(a) - sevRank(b);
}

/** Return the most severe severity from a list of strings. */
export function worstSeverity(severities: string[]): string | null {
	let best: string | null = null;
	for (const s of severities) {
		if (best === null || sevRank(s) < sevRank(best)) best = s;
	}
	return best;
}
