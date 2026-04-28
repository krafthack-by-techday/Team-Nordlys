#!/usr/bin/env bash
# Bootstrap STK-demoen: start KraftCERT, hent invite-tokens, start peers + kollektor + RTU.
#
# Kjør fra demo/-mappa:  ./run-demo.sh
# Stopp alt:             docker compose -f docker-compose.demo.yml down -v

set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.demo.yml"

step() { echo; echo "▶ $*"; }

step "1/5  Starter KraftCERT (trust anchor)"
$COMPOSE up -d --build kraftcert
echo -n "   venter på at KraftCERT svarer "
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8800/health > /dev/null 2>&1; then
    echo "OK"
    break
  fi
  echo -n "."; sleep 1
done

step "2/5  Genererer invite-tokens for Hafslund og Statkraft"
TOKEN_HAFSLUND=$(curl -s -X POST http://localhost:8800/invite \
  -H "Content-Type: application/json" \
  -d '{"company":"Hafslund Kraft"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
TOKEN_STATKRAFT=$(curl -s -X POST http://localhost:8800/invite \
  -H "Content-Type: application/json" \
  -d '{"company":"Statkraft"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "   Hafslund:   ${TOKEN_HAFSLUND:0:16}..."
echo "   Statkraft:  ${TOKEN_STATKRAFT:0:16}..."

step "3/5  Starter Hafslund og Statkraft med invite-tokens"
INVITE_HAFSLUND="$TOKEN_HAFSLUND" \
INVITE_STATKRAFT="$TOKEN_STATKRAFT" \
$COMPOSE up -d --build hafslund statkraft

step "4/5  Starter kollektor-sidecar og ABB Relion-simulator"
$COMPOSE up -d --build hafslund-kollektor rtu-sim

step "5/5  Verifiserer at alt er oppe"
sleep 4
for port in 8800 8801 8802 8888; do
  name=$(curl -s "http://localhost:$port/health" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('company') or d.get('device') or '?')" 2>/dev/null || echo "?")
  echo "   localhost:$port  ${name}"
done

cat <<EOF

════════════════════════════════════════════════════════════════════
 STK-demo klar.

 Åpne i tre nettleser-vinduer:
   http://localhost:8801     Hafslund — peer under angrep
   http://localhost:8802     Statkraft — peer som observerer via gossip
   http://localhost:8888     ABB Relion 615 (HMI som blir angrepet)

 Kjør angrepet i en separat terminal:
   RTU_URL=http://localhost:8888 ./attacker/exploit.sh

 Stopp alt:
   docker compose -f docker-compose.demo.yml down -v
════════════════════════════════════════════════════════════════════
EOF
