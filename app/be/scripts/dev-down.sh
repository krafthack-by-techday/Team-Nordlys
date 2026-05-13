#!/usr/bin/env bash
# Stopper alle dev-containere. Postgres-data beholdes i be_pgdata-volumet.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Stopper containere..."
docker compose -f docker-compose.dev.yml stop

echo
echo "Tip: ./scripts/dev-reset.sh tar ned data også (drop og re-migrer)."
