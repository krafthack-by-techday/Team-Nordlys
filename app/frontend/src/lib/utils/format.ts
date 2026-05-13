/**
 * Date/time formatting utilities (Norwegian locale).
 * Single source of truth — used by EventRow, EventTimeline, EventTable, PeerDetail, TopologyGraph.
 */

/** Format ISO timestamp as "04. mai 2026, 15:36" */
export function fmtDateTime(iso: string): string {
	try {
		return new Date(iso).toLocaleDateString('nb-NO', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return '-';
	}
}

/** Format ISO timestamp as "04. mai 2026" (date only) */
export function fmtDate(iso: string): string {
	try {
		return new Date(iso).toLocaleDateString('nb-NO', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	} catch {
		return '-';
	}
}

/** Format ISO timestamp as "15:36:42" (time only) */
export function fmtTime(iso: string): string {
	try {
		return new Date(iso).toLocaleTimeString('nb-NO', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	} catch {
		return '-';
	}
}

/** Format ISO timestamp as "04. mai 15:36" (compact date+time for tables) */
export function fmtDateTimeShort(iso: string): string {
	try {
		const d = new Date(iso);
		return (
			d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }) +
			' ' +
			d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
		);
	} catch {
		return '-';
	}
}
