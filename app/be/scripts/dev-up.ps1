# Starter postgres + redis, kjører migrasjoner. Klar for at du starter tjenester.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$DatabaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgres://nordlys:nordlys@localhost:5432/nordlys" }
$ComposeFile = "docker-compose.dev.yml"

Write-Host "==> Starter postgres og redis..."
docker compose -f $ComposeFile up -d postgres redis

Write-Host ""
Write-Host "==> Venter på at postgres er klar..."
$deadline = (Get-Date).AddSeconds(60)
while ($true) {
    $status = docker compose -f $ComposeFile ps postgres 2>$null | Out-String
    if ($status -match "healthy") { break }
    if ((Get-Date) -gt $deadline) {
        Write-Error "postgres ble ikke healthy innen 60 sek."
    }
    Start-Sleep -Seconds 1
}
Write-Host "postgres OK."

Write-Host ""
Write-Host "==> Kjører drizzle-migrasjoner..."
$env:DATABASE_URL = $DatabaseUrl
bun packages/db/src/migrate.ts

Write-Host ""
Write-Host "✓ Dev-stack klar."
Write-Host ""
Write-Host "Slik starter du tjenester (i separate terminaler):"
Write-Host "  `$env:DATABASE_URL='$DatabaseUrl'; `$env:PORT='3010'; `$env:NODE_ID='hafslund-1'; ``"
Write-Host "  `$env:COMPANY='Hafslund'; `$env:ROLE='peer'; `$env:MESH_SVC_URL='http://localhost:3011'; ``"
Write-Host "  bun services/core-svc/src/index.ts"
Write-Host ""
Write-Host "  `$env:PORT='3000'; `$env:CORE_SVC_URL='http://localhost:3010'; ``"
Write-Host "  `$env:DATABASE_URL='$DatabaseUrl'; `$env:API_KEYS='dev-key:dev-secret'; ``"
Write-Host "  bun services/api-gateway/src/index.ts"
Write-Host ""
Write-Host "OpenAPI: http://localhost:3000/openapi"
Write-Host "Stopp:   ./scripts/dev-down.ps1"
