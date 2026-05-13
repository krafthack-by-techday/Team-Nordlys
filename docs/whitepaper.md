# Nordlys STK — Desentralisert situasjonsbilde for cybersikkerhet i kraftsektoren

*Nordlys STK (Security Toolkit) — heretter «Nordlys».*

**Målgruppe:** SOC-ledere (Security Operations Center), CISOer
(Chief Information Security Officer) og beredskapsledere i norske
kraftselskaper  
**Status:** Utkast  
**Dato:** Mai 2026

---

## Sammendrag

Nordlys er en desentralisert mesh for deling av sikkerhetshendelser
mellom kraftselskaper i sanntid. Hver organisasjon eier sin egen node,
signerer sine egne observasjoner kryptografisk, og deler dem med andre
uten en sentral server i veien. Resultatet er et felles
situasjonsbilde som overlever angrep på enkeltkomponenter — fordi det
ikke finnes noen enkeltkomponent å angripe.

Nordlys erstatter ikke MISP (Malware Information Sharing Platform)
eller OpenCTI (Open Cyber Threat Intelligence). MISP og OpenCTI
dekker strukturert trusseletterretning og kunnskapsforvaltning.
Nordlys
dekker operativ koordinering i hendelsesøyeblikket, med tillitsstyrt
deling i tilnærmet sanntid. Sammen gir de en komplett operasjonsloop
fra deteksjon til koordinert respons.

---

## Problemet

Når et koordinert cyberangrep rammer flere kraftselskaper samtidig,
ser hver organisasjon bare sin egen del av bildet. Operatørene ringer
hverandre, sender Teams-meldinger, og det tar alt i fra 30–60 minutter og opptil flere dager eller uker før noen
oppdager at separate hendelser hos separate selskaper er ett og samme
angrep.

I mellomtiden eskalerer angrepet.

En sentral rapporteringsplattform løser tidsproblemet, men skaper et
nytt: den blir selv et høyverdimål. Kompromittér plattformen, og du
blinder hele sektoren. Ta den ned med DDoS (Distributed Denial of Service), og
informasjonsflyten stopper.

Kraftsektoren trenger et tredje alternativ: sanntidsdeling som ikke
avhenger av at én server er oppe.

---

## Hva Nordlys er

Nordlys er et desentralisert mesh der hvert kraftselskap kjører
sin egen instans. Internt bruker hver organisasjon en hub-spoke-
topologi med API-gateway som nav; eksternt kommuniserer
organisasjonenes Varder via bounded gossip med et utvalg peers
(~15 per node). Det finnes ingen sentral server som eier dataene
eller kontrollerer flyten.

**Tre roller i meshet:**

- **Node** — organisasjonens egen backend, i intern sone. Holder
  signeringsnøkkelen, lagrer hendelser, kjører dashboardet.
  Eksponerer ingen porter mot internett.
- **Varde** — en relay i organisasjonens DMZ (demilitarisert
  sone). Publiserer hendelser til andre organisasjoners Varder.
  Den eneste internet-eksponerte komponenten.
- **KraftCERT** — sektorens ISAC (Information Sharing and
  Analysis Center) og CERT-funksjon. I meshet har KraftCERT
  to roller: (1) **kjernen** — utstede identiteter og revokere
  kompromitterte noder, og (2) **extensions** — levere ISAC-
  tjenester som vurderte varsler, berikelse og øvelsesmodus
  via signerte plugins (se plugin-seksjonen). Meshet fortsetter
  å fungere om KraftCERT er nede — bare onboarding av nye
  peers pauser.

Alle hendelser, indikatorer og chatmeldinger er kryptografisk
signert av avsenderens node. Mottakere verifiserer signaturen mot
en lokal tillitsregister. Usignerte eller ukjente avsendere
avvises.

---

## Hva Nordlys IKKE er

- **Ikke en SIEM (Security Information and Event Management).**
  Nordlys aggregerer ikke logger og kjører ikke deteksjonsregler.
  Det mottar ferdig-evaluerte hendelser fra organisasjonens SIEM.
