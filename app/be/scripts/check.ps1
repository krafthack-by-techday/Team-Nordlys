# Typecheck + tester på alle workspaces. Kjør før commit.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> typecheck (alle workspaces)..."
bun run --filter '*' typecheck

Write-Host ""
Write-Host "==> bun test (alle workspaces)..."
bun test

Write-Host ""
Write-Host "✓ check OK."
