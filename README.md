# Nordlys ⚡

> Felles sanntids situasjonsforståelse for norsk kraftsektor — desentralisert, signert og uten single point of failure.

**Nordlys** er en utvidbar sikkerhetsplattform utviklet til **Krafthack 2026**. Den lar kraftselskaper koordinere sårbarhets-, hendelses- og indikatorhåndtering i sanntid via et mesh-nettverk av selveide noder, med KraftCERT som tillitsanker.

---

## Problemet

Når et koordinert cyberangrep treffer flere norske kraftaktører samtidig, deles informasjon i dag via telefon, e-post og ad-hoc Teams-grupper. Det tar typisk 30–60 minutter før noen forstår at det som ser ut som tre uavhengige feil i tre selskaper, egentlig er ett angrep. Sentraliserte rapporteringsplattformer er attraktive DoS-mål — Glitrenett sa det rett ut: *«Det samler alt inn i ett felles system — utrolig gunstig for dem som har lyst til å ødelegge noe.»*

Polen-angrepet 29. desember 2025 traff 30+ nettstasjoner samtidig. CERT Polska konkluderte med at angrepet hadde karakter av «bevisst brannstiftelse». Norge bruker mange av de samme SCADA-, RTU- og vernerelé-leverandørene. Vi har samme angrepsflate, og vi mangler den infrastrukturen som lar oss se mønsteret før det er for sent.

## Hva Nordlys er

Nordlys er en **desentralisert verktøyplattform** der hver peer (kraftselskap, nettoperatør, KraftCERT) kjører sin egen node. Plattformen samler syv kjernekomponenter:

| Komponent | Hva den gjør |
|---|---|
| **Dashboard** | Overordnet situasjonsbilde: åpne sårbarheter, åpne IoC-er, peer-helse, live mesh-topologi. |
| **Vulnerability Dashboard** | Sårbarheter funnet på egne assets, korrelert mot CVE/CVSS med angitt status. |
| **Network Scanner** | Aktiv scan av interne og eksponerte IP-er etter sårbarheter (nmap-basert). |
| **Tool Store** | Plugin-katalog der bidragsytere kan publisere verktøy som blir tilgjengelige i alle Nordlys-instanser. |
| **Indicators List** | Indicators of Compromise (IP-er, hash-er, domener, TTP-er) med TLP-merking, gossipet på tvers av peers. |
| **Chat/Discussion** | Per-incident kanal for koordinering mellom operatører hos forskjellige aktører. |
| **Data Collector** | Sidecar som leser syslog (RFC 5424/3164) fra OT-utstyr og oversetter til signerte Nordlys-events. |

Alle komponentene deler den samme grunnmuren: hendelser opprettes lokalt, **RSA-signeres** av kildenoden, og distribueres gjennom meshen via en gossip-protokoll med UUID-deduplisering. Mottakere verifiserer signatur uten å stole på transportlaget.

KraftCERT er det eneste leddet med en privilegert rolle: de utsteder kortlivede **invite-tokens** for onboarding av nye peers, og de fører **revokeringslisten** som sprer seg gjennom meshen som vanlige hendelser. KraftCERT er ikke en sentral rapporteringsserver — kraftcert-noden kan gå ned, og resten av meshen fortsetter å synkronisere uberørt.

For peers bak NAT eller streng brannmur finnes **Varde** — en stateless HTTPS-relay som bærer trafikk inn til en intern node uten å se klartekstinnholdet. Konseptet er lånt fra det norske kystforsvarets gamle varslingssystem.

---

## Arkitektur

