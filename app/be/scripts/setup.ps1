# Førstegangsoppsett. Sjekker dependencies, installerer workspaces.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> Sjekker Bun..."
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Error "Bun mangler. Installer fra https://bun.sh (Windows-bygg er stabilt fra v1.1)."
}
bun --version

Write-Host ""
Write-Host "==> Sjekker Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "docker mangler. Installer Docker Desktop."
}
try {
    docker info | Out-Null
} catch {
    Write-Error "Docker daemon kjører ikke. Start Docker Desktop."
}
docker --version

Write-Host ""
Write-Host "==> bun install (workspaces)..."
bun install

Write-Host ""
Write-Host "==> Verifiserer at workspaces resolvere..."
bun run --filter '*' typecheck | Out-Null

Write-Host ""
Write-Host "✓ Oppsett ferdig. Neste steg: ./scripts/dev-up.ps1"
