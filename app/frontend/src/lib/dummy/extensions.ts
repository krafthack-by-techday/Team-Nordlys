import type { Extension } from '$lib/types/extension';

export const mockExtensions: Extension[] = [
	{
		id: 'kraftcert-vurderte-varsler',
		name: 'KraftCERT Vurderte Varsler',
		description:
			'Sektorspesifikke varsler vurdert og kvalitetssikret av KraftCERT. Distribueres til alle peers via meshet med kontekst om aktør, kampanje og sektorrelevans.',
		author: 'KraftCERT',
		version: '2.1.0',
		kind: 'isac',
		trustTier: 'anchor-signed',
		qualityRating: 'platinum',
		installed: true,
		enabled: true,
		capabilities: ['event.publish', 'indicator.publish'],
		capabilityJustifications: {
			'event.publish': 'Publiserer KraftCERTs vurderte varsler som hendelser til peers i meshet.',
			'indicator.publish': 'Deler tilhørende IOC-er (IP, hash, domene) knyttet til varslene.'
		},
		maxTlp: 'AMBER',
		downloads: 42,
		updatedAt: '2026-05-10'
	},
	{
		id: 'kraftcert-berikelse',
		name: 'KraftCERT Berikelse',
		description:
			'Automatisk berikelse av IOC-er med KraftCERTs kontekst: trusselaktør, kampanje, sektorrelevans og historiske koblinger.',
		author: 'KraftCERT',
		version: '1.4.2',
		kind: 'isac',
		trustTier: 'anchor-signed',
		qualityRating: 'gold',
		installed: true,
		enabled: true,
		capabilities: ['indicator.read', 'indicator.enrich', 'outbound.http'],
		capabilityJustifications: {
			'indicator.read': 'Leser lokale IOC-er for å finne kandidater til berikelse.',
			'indicator.enrich': 'Legger til aktør-, kampanje- og sektorkontekst på eksisterende IOC-er.',
			'outbound.http': 'Henter berikelsesdata fra KraftCERTs CTI-API (api.kraftcert.no, cti.kraftcert.no).'
		},
		allowedHosts: [
			{ host: 'api.kraftcert.no', port: 443, protocol: 'HTTPS' },
			{ host: 'cti.kraftcert.no', port: 443, protocol: 'HTTPS' }
		],
		maxTlp: 'RED',
		downloads: 42,
		updatedAt: '2026-04-28'
	},
	{
		id: 'kraftcert-varslingsstotte',
		name: 'KraftCERT Varslingsstøtte',
		description:
			'Ferdig-formaterte rapporter til NVE/NSM basert på hendelsesdata i noden. Reduserer tid fra hendelse til lovpålagt varsling.',
		author: 'KraftCERT',
		version: '1.2.0',
		kind: 'isac',
		trustTier: 'anchor-signed',
		qualityRating: 'gold',
		installed: false,
		enabled: false,
		capabilities: ['event.read', 'report.generate', 'outbound.http'],
		capabilityJustifications: {
			'event.read': 'Leser hendelsesdata for å generere varslingsskjema til NVE/NSM.',
			'report.generate': 'Formaterer hendelser til lovpålagt rapportmal.',
			'outbound.http': 'Sender ferdig rapport til NVEs og NSMs meldingsportaler.'
		},
		allowedHosts: [
			{ host: 'melding.nve.no', port: 443, protocol: 'HTTPS' },
			{ host: 'varsling.nsm.no', port: 443, protocol: 'HTTPS' }
		],
		maxTlp: 'AMBER',
		downloads: 38,
		updatedAt: '2026-04-15'
	},
	{
		id: 'kraftcert-ovelsesmodus',
		name: 'KraftCERT Øvelsesmodus',
		description:
			'Simulerte hendelser merket som øvelse, slik at sektoren kan trene koordinert respons uten å forurense produksjonsdata.',
		author: 'KraftCERT',
		version: '0.9.1',
		kind: 'isac',
		trustTier: 'anchor-signed',
		qualityRating: 'silver',
		installed: false,
		enabled: false,
		capabilities: ['event.publish', 'event.read', 'exercise.manage'],
		capabilityJustifications: {
			'event.publish': 'Injiserer simulerte hendelser merket som øvelse i meshet.',
			'event.read': 'Leser eksisterende hendelser for å lage realistiske øvelsesscenarier.',
			'exercise.manage': 'Oppretter, starter og avslutter øvelsessesjoner med tidsstyring.'
		},
		maxTlp: 'GREEN',
		downloads: 24,
		updatedAt: '2026-03-20'
	},
	{
		id: 'abb-relion-adapter',
		name: 'ABB Relion Adapter',
		description:
			'Parser for ABB Relion vernereléer. Normaliserer hendelser fra reléets hendelseslogg til Nordlys-format for deling i meshet.',
		author: 'ABB Power Grids',
		version: '1.1.3',
		kind: 'vendor-adapter',
		trustTier: 'publisher-signed',
		qualityRating: 'gold',
		installed: true,
		enabled: true,
		capabilities: ['event.read', 'event.publish', 'device.discover'],
		capabilityJustifications: {
			'event.read': 'Leser eksisterende hendelser for korrelasjon med Relion-alarmer.',
			'event.publish': 'Publiserer normaliserte hendelser fra Relion-vernereléer til meshet.',
			'device.discover': 'Oppdager Relion-enheter på nettverket via IEC 61850 MMS-protokollen.'
		},
		maxTlp: 'AMBER',
		downloads: 31,
		updatedAt: '2026-05-02'
	},
	{
		id: 'siemens-sicam-adapter',
		name: 'Siemens SICAM Adapter',
		description:
			'Kobler Siemens SICAM A8000-serien til Nordlys. Parser OT-hendelser og alarmer fra SICAM-enheter.',
		author: 'Siemens Energy',
		version: '0.8.0',
		kind: 'vendor-adapter',
		trustTier: 'publisher-signed',
		qualityRating: 'silver',
		installed: false,
		enabled: false,
		capabilities: ['event.read', 'event.publish', 'device.discover'],
		capabilityJustifications: {
			'event.read': 'Leser eksisterende hendelser for deduplisering mot SICAM-alarmer.',
			'event.publish': 'Publiserer normaliserte OT-hendelser fra SICAM A8000 til meshet.',
			'device.discover': 'Oppdager SICAM-enheter på nettverket via IEC 60870-5-104.'
		},
		maxTlp: 'AMBER',
		downloads: 18,
		updatedAt: '2026-04-10'
	},
	{
		id: 'kraftsektor-deteksjon',
		name: 'Kraftsektor Deteksjonspakke',
		description:
			'Kuraterte YAML-deteksjonsscenarier for norsk kraftsektor: ICS/SCADA-angrep, OT-protokollanomalier, og kjente TTP-er mot kraftinfrastruktur.',
		author: 'KraftCERT',
		version: '3.0.1',
		kind: 'scenario-pack',
		trustTier: 'anchor-signed',
		qualityRating: 'platinum',
		installed: true,
		enabled: true,
		capabilities: ['scenario.register', 'event.publish', 'indicator.read'],
		capabilityJustifications: {
			'scenario.register': 'Registrerer YAML-deteksjonsscenarier i collector-modulen.',
			'event.publish': 'Publiserer hendelser når et deteksjonsscenario utløses.',
			'indicator.read': 'Leser kjente IOC-er for å korrelere med scenariotreff.'
		},
		maxTlp: 'GREEN',
		downloads: 42,
		updatedAt: '2026-05-08'
	},
	{
		id: 'nve-nsm-rapport',
		name: 'NVE/NSM Rapporteksport',
		description:
			'Eksporterer hendelser og situasjonsrapporter i formatet påkrevd av NVE og NSM. Forenkler lovpålagt rapportering under kraftberedskapsforskriften.',
		author: 'KraftCERT',
		version: '1.3.0',
		kind: 'export',
		trustTier: 'anchor-signed',
		qualityRating: 'gold',
		installed: true,
		enabled: true,
		capabilities: ['event.read', 'report.generate', 'report.export'],
		capabilityJustifications: {
			'event.read': 'Leser hendelser som grunnlag for lovpålagt situasjonsrapport.',
			'report.generate': 'Genererer rapport i kraftberedskapsforskriftens format.',
			'report.export': 'Eksporterer ferdig rapport til fil eller API.'
		},
		maxTlp: 'AMBER',
		downloads: 39,
		updatedAt: '2026-04-22'
	},
	{
		id: 'stix-taxii-eksport',
		name: 'STIX/TAXII Eksport',
		description:
			'Eksporterer indikatorer og hendelser som STIX 2.1-bunter via TAXII 2.1-protokollen for interoperabilitet med MISP, OpenCTI og andre CTI-plattformer.',
		author: 'Nordlys Community',
		version: '1.0.2',
		kind: 'export',
		trustTier: 'publisher-signed',
		qualityRating: 'silver',
		installed: false,
		enabled: false,
		capabilities: ['event.read', 'indicator.read', 'outbound.http', 'report.export'],
		capabilityJustifications: {
			'event.read': 'Leser hendelser for transformasjon til STIX 2.1-objekter.',
			'indicator.read': 'Leser IOC-er for eksport som STIX indicators.',
			'outbound.http': 'Sender STIX-bunter til TAXII 2.1-server (taxii.statnett.no).',
			'report.export': 'Eksporterer STIX-bunter til fil ved behov.'
		},
		allowedHosts: [
			{ host: 'taxii.statnett.no', port: 443, protocol: 'HTTPS' }
		],
		maxTlp: 'GREEN',
		downloads: 27,
		updatedAt: '2026-03-30'
	},
	{
		id: 'nvd-sarbarhetskilde',
		name: 'NVD Sårbarhetskilde',
		description:
			'Henter CVE-er fra NIST NVD og beriker med CVSS-score, referanser og kjent utnyttelse (CISA KEV). Dedupliserer mot lokale funn.',
		author: 'Nordlys Community',
		version: '2.0.0',
		kind: 'source',
		trustTier: 'publisher-signed',
		qualityRating: 'gold',
		installed: true,
		enabled: true,
		capabilities: ['vulnerability.publish', 'outbound.http', 'indicator.publish'],
		capabilityJustifications: {
			'vulnerability.publish': 'Lagrer hentede CVE-er i lokal sårbarhetsdatabase.',
			'outbound.http': 'Henter CVE-data fra NVD REST API og CISA KEV-feed.',
			'indicator.publish': 'Publiserer IOC-er utledet fra kjent utnyttede sårbarheter (CISA KEV).'
		},
		allowedHosts: [
			{ host: 'services.nvd.nist.gov', port: 443, protocol: 'HTTPS' },
			{ host: 'www.cisa.gov', port: 443, protocol: 'HTTPS' }
		],
		maxTlp: 'CLEAR',
		downloads: 40,
		updatedAt: '2026-05-06'
	},
	{
		id: 'misp-sync',
		name: 'MISP Synkronisering',
		description:
			'Toveis synkronisering med MISP-instanser. Importerer IOC-er og hendelser fra MISP til Nordlys, og eksporterer lokale funn tilbake som MISP-events med korrekt TLP-mapping.',
		author: 'Nordlys Community',
		version: '1.2.0',
		kind: 'source',
		trustTier: 'publisher-signed',
		qualityRating: 'gold',
		installed: true,
		enabled: true,
		capabilities: ['indicator.read', 'indicator.publish', 'event.read', 'event.publish', 'outbound.http'],
		capabilityJustifications: {
			'indicator.read': 'Leser lokale IOC-er for synkronisering til MISP.',
			'indicator.publish': 'Importerer IOC-er fra MISP til lokal node.',
			'event.read': 'Leser lokale hendelser for eksport til MISP-events.',
			'event.publish': 'Importerer MISP-events som lokale hendelser.',
			'outbound.http': 'Kommuniserer med MISP REST API for toveis synkronisering.'
		},
		allowedHosts: [
			{ host: 'misp.statnett.no', port: 443, protocol: 'HTTPS' }
		],
		maxTlp: 'AMBER',
		downloads: 35,
		updatedAt: '2026-05-01'
	},
	{
		id: 'fysisk-sikkerhet',
		name: 'Fysisk Sikkerhet',
		description:
			'Rapportering av fysiske sikkerhetshendelser: drone-observasjoner, uautorisert fotografering av infrastruktur, innbruddsforsøk. Normalisert og delt i meshet.',
		author: 'Nordlys Community',
		version: '0.4.0',
		kind: 'detector',
		trustTier: 'publisher-signed',
		qualityRating: 'bronze',
		installed: false,
		enabled: false,
		capabilities: ['event.publish', 'event.read'],
		capabilityJustifications: {
			'event.publish': 'Publiserer fysiske sikkerhetshendelser (drone, fotografering, innbrudd) til meshet.',
			'event.read': 'Leser eksisterende hendelser for å unngå duplikater av samme observasjon.'
		},
		maxTlp: 'AMBER',
		downloads: 9,
		updatedAt: '2026-02-14'
	}
];
