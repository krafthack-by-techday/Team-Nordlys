# Kjører alle tre ende-til-ende-smoke-tester mot live docker-stack.
# Krever at postgres er oppe (kjør ./scripts/dev-up.ps1 først).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$DatabaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgres://nordlys:nordlys@localhost:5432/nordlys" }

function Stop-BunSvc {
    param([string]$Pattern)
    Get-Process -Name "bun" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern } |
        Stop-Process -Force -ErrorAction SilentlyContinue
}

function Stop-AllBgSvcs {
    Stop-BunSvc "varde-svc/src/index"
    Stop-BunSvc "core-svc/src/index"
    Stop-BunSvc "mesh-svc/src/index"
    Start-Sleep -Seconds 1
}

try {
    Stop-AllBgSvcs

    Write-Host "==> 1/3: varde-svc basic smoke (HELLO/EVENT/PING)"
    $env:DATABASE_URL = $DatabaseUrl
    $env:PORT = "3020"
    $env:VARDE_ID = "varde-1"
    $env:VARDE_TEST_MODE = "true"
    $env:PUBLIC_URL = "http://localhost:3020"
    $varde = Start-Process -FilePath "bun" -ArgumentList "services/varde-svc/src/index.ts" `
        -RedirectStandardOutput "$env:TEMP/varde-smoke.log" -PassThru -NoNewWindow
    Start-Sleep -Seconds 2
    docker exec be-postgres-1 psql -U nordlys -d nordlys -c "TRUNCATE events, peers RESTART IDENTITY CASCADE;" | Out-Null
    bun services/varde-svc/test/smoke.ts
    Stop-Process -Id $varde.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    Write-Host ""
    Write-Host "==> 2/3: mesh-svc full mesh-flyt (2 noder + 1 Varde)"
    $varde = Start-Process -FilePath "bun" -ArgumentList "services/varde-svc/src/index.ts" `
        -RedirectStandardOutput "$env:TEMP/varde-smoke.log" -PassThru -NoNewWindow
    Start-Sleep -Seconds 2
    bun services/mesh-svc/test/smoke.ts
    Stop-Process -Id $varde.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    Write-Host ""
    Write-Host "==> 3/3: invite-flyt (KraftCERT + candidate + Varde)"
    bun services/varde-svc/test/invite-smoke.ts

    Write-Host ""
    Write-Host "✓ Alle smoke-tester passerer."
}
finally {
    Stop-AllBgSvcs
}
