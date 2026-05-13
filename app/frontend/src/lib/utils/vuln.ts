/**
 * Vulnerability display utilities.
 * Single source of truth for badge classes, status labels, and severity helpers.
 */

import { m } from '$lib/paraglide/messages.js';

/** Returns badge class for a severity level (configurable size). */
export function severityBadge(severity: string, size: 'xs' | 'sm' | 'md' = 'sm'): string {
	return `badge badge--${size} badge--severity-${severity}`;
}

/** Returns badge class for a vulnerability status (configurable size). */
export function statusBadge(status: string, size: 'xs' | 'sm' | 'md' = 'xs'): string {
	switch (status) {
		case 'new':
			return `badge badge--${size} badge--severity-high`;
		case 'acknowledged':
			return `badge badge--${size} badge--severity-medium`;
		case 'in_progress':
			return `badge badge--${size} badge--severity-low`;
		case 'mitigated':
			return `badge badge--${size} badge--status-active`;
		case 'not_applicable':
			return `badge badge--${size} badge--status-inactive`;
		case 'exploited':
			return `badge badge--${size} badge--severity-critical`;
		default:
			return `badge badge--${size}`;
	}
}

/** Returns i18n label for a vulnerability status. */
export function statusLabel(status: string): string {
	switch (status) {
		case 'new':
			return m.vuln_status_new();
		case 'acknowledged':
			return m.vuln_status_acknowledged();
		case 'in_progress':
			return m.vuln_status_in_progress();
		case 'mitigated':
			return m.vuln_status_mitigated();
		case 'not_applicable':
			return m.vuln_status_not_applicable();
		case 'exploited':
			return m.vuln_status_exploited();
		default:
			return status;
	}
}
