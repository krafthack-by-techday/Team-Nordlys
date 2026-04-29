# Nordlys / STK — Roadmap

> Prioritert oversikt over hva som er bygget, hva som mangler, og når det skal være ferdig.
> Skrevet 2026-04-29. Grunnlag: faktisk kodegjennomgang + README, FAQ, intervju-analyse, juridisk-vurdering, juridisk-svar.

---

## Versjoneringsprinsipp

| Versjon | Fase | Karakteristikk |
|---|---|---|
| **v0.1.0** | Krafthack PoC (nå) | Mesh + signert gossip + Data Collector kjører. UI-skall for sprint 1-komponenter. |
| **v0.2.0** | Sprint 1 — produktkomplettering | De fem UI-skallene får ekte backend (Vuln, Scanner, Tool Store, IoC, Chat). |
| **v0.3.0** | Driftshardning | Tester, mTLS, signaturhåndheving, CI, PII-håndtering. |
| **v0.4.0** | Transport- og identitetsmodernisering | Varde som stateful relay, multi-anchor-støtte, k-av-n-godkjenning av IoC. |
| **v0.5.0** | Regulatorisk rammeverk | Klassifiseringsprofil, varslingsstatus, NSM-eksport, sektorforening operativ. |
| **v1.0.0** | Produksjonsklar | Juridisk enhet + peering-avtale + forsikring + NVE-/Datatilsynet-/Konkurransetilsynet-dialog avsluttet, EU-/lokal-AI bundet i kontrakt. |

**Prioritetsmerker**

- **Must** — blokker for målversjonen. Uten den slippes ikke versjonen.
- **Should** — viktig for målversjonen, men kan flyttes ett hakk ved tidsnød.
- **Nice** — forbedring, ikke blokker.

Status-koder: `ferdig`, `delvis`, `UI-skall`, `ikke startet`, `dokumentert ikke implementert`.

---

## Hva som er ferdig i v0.1.0 (Krafthack PoC)

| Område | Komponent | Bevis i koden |
|---|---|---|
| Backend | FastAPI-node med 20 endepunkter | `app/backend/main.py` (614 linjer) |
| Backend | Gossip push-pull, hop-limit, peer-helse, discovery | `app/backend/gossip.py` (297 linjer) |
| Backend | RSA-2048 + PKCS1v15 + SHA-256 signering | `app/backend/crypto.py` |
| Backend | Identitetsregister + revokeringsliste + invite-tokens | `app/backend/identity.py` |
| Backend | SQLite med WAL, auto-migrasjon | `app/backend/db.py` |
| Kollektor | Syslog UDP/TCP (RFC 5424/3164) | `kollektor/syslog_adapter.py` |
| Kollektor | Scenario-engine med aggregering, shadow-modus, per-peer-overstyring | `kollektor/scenario_loader.py` |
| Kollektor | Disk-kø med backoff og 429-håndtering | `kollektor/post.py` |
| Kollektor | Idempotens på (source, external_ref) | `kollektor/dedup.py` |
| Scenarier | ABB Relion 615/620/630-pakke + generic-syslog-ot-pakke | `kollektor/scenarios/*.yaml` |
| Frontend | Per-node dashboard, node-detalj, mesh-topologi (Canvas), gossip-debug | `app/backend/static/*.html` |
| Demo | Live RTU-angrep ende-til-ende (~3 min) | `app/demo/run-demo.sh` |
| Demo | Onboarding/revoke-flyt for full mesh | `app/demo-onboarding.sh` |
| Varde | nginx-relay (passthrough) | `app/varde/` |

---

## Prioritert hovedtabell

### v0.2.0 — Sprint 1: produktkomplettering

De fem UI-kortene i dashbordet er i dag bare overskrifter. `/stats` returnerer hardkodede nuller for disse (`main.py:247`). Mål: ekte backend, ekte data, samme signatur-/gossip-stack som ordinære events.

