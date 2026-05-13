#!/usr/bin/env bash
# Førstegangsoppsett. Sjekker dependencies, installerer workspaces.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Sjekker Bun..."
if ! command -v bun >/dev/null 2>&1; then
  echo "FEIL: Bun mangler. Installer fra https://bun.sh (eller 'brew install oven-sh/bun/bun' på macOS)." >&2
  exit 1
fi
bun --version

echo
echo "==> Sjekker Docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo "FEIL: docker mangler. Installer Docker Desktop." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "FEIL: Docker daemon kjører ikke. Start Docker Desktop." >&2
  exit 1
fi
docker --version

echo
echo "==> bun install (workspaces)..."
bun install

echo
echo "==> Verifiserer at workspaces resolvere..."
bun run --filter '*' typecheck >/dev/null

echo
echo "✓ Oppsett ferdig. Neste steg: ./scripts/dev-up.sh"
