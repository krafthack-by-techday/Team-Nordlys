# STK – Worklist, første sprint (kickoff)

> **Oppdatert:** Sprint 1 lift-and-shifter fra eksisterende kodebase i `app/`. Gossip-laget, kollektor, invite-onboarding, RTU-simulator, attacker-script og Canvas-topologi gjenbrukes. Sprint 1 er onboarding + komponent-gap-lukking, ikke bygg-fra-bunn.

**Mål for sprinten:** Hele teamet har STK oppe lokalt, vi har én felles forståelse av hva som finnes vs hva som mangler per STK-komponent, og alle 5 sporene har levert en synlig endring i UI som henter eller produserer reelle data via gossip-laget.

**Team:** 5 personer.
**Demo-driver:** Live-angrep mot ABB Relion 615-mock → syslog → kollektor → events gossipes mellom 5 noder + 2 Varder → alle dashboards oppdateres → operatør reagerer i Chat. RTU-sim og attacker-script finnes allerede.

---

## 1. Stack (avklart, basert på eksisterende kodebase)

| Lag | Valg | Kilde |
|---|---|---|
| Backend | **FastAPI (Python 3.12)** | `backend/` |
| DB | SQLite per node (WAL-mode) | `backend/db.py` — vurder Postgres senere |
| P2P | HTTP gossip 10s-polling, RSA-2048 signering | `gossip.py` + `crypto.py` + `identity.py`, ~537 LOC |
| Identitet | Invite-token via KraftCERT, peer-registry, revocations | `identity.py` |
| Frontend | Vanilla JS + Canvas (utvides) | `dashboard/topology.html` + `dashboard/index.html` |
| Kollektor | Syslog UDP 5514 + scenario-YAML | `backend/kollektor/` |
| Demo-utstyr | ABB Relion 615-mock + attacker-script | `demo/rtu-sim/` + `demo/attacker/exploit.sh` |
| Deploy lokalt | Docker Compose (5 noder + 2 Varde-relays) | `docker-compose.yml` |

**Ingen stack-debatt i sprint 1.** Hvis noen vil bytte til React/D3/Postgres senere er det en sprint 2-diskusjon.

---

## 2. Komponent-mapping: hva finnes, hva mangler

| Lapp | Status nå | Sprint 1-leveranse |
|---|---|---|
| **Dashboard** | Finnes (`dashboard/index.html`): peer-stats, aktivitetslogg, Canvas-topologi øverst. PoC-kvalitet. | Re-strukturere som STK-landingsside med live counters (åpne vulns, åpne IoC, peer-status, siste events). Behold Canvas-topologien. |
| **Vulnerability Dashboard** | Finnes ikke. Events-tabellen kan brukes som kilde, men det er ingen `vulnerability`-modell. | Ny tabell `vulnerability` (asset_id, cve, cvss, status). UI-side med tabell, filter på CVSS/status, link til kilde. Seed med funn fra scenario-pakkene. |
| **Network Scanner** | Finnes ikke. Eksisterende kollektor-pipeline er passiv (syslog-basert), ikke aktiv scanning. | Ny `scanner-worker`-container som wrapper `nmap` mot et IP-range, parser output, lagrer i `vulnerability`-tabellen. Kjør-knapp i UI. NVD CVE-cache for matching (senere). |
| **Tool Store** | Scenario-YAML-format finnes (`abb-relion.yaml`, `generic-syslog-ot.yaml`) — perfekt utgangspunkt for plugin-manifest. | Definer `tool`-manifest (utvidelse av scenario-YAML). Katalog-side i UI som leser `tools/`-mappen og viser dem. Seed med 3: `nmap-scan`, `ioc-lookup`, `ping-sweep`. "Run"-knapp i sprint 1 kan være no-op for 2 av 3. |
| **Indicators List** | Events-tabellen finnes, men ingen formell IoC-modell (TLP, type, STIX-felt). | Ny tabell `indicator` (kind, value, tlp, source, signature). UI-side med tabell + TLP-badges + filter. IoC-er gossipes som vanlige events. |
| **Chat/Discussion** | Aktivitetsloggen finnes, men ikke chat. Gossip-laget kan brukes til å distribuere meldinger. | Ny tabell `message` (incident_id, author, body). Enkel UI: én tråd per incident. Meldinger gossipes som signerte events (gjenbruker `gossip.py` direkte). |
| **Data Collector** | Finnes (`backend/kollektor/syslog_adapter.py`, scenario-YAML, dedup, post). Beta-kvalitet. | UI-side som viser tilkoblede kollektorer, scenario-pakker som er aktive, og siste innkommende events. Ingen ny ingestion-kode i sprint 1. |

