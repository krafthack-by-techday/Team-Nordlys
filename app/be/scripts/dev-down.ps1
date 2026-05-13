# Stopper alle dev-containere. Postgres-data beholdes i be_pgdata-volumet.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Stopper containere..."
docker compose -f docker-compose.dev.yml stop

Write-Host ""
Write-Host "Tip: ./scripts/dev-reset.ps1 tar ned data også (drop og re-migrer)."
