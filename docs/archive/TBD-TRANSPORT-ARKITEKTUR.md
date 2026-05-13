# STK — Varde-mesh transport-arkitektur

> **Status:** Designutkast for diskusjon. Ikke vedtatt — flere åpne spørsmål nederst.
> Skrevet 2026-04-25. Erstatter dagens HTTP-peer-til-peer-gossip.

---

## Kontekst

Dagens implementasjon har et grunnleggende problem: tre av fem peers (Hafslund, Glitrenett, Aenergi) eksponerer egne porter direkte mot internett for å delta i gossip-meshet. KraftCERT og Statnett bruker nginx-Varde som «skjulemekanisme», men selv den krever at Varden kan nå noden internt — i ekte produksjon må noden enten åpne et hull i brannmuren eller etablere en utgående tunnel manuelt.

Dette samsvarer ikke med virkeligheten i kraftsektoren. Beredskapsapparatet til et kraftselskap ligger *langt inne i løken* — i en sone der innkommende trafikk er kategorisk avvist. IT-sjefen åpner ikke porter mot internett for et delingsnett, uansett hvor godt det er signert.

**Målarkitektur:** Bare et eget *Varde-lag* er publikt nåbart. Noder sitter inne i hver organisasjons perimeter og etablerer kun *utgående* forbindelser til Varder. Vardene utgjør et redundant mesh som gossiper seg imellom og oppdager hverandre dynamisk. KraftCERT er en helt vanlig node i denne modellen — uten privilegert nettverksposisjon.

---

## Visuell skisse

```
                     ╔══════════════════════════════════════╗
                     ║         INTERNETT (publikt)          ║
                     ║                                      ║
                     ║    ┌─────────┐ HTTP  ┌─────────┐    ║
                     ║    │ Varde A │◄─────►│ Varde B │    ║
                     ║    │ (DNS)   │ pull/ │ (DNS)   │    ║
                     ║    │ +state  │ push  │ +state  │    ║
                     ║    └────┬────┘       └────┬────┘    ║
                     ║         │ ▲             ▲ │         ║
                     ║         │ │             │ │         ║
                     ║         │ │  ┌──────────┘ │         ║
                     ║         │ │  │  HTTP      │         ║
                     ║         │ │  │  gossip    │         ║
                     ║    ┌────▼─┴──┴──┐         │         ║
                     ║    │  Varde C   │◄────────┘         ║
                     ║    │ (DNS)      │                   ║
                     ║    │ +state     │                   ║
                     ║    └─┬──┬───┬───┘                   ║
                     ╚══════│══│═══│═══════════════════════╝
                            │  │   │
                  WebSocket │  │   │ WebSocket
              (TLS, outbnd) │  │   │ (TLS, outbnd)
                            │  │   │
        ╔═══════════════════│══│═══│════════════════════════╗
        ║   INTERNT NETT    │  │   │  (per organisasjon)    ║
        ║                   │  │   │                        ║
        ║              ┌────▼┐ │   │     ┌──────┐           ║
        ║              │Hafs-│ │   │     │Glitr-│           ║
        ║              │lund │ │   └────►│enett │           ║
        ║              │ Node│ │         │ Node │           ║
        ║              └─┬───┘ │         └──┬───┘           ║
        ║                │     │            │               ║
        ║         (UI på loopback,       (UI på loopback,   ║
        ║          kun org.brukere)       kun org.brukere)  ║
        ║                                                    ║
        ║   ┌─────────┐   ┌──────────┐   ┌──────────┐       ║
        ║   │KraftCERT│   │ Aenergi  │   │ Statnett │       ║
        ║   │  Node   │   │  Node    │   │  Node    │       ║
        ║   │ (vanlig │   └──────────┘   └──────────┘       ║
        ║   │  node)  │                                      ║
        ║   └─────────┘   (Hver kobler til 3 Varder, ikke   ║
        ║                  alle — top-N med konsistent      ║
        ║                  hash for stabil fordeling.)       ║
        ╚════════════════════════════════════════════════════╝
```

