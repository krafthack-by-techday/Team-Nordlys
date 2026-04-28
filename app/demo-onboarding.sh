#!/bin/bash
# Demo: Onboarding av peers via KraftCERT
set -euo pipefail

wait_for() {
  local url=$1 label=$2 tries=${3:-60}
  echo -n "  venter på $label "
  for _ in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null 2>&1; then echo "OK"; return 0; fi
    echo -n "."; sleep 1
  done
  echo " TIMEOUT"
  echo "  --- siste containere/logger ---"
  docker compose ps
  return 1
}

echo "=== 1. Start KraftCERT (+ varde-kraftcert som eksponerer port 8000) ==="
docker compose up -d --build kraftcert varde-kraftcert
wait_for http://localhost:8000/health "KraftCERT på 8000"

echo ""
echo "=== 2. KraftCERT genererer invite-tokens ==="
INVITE_HAFSLUND=$(curl -s -X POST http://localhost:8000/invite \
  -H "Content-Type: application/json" \
  -d '{"company":"Hafslund Kraft"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "  Hafslund token: ${INVITE_HAFSLUND:0:16}..."

INVITE_GLITRENETT=$(curl -s -X POST http://localhost:8000/invite \
  -H "Content-Type: application/json" \
  -d '{"company":"Glitrenett"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "  Glitrenett token: ${INVITE_GLITRENETT:0:16}..."

INVITE_AENERGI=$(curl -s -X POST http://localhost:8000/invite \
  -H "Content-Type: application/json" \
  -d '{"company":"Aenergi"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "  Aenergi token: ${INVITE_AENERGI:0:16}..."

INVITE_STATNETT=$(curl -s -X POST http://localhost:8000/invite \
  -H "Content-Type: application/json" \
  -d '{"company":"Statnett"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
echo "  Statnett token: ${INVITE_STATNETT:0:16}..."

echo ""
echo "=== 3. Start peers med invite-tokens (+ varde-statnett som eksponerer port 8004) ==="
INVITE_HAFSLUND=$INVITE_HAFSLUND \
INVITE_GLITRENETT=$INVITE_GLITRENETT \
INVITE_AENERGI=$INVITE_AENERGI \
INVITE_STATNETT=$INVITE_STATNETT \
docker compose up -d --build hafslund glitrenett aenergi statnett varde-statnett

wait_for http://localhost:8001/health "Hafslund på 8001"
wait_for http://localhost:8002/health "Glitrenett på 8002"
wait_for http://localhost:8003/health "Aenergi på 8003"
wait_for http://localhost:8004/health "Statnett på 8004"

echo ""
echo "=== 4. Sjekk registrerte identiteter på KraftCERT ==="
curl -s http://localhost:8000/identity | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data['peers']:
    print(f\"  {p['node_id']:20} {p['company']:20} registered_by={p['registered_by']}\")
"

echo ""
echo "=== 5. Test signert hendelse ==="
curl -s -X POST http://localhost:8001/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Uvanlig trafikk på SCADA","severity":"high"}' | python3 -c "
import sys, json
e = json.load(sys.stdin)
print(f\"  Event {e['id'][:8]}... opprettet på {e['node_id']}\")
"
sleep 2

echo ""
echo "=== 6. Verifiser synkronisering ==="
for port in 8000 8001 8002 8003 8004; do
  count=$(curl -s http://localhost:$port/events | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")
  name=$(curl -s http://localhost:$port/health | python3 -c "import sys,json;print(json.load(sys.stdin)['company'])")
  echo "  $name: $count hendelser"
done

echo ""
echo "=== Ferdig! Alle peers onboardet og synkronisert ==="
