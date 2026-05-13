#!/usr/bin/env bash
# Kjører alle tre ende-til-ende-smoke-tester mot live docker-stack.
# Krever at postgres er oppe (kjør ./scripts/dev-up.sh først).
set -euo pipefail

cd "$(dirname "$0")/.."

DATABASE_URL="${DATABASE_URL:-postgres://nordlys:nordlys@localhost:5432/nordlys}"

cleanup() {
  echo
  echo "==> Stopper bakgrunnstjenester..."
  pkill -f "varde-svc/src/index" 2>/dev/null || true
  pkill -f "core-svc/src/index" 2>/dev/null || true
  pkill -f "mesh-svc/src/index" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT

# Drep eventuelle restende tjenester fra forrige kjøring
pkill -f "varde-svc/src/index" 2>/dev/null || true
pkill -f "core-svc/src/index" 2>/dev/null || true
pkill -f "mesh-svc/src/index" 2>/dev/null || true
sleep 1

echo "==> 1/3: varde-svc basic smoke (HELLO/EVENT/PING)"
DATABASE_URL="$DATABASE_URL" PORT=3020 VARDE_ID=varde-1 \
  VARDE_TEST_MODE=true PUBLIC_URL=http://localhost:3020 \
  bun services/varde-svc/src/index.ts > /tmp/varde-smoke.log 2>&1 &
sleep 2
docker exec be-postgres-1 psql -U nordlys -d nordlys -c "TRUNCATE events, peers RESTART IDENTITY CASCADE;" >/dev/null 2>&1
bun services/varde-svc/test/smoke.ts
pkill -f "varde-svc/src/index" 2>/dev/null || true
wait 2>/dev/null || true
sleep 1

echo
echo "==> 2/3: mesh-svc full mesh-flyt (2 noder + 1 Varde)"
DATABASE_URL="$DATABASE_URL" PORT=3020 VARDE_ID=varde-1 \
  VARDE_TEST_MODE=true PUBLIC_URL=http://localhost:3020 \
  bun services/varde-svc/src/index.ts > /tmp/varde-smoke.log 2>&1 &
sleep 2
bun services/mesh-svc/test/smoke.ts
pkill -f "varde-svc/src/index" 2>/dev/null || true
wait 2>/dev/null || true
sleep 1

echo
echo "==> 3/3: invite-flyt (KraftCERT + candidate + Varde)"
bun services/varde-svc/test/invite-smoke.ts

echo
echo "✓ Alle smoke-tester passerer."
