/**
 * Dummy data generators for all Nordlys domain types.
 *
 * Realistic Nordic energy-sector data for demo/presentation purposes.
 * All data is deterministic per-seed for reproducibility.
 */

import type {
	SignedEvent,
	SignedIndicator,
	SignedChatMessage,
	PeerWithStatus,
	Stats,
	Vulnerability,
	Severity,
	TLP,
	EventSource,
	IndicatorType,
	VulnerabilityStatus,
	VulnerabilitySource
} from '$lib/api/types';

// ── Helpers ──────────────────────────────────────────────────────────

let _seed = 42;
function seededRandom(): number {
	_seed = (_seed * 16807 + 0) % 2147483647;
	return (_seed - 1) / 2147483646;
}
function resetSeed(s = 42) { _seed = s; }
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(seededRandom() * arr.length)]!; }
function pickN<T>(arr: readonly T[], n: number): T[] {
	const shuffled = [...arr].sort(() => seededRandom() - 0.5);
	return shuffled.slice(0, n);
}
function uuid(): string {
	const h = '0123456789abcdef';
	let u = '';
	for (let i = 0; i < 32; i++) {
		if (i === 8 || i === 12 || i === 16 || i === 20) u += '-';
		u += h[Math.floor(seededRandom() * 16)];
	}
	return u;
}
function isoAgo(hoursAgo: number): string {
	return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}
function fakeSignature(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let sig = '';
	for (let i = 0; i < 64; i++) sig += chars[Math.floor(seededRandom() * chars.length)];
	return sig + '==';
}
function fakePublicKey(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let key = '';
	for (let i = 0; i < 44; i++) key += chars[Math.floor(seededRandom() * chars.length)];
	return key;
}

// ── Realistic data pools ─────────────────────────────────────────────