```
                 ┌──────────────────────────────────────────┐
                 │            KraftCERT-node                │
                 │   /invite  /register  /revoke  (+gossip) │
                 └──────────────────────┬───────────────────┘
                                        │ invite-tokens, revokeringer
                                        │ (gossip)
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
  ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
  │   Hafslund-node   │◀────▶│  Glitrenett-node  │◀────▶│   Aenergi-node    │
  │  FastAPI + SQLite │      │  FastAPI + SQLite │      │  FastAPI + SQLite │
  │   gossip 10s      │      │   gossip 10s      │      │   gossip 10s      │
  └────────┬──────────┘      └───────────────────┘      └───────────────────┘
           │                                                       ▲
           │ /events/ingest                                        │ via Varde-relay
           ▼                                                       │
  ┌───────────────────┐                                  ┌─────────┴─────────┐
  │  Data Collector   │                                  │   Statnett-node   │
  │  scenario-pakker  │                                  │   (bak brannmur)  │
  │  shadow / live    │                                  └───────────────────┘
  └────────┬──────────┘
           │ syslog UDP/TCP (5424/3164)
           ▼
   ┌───────────────────┐
   │  OT-utstyr        │
   │  RTU, vernerelé,  │
   │  HMI, switch      │
   └───────────────────┘
```

Synkronisering skjer ved HTTP-polling hvert 10. sekund, med UUID-deduplisering, hop-counter (`MAX_HOPS=3`) og rate limiting per kildenode. Topologien oppdages dynamisk ved at hver node eksponerer `/.well-known/stk` og crawler kjente peers.

---

## Hovedfunksjoner

- **Desentralisert mesh** — ingen sentral server, ingen SPOF. Hver peer eier sin egen historikk.
- **Kryptografisk identitet** — hver node genererer et RSA-nøkkelpar ved oppstart, og hver hendelse signeres før den gossipes. Mottakere verifiserer signatur mot KraftCERT-godkjent public key.
- **Onboarding via KraftCERT** — KraftCERT utsteder kortlivede engangs invite-tokens. Nye noder bytter token mot godkjenning og blir kunngjort til meshen.
- **Revokeringsmekanisme** — kompromitterte noder kan revokeres av KraftCERT. Revokeringen sprer seg gjennom meshen som en hendelse, og signaturer fra revokerte noder avvises automatisk.
- **Gossip push-pull med hop-limit** — push for lav latency, pull som sikkerhetsnett for noder som har vært nede. Hop-counter og dedup hindrer infinite loops og duplikater.
- **Varde-relay** — nginx-basert HTTPS-relay for noder som ikke kan eksponere porter mot meshen. Stateless, og ser ingen klartekst utover HTTP-rutingen.
- **Data Collector** — egen prosess som tar imot syslog (RFC 5424/3164) fra OT-utstyr, evaluerer scenario-pakker og sender ferdige Nordlys-hendelser til lokal node via `/events/ingest`. Holder OT-rådata utenfor meshen.
- **Tool Store og scenario-pakker** — KraftCERT-vedlikeholdte YAML-pakker (`abb-relion.yaml`, `generic-syslog-ot.yaml` osv.) med deteksjonsregler, aggregering og MITRE ATT&CK-tagger. Eksperimentelle regler kjører i **shadow-modus** og logges lokalt uten å gossipes — en beskyttelse mot at en uvettig regel oversvømmer meshen.
- **Per-scenario rate-cap** — meshen begrenser antall hendelser per (kilde, scenario_id, severity) per time. Beskytter mot feilkonfigurerte peers og gjentatte støyevents.
- **Web-dashboard per node + global topologi** — et vanilla-JS-dashbord på hver node viser egne hendelser, peer-helse, gossip-aktivitet og signaturstatus. `app/backend/static/topology.html` aggregerer flere noder for en mesh-visualisering live i demoen.

---

## Tech stack

| Lag | Teknologi |
|---|---|
| Node-backend | FastAPI · Uvicorn · Python 3.12 |
| Lagring | SQLite (én fil per node, persistent volume) |
| Krypto | `cryptography` — RSA-2048 + SHA-256 signering |
| Scenario-pakker | PyYAML (signert med KraftCERTs nøkkel) |
| Data Collector | Python sockets (syslog UDP/TCP), httpx |
| Dashboard | Vanilla HTML/CSS/JS — ingen build-step |
| Varde-relay | nginx (Alpine) som ren reverse proxy |
| Demo-RTU | Flask — etterligner ABB Relion 615 web-HMI |
| Orkestrering | Docker Compose |

---

