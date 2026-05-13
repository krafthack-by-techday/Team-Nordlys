#!/usr/bin/env bash
# Starter hele dev-stacken i Docker (alle tjenester fra compose-filen).
# Bruk dev-up.sh i stedet hvis du vil kjøre tjenestene direkte med bun
# mot postgres+redis i Docker.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.dev.yml"
REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --rebuild|-r) REBUILD=1 ;;
    -h|--help)
      echo "Usage: $0 [--rebuild]"
      echo "  --rebuild   Build images before starting (use after code changes)"
      exit 0
      ;;
  esac
done

if [ "$REBUILD" -eq 1 ]; then
  echo "==> Bygger alle service-images på nytt..."
  docker compose -f "$COMPOSE_FILE" build
fi

echo "==> Starter hele stacken..."
docker compose -f "$COMPOSE_FILE" up -d

echo
echo "==> Status:"
docker compose -f "$COMPOSE_FILE" ps

echo
echo "✓ Stack oppe."
echo "  API-gateway:  http://localhost:3000"
echo "  OpenAPI:      http://localhost:3000/openapi"
echo "  Varde WS:     ws://localhost:3020/ws"
echo
echo "Logs:  docker compose -f $COMPOSE_FILE logs -f <service>"
echo "Stopp: ./scripts/dev-down.sh"
