#!/usr/bin/env bash
# Typecheck + tester på alle workspaces. Kjør før commit.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> typecheck (alle workspaces)..."
bun run --filter '*' typecheck

echo
echo "==> bun test (alle workspaces)..."
bun test

echo
echo "✓ check OK."