| # | Feature | Prioritet | Status nå | Beskrivelse |
|---|---|---|---|---|
| 2.1 | Indicators List med TLP-merking | **Must** | UI-skall | IoC-datamodell (IP, hash, domene, TTP), TLP-felt, gossip over eksisterende signatur-stack. Selektiv distribusjon (alle/kun KraftCERT/navngitte peers). |
| 2.2 | Vulnerability Dashboard | **Must** | UI-skall | `vulnerability`-tabell, korrelering mot CVE-ID/CVSS, status-felt (åpen/under arbeid/lukket), kobling til asset. |
| 2.3 | Chat/Discussion per incident | **Must** | UI-skall | Per-event diskusjonstråd, gossipet som signerte meldinger med `parent_event_id`. |
| 2.4 | Tool Store med plugin-manifest | **Should** | UI-skall | YAML-manifest som utvider scenario-formatet. Katalog-endepunkt, signert installasjon. Ikke utførelse — bare metadata. |
| 2.5 | Network Scanner (nmap-runner) | **Should** | UI-skall | Egen container med nmap, scan-jobs eksponert som strukturerte events. Begrenset til interne nett uten eksplisitt opt-in for eksterne IP-er. |
| 2.6 | Data Collector-status i UI | **Should** | UI-skall | Egen side som viser tilkoblede syslog-kilder, regelaktivering, shadow-/live-modus per scenario. |
| 2.7 | `/stats` med ekte tall | **Must** | Hardkodet 0 | Erstatt placeholders med spørringer mot nye tabeller. Krever 2.1–2.3 først. |
| 2.8 | Endepunkt-tester for hovedflyter | **Must** | Ingen tester | pytest + httpx for events/sync, /events/ingest, /invite-/register-/revoke-flyt. Minimum 60% linjedekning på `app/backend/`. |
| 2.9 | k-av-n-godkjenning av IoC før gossip | **Nice** | Ikke startet | Krev m signaturer fra distinkte peers før en IoC propagerer videre enn første hop. Hever terskelen mot kompromittert peer. Kan utsettes til v0.4. |

### v0.3.0 — Driftshardning

| # | Feature | Prioritet | Status nå | Beskrivelse |
|---|---|---|---|---|
| 3.1 | mTLS mellom noder | **Must** | HTTP/HTTPS m/ selvsignerte | KraftCERT som CA, sertifikater rotert per peer. Erstatter dagens åpne HTTP-gossip. |
| 3.2 | Signaturhåndheving av scenario-pakker | **Must** | «unsigned-ok»-modus (`scenario_loader.py:82-88`) | Avvis usignerte pakker i produksjonskonfig. Behold opt-in for utvikling. |
| 3.3 | PII-sanitisering i kollektor | **Must** | Ikke implementert | Pseudonymiser brukernavn (hash-with-salt, salt deles via sektorforening). Konfigurerbar IP-stripping. |
| 3.4 | Retensjonsregler per sensitivitet | **Must** | Ingen automatisk sletting | Default 12 mnd, konfigurerbar per `severity`/`tlp`-felt. Cron-jobb i noden. |
| 3.5 | CI med lint + tester + docker-build | **Must** | Ingen CI | GitHub Actions eller tilsvarende. Blokker merge på rød. |
| 3.6 | Strukturert logging + audit log | **Must** | Print-baserte spor | JSON-logger, separat audit-tabell for invite/register/revoke/identity-endringer. |
| 3.7 | Backup/restore-prosedyre | **Should** | Volum-snapshot manuelt | Skript for SQLite + nøkkelbackup, og pull-fra-mesh-prosedyre for ny node etter tap. |
| 3.8 | Hardkodet `localhost:8000` i gossip | **Should** | `gossip.py:240` | Refaktorer til konfigurerbar URL — blokker for ikke-Docker-Compose-deployment. |
| 3.9 | Bound på activity log (i dag 100) | **Nice** | `gossip.py:26` | Persistere til DB med rotasjon for langtidsanalyse. |
| 3.10 | OpenAPI-dokumentasjon publisert | **Nice** | FastAPI auto-`/docs` finnes | Versjonert, statisk eksport for sektorforeningen. |

### v0.4.0 — Transport- og identitetsmodernisering

