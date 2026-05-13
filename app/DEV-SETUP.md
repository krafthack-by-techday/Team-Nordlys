# Nordlys Dev Setup

## Arkitektur: Roller og noder

Systemet har to typer noder:

| Rolle | Beskrivelse | Hvem | Domene (pre-prod) |
|-------|-------------|------|--------------------|
| `kraftcert` (IDP) | Identity Provider — utsteder og signerer peer-identiteter | KraftCERT | kraftcert-stk.n0rdlys.no |
| `peer` | Vanlig deltakernode (f.eks. Statnett, Hafslund, etc.) | Energiselskap | TBD |

### Rolletildeling

Rollen utledes **automatisk** fra `node_id`:
- Inneholder `node_id` strengen "kraftcert" → `ROLE=kraftcert` (IDP)
- Ellers → `ROLE=peer`

`ROLE` env-variabel kan overstyre dette (for testing), men i normal drift settes den aldri eksplisitt.

### Rekkefølge for utrulling

1. **KraftCERT-noden** (`kraftcert-stk.n0rdlys.no`) deployes først.
2. **Peer-noder** (f.eks. Statnett) settes opp etter at KraftCERT-noden er operativ.

## Onboarding (Setup Wizard)

Alle noder onboardes identisk — samme stack, samme compose-fil. Rollen bestemmes av hva du skriver i setup wizard.

### Flyt

1. Deploy stacken (`docker compose up`)
2. Åpne frontend i nettleser → setup wizard vises (ingen brukere i DB)
3. Fyll inn:
   - **Company**: f.eks. "KraftCERT" eller "Statnett"
   - **Node name**: f.eks. "prod-01"
   - **Admin email + passord**
4. Wizard genererer:
   - `node_id` = `slugify(company)-slugify(nodeName)` (f.eks. `kraftcert-prod-01`)
   - Ed25519 keypair → `/data/nordlys/keys/`
   - Verifikasjonskode (6 tegn, gyldig 1 time)
5. Verifiser med CLI:
   ```bash
   docker exec nordlys-v2 cli-verify <KODE>
   ```
6. Noden er aktiv — restart tjenester for å plukke opp ny identity:
   ```bash
   docker compose restart core-svc mesh-svc
   ```

### Eksempler

| Company | Node name | Generert node_id | Utledet rolle |
|---------|-----------|------------------|---------------|
| KraftCERT | prod-01 | `kraftcert-prod-01` | `kraftcert` |
| Statnett | node-01 | `statnett-node-01` | `peer` |
| Hafslund | main | `hafslund-main` | `peer` |

## Mesh-tilkoblingsflyt

```
Peer mesh-svc  →  ws://varde-svc/ws  →  varde-svc sjekker KRAFTCERT_NODE_IDS
                                              ↓
                                    Forwarder HELLO til KraftCERT-session
                                              ↓
                                    KraftCERT core-svc signerer identitet
                                              ↓
                                    Peer mottar WELCOME med signert identitet
```

Hvis KraftCERT-noden ikke er online svarer Varde med `kraftcert_offline_retry_later` (WebSocket close 1013).

## Konfigurasjon (nøkkelvariabler)

| Variabel | Tjeneste | Beskrivelse |
|----------|----------|-------------|
| `NODE_ID` | core-svc, mesh-svc | Settes av setup wizard i DB. Env-var overstyrerer (kun for testing). |
| `COMPANY` | core-svc | Settes av setup wizard i DB. |
| `ROLE` | core-svc | **Utledes fra node_id**. Env-var overstyrerer (kun for testing). |
| `VARDE_BOOTSTRAP` | mesh-svc | WebSocket-URL til varde-svc for mesh-signaling. |
| `KRAFTCERT_NODE_IDS` | varde-svc | Kommaseparert liste over node_id-er som har KraftCERT-rollen. Default: `"kraftcert"`. |

## Lokal utvikling (`docker compose`)

```bash
docker compose -f app/docker-compose.dev.yml up --build
```

I dev-stacken kjører alt lokalt som en enkelt node:
- `core-svc` bruker placeholder `NODE_ID=uninitialized` før setup wizard er kjørt (genererer ephemeral keypair).
- `varde-svc` kjører i `VARDE_TEST_MODE=true` som relaxer identity-kravene.
- Kjør setup wizard via frontend for å konfigurere noden.

## Veien til prod

- [ ] Deploy KraftCERT-node til kraftcert-stk.n0rdlys.no
- [ ] Sett opp reverse proxy: kraftcert-stk.n0rdlys.no → port 4173
- [ ] Kjør setup wizard (company="KraftCERT", nodeName=...) → verifiser med cli-verify
- [ ] Verifiser at varde-svc aksepterer connections og KraftCERT kan utstede identiteter
- [ ] Sett opp første peer-node (f.eks. Statnett) med `VARDE_BOOTSTRAP` pekende mot kraftcert-stk.n0rdlys.no