- **Ikke et CTI-repositorium (Cyber Threat Intelligence).**
  Langsiktig lagring og analyse av trusselinformasjon hører
  hjemme i MISP og OpenCTI.
- **Ikke et IAM-system (Identity and Access Management).**
  Nordlys autentiserer peers med kryptografiske nøkler, men
  erstatter ikke organisasjonens identitets- og tilgangsstyring.
- **Ikke en erstatning for MISP.** MISP og Nordlys er
  komplementære: MISP strukturerer etterretning, Nordlys
  koordinerer operativ respons.

---

## Operasjonell verdi for SOC

**Tilnærmet sanntids situasjonsbilde.** Når Hafslund ser et
brute-force-forsøk mot ABB Relion, ser Glitrenett det i
tilnærmet sanntid — ikke etter en telefonrunde neste morgen.
Initielle tester viser meldingslevering på under 5 sekunder.

**Automatisk innhenting.** Nordlys kobler seg mot organisasjonens
eksisterende SIEM (syslog, webhooks). Hendelser som matcher
deteksjonsregler sendes automatisk til meshet. Ingen manuell
rapportering for rutinehendelser.

**Felles chat per hendelse.** Operatører fra forskjellige selskaper
kan koordinere direkte på hendelsen: "Vi ser det samme mønsteret",
"Blokkerer nå". Alt signert og sporbart.

**TLP-styrt synlighet.** Operatøren velger distribusjonsnivå per
hendelse. GREEN deles med hele meshet. RED går kun til navngitte
mottakere, kryptert ende-til-ende. Systemet håndhever TLP i alle
lag — det er ikke mulig å dele bredere enn merket tillater.

**Skanner og sårbarhetsoversikt.** Nettverksskanning og
sårbarhetsinformasjon som er relevant for sektoren kan deles med
peers som har behov.

---

## Oppdatert arkitektur (2026): plugin-drevet utvidbarhet

Nordlys har en liten, stabil kjerne. All domenespesifikk
funksjonalitet — sårbarhetshåndtering, SIEM-integrasjon,
skannerstrategier, eksportformater — leveres som **signerte
plugins** (extensions).

Dette betyr at meshet ikke er begrenset til forhåndsdefinerte
datatyper. Enhver type sikkerhetsrelevant informasjon kan deles
over Nordlys, så lenge det finnes en plugin som produserer og
konsumerer den:

- **Vendor-adaptere:** Ny OT-utstyrsleverandør? Skriv en plugin
  som parser loggformatet, og hendelsene flyter gjennom meshet
  som alt annet.
- **Sektorspesifikke deteksjonsregler:** En pakke med
  deteksjonsscenarier for kraftsektoren kan distribueres som en
  plugin — uten å endre kjernen.
- **Eksportformater:** Trenger du rapporter på
  kraftberedskapsforskriftens format, STIX/TAXII-bunter
  (Structured Threat Information Expression / Trusted Automated
  Exchange of Intelligence Information), eller nasjonale
  rapporteringsmaler til NSM/NVE? En eksport-plugin håndterer
  transformasjonen.
- **Nye datakilder:** OSINT-feeds (Open Source Intelligence),
  leverandørvarsler, eller proprietære
  trusseletterretningskilder kobles til via en kilde-plugin.

Plugins er **kryptografisk signert** med en tillitskjede tilbake
til KraftCERT. En node aksepterer ikke en usignert eller ukjent
plugin. Hver plugin deklarerer nøyaktig hvilke tilganger den
trenger — og får ikke mer. TLP-håndhevelsen gjelder for
plugins på samme måte som for kjernen: en plugin kan ikke se
data over sitt deklarerte TLP-nivå.

Modellen betyr at sektoren kan utvide Nordlys uten å vente på
en sentral leverandør. Et kraftselskap med spesialbehov kan
bygge sin egen plugin, få den signert, og dele den med peers —
eller bruke den kun internt.

### Eksempler: hva Nordlys er, kan være — og ikke bør være

**Kjernebruk — dette er Nordlys:**

- Deling av SIEM-alarmer og IOC-er (Indicators of Compromise)
  mellom organisasjoner i tilnærmet sanntid.