**Tommelfingerregel:** 3 av 7 komponenter har grunnmur i STK (Dashboard, Indicators-via-events, Data Collector). 4 må skrives nye eller utvides vesentlig (Vulnerability Dashboard, Network Scanner, Tool Store, Chat).

---

## 3. Repo-strategi

- Innholdet i `app/` er teamets repo-rot. Behold mapper og navngiving slik koden ligger.
- `git init` + første commit dag 1, push til team-remote.
- **Behold Python-strukturen** under `backend/`, frontend under `dashboard/`. Ny scanner-worker som `backend/scanner/` eller egen toppnivå-mappe.
- **CI:** GitHub Actions med `pytest` + `ruff` + Docker-build for alle services. Compose-up som smoke test.

---

## 4. Datamodell-utvidelser (eier: Spor B, dag 1–2)

Nye tabeller utover de eksisterende `events`, `peers`, `revocations`, `sync_cursors`:

- `asset` (id, ip, hostname, kind, owner, last_seen)
- `vulnerability` (id, asset_id, cve, cvss, status, discovered_at, source_event_id)
- `indicator` (id, kind, value, tlp, source, created_at, signature, hops) — gossipes som events
- `incident` (id, title, status, started_at)
- `message` (id, incident_id, author_node_id, body, created_at, signature) — gossipes som events
- `tool` (id, slug, name, manifest jsonb, version, enabled)
- `tool_run` (id, tool_id, input, output, status, started_at, finished_at)

Alt får `id` som UUID for å fungere med eksisterende dedup. `signature` og `hops` er der det skal gossipes.

---

## 5. Tynn ende-til-ende-slice (sprint-DoD)

**Scenario som skal funke fredag:**
1. `docker compose up` starter 5 noder (KraftCERT, Hafslund, Glitrenett, Aenergi, Statnett) + 2 Varde-relays.
2. Operatør på Hafslund-noden trykker "Run nmap" i Tool Store mot RTU-sim → finn på sårbarhet → `vulnerability`-rad opprettes → vises i Vulnerability Dashboard innen 5 sekunder.
3. `demo/attacker/exploit.sh` kjøres → syslog fra RTU-sim → kollektor matcher mot ABB Relion-scenario → events gossipes → alle 5 nodenes Indicators List og Dashboard oppdateres.
4. Operatør skriver i Chat på en incident → meldingen gossipes → vises på alle nodenes incident-tråd.
5. Topologi-Canvas pulserer når peers publiserer events.

**Akseptansekriterier:**
- [ ] Hele teamet kan kjøre `docker compose up` lokalt og se 5+2-topologi i UI.
- [ ] Nye tabeller (§4) er migrert i alle noder.
- [ ] Nmap-scan fra UI lagrer minst én `vulnerability`-rad og viser den.
- [ ] Attacker-script genererer events synlige på alle 5 noder innen 30 sekunder.
- [ ] Chat-melding gossipes til alle peers og vises i Chat-UI.
- [ ] Tool Store viser 3 seedede tools.
- [ ] CI grønt på main.

---

## 6. Sprintens spor (5 personer parallelt fra dag 2)

| # | Spor | Eier | Sprint-leveranse | Bygger på |
|---|---|---|---|---|
| A | Frontend-shell, Dashboard, Topologi | Person 1 | Restrukturér `dashboard/index.html` til STK-landingsside, behold Canvas-topologi, legg til live counters via `/stats`-endpoint. | `dashboard/index.html`, `dashboard/topology.html` |
| B | Datamodell, schema-migrasjon, gossip-utvidelse | Person 2 | Migrasjoner for §4-tabeller, utvid gossip til å bære `indicator` og `message` som event-typer, oppdater signatur-kanonisering. | `backend/db.py`, `backend/gossip.py`, `backend/crypto.py` |
| C | Network Scanner | Person 3 | Ny `scanner-worker`-container med nmap, scan-jobb-API, lagring til `vulnerability`. UI: "Run nmap"-knapp + jobb-status. | Nytt — men kan piggybacke på `tool_run`-skjemaet |
| D | Tool Store + Vulnerability Dashboard | Person 4 | Definer plugin-manifest (utvid scenario-YAML), katalog-side, seed 3 tools. Bygg Vulnerability Dashboard-UI. | `backend/kollektor/scenarios/*.yaml` |
| E | Chat/Discussion + demo-scenario + Data Collector-UI | Person 5 | Chat-tabell + UI + gossiping. Side som viser kollektor-status. Kjør `demo/run-demo.sh` og verifisér end-to-end-scenarioet. | `demo/`, `backend/kollektor/` |