| # | Feature | Prioritet | Status nå | Beskrivelse |
|---|---|---|---|---|
| 4.1 | Varde som stateful FastAPI-relay | **Must** | nginx passthrough | Implementer fase 1–3 fra `docs/TBD-TRANSPORT-ARKITEKTUR.md`. WebSocket node↔Varde tunneller. |
| 4.2 | Varde↔Varde gossip | **Must** | Ikke startet | Fase 4–5 i transport-dokumentet. Lar noder bak NAT delta uten direkte porter. |
| 4.3 | Multi-anchor-støtte | **Must** | KraftCERT som eneanker | NVE, RME og NSM kan utstede invite-tokens parallelt. Peer velger anerkjente ankere lokalt. |
| 4.4 | k-av-n-godkjenning av IoC (hvis ikke i 2.9) | **Should** | Ikke startet | Se 2.9. |
| 4.5 | Ed25519 ved siden av RSA | **Should** | Kun RSA | `crypto.py` er allerede isolert — bytte er lokalt arbeid. |
| 4.6 | OCSP/CRL-revokering | **Should** | In-mesh revokeringsliste | Suppler in-mesh-listen med standard OCSP for verktøy som forventer det. |
| 4.7 | SPIFFE/SPIRE for nøkkelrotasjon | **Nice** | Statisk per-node-nøkkel | Roterende node-identitet, særlig for langlivede peers. |
| 4.8 | OPC UA-kollektor | **Nice** | Kun syslog | Ny adapter, samme scenario-engine. |
| 4.9 | IEC 60870-5-104-kollektor | **Nice** | Kun syslog | Som over. |
| 4.10 | STIX/TAXII-eksport av IoC-er | **Should** | Ingen ekstern eksport | Lar SOC-er konsumere IoC-feed med standard verktøy. |
| 4.11 | Webhooks ut til SIEM/SOAR | **Should** | Pull via `/events/since` | Push-basert integrasjon for konsumenter som forventer det. |

### v0.5.0 — Regulatorisk rammeverk

Krever koordinasjon med myndigheter. Teknisk arbeid er begrenset; det meste er prosess.

| # | Feature | Prioritet | Status nå | Beskrivelse |
|---|---|---|---|---|
| 5.1 | NVE-godkjent klassifiseringsprofil i repo | **Must** | Ikke startet | Versjonert YAML, default deling avskrudd for KBO-enheter inntil profilen er aktivert. |
| 5.2 | Varslingsstatus-felt på events | **Must** | Ikke startet | `ikke_varslet` / `varslet_nsm` / `varslet_rme` / `varslet_sektor_csirt` med tidsstempel og referanse-ID. |
| 5.3 | Dashboard-widget «Hendelser uten varsling > 24t» | **Must** | Ikke startet | Compliance-påminnelse til operatør. Bygger på 5.2. |
| 5.4 | Eksport til NSM/RME-rapportformat | **Should** | Ikke startet | PDF/JSON ferdig utfylt fra eventdata. Mennesket sender selv. |
| 5.5 | Konkurranserettslig do-not-share-filter | **Should** | Ingen filter | Teknisk filter på publisering: pris-/volum-/kundefelt blokkeres med to-personers overstyring + logging. |
| 5.6 | Sektorforening etablert (juridisk enhet) | **Must** | Eksisterer ikke | Forening eller AS, peering-avtale, kollektiv cyber-/profesjonsansvarsforsikring. |
| 5.7 | Felles DPIA + art. 26-avtale | **Must** | Ikke startet | Datatilsynet-mal som vedlegg til peering-avtale. |
| 5.8 | Konkurransetilsynet-uttalelse | **Should** | Ikke innhentet | Skriftlig avklaring før produksjonsbruk; FS-ISAC-presedens som referanse. |

### v1.0.0 — Produksjonsklar

| # | Feature | Prioritet | Status nå | Beskrivelse |
|---|---|---|---|---|
| 6.1 | NVE-dialog avsluttet, profil aktiv hos pilotpeer | **Must** | Ikke startet | Forutsetning for at en KBO-enhet i det hele tatt kan kjøre noden i produksjon. |
| 6.2 | Datatilsynet-dialog dokumentert | **Must** | Ikke startet | DPIA gjennomført; behandlingsgrunnlag (sannsynlig art. 6(1)(f) berettiget interesse) dokumentert. |
| 6.3 | EU-/lokal-AI kontraktsfestet | **Must** | Ingen LLM-kall i koden | Eksplisitt utelukkelse av amerikanske skytjenester for kraftsensitive data. Ollama lokal eller EU-vert med dataresidens-garanti. |
| 6.4 | Hardware Security Module for KraftCERT/anchor-nøkler | **Must** | Filsystem-PEM | YubiHSM eller skyHSM. Multi-anchor (4.3) gjør at flere ankere må ha HSM. |
| 6.5 | Ekstern penetrasjonstest gjennomført | **Must** | Kun STRIDE-skrivebord | Akkreditert leverandør, rapport håndtert, kritiske funn lukket. |
| 6.6 | Bug bounty / responsible disclosure | **Should** | Ingen kanal | E-post + PGP, eller plattform. |
| 6.7 | Drift-runbook publisert | **Should** | Demo-README | Onboarding av ny peer, incident-respons, nøkkelrotasjon, revokering. |
| 6.8 | SLO-er for gossip-latens og oppetid | **Should** | Ingen SLO | Eksempel: P95 < 30s for event-propagering peer→peer. |