- Koordinert chat mellom SOC-er under en pågående hendelse.
- TLP-styrt distribusjon av sårbarhetsinformasjon til relevante
  peers.

**Utvidbar — dette KAN Nordlys bli med plugins:**

- **KraftCERTs ISAC-tjenester:** KraftCERT utøver sin ISAC-
  rolle gjennom signerte extensions — ikke som en del av
  kjernen. Eksempler:
  - **Vurderte varsler:** KraftCERT publiserer sektorspesifikke
    varsler som distribueres til alle peers via meshet.
  - **Berikelse:** IOC-er berikes automatisk med KraftCERTs
    kontekst (aktør, kampanje, sektorrelevans).
  - **Varslingsstøtte:** Ferdig-formaterte rapporter til NVE/NSM
    basert på hendelsesdata i noden.
  - **Øvelsesmodus:** Simulerte hendelser merket som øvelse,
    slik at sektoren kan trene koordinert respons uten å
    forurense produksjonsdata.
- **Fysisk sikkerhet:** Drone observert ved transformatorstasjon,
  person med kamera som fotograferer kritiske komponenter —
  normalisert og delt med samme sporbarhet som cyber-hendelser.
- **OT-spesifikk deteksjon (Operational Technology):** Ny
  sårbarhet i Siemens S7-1500 PLC (Programmable Logic
  Controller) — deteksjonssignatur distribueres til alle
  relevante peers uten sentral utrulling.
- **Vendor-adaptere:** Parser for proprietært loggformat fra
  OT-leverandør, slik at hendelsene flyter gjennom meshet som
  alt annet.
- **Sektorspesifikke rapporter:** Eksport til
  kraftberedskapsforskriftens format, STIX/TAXII-bunter eller
  nasjonale rapporteringsmaler.

**Grenseland — dette bør Nordlys typisk IKKE brukes til:**

- Langsiktig lagring av trusselinformasjon (bruk MISP/OpenCTI).
- Loggaggregering og korrelasjon (bruk SIEM).
- Generell meldingsutveksling uten sikkerhetskontekst.

---

## Sikkerhet og tillit

### Dataeierskap

Din organisasjons data forblir på din node. Nordlys kopierer
hendelser til peers som har rett til å se dem — men kilden eier
alltid originalen, og kan ikke tvinges til å dele mer enn
TLP-merket tillater.

### TLP v2.0

Nordlys implementerer FIRST (Forum of Incident Response and
Security Teams) Traffic Light Protocol v2.0 [¹] med
fire merker:

| Merke | Hvem ser det? |
|-------|---------------|
| **TLP:RED** | Kun navngitte mottakere. Kryptert ende-til-ende. |
| **TLP:AMBER** | Mottakerorganisasjonen og dens klienter. Med modifikatoren **+STRICT** begrenses dette til kun mottakerorganisasjonen uten videredeling. |
| **TLP:GREEN** | Hele mesh-fellesskapet. |
| **TLP:CLEAR** | Offentlig. Ingen restriksjoner. |

TLP håndheves i elleve lag (0–10) fra signeringstidspunkt til
visning i dashbordet. Det er teknisk umulig å sende en
RED-hendelse uten å
spesifisere mottakere, og umulig for en Varde å videresende den
til andre enn de navngitte.

### Kryptering for sensitiv deling

RED- og AMBER-med-mottakere-hendelser krypteres med en unik
sesjonsnøkkel per melding. Sesjonsnøkkelen krypteres individuelt
for hver mottaker med deres offentlige nøkkel. Selv om en Varde
kompromitteres, kan den ikke lese innholdet — den ser bare
kryptert payload.

### Hva skjer om en peer kompromitteres?

KraftCERT utsteder en signert revokering. Den sprer seg gjennom
meshet som en vanlig melding. Alle noder slutter umiddelbart å
godta meldinger fra den kompromitterte peeren. Historiske
meldinger beholdes i loggen (de ble signert av en da-gyldig
nøkkel), men ingen nye meldinger aksepteres.

### Hva skjer om meshet partisjoneres?