// All Norwegian energy companies with P/D/R/S concessions from NVE's official list.
// Source: https://www.nve.no/reguleringsmyndigheten/publikasjoner-og-data/data-og-noekkeltall/liste-over-konsesjonaerer/
// Additional: KraftCERT (sectoral CERT), NVE (regulator)
const COMPANIES = [
	'KraftCERT', 'NVE',
	'AS Egelands Verk', 'AS Randsfjord Tremasse- & Papirfabrikk', 'Aa-tverrelva Kraft',
	'Aker BP', 'Aksa Vann', 'Aktieselskabet Saudefaldene', 'Aktieselskabet Tyssefaldene',
	'Albert Collett', 'Alcoa Norway', 'Alltec', 'Alta Kraftlag', 'Alut', 'Aneo',
	'Anga Kraft', 'Arctic Wind', 'Area Nett', 'Arendals Fossekompani', 'Arva',
	'Asker Nett', 'Asko Hedmark', 'Asko Oslo', 'Asko Øst', 'Aurland Energiverk',
	'Austri Kjølberget', 'Austri Raskiftet', 'Avinor', 'BKK', 'Bagn Kraftverk',
	'Ballangen Energi', 'Ballangen Utvikling', 'Bane Nor', 'Barents Nett',
	'Befring Kraft', 'Bele Kraft', 'Bergesli Kraftverk', 'Bergselvi Kraftverk',
	'Bindal Kraftlag', 'Bir Ressurs', 'Birtedalen Kraftverk', 'Bjerkreim Vind',
	'Boen Foss', 'Boge Kraft', 'Bonntjennsvegen 13', 'Borregaard', 'Botna Kraft',
	'Botnen Kraftverk', 'Brattabøelvi Kraft', 'Brattvåg Kraftverk', 'Breheim Nett',
	'Breivikelva Kraft', 'Breivold Energi', 'Brekkefossen Kraftverk', 'Brunstad Kraft',
	'Bråberg Kraft', 'Buheii Vindkraft', 'Buset Kraft', 'Bøen Kraft', 'Bølakraft',
	'Bømlo Kraftnett', 'Børter E Verk', 'Cadre Elvekraft', 'Cadre Elvekraft 2',
	'Chr Salvesen & Chr Thams\'s Communications Aktieselskab', 'Clemens Kraft',
	'DB Kraftverk', 'DE Nett', 'Dagsvikelva Kraft', 'Dalane Kraft', 'Dalane Vind',
	'Dale Kraft', 'Desconda', 'Dragefossen', 'Drangedal Kraft', 'Dravlaus Kraft',
	'Driva Kraftverk', 'Dvergfossen Kraft', 'Dyrdal Kraft', 'Dyrstad Kraft',
	'Dønnesfjord Vindpark', 'Døvik Kraft', 'EFTESTØL Ole Tom', 'Eastern Norge Svartisen',
	'Egersund Vind', 'Eidefoss Vannkraft', 'Eidsdal Kraftverk', 'Eidsiva Bioenergi',
	'Eidsland Energi', 'Eikemo Kraftverk', 'Eiker Kraftproduksjon', 'Eldao Kraftverk',
	'Elinett', 'Elkem', 'Elmea', 'Elvenett', 'Elvia', 'Embla Kraft',
	'Embretsfosskraftverkene', 'Endra', 'Energeia Seval Skog', 'Engene Solar', 'Enida',
	'Enny Asset Management', 'Equinor', 'Eramet Norway', 'Ervikselva Kraft',
	'Espeelvi Kraft', 'Etna Nett', 'Everket', 'Eviny Fornybar', 'Eviny Termo',
	'Ewz Måkaknuten Vind', 'Ewz Stigafjellet Vind', 'Fagne', 'Fakken Vind',
	'Feios Kraftverk', 'Felleskjøpet Agri', 'Finndøla Kraftverk', 'Firdakraft',
	'Fitjar Kraftlag', 'Fjellnett', 'Fjerdingelva', 'Fjærland Kraft', 'Follsjå Kraft',
	'Forsøget Haugaelva Småkraftverk', 'Forus Energigjenvinning 2', 'Fosen Vind',
	'Fosenkraft Energi', 'Fossane Wijgergangs', 'Fossbråten Kraftverk',
	'Fossdalen Kraftverk', 'Fossheim Energiverk', 'Fossåa 1 K',
	'Fredrikstad Innovasjonspark', 'Freim Kraft', 'Fritzøe Energi', 'Frøya Vind',
	'Fugleåsen 7', 'Fugleåsen Logistikk', 'Furuseth Solkraftverk', 'Føie', 'Føre',
	'Geitåni Kraftverk', 'Gismarvik Vindkraft', 'Gjemlestad Kraftverk',
	'Gjerdelva Kraft', 'Gjesdal Kraft', 'Gjuvåa Kraftverk', 'Glesåa Kraftverk',
	'Glitre Nett', 'Glitrevannverket', 'Glomma Kraftproduksjon', 'Gloppen Energi',
	'Glutra Kraft', 'Godfarfoss Kraft', 'Graffer Kraft', 'Gravbrøtfoss Kraft', 'Griug',
	'Grunnåi Kraftverk', 'Gråklubben Kraftverk', 'Grøndalselva',
	'Gudbrandsdal Energi Produksjon', 'Gul Energi', 'Guleslettene Vindkraft',
	'Gullbergelva Kraftverk', 'Gyl Kraft', 'Hadeland Kraftproduksjon', 'Hafslund Celsio',
	'Hafslund Kraft', 'Hafslund Kraft Innlandet', 'Hafslund Produksjon',
	'Halden Kraftproduksjon', 'Halvdagsåa Kraft', 'Hammerfest Energi Produksjon',
	'Hamnefjell Vindkraft', 'Haram Kraft', 'Hardanger Energi', 'Haringnett',
	'Haugsvær Kraft', 'Haukvik Kraft', 'Havnett', 'Heidelva Kraftverk', 'Heina Kraft',
	'Helgeland Kraft Vannkraft', 'Hellefoss Kraft', 'Hellifossen Kraft', 'Herand Kraft',
	'Herøya Nett', 'Hias', 'Hisvatn Kraftlag', 'Hitra Vind', 'Holmen Kraft',
	'Holsen Kraft Norddøla', 'Hopland Kraft', 'Horpedal Kraft', 'Hovuduk Kraftverk',
	'Hundhammerfjellet', 'Husstøl Kraftverk', 'Husvollåe Kraft', 'Hydro Aluminium',
	'Hydro Energi', 'Hydro Renewables Holding', 'Hydropower', 'Hynna Kraft',
	'Håndverksveien 10-12', 'Høland OG Setskog Elverk', 'Høydal Kraftverk',
	'Indre Hordaland Kraftnett', 'Infranord', 'Infranord Produksjon',
	'Innlandet Fornybar Kile', 'Innlandet Fornybar Måna', 'Innvik Kraftverk',
	'Interfrukt', 'Ise Kvarv Kraft', 'Ise Produksjon Røyrvatn', 'Istad Kraft',
	'Jorda Kraft', 'Jordalen Kraftlag', 'Jotun Kraftproduksjon', 'Julfoss Kraftverk',
	'Jæren Energi', 'Jæren Everk', 'Jølstra Kraft', 'Jølåna Kraft',
	'Jørnevikelva Kraftverk', 'Jørpeland Kraft', 'KE Nett', 'Kaldåna Kraft',
	'Kandal Kraftverk', 'Kjeldalselva Kraft', 'Kjerringnes Kraft', 'Kjeråa Kraftverk',
	'Kjøllefjord Vind', 'Klauva Kraft', 'Klive', 'Kogen', 'Kongsberg Energiselskap',
	'Kongsberg Teknologipark', 'Kraftia Tjenester', 'Kraftverkene I Orkla',
	'Kroka2 Kraft', 'Krossdalselvi Kraft', 'Kupe Kraftverk', 'Kupekraft',
	'Kuvelda Kraft', 'Kvalheim Kraft', 'Kvam Kraftverk', 'Kvannvatn Kraft',
	'Kveldroveien 19', 'Kvemma Kraft', 'Kvennhusåi Kraftverk', 'Kvernfossen Kraft',
	'Kverninga Kraftverk', 'Kvinnherad Energi', 'Kvitno Kraft',
	'Kvitvella Electrisitetsverk', 'Kviven Kraft', 'Kværnertomta', 'Kvævebekken 2',
	'Kylland Kraft', 'Kystnett', 'Langedal Kraft', 'Langfjordkraft',
	'Lauvstad Kraftverk', 'Lede', 'Leikanger Kraft',
	'Lhi Solarwind Hydro Grønlielva 2641', 'Lhi Solarwind Hydro Kulu 2642',
	'Lhi Solarwind Hydro Ryddøla 2643', 'Lhi Solarwind Hydro Vikaåne 2644',
	'Lhi Solarwind Hydro Voldsetelva 2645', 'Lifjellkraft', 'Linea', 'Linja',
	'Lista Vindkraftverk', 'Litj-hena Kraftverk', 'Litlebø Kraft', 'Ljotå Kraftverk',
	'Lnett', 'Lofotkraft Produksjon', 'Login Vagle', 'Login Vinterbro',
	'Lona Kraftverk', 'Lucerna', 'Lunds Energi Norge', 'Luster Småkraft',
	'Lutelandet Energipark', 'Lyse Neo', 'Lyse Produksjon', 'Lysna', 'Lysvatn',
	'Lysåelva Kraftverk', 'Løvenskiold Fossum Kraft', 'MK Kraft', 'MT Eiendom II',
	'Madland Kraft', 'Malmo Elektrisitetsverk', 'Marine Trading', 'Marker Vindpark',
	'Markåni Kraftverk', 'Mellom', 'Meløy Energi', 'Meraker Kraft', 'Midgard Vind',
	'Midt Energi', 'Midt Kraft', 'Midtfjellet Vindkraft', 'Midtnett', 'Midtunkraft',
	'Mip Miljøkraft', 'Misfjord Kraftverk', 'Mjølsvik Kraft',
	'Modum Kraftproduksjon KF', 'Mordøla Kraft', 'Mork Kraftverk', 'Mossefossen',
	'Mostraum Nett', 'Muoidejohka Kraft', 'Mygland Kraft', 'Mykleby Maskin',
	'Måge Naturkraft', 'NGB', 'NL Brønnbåt', 'Nape Kraft', 'Neas Energi Telekom',
	'Nedre Otta', 'Nedre Romerike Vann- OG Avløpsselskap', 'Neowatt', 'Neset Kraft',
	'Nessakraft', 'Netera', 'Nettselskapet', 'Noranett', 'Noranett Andøy',
	'Noranett Hadsel', 'Nord-salten Kraft', 'Nordbøåna Kraft', 'Nordic Paper',
	'Nordic Power', 'Nordic Power Torsnes', 'Nordkraft Industrinett', 'Nordkraft Magasin',
	'Nordlaks Smolt', 'Nordlink Norge', 'Nordvest Nett', 'Nordvik Kraft',
	'Nordåna OG Dalaåna Kraft', 'Norefjell Nett', 'Norgesgruppen Fornybar', 'Norgesnett',
	'Norsjøkraft', 'Norsk Hydro', 'Norsk Miljøkraft Raudfjell', 'Norsk Vind Skinansfjellet',
	'Norske Skog Skogn', 'Nottveit Energi', 'Nte Energi', 'Nte Solkraft', 'Nunelva',
	'Nydalselva Kraft', 'Nye Grøvla Kraft', 'Nygårdsfjellet Vindpark',
	'Nørlandselva Kraft', 'Odal Vindkraftverk', 'Okken Kraft', 'Opplandskraft',
	'Orkland Energi Produksjon', 'Oslo Lysverker', 'Otra Kraft', 'Pareto Solar Fund',
	'Pasvik Kraft', 'Porsa Kraftlag', 'Porsgrunn Kommune', 'Psf 1', 'R-nett', 'RK Nett',
	'Ramfoss Kraftlag Kommunalt Oppgavefellesskap', 'Ramsliåna Kraftverk',
	'Raudfjell Vind', 'Rauma Energi Produksjon', 'Regnbuen Logistikkbygg',
	'Reinli Kraft', 'Reinstaul Kraft', 'Ren Røros Strøm', 'Renantis Norway',
	'Returkraft', 'Ringdal Kraftverk', 'Ringerikskraft Produksjon', 'Risdal Energi',
	'Rissa Kraftlag', 'Roan Vind', 'Rodal Kraft', 'Romsdalsnett', 'Rusdalsåni Kraft',
	'Rødøy-lurøy Kraftverk', 'Røyrmyra Vindpark', 'S-nett', 'SFE', 'Sage Kraftverk',
	'Sagelva Kraftverk', 'Saksenvik Kraft', 'Salhuselva Kraft',
	'Sandal & Fossheim Kraft', 'Sandøy Vindkraft', 'Saren Energy Bio-el',
	'Sarp Kraftstasjon', 'Sarpsfoss Limited', 'Segadal Kraft', 'Selbu Energiverk',
	'Selja Kraft', 'Selselva Kraft', 'Setredalen Kraft', 'Sevre Kraftverk',
	'Sigdal Energi', 'Sigdestad Kraftverk', 'Simsfossen', 'Sira Kvina Kraftselskap',
	'Sirdal Kraft', 'Siso Energi', 'Skafså Kraftverk', 'Skagerak Kraft',
	'Skeidsflåten Kraft', 'Skjeggfoss Kraftverk', 'Skjerdalselva Kraft', 'Skjerva Kraft',
	'Skjåstad Kraftverk', 'Skjærdalen Eiendom', 'Skollenborg Kraftverk', 'Skolten Kraft',
	'Skorga Kraftverk', 'Sks Produksjon', 'Skåråna Kraft', 'Sleveåne Kraft',
	'Smisto Kraft', 'Smådøla Kraft', 'Småkraft', 'Småkraft Green Bond 1',
	'Småkraft Green Bond 2', 'Småkraft Uspp 1', 'Småkraft Vekst 2025',
	'Småkraft Vekst 2026', 'Smøla Vind 2', 'Snefjellåkraft', 'Sognekraft Produksjon',
	'Soldekke', 'Solvind Prosjekt', 'Solør Bioenergi', 'Somrungen Kraftverk', 'Stannum',
	'Stardalen Kraft', 'Statkraft Energi', 'Statnett', 'Steindal Kraftverk',
	'Steinsvik Kraft', 'Stokkfjellet', 'Storbekken Småkraftverk', 'Storedalen Kraftverk',
	'Storforshei Naturkraft', 'Storøy Vindpark', 'Stram', 'Strandos Kraft',
	'Straumen Nett', 'Straumnett', 'Strupen Kraft', 'Styrkesneselva Kraft',
	'Stølskraft', 'Sundal Kraft', 'Sundal Kraftverk', 'Sundsbarm Kraftverk',
	'Sunnhordland Kraftlag', 'Sunnmøre Energi', 'Svabo Industrinett',
	'Svandalen Kraftverk', 'Svanedal', 'Svardøla Kraft', 'Svelgen Kraft',
	'Svorka Energi', 'Svorka Småkraft', 'Sygnir', 'Sykkylven Energi',
	'Syversætre Foss Kraftverk', 'Sædalen Kraft', 'Sør Aurdal Energi',
	'Sør-norge Aluminium', 'Sørfjord Kraft', 'Sørfjord Vindpark', 'Sørmarkfjellet',
	'Søråni Kraft', 'Tafjord Kraftproduksjon', 'Tafjord Kraftvarme', 'Teitafossen Kraft',
	'Telemark Energi Produksjon', 'Tellenes Vindpark', 'Tendranett', 'Tensio TN',
	'Tensio TS', 'Terråk Kraftverk', 'Time Kommune', 'Tindåga Kraft', 'Tinfos',
	'Tinnkraft', 'Titania', 'Tnett', 'Todøla Kraftverk', 'Tokagjelet', 'Tokheim Kraft',
	'Tonstad Vindkraft', 'Toveien 28', 'Toveien 41', 'Toveien 51', 'Trollekraft',
	'Trollvikelva Kraft', 'Troms Kraft Produksjon', 'Tromsø Vind', 'Trondheimsveien 183',
	'Trongstadlia Kraftverk', 'Trælandsfos', 'Trønderenergi Kraft', 'Tufteelva Kraft',
	'Tussa Energi', 'Tverrdalselvi Kraft', 'Tysvær Vindpark', 'Ulefoss Kraftverk',
	'Ullestad Kraft', 'Ustekveikja Kraftverk', 'Uvdal Kraftforsyning', 'Vadheim Kraft',
	'Vaksvik Kraft', 'Valen Kraftverk', 'Vang Energiverk', 'Vangjolo Kraft',
	'Varanger Kraftvind', 'Vardafjellet Vindkraft', 'Vardar Vannkraft', 'Vardar Varme',
	'Vassbrekka Kraft', 'Vegusdal Kraftverk', 'Vengåkraft', 'Vest-telemark Kraftlag',
	'Vestall', 'Vesterålskraft Produksjon', 'Vestmar Nett', 'Vevig', 'Viermie',
	'Vikeså Kraftverk', 'Vimle', 'Vinstra Kraftselskap', 'Vissi', 'Viul Kraft',
	'Vokks Kraft', 'Vollakvernfallet', 'Voss Energi Produksjon', 'Vossedalselvi Kraft',
	'Vågen Kraft', 'Væla Kraft', 'Watts UP ?', 'Yara Norge', 'Ymber Produksjon',
	'Ytre Kandal Kraft', 'Ytre Oppedal Kraftverk', 'Ytre Vikna 1', 'Ytteråa Kraftverk',
	'Å Energi Vannkraft', 'ÅL Kraftverk KF', 'Åbjørakraft Kolsvik Kraftverk',
	'Ågskarkraft', 'Åmotsfoss Kraft', 'Ånstadblåheia Vindpark', 'Årdal Kraftverk',
	'Åselva Kraft', 'Ørteren Kraftverk Hol KF', 'Østerdalen Kraftproduksjon',
	'Østfold Energi', 'Østre Hurdalsveg 189', 'Øvre Kvemma Kraftverk', 'Øvre Otta',
	'Øvre Storelvi Kraft', 'Øvrebø Kraft', 'Øyadalen Kraftverk', 'Øyfjellet Wind',
	'Øygardselva Kraft', 'Øystre Slidre Kommune',
] as const;