---

## Ønskeliste — v1.1+ horisont

Ikke prioritert mot dato, ikke i sprintplan. Levende liste over hvor Nordlys *kan* gå når v1.0 står og sektorforeningen er operativ. Tatt med for å vise retning, ikke for å forplikte.

**Type-koder:**

- **Core** — krever endring i mesh-, identitets- eller protokoll-stacken. Lever som del av node-binæren. Må gå gjennom kjerne-utviklersporet.
- **Plugin** — bygges som Tool Store-manifest eller scenario-pakke. Endrer ikke kjernen. Kan utvikles og signeres av tredjepart.
- **Klient** — egen frontend/app som snakker mot eksisterende node-API. Krever ingen endring i kjernen utover stabile API-er.
- **Distro** — pakking, hardware eller deployment-form. Ingen ny kode i kjerne eller plugin-format.

| # | Idé | Type | Hvorfor det er interessant |
|---|---|---|---|
| W1 | **Nordisk mesh** — føderasjon mot CERT-FI, CERT-SE, CFCS (DK) | Core | Multi-anchor på tvers av landegrenser + transport-policy. Kjerneprotokoll må forstå nasjonalt namespace. |
| W2 | **Multi-sektor-utvidelse** — vann, tele, finans, helse | Core + Plugin | Sektor-namespace og isolasjonsregler er core; sektorspesifikke deteksjonsregler er scenario-plugins. |
| W3 | **Lokal ML-korrelering** — Ollama eller llama.cpp på node | Plugin | Verktøy i Tool Store som leser event-stream lokalt. Trenger ikke kjerneendring. |
| W4 | **Tabletop-modus** — isolert øvelses-mesh, KraftCERT som GM | Core | Krever sandbox-flagg på events og separat anchor-kontekst. Markeringen må være ufremkommelig. |
| W5 | **Forsker-/akademia-feed** — sanitiserte, aggregerte IoC-er | Plugin | Eksport-tjeneste én peer kjører. Sanitiseringsregler distribueres som scenario-pakke. |
| W6 | **MISP/OpenCTI-bridge** — toveis sync | Plugin | Sidecar-tjeneste mot eksisterende node-API. Holder tredjepartsavhengigheter ute av kjernen. |
| W7 | **Threat hunting-workspace** — interaktiv spørringsbygger over historiske events | Core | UI-komponent på node-dashbordet. Krever stabile spørrings-API-er i kjernen. |
| W8 | **SOAR-light** — forhåndsdefinerte playbooks utløst av events | Plugin | Per-peer playbook-engine. Hver peer eier egen automatisering. Krever absolutt at OT-handlinger ligger utenfor mesh-godkjenning. |
| W9 | **Hardware appliance** — pre-bygd node på industriell PC | Distro | Pakking, ikke ny kode. Bygger på samme image som vanlig node. |
| W10 | **Air-gap modus** — eksport/import via signert pakke | Core | Eksport-/import-format må bære samme signatur-, dedup- og hop-stack. Hører hjemme i kjernen. |
| W11 | **Anonymisert peer-benchmarking** — angrepsfrekvens og MTTR per peer-størrelse | Core | Felles tellings- og aggregerings-protokoll på tvers av peers. Krever konsistente felt i kjernen. |
| W12 | **TTP-deling på tvers av sektor-meshes** — kun mønstre, ikke rådata | Core | Mesh-til-mesh-bro må implementeres i transportlaget for å bevare signatur-kjeden. |
| W13 | **Cross-mesh attribution** — aktørprofiler delt mellom Nordlys og andre sektorers mesh | Core | Aktør-identitetsobjekt må være kjerneprimitiv for å overleve kryss-mesh-rebroadcast. |
| W14 | **Compliance-as-code** — eksport til ISA/IEC 62443 og NSM Grunnprinsipper-format | Plugin | Eksport-mappingen er per-rammeverk og evolverer raskere enn kjernen. Hører hjemme som plugin per profil. |
| W15 | **Asset fingerprinting-database** — kollektiv RTU-/PLC-katalog | Core | Ny gossip-datatype med egen datamodell. Må synkroniseres med samme garantier som events. |
| W16 | **CVE → asset patch advisory routing** | Plugin | Bygger på W15 (core). Selve routing-policyen er per-peer og leveres som plugin med konfigurerbare regler. |
| W17 | **Kryptografisk varslings-attestering** — tidsstemplet bevis på at en hendelse ble varslet | Core | Hekter på audit-log og signaturstack i kjernen. Bevis-formatet må være standardisert. |
| W18 | **Game day / red team-injeksjon** — kontrollerte falske angrep i live-mesh | Core + Plugin | Sandbox-/øvingsflagg er kjerneprimitiv (uten det bryter markeringen ned); challenge-pakker er plugins. |
| W19 | **Mobil on-call companion** | Klient | Egen app mot eksisterende REST-API. Lese + ack. Påvirker ikke kjernen. |
| W20 | **EU-mesh / ENISA-bridge** | Core | Transport- og identitets-bro analogt med W1, men mot EU-nivå. |
| W21 | **Tool Store-rating og signert publisher** | Core | Tool Store-protokollen er core. Publisher-identitet og rating-events må gossipes på samme stack. |
| W22 | **Public sektor-helsekart** — anonymisert sanntidsstatus | Plugin | Aggregerings- og publiseringstjeneste én peer kjører. Anonymiseringsregler kan distribueres som pakke. |
| W23 | **Sektor-CTF-modus** — innebygget challenge-plattform | Distro + Plugin | Egen mesh-deployment (distro) med challenge-pakker som plugins. Bygger på W4-sandboxen. |

