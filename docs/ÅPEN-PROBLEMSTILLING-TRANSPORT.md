# Transportprotokoll for STK

## Beslutning

**Produksjonsretning: mTLS over HTTPS, med valgfri Varde som relay for noder uten åpen port.**

- KraftCERT fungerer som CA og utsteder klientsertifikater ved provisjonering (gjenbruk av eksisterende onboarding).
- Noder snakker direkte node-til-node over mTLS når nettverket tillater det.
- Noder bak streng brannmur kobler outbound til en Varde, som broker forbindelsen ende-til-ende-kryptert. Varden ser kun TLS-trafikk.
- Flere Varder kan eksistere parallelt — Hafslund, Statnett og KraftCERT kan alle drifte hver sin uten at noen blir kritisk.

For hackathon-demoen beholdes ren HTTP i Docker Compose. mTLS presenteres som produksjonsretningen.

WireGuard ble vurdert grundig og avvist. Analysen ligger nederst i dokumentet.

## Kjerneproblemet

Etter provisjonering (onboarding via KraftCERT) skal noder kommunisere P2P uten:

- Eksponerte porter på internett
- Avhengighet av Varde (relay) eller sentral infrastruktur for noder som *kan* nå hverandre
- Krav om stort driftsapparat hos peeren

Samtidig krever TCP at én part lytter og én part initierer. Spørsmålet er hvordan to noder bak brannmur uten åpne innkommende porter når hverandre.

```
Node A (bak FW)          Node B (bak FW)
  Outbound OK →            Outbound OK →
  ← Inbound blokkert      ← Inbound blokkert

  Hvem lytter? Ingen kan ta imot.
```

## Krav

- **Øydrift**: Kraftforsyningen skal fungere lokalt. STK må operere uten internett.
- **P2P når mulig**: Direkte forbindelse mellom noder som kan nå hverandre, uten unødig mellomledd.
- **Lav terskel**: Små aktører uten driftsapparat skal kunne delta.
- **Varde er valgfritt**: Varder er broer mellom regioner og fallback for NAT-tede noder, ikke en forutsetning.
- **Provisjonering**: KraftCERT har publiserte tjenester for engangs onboarding.

## Hvorfor mTLS over HTTPS

De fleste kraftaktørene *kan* eksponere en port (internt eller via DMZ) — de gjør det allerede for SCADA, EMS og andre systemer. Problemet med ren HTTP i dagens implementasjon er ikke HTTP som protokoll, men at trafikken er **ukryptert og uautentisert**.

```
I dag:        Node A --[HTTP klartekst]--> Node B:8000
Produksjon:   Node A --[mTLS, klientcert]--> Node B:8000
                       ↑
               KraftCERT som CA utsteder klientsertifikater
               ved provisjonering. Gjenbruk eksisterende
               onboarding-flyt.
```

### Hva dette gir

- **Transportkryptering** — TLS 1.3
- **Gjensidig autentisering** — klientcert = nodeidentitet, gjenbruker eksisterende RSA-identitet
- **Fungerer gjennom alle brannmurer** — HTTPS er universelt tillatt, også gjennom inspekserende proxy
- **Ingen ny infrastruktur** — ingen WireGuard, ingen rendezvous, ingen UDP
- **Revokering via CRL/OCSP** — standard, velforstått, propageres samme vei som dagens revoke-flyt
- **Lav terskel** — alle vet hva HTTPS er, alle har bibliotekstøtte

### Beslutninger

- **CA**: KraftCERT er CA. Ekstern PKI er overkill for en sektor-intern mesh og bryter prinsippet om "lavere terskel". KraftCERT er allerede trust anchor for invite-tokens og RSA-nøkler.
- **Nøkkelgenerering**: Noden genererer privatnøkkel lokalt og sender Certificate Signing Request (CSR) til KraftCERT under onboarding. KraftCERT ser aldri privatnøkkelen.
- **Sertifikatlevetid**: Kort (90 dager) med automatisk fornyelse via gossip — samme kanal som identitetsdistribusjon.
- **Revokering**: CRL distribueres via gossip på linje med dagens `revoke`-endepunkt. Noder verifiserer mot lokal CRL ved hvert handshake.

