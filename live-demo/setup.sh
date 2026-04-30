#!/bin/bash
# STK live-demo setup — run once to register a peer against an existing KraftCERT.
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  set -a; source .env; set +a
fi

PEER_NAME="${PEER_NAME:?Set PEER_NAME in .env}"
KRAFTCERT_URL="${KRAFTCERT_URL:?Set KRAFTCERT_URL in .env}"
PEER_PORT="${PEER_PORT:-8803}"
DOCKER="${DOCKER:-docker}"

wait_for() {
  local url=$1 label=$2
  echo -n "  waiting for $label "
  for _ in $(seq 1 60); do
    if curl -sf "$url/health" >/dev/null 2>&1; then echo " OK"; return 0; fi
    echo -n "."; sleep 2
  done
  echo " TIMEOUT"; $DOCKER compose logs --tail 20; exit 1
}

if [ -z "${PEER_INVITE_TOKEN:-}" ]; then
  echo -n "Invite token for ${PEER_NAME}: "
  read -r PEER_INVITE_TOKEN
fi

echo "=== 1. Start ${PEER_NAME} ==="
PEER_INVITE_TOKEN="$PEER_INVITE_TOKEN" $DOCKER compose up -d --build peer varde-peer
wait_for "http://localhost:${PEER_PORT}" "${PEER_NAME} (:${PEER_PORT})"

echo ""
echo "=== Done! ==="
echo "  KraftCERT    : ${KRAFTCERT_URL}"
echo "  ${PEER_NAME} : ${PEER_PUBLIC_URL:-http://localhost:${PEER_PORT}}"