## Repo-struktur

```
team-nordlys/
├── app/                            STK-produktet (alt som kjører i demo og produksjon)
│   ├── backend/                    FastAPI-noden (gjelder alle peers, inkl. KraftCERT)
│   │   ├── main.py                 Endepunkter: /events, /events/sync, /events/ingest,
│   │   │                           /.well-known/stk, /invite, /register, /revoke,
│   │   │                           /identity, /peers, /gossip/activity, /health
│   │   ├── gossip.py               Push-pull-loop, hop-limit, peer-helse, rate limiting
│   │   ├── crypto.py               RSA-keygen, sign_event, verify_signature
│   │   ├── identity.py             Lokalt tillitsregister: peers + revokeringer
│   │   ├── db.py                   SQLite-skjema og connection pool
│   │   ├── kollektor/              Data Collector-implementasjon (sidecar)
│   │   │   ├── syslog_adapter.py   Tar imot RFC 5424/3164 over UDP og TCP
│   │   │   ├── scenario_loader.py  YAML-pakker, regex-matching, aggregering, shadow-modus
│   │   │   ├── dedup.py            Idempotens på (source, external_ref)
│   │   │   ├── post.py             POST til lokal node /events/ingest
│   │   │   └── scenarios/          Pakker fra KraftCERT (abb-relion, generic-syslog-ot)
│   │   └── static/                 Per-node dashboard (servers fra noden selv)
│   ├── demo/                       Live RTU-angrepsdemo (Data Collector + scenario)
│   │   ├── README.md               Demo-instrukser og tidslinje
│   │   ├── docker-compose.demo.yml
│   │   ├── run-demo.sh             Bootstrap (KraftCERT, invites, peers, Data Collector, RTU)
│   │   ├── index.html              Climax-skjerm med tabbed peer-iframe
│   │   ├── kollektor-config/       Peer-overstyringer for scenario-pakker
│   │   ├── rtu-sim/                ABB Relion 615 Flask-simulator (port 8888)
│   │   └── attacker/exploit.sh     Angrepsskript: nmap → brute-force → setpunkt → firmware
│   ├── varde/                      HTTPS-relay for noder bak NAT/brannmur
│   ├── docker-compose.yml          Full mesh: 5 noder + 2 varde-relay (porter 8000–8004)
│   └── demo-onboarding.sh          Kjører invite/register/revoke-flyten ende-til-ende
├── stage/                          Krafthack-pitch (statisk, kjører uten backend)
│   ├── index.html                  Presentasjon: intro, problem, demo, mesh, distribusjon
│   ├── style-kit.html              Design-system og komponent-bibliotek
│   ├── topology-anim.html          Ren Canvas-animasjon brukt som mesh-iframe
│   └── assets/                     Team-bilder
├── docs/
│   ├── architecture.html           Generisk høynivå arkitekturskisse
│   ├── intervju-analyse.html       Visuell intervju-analyse
│   └── TBD-TRANSPORT-ARKITEKTUR.md Varde-relay-design
└── README.md
```

---

## Kjør live-demoen

Tre roller: hackeren, Hafslund (peer A som blir angrepet) og Statkraft (peer B som ser angrepet via gossip).

**Forutsetninger:** Docker Desktop (eller `docker compose`), `python3`, `curl`. Porter 8800, 8801, 8802, 8888 og UDP 5514 må være ledige.

> **Merk:** `.sh`-skriptene må være kjørbare. Hvis du får `permission denied`, kjør `chmod +x app/demo/run-demo.sh app/demo/attacker/exploit.sh app/demo-onboarding.sh` først (eller `chmod +x` på det enkelte skriptet).

```bash
cd app/demo
./run-demo.sh                        # bootstrap (~30s første gang)
```

I en annen terminal:

```bash
./attacker/exploit.sh                # naturlig demo-tempo, ~3 min
./attacker/exploit.sh --fast         # raskt for selvtest
```

Åpne i nettleser:

| URL | Hva du ser |
|---|---|
| http://localhost:8800 | KraftCERT-noden — utstedte invites og registrerte peers |
| http://localhost:8801 | **Hafslund** — events ankommer i sanntid med `syslog`-badge når Data Collector detekterer angrepet |
| http://localhost:8802 | **Statkraft** — samme events 5–10 sekunder senere via gossip, med Hafslunds signatur verifisert |
| http://localhost:8888 | RTU-en (ABB Relion 615-simulator) som blir kompromittert |

Stopp og rydd opp:

```bash
docker compose -f docker-compose.demo.yml down -v
```

Detaljert tidslinje og feilsøking: se [`app/demo/README.md`](app/demo/README.md).

> **Inspirasjon:** Demo-scenariet etterligner mønsteret Z-Pentest / Sector 16 brukte mot polske kraft- og vannsystemer i 2024–2025: nmap-rekognosering, brute-force mot eksponerte HMI-er, default credentials, manipulasjon av setpunkter og firmware. Polen-angrepet 29. desember 2025 (CERT Polska-rapport, januar 2026) traff 30+ nettstasjoner med samme grunnmønster.

## Kjør full mesh (onboarding-demo)

Dette er en separat compose-fil som viser KraftCERT-onboarding ende-til-ende: 5 noder (kraftcert, hafslund, glitrenett, aenergi, statnett) pluss 2 Varde-relayer for noder uten direkte port-eksponering.

```bash
cd app
./demo-onboarding.sh
```

Skriptet starter KraftCERT først, ber den utstede invite-tokens for hver peer, starter peers med token i miljøvariabel, verifiserer at alle har registrert seg, oppretter en signert hendelse på Hafslund-noden og bekrefter at den er gossipet til alle 5 noder.

Porter for full mesh: KraftCERT på **8000** (via Varde), Hafslund **8001**, Glitrenett **8002**, Aenergi **8003**, Statnett **8004** (via Varde). Disse er bevisst forskjellige fra demo-portene (8800/8801/8802/8888) — det er to ulike compose-filer for to forskjellige formål.

---

## Hovedendepunkter

| Metode | Path | Formål |
|---|---|---|
| `GET` | `/.well-known/stk` | Node-oppdagelse (RFC 8615): node_id, company, public_key, peers, role, varde |
| `GET` | `/health` | Liveness + heartbeat-counter |
| `GET` | `/identity` | Alle kjente peer-identiteter og revokeringer |
| `GET` | `/peers` | Live peer-liste med helsestatus |
| `GET` | `/events` | Alle hendelser noden kjenner til (egne + gossipet) |
| `POST` | `/events` | Opprett manuell hendelse (signeres lokalt, gossipes) |
| `POST` | `/events/ingest` | Strukturert hendelse fra lokal Data Collector (X-Ingest-Key auth) |
| `POST` | `/events/sync` | Mottar gossip-batch fra peer (verifiserer signatur, deduplikerer) |
| `GET` | `/events/since/{iso}` | Pull-endepunkt brukt av gossip-loopen |
| `POST` | `/invite` | KraftCERT utsteder invite-token |
| `POST` | `/register` | Ny peer bytter token mot identitet |
| `POST` | `/revoke` | KraftCERT revokerer kompromittert peer |
| `GET` | `/gossip/activity` | Sanntids gossip-aktivitet (push/pull/discovery) for topologi-UI |

Komplett API-referanse, inkl. payloads og feilkoder, er tilgjengelig under «Hjelp»-fanen i dashbordet til hver node.

---

## Konsepter