## Varde — relay for NAT-tede noder

En Varde er en valgfri HTTPS-basert relay som bærer kryptert mTLS-trafikk videre til noder som ikke kan eksponere en port. Den ser kun TLS-strømmen, aldri klartekst.

```
Node A (bak FW) --mTLS outbound--> Varde --mTLS outbound<-- Node B (bak FW)
                                     ↑
                           Ser kun kryptert trafikk.
                           Bærer signalet videre,
                           som en tent varde.
```

Navnet **Varde** refererer til det historiske norske varslingssystemet der steinvarder på fjelltopper ble tent for å bære signaler mellom punkter som ikke kunne se hverandre direkte — desentralisert, redundant, hver Varde selvstendig men del av en kjede.

### Egenskaper

- **Utbyttbar** — flere Varder, ingen er kritisk. KraftCERT, Statnett, Hafslund kan hver drifte sin egen.
- **Ende-til-ende-kryptert** — Varden ser kun TLS-bytes, kan ikke lese eller manipulere innhold.
- **Valgfri** — noder som kan nå hverandre direkte bruker den ikke. En node kan annonsere sin Varde i `/.well-known/stk`.
- **Tilstandsløs** — Varden lagrer ingenting. Faller den ut, bytter klienten til en annen.

### Hvem drifter Varder

Varder drives av aktører som har offentlig IP og kapasitet — KraftCERT, Statnett, og større nettselskaper. En liten aktør velger hvilken Varde de vil bruke under onboarding, og kan bytte når som helst. Tap av én Varde tar ikke ned meshen.

## Industristandard støtter retningen

Ingen produksjonssystemer oppnår P2P gjennom NAT uten en form for mellomtjeneste. Mønsteret er det samme overalt — tre trinn:

1. **Prøv direkte** — hole-punching, STUN, UDP-probing
2. **Relay som fallback** — når direkte feiler (20-50 % av tilfellene). I STK: **Varde**
3. **Relayen er "dum"** — ser kun kryptert trafikk, kan byttes ut, kan kjøres av flere parter

| Produkt | Signalering / discovery | NAT-fallback | Transport |
|---|---|---|---|
| **Tailscale** | Koordineringsserver (control plane) | DERP-relays (HTTPS) | WireGuard |
| **Nebula** (Slack) | Lighthouses (rendezvouspunkter) | Via lighthouse | Noise-protokoll |
| **ZeroTier** | Root-servere ("planets") | Root som relay | Egen protokoll |
| **Syncthing** | Global discovery-server | Community-drevne relays | TLS |
| **WebRTC** | STUN + app-definert signalering | TURN-relays | DTLS-SRTP |
| **libp2p** (IPFS) | DHT + bootstrap-noder | Circuit Relay v2 | QUIC / TCP / WebSocket |

Tailscale er det mest relevante eksempelet: de bygde WireGuard-overlay i produksjon og fant at WireGuard alene ikke holder. Løsningen var **DERP** (Designated Encrypted Relay for Packets) — en HTTPS-relay som fungerer gjennom alle brannmurer. Når WireGuard-tunnel lykkes: direkte P2P. Når den ikke lykkes: trafikk rutes via nærmeste DERP. Klienten merker ingen forskjell.

Varde er det samme mønsteret, kuttet ned: når mTLS direkte fungerer, brukes det. Når det ikke gjør det, bæres trafikken videre av en Varde.

---

## Vurdert og avvist: embedded WireGuard

WireGuard er en åpen protokoll og Linux kernel-modul. På overflaten løser den problemet med ett UDP-handshake outbound og kryptert overlay-nettverk. Etter analyse ble retningen forkastet av fire grunner:

### 1. NAT-traversal-påstanden holder ikke

WireGuard har *keepalives* som vedlikeholder eksisterende NAT-mappings, men **ingen mekanisme for å etablere** en forbindelse mellom to noder som begge sitter bak NAT.