const NODE_IDS = COMPANIES.map(c =>
	c.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-soc'
);

const EVENT_TITLES: Record<Severity, readonly string[]> = {
	critical: [
		'Unauthorized SCADA command execution detected',
		'Ransomware payload identified on HMI workstation',
		'IEC 104 protocol anomaly — unscheduled control action',
		'Active exploitation of CVE-2024-3400 on perimeter firewall',
		'Modbus TCP write to safety controller from unknown source',
		'Credential dump detected on domain controller',
		'OPC UA session hijack attempt from external IP',
	],
	high: [
		'Brute-force attack on VPN concentrator',
		'Lateral movement via PsExec to engineering workstation',
		'DNP3 unsolicited response from rogue device',
		'Suspicious PowerShell execution on SCADA server',
		'TLS certificate mismatch on substation RTU link',
		'Multiple failed Kerberos auth from service account',
		'Outbound C2 beacon pattern to known APT infrastructure',
	],
	medium: [
		'Network scan detected from maintenance VLAN',
		'USB device connected to air-gapped HMI',
		'Anomalous NTP traffic from substation gateway',
		'Failed login attempts on historian database',
		'Unpatched Java runtime on SCADA application server',
		'SNMP community string exposed in network traffic',
		'Firewall rule change outside maintenance window',
	],
	low: [
		'Routine vulnerability scan completed',
		'Backup job completed with warnings',
		'Certificate renewal reminder — 30 days remaining',
		'Non-critical firmware update available for RTU',
		'Scheduled maintenance window started',
		'Audit log rotation completed',
		'DNS query to newly registered domain',
	]
};

