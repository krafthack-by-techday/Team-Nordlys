export type ExtensionKind =
	| 'isac'
	| 'vendor-adapter'
	| 'scenario-pack'
	| 'export'
	| 'source'
	| 'scanner'
	| 'detector';

export type TrustTier = 'anchor-signed' | 'publisher-signed';
export type QualityRating = 'platinum' | 'gold' | 'silver' | 'bronze';
export type TlpLevel = 'RED' | 'AMBER' | 'GREEN' | 'CLEAR';

export interface Extension {
	id: string;
	name: string;
	description: string;
	author: string;
	version: string;
	kind: ExtensionKind;
	trustTier: TrustTier;
	qualityRating: QualityRating;
	installed: boolean;
	enabled: boolean;
	capabilities: string[];
	/** Developer-provided justification for each capability (like Apple's usage descriptions) */
	capabilityJustifications?: Record<string, string>;
	/** Developer-declared allowed outbound hosts (fixed in manifest, verified at signing) */
	allowedHosts?: { host: string; port: number; protocol: 'HTTPS' | 'HTTP' }[];
	maxTlp: TlpLevel;
	downloads: number;
	updatedAt: string;
}
