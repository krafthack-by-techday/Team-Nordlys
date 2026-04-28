# STK-demo: live RTU-angrep i tre roller

Demonstrasjon for Krafthack 2026: et koordinert angrep mot et eksponert
ABB Relion 615-vernrelé, basert på mønsteret som ble brukt mot polske
energi- og vannselskaper i 2024–2025 (Z-Pentest / Sector 16).

## Hva publikum ser

| Skjerm | Innhold |
|---|---|
| **Hacker** | Terminal som kjører `attacker/exploit.sh`. nmap → brute-force → SSH-default-cred → setpunkt-tukling → firmware-tukling. |
| **Hafslund (peer A)** | http://localhost:8801 — events dukker opp ettersom kollektoren oppdager angrepet. |
| **Statkraft (peer B)** | http://localhost:8802 — samme events ankommer ~5–10 sekunder senere via gossip. |
| **(valgfritt)** ABB Relion 615 | http://localhost:8888 — selve "RTU-en" som blir kompromittert. |

## Forutsetninger

- Docker Desktop (eller annen `docker compose`-implementasjon)
- `python3` og `curl` for bootstrap-scriptet
- Porter ledige: 8800, 8801, 8802, 8888, og UDP 5514

## Kjør demoen

```bash
cd demo
./run-demo.sh                 # bootstrapper alt (~30 sek første gang)
# (i en annen terminal)
./attacker/exploit.sh         # kjør angrepet, ~3 min med naturlig demo-tempo
./attacker/exploit.sh --fast  # raskt for selv-test
```

Stopp og rydd opp:
```bash
docker compose -f docker-compose.demo.yml down -v
```

## Tidslinje

| Tid | Hacker | Hva som logges (syslog) | STK-deteksjon |
|---|---|---|---|
| 0:00 | nmap-scan | (ingen) | — |
| 0:30 | 9× brute-force | `RELION615 web: authentication failure user=… source=…` | `relion-bruteforce-burst` aggregerer 5+ feil/60s → 1 high-event |
| 1:30 | SSH med admin/admin | `RELION615 sshd: Accepted password for admin from …` | `relion-default-cred-success` → 1 critical-event |
| 2:30 | setpunkt voltage 0.85 | `RELION615 control: setpoint voltage changed 1.00 -> 0.85 by user=admin from=…` | `relion-setpoint-change` → 1 critical-event |
| 3:00 | firmware-opplasting | `RELION615 firmware: upload started by user=admin from=…` | `relion-firmware-tampering` → 1 critical-event |

På Hafslund-skjermen: events ankommer i sanntid med `syslog`-badge og scenario-id.
På Statkraft-skjermen: samme events ankommer via gossip-meshen 5–10 sekunder senere,
markert med Hafslunds selskapsnavn og verifisert signatur.

## Sikkerhet

- **Alt kjører på lokal Docker-bridge.** RTU-simulatoren er aldri eksponert mot
  fysisk nett.
- **Default-credsene (`admin`/`admin`) er innebygd og dokumentert som demo-only.**
  De aktiveres ikke utenfor denne compose-filen.
- **Ingen reelle OT-systemer involvert.** Hele angreps-overflaten er en Flask-app
  (`rtu-sim/rtu.py`) som etterligner Relions web-HMI for visuell troverdighet.
- **Ingen ekte kraft-data, ingen ekte setpunkter.** Setpunkt-endringer oppdaterer
  kun en in-memory dict.

## Filstruktur

```
demo/
├── README.md                          (denne)
├── run-demo.sh                        bootstrap-script
├── docker-compose.demo.yml            orkestrering
├── kollektor-config/
│   └── hafslund.yaml                  peer-config for kollektoren
├── rtu-sim/
│   ├── Dockerfile
│   └── rtu.py                         ABB Relion 615-simulator (Flask)
└── attacker/
    └── exploit.sh                     hacker-flyt (nmap → brute-force → ...)
```

## Feilsøking

**Kollektoren mottar ingen syslog?**
- Sjekk at RTU-simulatoren peker på riktig `SYSLOG_HOST` (skal være `hafslund-kollektor`).
- `docker compose -f docker-compose.demo.yml logs hafslund-kollektor`

**Events vises ikke på Hafslund?**
- Sjekk kollektor-logs: `docker compose -f docker-compose.demo.yml logs hafslund-kollektor`
- Verifiser at scenario-pakkene lastes (skal logge "loaded N scenarios").
- Test ingest direkte:
  ```bash
  curl -X POST http://localhost:8801/events/ingest \
    -H "X-Ingest-Key: demo-secret-hafslund" \
    -H "Content-Type: application/json" \
    -d '{"title":"manuell test","severity":"low","source":"syslog","scenario_id":"manual-test"}'
  ```

**Events kommer på Hafslund men ikke Statkraft?**
- Vent 10–15 sekunder — gossip-syklusen er 10s.
- Sjekk gossip-loggen i Statkrafts dashboard (høyre kolonne).
- `docker compose -f docker-compose.demo.yml logs statkraft | grep -i pull`
