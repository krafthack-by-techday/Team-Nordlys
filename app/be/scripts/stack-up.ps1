# Starter hele dev-stacken i Docker (alle tjenester fra compose-filen).
# Bruk dev-up.ps1 i stedet hvis du vil kjøre tjenestene direkte med bun
# mot postgres+redis i Docker.
param(
    [switch]$Rebuild
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$ComposeFile = "docker-compose.dev.yml"

if ($Rebuild) {
    Write-Host "==> Bygger alle service-images på nytt..."
    docker compose -f $ComposeFile build
}

Write-Host "==> Starter hele stacken..."
docker compose -f $ComposeFile up -d

Write-Host ""
Write-Host "==> Status:"
docker compose -f $ComposeFile ps

Write-Host ""
Write-Host "✓ Stack oppe."
Write-Host "  API-gateway:  http://localhost:3000"
Write-Host "  OpenAPI:      http://localhost:3000/openapi"
Write-Host "  Varde WS:     ws://localhost:3020/ws"
Write-Host ""
Write-Host "Logs:  docker compose -f $ComposeFile logs -f <service>"
Write-Host "Stopp: ./scripts/dev-down.ps1"