**Tre faste rom i arkitekturen:**

| Rom | Komponent | Eksponering | Tillit |
|---|---|---|---|
| Publikt | Varde-mesh | DNS+TLS-eksponert | Verifiseres via signatur, *ikke* trust anchor |
| Lim | WebSocket-tunneler | Utgående fra node | Nodens signering autentiserer; Varden er bare bærer |
| Privat | Node + lokalt UI | Loopback / org.intern | Nodens egne nøkler, KraftCERT-validert identitet |

---

## Roller og ansvar

### Varde

- **Identitet:** Egen RSA-nøkkel og DNS-navn (f.eks. `varde-1.stk.no`)
- **Lagrer:** Events (TTL ~30 dager), identitetsregister (full kopi), revokeringer (full kopi), Varde-roster
- **Eksponerer (publikt):**
  - HTTP for Varde↔Varde-gossip
  - WebSocket `/ws` for node-tilkobling
  - HTTPS GET `/.well-known/stk-roster` (signert liste over kjente Varder, fallback)
- **Gjør:** Mottar events fra noder, distribuerer til andre Varder, leverer til abonnerte noder, validerer signaturer
- **Gjør IKKE:** Utsteder identiteter, signerer events, lagrer ukrypterte hemmeligheter på vegne av noder

### Node

- **Identitet:** RSA-nøkkel som i dag, validert via invite-token-flyten
- **Eksponerer:** Lokalt UI på loopback eller intern bridge — *aldri publikt*
- **Etablerer:** Utgående WebSocket til *N* utvalgte Varder (standard N=3)
- **Lagrer:** Egne events lokalt + speil av identitetsregister + Varde-roster
- **Gjør IKKE:** Aksepterer innkommende forbindelser

### KraftCERT-rollen

- En vanlig node nettverksmessig
- Skiller seg fra andre noder kun via `ROLE=kraftcert` i konfig
- Utsteder invite-tokens og revokeringer; disse propagerer over Varde-mesh som vanlige kontroll-meldinger

---

## Protokoll-skisse

### Node ↔ Varde (WebSocket)

JSON-meldinger med `type` + `corr_id` (for request/response) + `seq` (for replay-deteksjon).

**Oppstrøms (node → Varde):**

| Type | Felter | Når sendes |
|---|---|---|
| `HELLO` | node_id, public_key, invite_token?, last_event_cursor | Ved tilkobling |
| `EVENT` | id, severity, title, description, signature | Ny hendelse opprettet |
| `PING` | seq | Hvert 25. sekund |
| `RESYNC` | from_cursor | Etter reconnect, mistenkt tap |

**Nedstrøms (Varde → node):**

| Type | Felter | Når sendes |
|---|---|---|
| `WELCOME` | accepted, peer_roster, varde_roster, since_cursor | Etter HELLO godkjent |
| `REJECTED` | reason | HELLO avvist (token ugyldig osv.) |
| `EVENT` | (videresendt event fra mesh) | Ny event via gossip |
| `IDENTITY_UPDATE` | node_id, company, public_key | Ny peer registrert |
| `REVOCATION` | node_id, reason, signed_by | Peer revokert |
| `VARDE_ROSTER` | varder: [{id, url, pubkey}] | Ved endring i Varde-mesh |
| `PONG` | seq_echo | Svar på PING |

### Varde ↔ Varde (HTTP, lik dagens gossip)

| Endpoint | Funksjon |
|---|---|
| `GET /v1/events/since/{cursor}` | Pull events for sync |
| `POST /v1/events/sync` | Push nye events (med hop-counter) |
| `GET /v1/identity` | Identitetsregister + revokeringer |
| `POST /v1/identity/sync` | Push nye identiteter |
| `GET /v1/roster` | Liste over kjente Varder |
| `POST /v1/roster/announce` | Annonser ny Varde |
| `POST /v1/invite/validate` | Relay invite-validering til KraftCERT-noden (når ny node er via *denne* Varden men KraftCERT-noden er via en annen) |