**Hver eier dag 1:** 1-siders "hva jeg gjør, hva jeg trenger fra andre, hva jeg blokkerer". Spor B er kritisk pad — alle andre venter på datamodellen, så Person 2 leverer schema senest dag 2 lunsj.

---

## 7. Plugin-manifest for Tool Store (eier: Spor D, dag 2)

Bygg på det eksisterende scenario-YAML-formatet så biblioteket kan dele konsept:

```yaml
slug: nmap-scan
name: Nmap Network Scan
version: 0.1.0
maturity: stable          # stable | beta | experimental — fra scenario-pakkene
inputs:
  - {name: cidr, type: string, required: true}
  - {name: ports, type: string, default: "1-1024"}
outputs:
  - {name: hosts, type: object[]}
runner:
  kind: container
  image: stk/scanner-worker:latest
  command: ["nmap", "-sV", "{{cidr}}", "-p", "{{ports}}"]
permissions:
  network: lan
  tlp_ceiling: AMBER
```

3 seedede tools sprint 1: `nmap-scan` (Spor C bygger runner), `ioc-lookup` (slå opp en IoC mot lokal indicator-tabell), `ping-sweep` (no-op stub).

---

## 8. Onboarding (dag 1, hele teamet)

Felles 2-timers session dag 1:
1. Klon repo, kjør `docker compose up`, verifisér at alle ser 5+2-topologi.
2. Walk-through av `gossip.py`, `identity.py`, `crypto.py`, `kollektor/` — Person 2 leder.
3. Demo av `demo/run-demo.sh` med attacker-script live.
4. Hver person plukker spor, melder gjensidige avhengigheter.
5. Brett opp `stk-oppsummering.md` og `TBD-TRANSPORT-ARKITEKTUR.md` så alle har samme kart.

---

## 9. Live-angrep-demo: forberedelser i sprint 1

Mesteparten finnes allerede:
- `demo/rtu-sim/` simulerer ABB Relion 615 med default-creds.
- `demo/attacker/exploit.sh` kjører nmap → brute-force → setpoint-endring → firmware-opplasting.
- `backend/kollektor/scenarios/abb-relion.yaml` har 5 deteksjonsregler.

Sprint 1-arbeid for Spor E:
- Verifisér at hele pipeline funker etter datamodell-utvidelser.
- Skriv `demo/run-stk-demo.sh` som scripter rekkefølgen for scenen (T+0, T+15, T+30, T+45, T+60 fra kickoff-worklisten).
- Legg til chat-melding-injeksjon så vi kan vise samhandling under demoen.

---

## 10. Verifisering før sprint-slutt

- [ ] Alle akseptansekriterier i §5 demonstrert på fellesskjerm.
- [ ] `docker compose up` fra ren repo-klon → 5+2 topologi opp på under 2 minutter.
- [ ] `demo/run-stk-demo.sh` kjører ende-til-ende uten manuelle inngrep utover scriptede pauser.
- [ ] CI grønt.
- [ ] README oppdatert med STK-scope og 5-minutters-quickstart.
- [ ] Hver av de 5 sporene har minst én PR merget.

---

## 11. Eksplisitt utenfor scope i sprint 1

- **Varde-mesh-laget** (WebSocket-tunneler) — kun design-dokumenter, ikke implementert. Sprint 2.
- **mTLS / sektor-PKI** — beholder HTTP + RSA-event-signering som i grunnmuren.
- **Automatisk TLP-merking og sanitisering** (modul 04 fra problemanalysen) — sprint 2.
- **STIX/TAXII-eksport av IoC-er** — sprint 2.
- **AI-korrelering / LLM-integrasjon** — sprint 3.
- **Postgres-migrering** — SQLite per node holder for hackathon.
- **Skalering forbi 5+2 noder** — performance-optimering ikke prioritert nå.
- **Polert visuell design** — fokuser på funksjon. Aurora-temaet beholdes.