const EVENT_SOURCES: EventSource[] = ['siem', 'syslog', 'scanner', 'scada', 'mqtt', 'manual'];
const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const TLP_VALUES: TLP[] = ['RED', 'AMBER', 'GREEN', 'WHITE'];
const INDICATOR_TYPES: IndicatorType[] = ['ip', 'domain', 'hash', 'url', 'ttp'];

const MALICIOUS_IPS = [
	'185.220.101.34', '91.219.236.174', '45.155.205.233', '194.26.29.110',
	'23.106.215.76', '103.75.201.2', '198.98.57.85', '80.66.88.207'
];
const MALICIOUS_DOMAINS = [
	'update-scada.ru', 'ics-firmware.top', 'energy-portal-login.com',
	'kraftverk-vpn.net', 'nordic-grid-update.xyz', 'statnett-portal.info'
];
const MALICIOUS_HASHES = [
	'e3b0c44298fc1c149afbf4c8996fb924', 'a7ffc6f8bf1ed76651c14756a061d662',
	'd7a8fbb307d7809469ca9abcb0082e4f', '5d41402abc4b2a76b9719d911017c592'
];

/** Realistic KraftCERT advisories based on actual published varsler. */
const KRAFTCERT_ADVISORIES = [
	{
		title: 'HMS Networks: sårbarheter i Cosy+ (HMSSAR-2024-07-29-001)',
		cve_id: 'CVE-2024-33892',
		cvss_score: 7.4,
		severity: 'high' as const,
		advisory_id: 'HMSSAR-2024-07-29-001',
		description: 'Vellykket utnyttelse kan føre til informasjonslekkasje, innsetting av kode eller cross-site-scripting. Oppdateringer er tilgjengelig fra HMS Networks.',
		reference_url: 'https://hmsnetworks.blob.core.windows.net/nlw/docs/default-source/products/cybersecurity/security-advisory/hms-security-advisory-2024-07-29-001.pdf',
		affected_products: [
			{ product: 'Cosy+', version: '21.x før 21.2s10' },
			{ product: 'Cosy+', version: '22.x før 22.1s3' },
		],
	},
	{
		title: 'LOYTEC Electronics LINX-serien (ICSA-24-247-01)',
		cve_id: 'CVE-2023-46381',
		cvss_score: 9.3,
		severity: 'critical' as const,
		advisory_id: 'ICSA-24-247-01',
		description: 'Sårbarhetene kan utnyttes via fjerntilkobling. Vellykket utnyttelse kan gjøre det mulig for en angriper å hente ut sensitiv informasjon eller gjøre endringer på en sårbar enhet. LOYTEC har sluppet firmwareoppdateringer til de fleste produktene.',
		reference_url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-24-247-01',
		affected_products: [
			{ product: 'LINX-151', version: 'alle versjoner' },
			{ product: 'LINX-212', version: 'alle versjoner' },
			{ product: 'LVIS-3ME12-A1', version: 'alle versjoner' },
			{ product: 'LIOB-586', version: 'alle versjoner' },
			{ product: 'LIOB-580 V2', version: 'alle versjoner' },
			{ product: 'L-INX Configurator', version: 'alle versjoner' },
		],
	},
	{
		title: 'mySCADA: MyPRO (ICSA-24-184-02)',
		cve_id: 'CVE-2024-4708',
		cvss_score: 9.8,
		severity: 'critical' as const,
		advisory_id: 'ICSA-24-184-02',
		description: 'Vellykket utnyttelse av denne sårbarheten kan gjøre det mulig for en angriper å fjernkjøre kode på enheten. Sårbarheten kan utnyttes via fjerntilkobling. mySCADA anbefaler å oppgradere til MyPRO v8.31.0.',
		reference_url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-24-184-02',
		affected_products: [
			{ product: 'myPRO', version: 'eldre enn 8.31.0' },
		],
	},
	{
		title: 'PAN-OS: GlobalProtect command injection (PAN-SA-2024-0010)',
		cve_id: 'CVE-2024-3400',
		cvss_score: 10.0,
		severity: 'critical' as const,
		advisory_id: 'PAN-SA-2024-0010',
		description: 'Utnyttelse tillater uautentisert fjernkjøring av kommandoer på PAN-OS GlobalProtect gateway. Aktivt utnyttet i det fri. Kritisk patch tilgjengelig fra Palo Alto Networks.',
		reference_url: 'https://security.paloaltonetworks.com/CVE-2024-3400',
		affected_products: [
			{ product: 'PAN-OS', version: '10.2.x før 10.2.9-h1' },
			{ product: 'PAN-OS', version: '11.0.x før 11.0.4-h1' },
			{ product: 'PAN-OS', version: '11.1.x før 11.1.2-h3' },
		],
	},
	{
		title: 'Ivanti Connect Secure: authentication bypass (ICSA-24-030-02)',
		cve_id: 'CVE-2024-21887',
		cvss_score: 9.1,
		severity: 'critical' as const,
		advisory_id: 'ICSA-24-030-02',
		description: 'Autentiseringsfeil i Ivanti Connect Secure og Policy Secure tillater omgåelse av tilgangskontroll og fjernkjøring av kode. Aktivt utnyttet. Omgående oppdatering anbefales.',
		reference_url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-24-030-02',
		affected_products: [
			{ product: 'Ivanti Connect Secure', version: 'alle 9.x og 22.x' },
			{ product: 'Ivanti Policy Secure', version: 'alle 9.x og 22.x' },
		],
	},
	{
		title: 'Cisco IOS XE: web UI privilege escalation',
		cve_id: 'CVE-2023-20198',
		cvss_score: 10.0,
		severity: 'critical' as const,
		advisory_id: 'cisco-sa-iosxe-webui-privesc-j22SaA0z',
		description: 'Sårbarhet i webgrensesnitt tillater uautentisert opprettelse av admin-konto. Aktivt utnyttet mot internetteksponerte enheter. Deaktiver HTTP/HTTPS server-funksjon umiddelbart.',
		reference_url: 'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-iosxe-webui-privesc-j22SaA0z',
		affected_products: [
			{ product: 'Cisco IOS XE', version: 'alle med HTTP/HTTPS aktivert' },
		],
	},
	{
		title: 'Schneider Electric Modicon M340: buffer overflow (SEVD-2024-072-01)',
		cve_id: 'CVE-2024-38063',
		cvss_score: 8.1,
		severity: 'high' as const,
		advisory_id: 'SEVD-2024-072-01',
		description: 'Bufferoverløp i Modbus TCP-håndtering i Modicon M340 PLC kan føre til denial of service eller potensielt kodeeksekvering. Firmware-oppdatering tilgjengelig.',
		reference_url: 'https://www.se.com/ww/en/download/document/SEVD-2024-072-01/',
		affected_products: [
			{ product: 'Modicon M340', version: 'firmware før 3.60' },
			{ product: 'Modicon M580', version: 'firmware før 4.20' },
		],
	},
	{
		title: 'Siemens SIMATIC S7-1500: denial of service (SSA-711309)',
		cve_id: 'CVE-2024-47575',
		cvss_score: 7.5,
		severity: 'high' as const,
		advisory_id: 'SSA-711309',
		description: 'Mangelfull inputvalidering i PROFINET-stakken kan føre til denial of service ved spesielt utformede nettverkspakker. Oppgradering anbefales.',
		reference_url: 'https://cert-portal.siemens.com/productcert/html/ssa-711309.html',
		affected_products: [
			{ product: 'SIMATIC S7-1500', version: 'firmware før V3.1.2' },
			{ product: 'SIMATIC S7-1200', version: 'firmware før V4.7' },
		],
	},
	{
		title: 'ABB Ability Symphony Plus: path traversal (ABBCERT-2024-003)',
		cve_id: 'CVE-2024-1709',
		cvss_score: 7.2,
		severity: 'high' as const,
		advisory_id: 'ABBCERT-2024-003',
		description: 'Mangelfull inputvalidering i webkomponent muliggjør path traversal-angrep. Angriper med nettverkstilgang kan lese vilkårlige filer. Oppdatering tilgjengelig.',
		reference_url: 'https://search.abb.com/library/Download.aspx?DocumentID=9AKK108467A7497',
		affected_products: [
			{ product: 'Ability Symphony Plus', version: 'S+ Operations før 3.3 SP2' },
		],
	},
	{
		title: 'Hitachi Energy RTU500: firmware tampering (ICSA-24-165-01)',
		cve_id: 'CVE-2023-46805',
		cvss_score: 8.6,
		severity: 'high' as const,
		advisory_id: 'ICSA-24-165-01',
		description: 'Mangelfull verifisering av firmware-integritet i RTU500 muliggjør installasjon av modifisert firmware. Fysisk eller nettverkstilgang kreves. Oppdater til siste firmware-versjon.',
		reference_url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-24-165-01',
		affected_products: [
			{ product: 'RTU500 series CMU', version: 'firmware før 13.5.1' },
		],
	},
	{
		title: 'Wago PLC: improper access control (ICSA-24-151-01)',
		cve_id: 'CVE-2024-33896',
		cvss_score: 6.5,
		severity: 'medium' as const,
		advisory_id: 'ICSA-24-151-01',
		description: 'Mangelfull tilgangskontroll i webbasert administrasjonsgrensesnitt. Autentisert bruker kan eskalere privilegier. Firmware-oppdatering tilgjengelig fra Wago.',
		reference_url: 'https://www.cisa.gov/news-events/ics-advisories/icsa-24-151-01',
		affected_products: [
			{ product: 'PFC200', version: 'firmware før FW26' },
			{ product: 'PFC100', version: 'firmware før FW26' },
		],
	},
	{
		title: 'Fortinet FortiOS: out-of-bound write (FG-IR-24-015)',
		cve_id: 'CVE-2024-33893',
		cvss_score: 5.4,
		severity: 'medium' as const,
		advisory_id: 'FG-IR-24-015',
		description: 'Out-of-bound write i SSL-VPN-komponent kan føre til krasj eller potensielt kodeeksekvering for autentisert angriper. Oppdatering tilgjengelig.',
		reference_url: 'https://fortiguard.fortinet.com/psirt/FG-IR-24-015',
		affected_products: [
			{ product: 'FortiOS', version: '7.2.x før 7.2.8' },
			{ product: 'FortiOS', version: '7.4.x før 7.4.3' },
		],
	},
];