---

## Sentrale flyter

### 1. Onboarding av ny node

```
[Operator]                                        [KraftCERT]
   │                                                  │
   │ 1. Skaffer invite-token (manuelt fra KraftCERT)  │
   │                                                  │
[Ny node]                                             │
   │                                                  │
   │ 2. Åpner WS til bootstrap-Varde                  │
   │ 3. Sender HELLO{node_id, pubkey, invite_token}   │
   │                                                  │
[Bootstrap-Varde]                                     │
   │                                                  │
   │ 4. Broadcast INVITE_VALIDATION_REQUEST til       │
   │    Varde-meshet (med corr_id)                    │
   │                                                  │
   │       ↓ (en eller annen Varde har KraftCERT-noden tilkoblet)
   │                                                  │
   │ 5. Den Varden leverer over WS til KraftCERT  ───►│
   │                                                  │
   │ 6. KraftCERT validerer token i lokal DB,         │
   │    signerer "approval" + identity ◄──────────────│
   │                                                  │
   │ 7. Approval propagerer som IDENTITY_UPDATE       │
   │    over hele Varde-mesh (alle Varder lagrer)     │
   │                                                  │
   │ 8. Bootstrap-Varde sender WELCOME til ny node    │
[Ny node]                                             │
   │ 9. Tar imot peer-roster + varde-roster,          │
   │    velger 3 Varder å holde åpne tunneler mot.    │
```

**Robusthet:** Hvis KraftCERT-noden er offline når invite mottas, holder Varde-meshet `INVITE_VALIDATION_REQUEST` i kø (TTL 5 min). Når KraftCERT kobler til igjen, prosesseres ventende invites og godkjenningen propageres normalt.

### 2. Ny event publiseres

```
[Hafslund-node]
   │
   │ Operator klikker "rapporter hendelse"
   │ Event signeres lokalt
   │
   │ → EVENT over WS til alle 3 tilkoblede Varder
   │
[Varde A,B,C samtidig]
   │
   │ Hver lagrer event i lokal SQLite (UUID-dedup)
   │ Hver pusher til andre Varder via HTTP gossip
   │
[Andre Varder D,E…]
   │
   │ Mottar via HTTP, dedup, lagrer
   │ Pusher EVENT over WS til alle tilkoblede noder
   │   (utenom opphavet)
   │
[Andre noder]
   │
   │ Verifiserer signatur mot lokalt identitetsregister
   │ Lagrer i lokal DB
   │ UI viser umiddelbart
```

**Latens:** Forventet < 1 sek for hele meshet (WS-push er umiddelbar; HTTP-Varde-gossip kjører hvert 5–10 sek, men direkte push er på vei). Dagens 10-sekunders polling-intervall blir ~10x bedre.

### 3. Varde-discovery

Ny Varde annonserer seg til en kjent Varde via `POST /v1/roster/announce`. Den mottakende Varden:
1. Validerer Varde-signaturen (Varder har nøkkelpar) mot en KraftCERT-utstedt Varde-identitet
2. Legger til i lokal roster
3. Propagerer announcement videre i mesh
4. Sender `VARDE_ROSTER`-melding til alle tilkoblede noder

Noder oppdaterer sin top-N-utvalg ved hver roster-endring (re-evaluerer hash-rangering, bytter forbindelser hvis det er bedre matcher).

**Bootstrap når alt er nytt:** Hardkodet seed-Varde-URL i node-konfigurasjonen. Ved fravær av tilkobling i > 2 min: hent signert roster fra `https://kraftcert.no/.well-known/stk-roster`.

---

## Sikkerhetsmodell

### Hva en kompromittert Varde KAN gjøre

