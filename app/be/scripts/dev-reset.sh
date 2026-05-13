#!/usr/bin/env bash
# Dropper hele DB-skjemaet og re-migrerer. Bruk når skjema-endringer fra main
# kolliderer med din lokale state. Postgres-containeren forblir oppe.
set -euo pipefail

cd "$(dirname "$0")/.."

DATABASE_URL="${DATABASE_URL:-postgres://nordlys:nordlys@localhost:5432/nordlys}"
COMPOSE_FILE="docker-compose.dev.yml"

if ! docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "healthy"; then
  echo "==> postgres er ikke healthy — starter opp først..."
  docker compose -f "$COMPOSE_FILE" up -d postgres
  until docker compose -f "$COMPOSE_FILE" ps postgres | grep -q "healthy"; do sleep 1; done
fi

echo "==> Dropper alle tabeller og drizzle-skjema..."
docker exec be-postgres-1 psql -U nordlys -d nordlys -c \
  "DROP SCHEMA IF EXISTS drizzle CASCADE;
   DROP TABLE IF EXISTS events, indicators, chat_messages, peers, revocations,
     varde_roster, audit_log, invite_tokens, vulnerabilities, tools, scans,
     ingest_dedup CASCADE;" >/dev/null

echo "==> Re-migrerer..."
DATABASE_URL="$DATABASE_URL" bun packages/db/src/migrate.ts

echo
echo "✓ DB resettet."