Hver partisjon fortsetter å fungere uavhengig. Når
nettverksforbindelsen gjenopprettes, synkroniserer Vardene
automatisk. Duplikatdeteksjon sikrer at ingen hendelser
dobbeltlagres.

---

## Sammenligning med alternativer

| Egenskap | Status quo (telefon/Teams) | Sentral plattform | MISP [²] | **Nordlys** |
|----------|---------------------------|-------------------|------|-------------|
| Sanntid | Nei (30min–∞) | Ja | Nær-sanntid (ZMQ/webhooks) | **Tilnærmet sanntid (<5s)** |
| Single point of failure | Nei | **Ja** | Ja (enkeltinstans) / redusert (federert) | **Nei (mesh ut av boksen)** |
| Dataeierskap | Hos avsender | Hos plattformeier | Hos operatør (self-hosted) | **Hos hver peer** |
| TLP-compliance | Manuell/ære | Varierer | Sharing-gruppe-basert | **Automatisk, 11 lag** |
| Driftsbyrde per org | Ingen | Lav (SaaS) | Moderat (server + evt. federation) | **Lav (2 stacker)** |
| Skalering (ny peer) | N/A | Enkel | Manuell sync-konfig per partner (O(N)) | **Invite token → operativ (O(1))** |
| Kryptert RED-deling | N/A | Avhenger av impl. | GnuPG/S/MIME for meldinger | **Ende-til-ende for alle RED-hendelser** |
| Fungerer ved internettbrudd | Ja (telefon) | Nei | Nei (enkeltinstans) / delvis (federert) | **Delvis (lokal drift + auto-synk)** |
| Overlevelse ved angrep på plattform | N/A | Nei | Server er mål | **Ja (ingen sentral komponent)** |

## Integrasjonsscenario: SIEM + OpenCTI + MISP + Nordlys

Et fornuftig målarkitekturmønster er å bruke verktøyene i hver sin
rolle i en sammenhengende flyt:

1. **SIEM detekterer lokalt.**
  En alarm trigges på mistenkelig aktivitet i virksomhetens egne
  logger (for eksempel mot OT-nære systemer).

2. **OpenCTI beriker analysen.**
  IOC-er og TTP-er (Tactics, Techniques and Procedures) fra
  alarmen korreleres mot kjent kampanje, trusselaktør og
  historiske relasjoner.

3. **MISP deler strukturert CTI.**
  Relevante indikatorer og objekter publiseres som strukturert
  etterretning for videre sektorutveksling.

4. **Nordlys koordinerer operativ respons i sanntid.**
  Hendelsen deles med tillitsstyrt kontekst mellom SOC-er:
  hva som skjer nå, hvilken påvirkning som observeres, og hvilke
  strakstiltak som er iverksatt.

5. **Feedback tilbake i kjeden.**
  Erfaringer fra responsen går tilbake til SIEM-regler,
  OpenCTI-kunnskapsgrunnlag og MISP-objekter.

Rollefordeling i én linje: SIEM detekterer, OpenCTI forklarer,
MISP strukturerer, Nordlys koordinerer.

---

## Hvorfor ikke bare MISP?

Et vanlig spørsmål er om MISP alene kan dekke behovet Nordlys
adresserer. Det er et godt spørsmål — MISP er et modent og
verdifullt verktøy som mange i sektoren allerede bruker [²].

MISP kan levere nær-sanntid distribusjon via ZMQ og webhooks,
har innebygd kryptering (GnuPG/S/MIME), støtter TLP
(Traffic Light Protocol) via sharing
groups, og kan federeres slik at flere instanser synkroniserer
uten én sentral server [³]. Det Nordlys gjør annerledes er ikke
hva som deles, men hvor enkelt det er å oppnå desentralisert
deltagelse for hele sektoren:

- **Mesh ut av boksen.** MISP federation krever eksplisitt
  oppsett av synkroniseringsrelasjoner mellom hvert instans-
  par, med manuell konfigurering av pull/push, filtre og
  autorisasjon per kobling [³]. I en sektor med titalls
  organisasjoner skalerer dette dårlig. Nordlys gir mesh-
  topologi fra første oppstart — en ny peer er operativ etter
  onboarding uten å konfigurere bilaterale relasjoner.