| Situasjon | WireGuard alene | Med signalering |
|---|---|---|
| A bak NAT, B har offentlig IP | Fungerer — A initierer | Fungerer |
| A og B begge bak NAT | **Fungerer ikke** — ingen vet den andres `ip:port` | Trenger STUN/rendezvous |
| A bak strikt NAT (symmetric) | Fungerer ikke | Hole-punching feiler ~50 % av tiden |

For at to NATtede noder skal finne hverandre, trengs en ekstern signaleringskanal. Det er ikke et åpent spørsmål — det er et **uløst arkitekturproblem** som underminerer P2P-premisset. En lighthouse eller koordineringsserver må *alltid* være tilgjengelig for nye tunneler — i praksis en sentral avhengighet for transport.

### 2. UDP er blokkert i OT-nettverk

Norske kraftselskaper med OT-segmenterte nettverk har typisk:

- Whitelisted outbound HTTP/S via proxy
- Alt annet blokkert (inkludert UDP)
- Inspeksjon/SSL-terminering på utgående trafikk

WireGuard har ingen TCP-fallback. Nodene som trenger STK mest (de med streng nettverkssikkerhet) er de som ikke kan bruke WireGuard.

### 3. Nøkkeldistribusjon er uløst

WireGuard løser transport, ikke nøkkeldistribusjon.

- Hvis KraftCERT genererer WireGuard private key, har KraftCERT sett privatnøkkelen. Ett kompromittert KraftCERT-øyeblikk = alle nøkler kompromittert.
- Peer-konfigurasjon krever oppdatering av alle noder ved hver endring. Ny node → N-1 noder må oppdatere sin `[Peer]`-blokk.
- Revokering er en race condition. Kompromittert node X har fortsatt overlay-tilgang mens revokering propageres via gossip *over det samme overlayet*.

### 4. Mesh skalerer dårlig

WireGuard i full mesh = O(n²) tunneler:

| Noder | Tunneler | Konfig-linjer per node |
|---|---|---|
| 5 (demo) | 10 | ~20 |
| 30 (realistisk) | 435 | ~120 |
| 100 (ambisiøst) | 4950 | ~400 |

Hver ny node krever oppdatering av alle eksisterende noders WireGuard-konfigurasjon — enten via sentral konfigurasjonstjeneste (motstrider P2P) eller dynamisk rekonfigurering via userspace API (komplekst og feilutsatt).

### Direkte sammenligning

| Krav | WireGuard | mTLS over HTTPS + Varde |
|---|---|---|
| Ingen åpne innkommende porter | Delvis (UDP outbound) | **Ja** (HTTPS outbound via Varde) |
| Fungerer gjennom bedriftsbrannmur | Nei (UDP blokkert) | **Ja** (HTTPS alltid tillatt) |
| Øydrift | Delvis (eksisterende tunneler) | **Ja** (lokal mTLS uten internett) |
| Ingen sentral avhengighet | Nei (trenger rendezvous) | **Ja** (flere Varder, valgfritt) |
| Lav terskel for deltakelse | Middels (WG-konfig) | **Ja** (standard HTTPS) |
| Transportkryptering | Ja (Noise) | **Ja** (TLS 1.3) |
| Etablert i sektoren | Nei | **Ja** (HTTPS er universelt) |

WireGuard løser et annet problem enn det STK har. Det er et utmerket VPN-byggeklots — men premisset om "ingen rendezvous, ingen relay, ingen sentral komponent" holder ikke i praksis, og kollapser til "WireGuard + DERP" akkurat som Tailscale fant ut. Da er det enklere å bruke HTTPS hele veien.

---

## Status

**Landet.** Produksjonsretning er mTLS over HTTPS med Varde som valgfri relay. Varde er allerede implementert som nginx reverse proxy (`varde/`) og brukes av KraftCERT og Statnett i `docker-compose.yml`. Neste steg er å bytte ren HTTP ut med mTLS — utenfor scope for hackathon-demoen, men inkludert i produksjonsplanen.
