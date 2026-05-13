# Nordlys deploy — KraftCERT-noden

KraftCERT-noden (trust anchor) + KraftCERT-Varde kjører på Synology NAS.

| Komponent | URL | Backend |
|---|---|---|
| Frontend | `https://kraftcert-stk.a1.cappern.net` | DSM Reverse Proxy → `localhost:4173` |
| Varde (WSS) | `https://varde-kraftcert-stk.a1.cappern.net` | DSM Reverse Proxy → `localhost:3020` |

Wildcard-cert `*.a1.cappern.net` dekker begge subdomenene.

> **DNS-merknad**: wildcard dekker bare ett nivå, derfor `varde-kraftcert-stk.a1.cappern.net` (ikke `varde.kraftcert-stk.a1.cappern.net`).

## Fersk start (clean redeploy)

På NAS:

```sh
ssh christoffer@192.168.2.2
cd /volume1/docker/Nordlys/Team-Nordlys/app
git pull
cd deploy
DOCKER=/var/packages/ContainerManager/target/usr/bin/docker
$DOCKER compose -f docker-compose.prod.yml down -v        # sletter containere + volumer
$DOCKER compose -f docker-compose.prod.yml up -d --build
```

Etter at containere er oppe:

1. Åpne `https://kraftcert-stk.a1.cappern.net` → kjør setup-wizard. Setup skriver `role: "peer"` som default.
2. Aktiver KraftCERT-rollen:
   ```sh
   curl -X POST https://kraftcert-stk.a1.cappern.net/api/v1/setup/self-activate \
     -H "cookie: <din session-cookie fra wizarden>"
   ```
   (eller bruk en knapp i UI hvis self-activate er gated på localhost. Se setup-wizardens siste steg.)

## Eksponer KraftCERT-Varde (engangs-oppsett)

1. **DNS**: A-record `varde-kraftcert-stk.a1.cappern.net` → NAS public IP.

2. **DSM → Control Panel → Login Portal → Advanced → Reverse Proxy → Create**
   - **Source**: `https` / `varde-kraftcert-stk.a1.cappern.net` / `443`
   - **Destination**: `http` / `localhost` / `3020`
   - **Custom Header** (kritisk for WebSocket):
     - `Upgrade` = `$http_upgrade`
     - `Connection` = `$connection_upgrade`
     - `X-Forwarded-Host` = `$host`
     - `X-Real-IP` = `$remote_addr`
     - `X-Forwarded-For` = `$proxy_add_x_forwarded_for`
   - **Advanced**: `Proxy read timeout` = `3600s` (mesh-svc pinger hver 25s; default 60s dreper tunneler).

3. **DSM → Control Panel → Security → Certificate**
   - Eksisterende wildcard `*.a1.cappern.net` dekker subdomenet.
   - **Settings → Configure**: bind wildcard-certet til den nye reverse-proxy-tjenesten.

4. **Pull + restart** på NAS:
   ```sh
   cd /volume1/docker/Nordlys/Team-Nordlys/app
   git pull
   cd deploy
   docker compose -f docker-compose.prod.yml up -d --build varde-svc mesh-svc
   ```

5. **Røyktest** fra hvor som helst:
   ```sh
   wscat -c wss://varde-kraftcert-stk.a1.cappern.net/ws
   # forventer: tilkobling holder seg oppe (varde svarer på protocol-handshake)

   curl -sf https://varde-kraftcert-stk.a1.cappern.net/.well-known/stk-roster | jq .
   # forventer: "url": "https://varde-kraftcert-stk.a1.cappern.net"
   ```

## Team-peer-oppsett (utenfor scope, kort referanse)

Team-medlemmer som setter opp egne peer-noder må eksponere sin egen Varde offentlig (sky/DMZ), og sette:

```env
# På peer-Varde (varde-svc):
PUBLIC_URL=https://<deres-varde-domene>
VARDE_PEERS=https://varde-kraftcert-stk.a1.cappern.net

# På peer-mesh-svc:
VARDE_BOOTSTRAP=wss://varde-kraftcert-stk.a1.cappern.net/ws
```

`PUBLIC_URL` må være `https://` (ikke `wss://`) — `mesh-svc/tunnel.ts` normaliserer selv til `wss://` + `/ws` for tunnel-bruk, og `varde-svc/peer-gossip.ts` bruker plain HTTP `fetch()` for inter-Varde-gossip.