Fordeling: 12 Core, 8 Plugin, 1 Klient, 1 Distro, 3 hybrid (Core+Plugin / Distro+Plugin). Fordelingen viser at kjernen må være moden før mye av ønskelisten kan realiseres — særlig W4-sandbox og W21-tool-store-protokoll er fellesnevnere flere andre punkter avhenger av.

---

## Eksplisitt utenfor scope (foreløpig)

Listet for å unngå at de dukker opp som «glemt» i juryen eller fremtidige diskusjoner.

| Tema | Hvorfor ikke nå |
|---|---|
| Gradert informasjon etter sikkerhetsloven | Hører hjemme på NSMs egne kanaler. Eksplisitt avgrensning, ikke gap. |
| Sentralisert «alt-i-ett»-portal | Bevisst arkitekturvalg — desentralisering er hele poenget. |
| AI-aktive korreleringskall i v0.1–v0.3 | Schrems II/CLOUD Act + lov å vente på lokal/EU-modell-modenhet. |
| Mobilapp | Ingen identifisert behov fra intervjuene. |
| Mer-sensorintegrasjoner enn syslog/OPC UA/IEC 104 | Diminishing returns før de tre er solide. |

---

## Risiko og avhengigheter mellom versjoner

- **v0.2 → v0.3:** Tester (2.8) bør være i sprint 1 selv om driftshardning er v0.3, fordi alle nye komponenter ellers blir gjeldfrie.
- **v0.3 → v0.4:** mTLS (3.1) og Varde-rewrite (4.1–4.2) kolliderer i transportlaget. Naturlig å gjøre 3.1 *som del av* 4.1 hvis tidsplanen tillater å hoppe over et mellomtrinn. Dokumenteres som beslutning når sprint 2 planlegges.
- **v0.5 ↔ v1.0:** Det meste av regulatorisk arbeid (NVE, Datatilsynet, Konkurransetilsynet, sektorforening) er kalendertid, ikke utviklertid. Kan starte parallelt med v0.2, og må starte senest når v0.3 er ferdig for at v1.0 ikke skal stoppe.
- **AI (6.3):** Hvis sektoren ber om AI-korrelering tidligere, må den lande på lokal/EU-modell. Ikke åpne for amerikansk sky som «midlertidig».

---

## Kilder

- Faktisk kodegjennomgang av `app/backend/`, `app/demo/`, `app/varde/`, `app/backend/static/` (2026-04-29).
- `README.md` Status-seksjon.
- `FAQ.md` (særlig seksjonene Sikkerhet, Arkitektur, Drift/samsvar).
- `docs/TBD-TRANSPORT-ARKITEKTUR.md` (Varde-fasing).
- `docs/intervju-analyse.html` (brukerbehov fra Hafslund, Glitrenett, Statnett, Aenergi, NSM).
- `docs/juridisk-vurdering.md` og `docs/juridisk-svar.md` (regulatoriske leveranser).

Roadmapen er **levende dokument**. Oppdater når en versjon slippes eller en prioritering endres, ikke etter hver commit.
