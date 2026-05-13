# Dropper hele DB-skjemaet og re-migrerer. Bruk når skjema-endringer fra main
# kolliderer med din lokale state. Postgres-containeren forblir oppe.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$DatabaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgres://nordlys:nordlys@localhost:5432/nordlys" }
$ComposeFile = "docker-compose.dev.yml"

$status = docker compose -f $ComposeFile ps postgres 2>$null | Out-String
if ($status -notmatch "healthy") {
    Write-Host "==> postgres er ikke healthy — starter opp først..."
    docker compose -f $ComposeFile up -d postgres
    while ($true) {
        $s = docker compose -f $ComposeFile ps postgres 2>$null | Out-String
        if ($s -match "healthy") { break }
        Start-Sleep -Seconds 1
    }
}

Write-Host "==> Dropper alle tabeller og drizzle-skjema..."
$dropSql = @"
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP TABLE IF EXISTS events, indicators, chat_messages, peers, revocations,
  varde_roster, audit_log, invite_tokens, vulnerabilities, tools, scans,
  ingest_dedup CASCADE;
"@
docker exec be-postgres-1 psql -U nordlys -d nordlys -c $dropSql | Out-Null

Write-Host "==> Re-migrerer..."
$env:DATABASE_URL = $DatabaseUrl
bun packages/db/src/migrate.ts

Write-Host ""
Write-Host "✓ DB resettet."