- **Skalering.** MISP federation er punkt-til-punkt: full mesh
  mellom 400 organisasjoner krever 79 800 bilaterale
  synkroniseringskoblinger, hver med manuell konfigurasjon av
  nøkler, filtre og retning. Det realistiske alternativet —
  et hub-and-spoke-oppsett — reduserer til ~400 koblinger,
  men gjeninnfører sentral avhengighet. Nordlys' bounded
  gossip gir full dekning med ~15 automatisk valgte peers
  per node (3 000 koblinger totalt, null manuell
  konfigurasjon). Ny peer: invite token → operativ
  umiddelbart. Administrativ byrde per ny organisasjon:
  O(1), ikke O(N).
- **Resiliens uten HA-oppsett.** En enkelt MISP-instans uten
  redundans stopper delingen ved nedetid. Med federation
  fortsetter andre instanser, men dette krever at HA eller
  federation er satt opp og vedlikeholdt. I Nordlys er
  partisjoneringstoleranse innebygd — hver node opererer
  lokalt og synkroniserer automatisk ved gjenopprettelse.
- **TLP i elleve lag.** MISP håndhever TLP gjennom sharing
  groups og distribusjonsnivåer på server-siden. Nordlys
  håndhever TLP i elleve lag fra signering til visning,
  inkludert på relay-nivå — selv en kompromittert Varde kan
  ikke lese TLP:RED-innhold.

Anbefalingen er ikke å velge mellom MISP og Nordlys. MISP er
riktig verktøy for strukturert etterretningsdeling. Nordlys er
bygget for å gjøre operasjonell koordinering så enkelt at hele
den norske kraftsektoren realistisk kan delta — uten å kreve
at hver organisasjon setter opp og vedlikeholder bilaterale
federation-koblinger.

---

## Regulatorisk kontekst

Nordlys er utviklet i konteksten av gjeldende og kommende
regulering for cybersikkerhet i kritisk infrastruktur:

- **NIS2-direktivet (EU 2022/2555) / Digitalsikkerhetsloven** [⁴]
  krever at virksomheter i kritisk infrastruktur deler
  sikkerhetsinformasjon med sektorvise responsmiljøer og andre
  berørte parter, samt håndterer hendelser koordinert
  (artikkel 21 og 23). Norsk transposisjon gjennom
  Digitalsikkerhetsloven er under implementering.

- **Kraftberedskapsforskriften** [⁵] stiller krav til beredskap,
  rapportering og koordinering ved sikkerhetshendelser i
  energisektoren. § 6-2 klassifiserer driftskontrollsystem-
  data som «kraftsensitiv informasjon» — noe som krever
  eksplisitt vurdering før deling, uavhengig av TLP-merking.

- **FIRST TLP v2.0** [¹] er den internasjonale standarden for
  klassifisering av delt sikkerhetsinformasjon.

Nordlys erstatter ikke lovpålagt rapportering til NSM (Nasjonal
sikkerhetsmyndighet), NVE (Norges vassdrags- og energidirektorat)
eller RME (Reguleringsmyndigheten for energi). Det erstatter
heller ikke koordineringsrollen til KraftCERT [⁶], som er
sektorens ISAC og CERT-funksjon (Computer Emergency Response
Team). Nordlys er et
operasjonelt verktøy som gjør at organisasjoner kan dele raskere
og bredere enn minstekravet — med kontroll over hvem som ser hva.

---

## Driftsmodell

### Hva du installerer

To stacker per organisasjon:

1. **Node-stack** (intern sone) — en container-stack med
   applikasjonstjenester, database og cache. Kobler seg til
   eksisterende SIEM eller annen datakilde via syslog/webhooks.
   Dashbordet er tilgjengelig for relevante brukere over intern
   nettleser / web-app.

2. **Varde** (DMZ) — én container med HTTPS-endepunkt. Eneste
   krav: DNS-navn (Domain Name System) og TLS-sertifikat
   (Transport Layer Security).

### Ingen sentral infrastruktur

