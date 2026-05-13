#!/usr/bin/env bash
# Starter postgres + redis, kjører migrasjoner. Klar for at du starter tjenester.
set -euo pipefail

cd "$(dirname "$0")/.."

DATABASE_URL="${DATABASE_URL:-postgres://nordlys:nordlys@localhost:5432/nordlys}"
COMPOSE_FILE="docker-compose.dev.yml"

echo "==> Starter postgres og redis..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo
echo "==> Venter på at postgres er klar..."
deadline=$(($(date +%s) + 60))
until docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "healthy"; do
  if [ "$(date +%s)" -gt "$deadline" ]; then
    echo "FEIL: postgres ble ikke healthy innen 60 sek." >&2
    exit 1
  fi
  sleep 1
done
echo "postgres OK."

echo
echo "==> Kjører drizzle-migrasjoner..."
DATABASE_URL="$DATABASE_URL" bun packages/db/src/migrate.ts

echo
echo "✓ Dev-stack klar."
echo
echo "Slik starter du tjenester (i separate terminaler):"
echo "  DATABASE_URL=$DATABASE_URL PORT=3010 NODE_ID=hafslund-1 COMPANY=Hafslund ROLE=peer \\"
echo "    MESH_SVC_URL=http://localhost:3011 bun services/core-svc/src/index.ts"
echo
echo "  PORT=3000 CORE_SVC_URL=http://localhost:3010 \\"
echo "    DATABASE_URL=$DATABASE_URL API_KEYS='dev-key:dev-secret' \\"
echo "    bun services/api-gateway/src/index.ts"
echo
echo "OpenAPI: http://localhost:3000/openapi"
echo "Stopp:   ./scripts/dev-down.sh"
