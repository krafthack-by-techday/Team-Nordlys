/**
 * Shared types — re-exports from @nordlys/contracts plus frontend-only types.
 *
 * Import from `$lib/api/types` (or via `$lib/api`) everywhere in the app.
 * Never duplicate contract types manually.
 */

// Domain types (single source of truth)
export type {
	SignedEvent,
	EventCore,
	EventIngestInput,
	SignedIndicator,
	IndicatorIngestInput,
	SignedPeerIdentity,
	PeerIdentity,
	PeerWithStatus,
	SignedChatMessage,
	ChatMessageInput,
	Vulnerability,
	Scan,
	ScanRequest,
	Revocation,
	InviteToken,
	InviteRedemption,
	ToolManifest,
	AuditLogEntry
} from '@nordlys/contracts';

import type { SignedEvent } from '@nordlys/contracts';

/** Event with optional relay path (transport metadata, not in signed payload). */
export type EventWithPath = SignedEvent & { path?: string[] };

// Primitive / enum types
export type {
	Severity,
	TLP,
	EventSource,
	IndicatorType,
	VulnerabilityStatus,
	VulnerabilitySource,
	TlpLevel,
	ScanStatus,
	VulnChangelogEntry,
	VulnFieldChange
} from '@nordlys/contracts';

/** Dashboard aggregate stats returned by the backend /stats endpoint. */
export interface Stats {
	node_id: string;
	node_display_name?: string;
	company: string;
	role: string;
	peers: {
		online: number;
		total: number;
	};
	events: {
		total: number;
		last_24h: number;
		critical_24h: number;
		actionable: number;
	};
	indicators: {
		total: number;
		tlp_red: number;
		tlp_amber: number;
	};
	incidents: {
		open: number;
	};
	vulnerabilities: {
		open: number;
		critical: number;
	};
}