| Begrep | Betydning |
|---|---|
| **Nordlys** | Sikkerhetsplattformen og dens komponenter. |
| **Peer** | En deltakende organisasjon i Nordlys-meshen (Hafslund, Glitrenett, KraftCERT, …) |
| **Node** | Den tekniske instansen en peer kjører (`hafslund-01`) |
| **Hendelse** / **Event** | En sikkerhets- eller driftshendelse som rapporteres |
| **Gossip** | Synkroniseringsmekanismen: HTTP push-pull hvert 10. sek med UUID-dedup |
| **Mesh** | Det samlede nettverket av alle peer-noder |
| **Seed-peer** | Den første kjente noden som brukes for bootstrap-discovery |
| **Varde** | Valgfri HTTPS-relay som bærer trafikk inn til en node bak NAT/brannmur |
| **Data Collector** | Sidecar-prosess som oversetter OT-signaler (syslog) til Nordlys-events |
| **Scenario-pakke** | KraftCERT-kuratert YAML-pakke med deteksjonsregler og aggregering |
| **Tool** | Plugin i Tool Store — definert med YAML-manifest (utvidelse av scenario-formatet) |
| **Indicator** / **IoC** | Indicator of Compromise — IP, hash, domene, TTP — TLP-merket og gossipet |

Sammenheng: *«Hver peer kjører sin egen Nordlys-node. Noder synkroniserer hendelser og IoC-er via gossip i mesh-nettverket. Noder bak brannmur bruker en Varde for å nå resten av meshen. Data Collector oversetter OT-syslog til signerte Nordlys-events.»*

---

## Trusselmodell

Nordlys-arkitekturen er gjennomgått med STRIDE. Hovedfunnene er at signering + KraftCERT-onboarding gir robust beskyttelse mot spoofing og tampering, mens DoS via event-flooding (særlig fra en kompromittert Data Collector) og **LLM prompt injection** i fritekstfelt er de mest sannsynlige reelle truslene. Mottiltakene som er implementert i POC-en, inkluderer per-node og per-scenario rate-caps, fritekst som aldri går rett inn i LLM-prompt, hop-limit og signaturverifikasjon på alle inngående events.

Varde-relayens design er dokumentert i [`docs/TBD-TRANSPORT-ARKITEKTUR.md`](docs/TBD-TRANSPORT-ARKITEKTUR.md).

---

## Status

Dette er en **proof-of-concept for hackathon — ikke produksjonsklart**. Ikke kjør dette mot ekte OT-utstyr.

**Ferdig (gjenbrukt fra grunnmuren)**
- Node-backend med signerte events, gossip push-pull, hop-limit og dedup
- KraftCERT-onboarding med invite-tokens og revokeringer
- Per-node dashboard og global mesh-topologi
- Data Collector med syslog (RFC 5424/3164) og scenario-pakker
- Shadow-modus og per-scenario rate-cap
- Varde-relay (nginx) for noder bak NAT
- Live demo med ABB Relion 615-simulator og angreps-skript

**Under arbeid (sprint 1)**
- Vulnerability Dashboard og `vulnerability`-datamodell
- Network Scanner (nmap-runner i egen container)
- Tool Store med plugin-manifest (utvidelse av scenario-YAML-format)
- Indicators List med TLP-merking og IoC-gossiping
- Chat/Discussion per incident, gossipet over eksisterende signatur-stack
- Data Collector-status-side i UI

**Delvis**
- Transport: HTTP/HTTPS med selvsignerte sertifikater (ikke mTLS)
- Signaturverifisering: implementert, men avhenger av at KraftCERT er trust anchor — ingen Certificate Transparency Log eller k-av-n-godkjenning ennå
- AI-korrelering: arkitekturplassholder i dashbordet, ingen aktive LLM-kall i POC
- Scenario-pakke-signering: implementert som PKCS1v15 + SHA-256, kjører i «unsigned-ok»-modus i demoen

**Ikke implementert (beskrevet som senere trinn)**
- mTLS med KraftCERT som CA (planlagt produksjonstransport)
- SPIFFE/SPIRE for roterende node-identiteter
- IEC 62351 PKI for SCADA/ICS
- OPC UA og IEC 60870-5-104-kollektorer (kun syslog i POC)
- OCSP/CRL-revokering (kun in-mesh revokeringsliste)
- Hardware Security Module for KraftCERT-nøkkel
- Automatisk TLP-merking og sanitisering av IoC-er før deling
- STIX/TAXII-eksport av indikatorer

---

## Juridisk og regulatorisk — på blokka