| Angrep | Konsekvens | Mottiltak |
|---|---|---|
| Slippe events | DoS for spesifikk node | Top-N-tilknytning gir redundans; 3 Varder må kompromitteres for total stillhet |
| Endre rekkefølge på meldinger | Kan villede analyse | Sekvensnumre signeres i events; mottakeren logger reorder-anomalier |
| Observere metadata | Vet hvem som rapporterer når | mTLS senere; events har ikke PII i innholdet |
| Spille av events på nytt | Spamme gamle hendelser | UUID-dedup + avvisning av events > 5 min fram i tid eller eldre enn TTL |

### Hva den IKKE kan gjøre

- **Forfalske events:** Krever nodens private nøkkel (RSA-2048-signering på nodesiden)
- **Forfalske identiteter:** Krever KraftCERTs private nøkkel (KraftCERT signerer identitetsgodkjenninger)
- **Lese event-innhold:** Beskyttet av TLS, og innholdet er forretningsrelevant, men ikke hemmelig

### Designvalg: TLS er nok, mTLS er overkill

Node-til-Varde over TLS gir konfidensialitet. Autentisering av noden skjer via signert HELLO med en offentlig nøkkel kjent fra KraftCERT-registeret — slik at Varden vet hvem den snakker med uten klientsertifikat. mTLS kan legges til senere som «paranoid mode» uten redesign.

---

## Filstruktur etter omarbeiding

```
varde/
├── Dockerfile              # Erstattet: nå python:3.12-slim
├── requirements.txt        # Ny: fastapi, uvicorn, websockets, cryptography, httpx
├── main.py                 # Ny: FastAPI med WS + gossip endpoints
├── relay.py                # Ny: WS connection registry, message routing
├── gossip.py               # Ny: Varde↔Varde HTTP-gossip (gjenbruker mønster fra backend/gossip.py)
├── identity.py             # Ny: peer registry på Varde
├── db.py                   # Ny: SQLite-skjema for events, identities, roster
└── crypto.py               # Ny: kun signaturverifikasjon (Varden signerer ikke events)

backend/                    # Node-koden — slankere etter migrasjon
├── main.py                 # Endret: fjern eksterne /events/sync, /identity, /peers
│                           #         Bind UI til 127.0.0.1 default (eller intern bridge)
├── gossip.py               # Endret: ~70% slettet. Behold: rate-limit, activity log,
│                           #         signature-verifikasjon, push_event-funksjons-signatur
├── varde_client.py         # Ny: persistent WS-klient med reconnect, message routing
├── identity.py             # Uendret
├── crypto.py               # Uendret
├── db.py                   # Uendret
└── static/index.html       # Endret: fjern cross-origin /health-pings — alt fra egen node

docker-compose.yml          # Omskrevet: 3 varder eksponert på distinkte ports;
                            # 5 noder uten ports-mapping; nodes har VARDE_BOOTSTRAP env
```

### Gjenbruk fra eksisterende kode

| Eksisterende | Brukes i |
|---|---|
| `backend/crypto.py` (sign_event, verify_signature, _canonical) | Uendret begge steder |
| `backend/identity.py` (create_invite, validate_invite, register_peer) | Beholdes på node, KraftCERT-rollen kjører den |
| `backend/gossip.py:check_rate_limit` | Flyttes til Varde |
| `backend/gossip.py:_log_activity` | Mønster gjenbrukes på Varde |
| `backend/main.py:sync_events`-handler-logikk | Migreres til Varde-side handler |

---

## Implementasjons-rekkefølge

Hvert trinn etterlater systemet kjørbart, så vi kan stoppe og polere når som helst.

1. **Trinn 1 — Varde som FastAPI-tjeneste, transparent foran noder.**
   Erstatt nginx i `varde/` med en Python-app som eksponerer dagens HTTP-endepunkter og videresender til upstream-noden. Verifiser at eksisterende compose-stack fortsatt fungerer.

2. **Trinn 2 — Varde↔Varde HTTP-gossip.**
   Implementer event/identity-pull/push mellom Varder. Test med 2–3 Varder at events konvergerer.