Det finnes ingen sentral server å drifte, finansiere eller
beskytte. Alle peers deler driftskostnaden ved å kjøre sin egen
node. KraftCERT har en koordinerende rolle (identitetsutstedelse),
men er ikke en sentral server — meshet fungerer uten den.

### Nedetid

| Scenario | Konsekvens |
|----------|-----------|
| Din Varde er nede | Dine hendelser når ikke meshet. Du mottar ikke andres. Når Varden kommer tilbake, synkroniserer den automatisk. |
| KraftCERT er nede | Eksisterende peers upåvirket. Nye peers kan ikke onboardes. |
| Internett-brudd | Lokal drift fortsetter. Hendelser bufres og synkroniseres ved gjenopprettelse. |
| Én peer kompromittert | Revokering spres. Resten av meshet upåvirket. |

---

## Bakgrunn

Nordlys STK ble unnfanget på **Krafthack 2026** — KraftCERTs
årlige cybersikkerhets-hackathon for den norske kraftsektoren.
Team Nordlys bygget en fungerende prototype på 48 timer og vant
**fagjuryens pris** for løsningen.

Ideen vokste ut av en konkret frustrasjon: når koordinerte angrep
rammer flere selskaper samtidig, finnes det i dag ingen felles
sanntidsbilde. Hackathon-prototypen viste at et desentralisert mesh
med kryptografisk signering og TLP-styrt deling er praktisk
gjennomførbart — ikke bare en akademisk øvelse.

Arbeidet etter hackathon har fokusert på å formalisere arkitekturen,
styrke sikkerhetsegenskapene, og forberede systemet for
pilotdrifting i sektoren.

---

## Åpen kildekode

Nordlys er åpen kildekode. Dette er et bevisst sikkerhetsvalg:

- **Kerckhoffs' prinsipp:** Sikkerheten avhenger av
  nøkkelmateriale, ikke av at systemets design er hemmelig.
  Alle kryptoalgoritmer i Nordlys er offentlige standarder
  (Ed25519 [⁷], X25519, XChaCha20-Poly1305).

- **Audit-mulighet:** Hver organisasjon som deployer Nordlys kan
  gjennomgå kildekoden selv — eller hyre en tredjepart til å
  gjøre det. Ingen blind tillit til en lukket leverandør.

- **Ingen vendor lock-in:** Sektoren eier verktøyet sitt.

- **Felles forbedring:** Sikkerhetsfeil oppdages og fikses av
  fellesskapet, ikke bare av én leverandørs interne team.

En angriper som leser kildekoden lærer hvordan systemet er
bygget — men ikke nøklene som beskytter det. Det er hele poenget.

---

## Kilder

| # | Referanse |
|---|----------|
| ¹ | FIRST, *Traffic Light Protocol v2.0*, august 2022 — https://www.first.org/tlp/ |
| ² | CIRCL, *MISP — Open Source Threat Intelligence and Sharing Platform* — https://www.misp-project.org/ |
| ³ | MISP Project, *Synchronisation / Federation* — https://www.misp-project.org/2024/03/22/MISP-Synchronisation.html |
| ⁴ | EU, *Directive (EU) 2022/2555 (NIS2)*, desember 2022 — https://eur-lex.europa.eu/eli/dir/2022/2555 |
| ⁵ | Kraftberedskapsforskriften, *§ 6-2 Sikring av kraftsensitiv informasjon* — https://lovdata.no/forskrift/2012-12-07-1157/§6-2 |
| ⁶ | KraftCERT — sektorforening, ISAC og CERT-funksjon for norsk kraftsektor |
| ⁷ | D. J. Bernstein et al., *Ed25519: High-speed high-security signatures* — https://ed25519.cr.yp.to/ |

---

## Neste steg

- **Kildekode og teknisk dokumentasjon:**
  Se `docs/README.md` for teknisk intro,
  `docs/architecture-overview.md` for full arkitektur,
  og `docs/adr/` for arkitekturbeslutninger.
- **Spørsmål om sikkerhet og TLP:** Se ADR-0020 (TLP enforcement)
  og ADR-0024 (kryptert direktelevering) for tekniske detaljer.
