#!/usr/bin/env bash
# Bootstrap STK-demoen: KraftCERT + 12 peer-noder + kollektor + RTU.
#
#   ./run-demo.sh           bruker eksisterende volumer hvis tilgjengelig
#   ./run-demo.sh --reset   wiper volumer og bootstrapper friskt
#   ./attacker/exploit.sh   kjør angrepet (i en annen terminal)
#
# Stopp alt: docker compose -f docker-compose.demo.yml down -v

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.demo.yml"
PROJECT_NAME=$(basename "$(pwd)")

# Selskapsnavn matcher COMPANY-feltet i compose. Rekkefølgen er ikke viktig
# her — tokens utstedes per selskap og mappes til riktig env-var i compose.
COMPANIES=(
  "Hafslund Kraft"
  "Statkraft"
  "Statnett"
  "BKK"
  "Lyse"
  "Agder Energi"
  "Glitre Energi"
  "Skagerak Energi"
  "Eviny"
  "Tensio"
  "Elvia"
  "NTE"
)
PEER_PORTS=(8801 8802 8803 8804 8805 8806 8807 8808 8809 8810 8811 8812)

step() { echo; echo "▶ $*"; }

# Map "Agder Energi" → INVITE_AGDER_ENERGI
company_to_env_var() {
  local upper
  upper=$(echo "$1" | tr '[:lower:] ' '[:upper:]_')
  echo "INVITE_${upper}"
}

# ── Reset-håndtering ───────────────────────────────────────────
RESET=false
if [[ "${1:-}" == "--reset" ]]; then
  RESET=true
elif ! docker volume ls --format '{{.Name}}' | grep -q "^${PROJECT_NAME}_kraftcert-data$"; then
  # Første gang demoen kjøres på denne maskinen — wipe for sikkerhets skyld
  RESET=true
fi

if [[ "$RESET" == "true" ]]; then
  step "Reset: wiper volumer og containere"
  $COMPOSE down -v 2>/dev/null || true
fi

# ── 1. Start KraftCERT alene ──────────────────────────────────
step "1/4  Starter KraftCERT (trust anchor)"
$COMPOSE up -d --build kraftcert
echo -n "      venter på at KraftCERT svarer "
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8800/health > /dev/null 2>&1; then
    echo "OK"
    break
  fi
  echo -n "."; sleep 1
done

# ── 2. Issuer invite-tokens for alle 12 peers ─────────────────
step "2/4  Genererer invite-tokens for ${#COMPANIES[@]} peers"
declare -a EXPORT_LINES=()
for c in "${COMPANIES[@]}"; do
  token=$(curl -s -X POST http://localhost:8800/invite \
    -H "Content-Type: application/json" \
    -d "{\"company\":\"$c\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
  if [[ -z "$token" ]]; then
    echo "      ⚠ kunne ikke hente token for '$c' (kanskje allerede onboardet)"
    continue
  fi
  var=$(company_to_env_var "$c")
  EXPORT_LINES+=("export $var=$token")
  printf "      %-22s %s…\n" "$c" "${token:0:16}"
done

# Henter export-linjene inn i shellet før compose up
TOKEN_FILE=$(mktemp)
trap 'rm -f "$TOKEN_FILE"' EXIT
printf '%s\n' "${EXPORT_LINES[@]}" > "$TOKEN_FILE"
# shellcheck disable=SC1090
source "$TOKEN_FILE"

# ── 3. Start resten av meshen ─────────────────────────────────
step "3/4  Starter 12 peer-noder + kollektor + RTU-sim"
$COMPOSE up -d --build

# ── 4. Vent på alle peers ─────────────────────────────────────
step "4/4  Verifiserer at alle 13 noder svarer"
for port in 8800 "${PEER_PORTS[@]}"; do
  echo -n "      localhost:$port "
  for _ in $(seq 1 30); do
    if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
      name=$(curl -s "http://localhost:$port/health" 2>/dev/null \
        | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('company') or d.get('device') or '?')" 2>/dev/null || echo "?")
      echo "✓ $name"
      break
    fi
    echo -n "."; sleep 1
  done
done

cat <<EOF

════════════════════════════════════════════════════════════════════
 STK-demo klar — 13 noder onboardet i mesh.

 Hovedskjermen:
   open demo/index.html

 Kjør angrepet i en separat terminal:
   RTU_URL=http://localhost:8888 ./attacker/exploit.sh

 Stopp alt:
   $COMPOSE down -v
════════════════════════════════════════════════════════════════════
EOF