const CHAT_MESSAGES = [
	'Vi ser økt aktivitet fra dette IP-området. Noen andre som opplever det samme?',
	'Bekreftet — vi fikk samme alert kl 14:23. Har isolert segmentet.',
	'KraftCERT har publisert oppdatert IOC-liste. Sjekk indikatorer.',
	'Patcher nå. Nedetid estimert 15 min på RTU-linken.',
	'Falsk positiv hos oss — var planlagt vedlikehold.',
	'Kan noen verifisere om dette er relatert til hendelsen i går?',
	'Har eskalert til SOC nivå 2. Oppdaterer når vi vet mer.',
	'Takk for heads-up. Vi stenger ned VPN-tilgangen midlertidig.',
	'Oppdatering: firmware-patchen er testet og rulles ut i kveld.',
	'Noen som har kontakt med leverandøren? Trenger RCA.',
	'Incident er lukket. Root cause: utdatert sertifikat på gateway.',
	'Deler vår YARA-regel for denne varianten i indikator-feeden.',
];

// ── Generators ───────────────────────────────────────────────────────

function companyForNode(nodeId: string): string {
	const idx = NODE_IDS.indexOf(nodeId);
	return idx >= 0 ? COMPANIES[idx] : pick(COMPANIES);
}

export function generateEvents(count = 40): SignedEvent[] {
	resetSeed(100);
	const events: SignedEvent[] = [];
	for (let i = 0; i < count; i++) {
		const severity = pick(SEVERITIES);
		const nodeId = pick(NODE_IDS);
		events.push({
			id: uuid(),
			node_id: nodeId,
			company: companyForNode(nodeId),
			title: pick(EVENT_TITLES[severity]),
			description: '',
			severity,
			source: pick(EVENT_SOURCES),
			external_ref: seededRandom() > 0.7 ? `SR-${Math.floor(seededRandom() * 90000 + 10000)}` : '',
			scenario_id: '',
			created_at: isoAgo(seededRandom() * 72),
			signature: fakeSignature(),
		});
	}
	return events.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function generateIndicators(count = 25): SignedIndicator[] {
	resetSeed(200);
	const indicators: SignedIndicator[] = [];
	for (let i = 0; i < count; i++) {
		const type = pick(INDICATOR_TYPES);
		const nodeId = pick(NODE_IDS);
		let value: string;
		switch (type) {
			case 'ip': value = pick(MALICIOUS_IPS); break;
			case 'domain': value = pick(MALICIOUS_DOMAINS); break;
			case 'hash': value = pick(MALICIOUS_HASHES); break;
			case 'url': value = `https://${pick(MALICIOUS_DOMAINS)}/payload/${Math.floor(seededRandom() * 999)}`; break;
			case 'ttp': value = `T${1000 + Math.floor(seededRandom() * 600)}.${Math.floor(seededRandom() * 5) + 1}`; break;
			default: value = pick(MALICIOUS_IPS);
		}
		indicators.push({
			id: uuid(),
			node_id: nodeId,
			company: companyForNode(nodeId),
			type,
			value,
			tlp: pick(TLP_VALUES),
			description: '',
			severity: pick(SEVERITIES),
			created_at: isoAgo(seededRandom() * 120),
			signature: fakeSignature(),
		});
	}
	return indicators.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const NODE_SUFFIXES = [
	'soc', 'gw', 'ops', 'ot', 'scada', 'noc', 'ics', 'hmi', 'rtu',
	'fw', 'vpn', 'hist', 'sub-01', 'sub-02', 'sub-03', 'sub-04',
] as const;

export function generatePeers(count = 300): PeerWithStatus[] {
	resetSeed(300);
	const peers: PeerWithStatus[] = [];
	const usedIds = new Set<string>();

	for (let i = 0; i < count; i++) {
		const companyIdx = i % COMPANIES.length;
		const suffixIdx = Math.floor(i / COMPANIES.length) % NODE_SUFFIXES.length;
		const round = Math.floor(i / (COMPANIES.length * NODE_SUFFIXES.length));
		const company = COMPANIES[companyIdx];
		const base = company.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		const nodeId = round > 0
			? `${base}-${NODE_SUFFIXES[suffixIdx]}-${round + 1}`
			: `${base}-${NODE_SUFFIXES[suffixIdx]}`;

		if (usedIds.has(nodeId)) continue;
		usedIds.add(nodeId);

		const isOnline = i % 12 !== 0; // ~92% online
		const isKraftcertNode = company === 'KraftCERT';
		peers.push({
			node_id: nodeId,
			company,
			public_key: fakePublicKey(),
			registered_at: isoAgo(seededRandom() * 2000 + 200),
			registered_by: isKraftcertNode ? nodeId : (seededRandom() > 0.5 ? 'kraftcert-csirt' : 'self'),
			signature: fakeSignature(),
			signed_by: 'kraftcert-csirt',
			last_seen_at: isKraftcertNode ? isoAgo(0.001) : (isOnline ? isoAgo(seededRandom() * 0.05) : isoAgo(seededRandom() * 200 + 24)),
		});
	}
	return peers;
}

export function generateChatMessages(eventIds: string[], count = 12): SignedChatMessage[] {
	resetSeed(400);
	const messages: SignedChatMessage[] = [];
	const authors = ['Anders (SOC)', 'Kari (OT-Sec)', 'Per (CSIRT)', 'Ingrid (NOC)', 'Lars (Drift)'];
	for (let i = 0; i < count; i++) {
		const nodeId = pick(NODE_IDS);
		messages.push({
			id: uuid(),
			event_id: pick(eventIds.length > 0 ? eventIds : ['00000000-0000-0000-0000-000000000000']),
			node_id: nodeId,
			company: companyForNode(nodeId),
			author: pick(authors),
			message: pick(CHAT_MESSAGES),
			created_at: isoAgo(seededRandom() * 48),
			signature: fakeSignature(),
		});
	}
	return messages.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function generateVulnerabilities(count = 42): Vulnerability[] {
	resetSeed(500);
	const vulns: Vulnerability[] = [];
	const statuses: VulnerabilityStatus[] = ['new', 'new', 'acknowledged', 'in_progress', 'mitigated', 'exploited'];

	for (let i = 0; i < count; i++) {
		const advisory = KRAFTCERT_ADVISORIES[i % KRAFTCERT_ADVISORIES.length];
		const status = pick(statuses);
		const version = 1 + Math.floor(seededRandom() * 3); // 1-3 local updates
		const createdAt = isoAgo(seededRandom() * 720);
		const updatedAt = isoAgo(seededRandom() * 48);

		// Build changelog
		const changelog = buildDemoChangelog(version, createdAt, updatedAt, advisory);

		vulns.push({
			id: uuid(),
			cve_id: advisory.cve_id,
			cvss_score: advisory.cvss_score,
			severity: advisory.severity,
			title: advisory.title,
			description: advisory.description,
			asset: advisory.affected_products[0]?.product ?? '',
			status,
			source: 'kraftcert',
			signed_by: 'kraftcert-csirt',
			signature: fakeSignature(),
			tlp: 'GREEN',
			advisory_id: advisory.advisory_id,
			reference_url: advisory.reference_url,
			affected_products: advisory.affected_products,
			version,
			updated_by: 'statnett-soc',
			changelog,
			created_at: createdAt,
			updated_at: updatedAt,
		});
	}
	return vulns.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function buildDemoChangelog(
	version: number,
	createdAt: string,
	updatedAt: string,
	advisory: (typeof KRAFTCERT_ADVISORIES)[number],
): Vulnerability['changelog'] {
	const entries: NonNullable<Vulnerability['changelog']> = [];

	// v1: initial import (always from NVD or scanner for multi-version vulns)
	const initialSource = version > 1 ? 'nvd' : 'kraftcert';
	const trustMap: Record<string, number> = { kraftcert: 100, nvd: 60, cisa: 80, scanner: 30 };
	entries.push({
		version: 1,
		timestamp: createdAt,
		action: 'initial_import',
		source: initialSource as VulnerabilitySource,
		source_trust: trustMap[initialSource] ?? 60,
		changes: [],
	});

	if (version >= 2) {
		// v2: KraftCERT advisory arrives and overrides
		const midTime = new Date((new Date(createdAt).getTime() + new Date(updatedAt).getTime()) / 2).toISOString();
		entries.push({
			version: 2,
			timestamp: midTime,
			action: 'merge_high_trust',
			source: 'kraftcert',
			source_trust: 100,
			changes: [
				{ field: 'title', old_value: `${advisory.cve_id} — ubekreftet`, new_value: advisory.title },
				{ field: 'description', old_value: '(ingen beskrivelse)', new_value: advisory.description },
				{ field: 'cvss_score', old_value: String(Math.max(advisory.cvss_score - 1.2, 5.0).toFixed(1)), new_value: String(advisory.cvss_score) },
				{ field: 'source', old_value: initialSource, new_value: 'kraftcert' },
			],
			note: `kraftcert (trust 100) overrode ${initialSource} (trust ${trustMap[initialSource]})`,
		});
	}

	if (version >= 3) {
		// v3: CISA also publishes — lower trust than KraftCERT, only enriches
		entries.push({
			version: 3,
			timestamp: updatedAt,
			action: 'merge_low_trust',
			source: 'cisa',
			source_trust: 80,
			changes: [
				{ field: 'reference_url', old_value: undefined, new_value: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
			],
			note: 'cisa (trust 80) enriched — kraftcert (trust 100) fields preserved',
		});
	}

	return entries;
}

export function generateStats(peers: PeerWithStatus[], events: SignedEvent[]): Stats {
	const onlinePeers = peers.filter(p => {
		if (!p.last_seen_at) return false;
		return Date.now() - new Date(p.last_seen_at).getTime() < 3600_000;
	}).length;
	const criticalEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high');
	return {
		node_id: 'statnett-soc',
		company: 'Statnett',
		role: 'hub',
		peers: { online: onlinePeers, total: peers.length },
		events: {
			total: events.length,
			last_24h: events.filter(e => Date.now() - new Date(e.created_at).getTime() < 86400_000).length,
			critical_24h: criticalEvents.filter(e => Date.now() - new Date(e.created_at).getTime() < 86400_000).length,
		},
		indicators: { total: 25, tlp_red: 4, tlp_amber: 8 },
		incidents: { open: 3 },
		vulnerabilities: { open: 7, critical: 3 },
	};
}

/** Generate a single realistic event with simulated relay path. */
export function generateSingleEvent(): SignedEvent & { path: string[] } {
	const r = () => Math.random();
	const pickR = <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;
	const h = '0123456789abcdef';
	let u = '';
	for (let i = 0; i < 32; i++) {
		if (i === 8 || i === 12 || i === 16 || i === 20) u += '-';
		u += h[Math.floor(r() * 16)];
	}
	// Weighted severity: mostly low/medium
	const sevRoll = r();
	const severity: Severity = sevRoll < 0.4 ? 'low' : sevRoll < 0.75 ? 'medium' : sevRoll < 0.92 ? 'high' : 'critical';
	const nodeId = pickR(NODE_IDS);

	// Simulated relay path: origin → 1-3 intermediate nodes → (self appended by consumer)
	const hopCount = 1 + Math.floor(r() * 3); // 1-3 intermediate hops
	const path: string[] = [nodeId];
	for (let i = 0; i < hopCount; i++) {
		let hop = pickR(NODE_IDS);
		while (path.includes(hop)) hop = pickR(NODE_IDS);
		path.push(hop);
	}

	return {
		id: u,
		node_id: nodeId,
		company: companyForNode(nodeId),
		title: pickR(EVENT_TITLES[severity]),
		description: '',
		severity,
		source: pickR(EVENT_SOURCES),
		external_ref: r() > 0.7 ? `SR-${Math.floor(r() * 90000 + 10000)}` : '',
		scenario_id: '',
		created_at: new Date().toISOString(),
		signature: fakeSignature(),
		path,
	};
}