3. **Trinn 3 — WebSocket node↔Varde, kun for events.**
   Noden får `varde_client.py`. Bak `USE_VARDE=true`-env-flagg. Identitet og onboarding fortsetter via HTTP foreløpig.

4. **Trinn 4 — Onboarding over Varde-mesh.**
   Implementer `INVITE_VALIDATION_REQUEST` med corr_id og timeout. Test happy path + KraftCERT-offline-flyten.

5. **Trinn 5 — Top-N-Varde-tilknytning og dynamisk roster.**
   Noden velger 3 Varder via konsistent hash. Roster-endringer trigger re-evaluering.

6. **Trinn 6 — Feilhåndtering.**
   Persistert roster på disk. Fallback til well-known signert roster. Tydelig isolasjons-logging.

7. **Trinn 7 — Fjern HTTP-gossip fra noden.**
   Gjør WS til eneste transport. Lokalt UI binder til loopback som standard. Slett de eksterne sync-endepunktene i `backend/main.py`.

---

## Verifiseringsplan

- **Enhetstester** for kanonisk serialisering + signaturverifikasjon (uendret)
- **Integrasjonstester** med 3 Varder + 5 noder i Docker:
  - Event publisert på node A er synlig på node B/C/D innen 2 sek
  - Node A drepes; reconnect henter alle tapte events siden cursor
  - 1 Varde drept; alle noder fortsetter via de gjenværende 2
  - Ny node onboardes; KraftCERT validerer over mesh
  - Revokering propagerer; events fra revokert node avvises
- **Sikkerhetstest:**
  - Modifisert event uten ny signatur → avvist av mottakeren
  - Event med tidsstempel +10 min → avvist
  - Avspilling av samme event-UUID → ignorert
- **Manuelt:** Operator-UI på én node viser identisk hendelseslogg som tre andre noders UI innen 2 sek

---

## Åpne spørsmål for diskusjon

Følgende valg krever brukerens bekreftelse før implementering. Gå gjennom hvert punkt — eventuelle avvik fra anbefalt løsning påvirker designet på ikke-trivielle måter.

1. **Migrasjonsstrategi:** Trinnvis (anbefalt — beholder kjørbart system gjennom migrasjonen) eller hard cut-over (raskere, men midlertidig brudd)?

2. **Top-N Varder per node:** N=3 er anbefalt. Vil dere ha N=2 (sparsommelig) eller N=alle (maks redundans, mer trafikk)?

3. **Event-retensjon på Varde:** 30 dager er anbefalt. Lengre (90 dager) gir bedre re-sync etter lange utfall; kortere (7 dager) reduserer lagringsbehov og PII-eksponering hvis Varden lekker.

4. **Bootstrap-fallback:** Skal vi implementere `https://kraftcert.no/.well-known/stk-roster` som siste utvei, eller starter vi enkelt med kun statiske env-variabler?

5. **TLS / mTLS:** Kun TLS nå, mTLS senere — eller bake inn mTLS fra start?

6. **Identitet for Varder:** Skal Varder selv ha KraftCERT-utstedte identiteter (mer sikkerhet, mer kompleks bootstrap), eller en enklere «shared secret» mellom Varder?

---

## Risiko-register

| Risiko | Sannsynlighet | Konsekvens | Mottiltak |
|---|---|---|---|
| WS-reconnect-storm ved Varde-restart | Middels | Trafikkspike | Eksponentiell backoff + jitter på nodesiden |
| Varde-state ute av sync (split-brain) | Lav | Inkonsistente events | Anti-entropi-pull hvert 5. min |
| Onboarding henger hvis KraftCERT er nede | Middels | Nye noder kan ikke koble til | INVITE_VALIDATION_REQUEST-kø med 5 min TTL; manuell fallback |
| Korrupte meldinger over WS | Lav | Disconnect og reconnect | JSON-validering + drop+reconnect, ikke crash |
| Lagringsvekst på Varde | Middels (over tid) | Full disk | TTL-rydding; alarm ved 80 % disk |