Nordlys er en teknisk PoC. Den løser ikke det regulatoriske rammeverket plattformen må operere innenfor i produksjon. Vi gjør **ingen autoritative tolkninger av lovverket** her — listen under er ment å være ærlig om hva som er identifisert og må adresseres med kvalifisert juridisk rådgivning og myndighetsdialog før utrulling.

- **Kraftberedskapsforskriften** — hendelsesdata fra driftskontrollsystemer kan være kraftsensitiv informasjon. Klassifiserings- og delingsbeslutning ligger hos peer-en og forutsetter NVE-dialog. PoC-en har ingen automatisert klassifisering, og automatisk merking erstatter ikke det skjønnet kraftberedskapsforskriften krever.
- **Sikkerhetsloven** — gradert informasjon hører ikke hjemme i Nordlys-meshen. Plattformen må avgrenses eksplisitt til ugradert og kraftsensitiv informasjon, slik andre sivile delingsplattformer (MISP, OpenCTI) gjør. Gradert informasjon håndteres på NSMs egne kanaler.
- **Digitalsikkerhetsloven / NIS2** — Nordlys kan understøtte lovpålagt varsling til NSM, RME og sektor-CSIRT, men erstatter den ikke. Strukturert «varslingsstatus» på hver hendelse og eksport til myndighetsformater er ikke implementert i PoC-en, og er identifisert som leveranse for produksjonsversjonen.
- **Ansvar og hefting** — det finnes i dag ingen juridisk enhet bak «sektoren eier plattformen». En produksjonsutrulling forutsetter en sektorforening (eller tilsvarende), peering-avtale med ansvarsbegrensning og kollektiv forsikring. Open source-lisensen fritar utvikleren, ikke peer-en som signerer en feilaktig hendelse.
- **Personvern (GDPR)** — IP-er, brukernavn og hash-er fra OT-syslog kan være personopplysninger. Felles behandlingsansvar mellom peers, DPIA og behandlingsgrunnlag er ikke etablert. PoC-en gjør ingen automatisk PII-sanitisering. Datatilsynet-dialog parallelt med NVE-dialogen er på blokka.
- **Konkurranserett** — sanntidsdeling av driftsdata mellom konkurrerende kraftleverandører trenger klare regler for hva som *ikke* skal deles (priser, volumer, kundedata). Konkurransetilsynet bør konsulteres før produksjonsbruk.
- **Trust anchor-legitimitet** — KraftCERT er en sektorforening, ikke et forvaltningsorgan. Designet bør utvides med **multi-anchor-støtte** slik at NVE, RME og NSM kan delta som likestilte ankere der formell hjemmel kreves. KraftCERT som eneanker er pragmatisk bootstrap, ikke et endelig valg.
- **AI-leverandør** — eventuell AI-korrelering må kjøres på lokale modeller eller EU-baserte tjenester uten amerikansk jurisdiksjonseksponering. Ingen aktive LLM-kall i PoC-en, og en produksjonsversjon vil eksplisitt utelukke amerikanske skytjenester for kraftsensitive data.

Underlag: [`docs/juridisk-vurdering.md`](docs/juridisk-vurdering.md) (innsigelser fra ekstern jurist) og [`docs/juridisk-svar.md`](docs/juridisk-svar.md) (skisserte mottiltak). Dette er **utkast og diskusjonsgrunnlag**, ikke ferdig juridisk arbeid.

---

## Bidrag og kontakt

Nordlys er bygget for Krafthack 2026. Designet forutsetter at **KraftCERT** tar rollen som tillitsanker i en eventuell produksjonsutrulling — utsteder invites, fører revokeringslisten, og vedlikeholder og signerer scenario-pakkene.

Tilbakemeldinger, særlig fra norske kraftselskaper, nettoperatører og KraftCERT, mottas med takk. Praktiske spørsmål om demoen og arkitekturen kan stilles direkte til teamet under Krafthack-presentasjonen. Se også [`FAQ.md`](FAQ.md) — bekymringene vi forventer fra en kritisk kraftbransje, og hvordan designet allerede møter dem.

## Lisens

Nordlys er lisensiert under [MIT-lisensen](LICENSE.md).

---

*Krafthack 2026*
