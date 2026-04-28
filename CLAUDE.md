# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Prosjekt

**STK — Security Toolkit** — utviklet til Krafthack 2026.
Felles sanntids situasjonsforståelse og sikkerhetsverktøy for norsk kraftsektor ved koordinerte cyberangrep.

### Konsept

Desentralisert sikkerhetsplattform for kraftselskaper. Hver organisasjon kjører sin egen node som synkroniserer via gossip-protokoll. Ingen sentral server = ingen single point of failure. STK samler syv kjernekomponenter på toppen av samme mesh-grunnmur:

1. **Dashboard** — overordnet situasjonsbilde, live counters, mesh-topologi
2. **Vulnerability Dashboard** — sårbarheter på egne assets, korrelert mot CVE/CVSS
3. **Network Scanner** — aktiv nmap-scan av interne og eksponerte IP-er
4. **Tool Store** — plugin-katalog der bidragsytere kan publisere verktøy
5. **Indicators List** — IoC-er (IP/hash/domene/TTP) med TLP-merking, gossipet
6. **Chat/Discussion** — per-incident kanal mellom operatører
7. **Data Collector** — sidecar som leser syslog fra OT-utstyr og oversetter til STK-events

### Tech stack

- **Backend:** FastAPI (Python 3.12) per node
- **Database:** SQLite per node (én fil, persistent volume)
- **Krypto:** `cryptography` — RSA-2048 + SHA-256 signering
- **Frontend:** Vanilla HTML/CSS/JS (per-node dashboard og frittstående topologi)
- **Data Collector:** Python sockets (syslog UDP/TCP) + httpx
- **Varde-relay:** nginx (Alpine) som ren reverse proxy
- **Demo-RTU:** Flask (ABB Relion 615-simulator)
- **AI:** OpenAI API for korrelering og handlingsforslag (planlagt, ikke aktivt i PoC)
- **Deploy:** Docker Compose (alle noder + Varder i én fil)
- **Node-oppdagelse:** `/.well-known/stk` (RFC 8615)

### Repostruktur

```
backend/                  FastAPI-node (gossip, identity, crypto, db, main, kollektor/)
dashboard/                Frittstående mesh-topologi-viz og dashboard
varde/                    HTTPS-relay-template
demo/                     RTU-sim, attacker-script, kollektor-config, run-demo.sh
docs/
  stk-oppsummering.md            Hovedanalyse: intervjuer, arkitektur, STRIDE, tidsplan
  stk-scenario.html              Interaktiv angrepsscenario-demo
  intervju-analyse.html          Visuell presentasjon av intervjuanalysen
  TBD-TRANSPORT-ARKITEKTUR.md    Varde-relay-design (ikke implementert)
  ÅPEN-PROBLEMSTILLING-TRANSPORT.md  Transport-sikkerhetsanalyse
  worklist-sprint1.md            Sprint 1-plan med spor for 5 personer
docker-compose.yml        Full mesh: 5 noder + 2 Varder
demo-onboarding.sh        End-to-end onboarding-flyt
```

### Nøkkelarkitektur

- Hybrid desentralisert: hver node har SQLite + FastAPI + dashboard + gossip-loop
- Synkronisering: HTTP push-pull hvert 10. sek, UUID-deduplisering, hop-counter (`MAX_HOPS=3`), per-peer rate limiting
- Onboarding via KraftCERT som trust anchor med kortlevde, engangs invite-tokens
- Identitet: RSA-2048 nøkkelpar generert per node, peer-registry og revocations spres som vanlige events
- Indicators og chat-meldinger gossipes over samme signatur-stack som ordinære events (utvidelse i sprint 1)
- STRIDE-trusselmodell dokumentert i `docs/stk-oppsummering.md`

### Arbeidsfordeling (5 utviklere — sprint 1)

Detaljert i `docs/worklist-sprint1.md`. Kort sammendrag:

1. **Spor A — Frontend, Dashboard, Topologi:** restrukturere `dashboard/index.html` til STK-landingsside, live counters, behold Canvas-topologi
2. **Spor B — Datamodell og gossip-utvidelse:** schema-migrasjoner for `asset`, `vulnerability`, `indicator`, `incident`, `message`, `tool`, `tool_run`. Utvide gossip til å bære indicator + message som event-typer. **Kritisk pad.**
3. **Spor C — Network Scanner:** ny `scanner-worker`-container med nmap, scan-jobb-API, lagring til `vulnerability`
4. **Spor D — Tool Store + Vulnerability Dashboard:** plugin-manifest (utvid scenario-YAML), katalog-side, seedede tools
5. **Spor E — Chat/Discussion + demo-scenario + Data Collector-UI:** chat-tabell + UI + gossiping, scriptet live-angrep, kollektor-status-side

### Begreper

| Begrep | Betydning | Brukes i |
|---|---|---|
| **STK** | Security Toolkit — den samlede plattformen | Alt |
| **Peer** | En deltakende organisasjon (Hafslund Kraft, Glitrenett, KraftCERT, …) | UI, docs, presentasjon |
| **Node** | Den tekniske instansen en peer kjører (`hafslund-01`) | Kode, API, konfig |
| **Hendelse** / **Event** | En sikkerhets- eller driftshendelse | "Hendelse" i UI, "Event" i kode |
| **Gossip** | Synkroniseringsmekanismen (push-pull + dedup) | Kode, docs |
| **Mesh** | Det samlede nettverket av alle peer-noder | Docs, presentasjon |
| **Seed-peer** | Den første kjente noden brukt for bootstrap-discovery | Kode, konfig |
| **Varde** | Valgfri HTTPS-relay som bærer trafikk inn til en node bak NAT/brannmur. Oppkalt etter det norske kystforsvarets gamle varslingssystem. | Kode, konfig, docs |
| **Data Collector** / **kollektor** | Sidecar som oversetter OT-signaler (syslog) til STK-events. `kollektor` brukes som mappenavn i kodebasen. | Kode, konfig, docs |
| **Scenario-pakke** | KraftCERT-kuratert YAML-pakke med deteksjonsregler og aggregering | Kode, kollektor |
| **Tool** | Plugin i Tool Store, definert med utvidet scenario-YAML-manifest | Tool Store, kode |
| **Indicator** / **IoC** | Indicator of Compromise: IP, hash, domene, TTP — TLP-merket og gossipet | UI, kode, docs |

Sammenheng: *«Hver peer kjører sin egen STK-node. Noder synkroniserer hendelser og IoC-er via gossip i mesh-nettverket. Noder bak brannmur bruker en Varde for å nå resten av meshen. Data Collector oversetter OT-syslog til signerte STK-events.»*

### Språk

Prosjektdokumentasjon er på norsk. Kode og commit-meldinger kan være på engelsk. Mappenavn som `kollektor/` beholdes som norske begreper i kodebasen — de kobler kode og dokumentasjon.
