param(
    [switch]$SkipDocker
)

# Start full DyslexAI stack: DB (optional), exercise backend, scan backend, Expo.
#   .\start-all.ps1
#   .\start-all.ps1 -SkipDocker   # Supabase / remote Postgres only (no local Docker DB)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Host "DyslexAI - starting all services from $RepoRoot" -ForegroundColor Cyan

# 1. PostgreSQL (Docker) - skip if using Supabase / remote Postgres only
Write-Host "`n[1/4] PostgreSQL..." -ForegroundColor Yellow
$dbStarted = $false
if ($SkipDocker) {
    Write-Host "  Skipped (-SkipDocker). Remote Postgres (e.g. Supabase): no local DB container." -ForegroundColor Gray
    Write-Host "  Supabase runs in the cloud - you do not start it from this PC. Resume project in dashboard if paused." -ForegroundColor DarkGray
}
else {
    try {
        $null = docker ps 2>$null
        if (-not $?) {
            throw "Docker not running"
        }
        $exists = docker ps -a --filter "name=dyslexia-db" --format "{{.Names}}" 2>$null
        if ($exists -eq "dyslexia-db") {
            docker start dyslexia-db 2>$null
            Write-Host "  Started existing container dyslexia-db" -ForegroundColor Green
        }
        else {
            Write-Host '  Creating container (first time)...' -ForegroundColor Gray
            docker run --name dyslexia-db -e POSTGRES_DB=dyslexia_db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15
            Write-Host "  Created and started dyslexia-db" -ForegroundColor Green
        }
        $dbStarted = $true
    }
    catch {
        Write-Host "  Docker not available or failed. Start Docker Desktop, then run this script again." -ForegroundColor Red
    }
}

# Wait for PostgreSQL to accept connections (avoid exercise backend 'Connection refused')
if ($dbStarted) {
    $maxWait = 25
    $waited = 0
    while ($waited -lt $maxWait) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5432)
            $tcp.Close()
            Write-Host "  Database ready on port 5432" -ForegroundColor Green
            break
        } catch {
            Start-Sleep -Seconds 2
            $waited += 2
        }
    }
    if ($waited -ge $maxWait) {
        Write-Host "  Warning: port 5432 not ready after ${maxWait}s. Exercise backend may fail." -ForegroundColor Yellow
    }
}

# 2. Exercise backend (port 8001) – new window
Write-Host "`n[2/4] Exercise backend (8001)..." -ForegroundColor Yellow
$exerciseBackendPath = Join-Path $RepoRoot "dyslexia-backend"
# Do NOT run seed.py here – it wipes all sessions and progress. Run seed once manually for first-time setup (see RUN_COMMANDS.md).
$exerciseCmd = "Set-Location '$exerciseBackendPath'; if (Test-Path '.\venv\Scripts\Activate.ps1') { .\venv\Scripts\Activate.ps1 }; python db/migrate_stroke_errors.py; uvicorn app.main:app --host 0.0.0.0 --port 8001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $exerciseCmd
Write-Host "  Started in new window" -ForegroundColor Green
Start-Sleep -Seconds 3

# 3. Scan backend (port 8000) – new window. Set $env:USE_ONNX=1 or $env:USE_INT8=1 for ONNX/INT8.
Write-Host "`n[3/4] Scan backend (8000)..." -ForegroundColor Yellow
$scanBackendPath = Join-Path $RepoRoot "scan-backend"
$scanEnv = @(); if ($env:USE_ONNX) { $scanEnv += "`$env:USE_ONNX = '1'" }; if ($env:USE_INT8) { $scanEnv += "`$env:USE_INT8 = '1'" }
$scanEnvStr = if ($scanEnv.Count -gt 0) { ($scanEnv -join "; ") + "; " } else { "" }
$scanCmd = "Set-Location '$scanBackendPath'; if (Test-Path '.\venv\Scripts\Activate.ps1') { .\venv\Scripts\Activate.ps1 }; $scanEnvStr uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $scanCmd
if ($env:USE_INT8) { Write-Host "  USE_INT8=1 passed (INT8 quantized models)" -ForegroundColor Gray }
elseif ($env:USE_ONNX) { Write-Host "  USE_ONNX=1 passed (ONNX/CPU)" -ForegroundColor Gray }
Write-Host "  Started in new window" -ForegroundColor Green
Start-Sleep -Seconds 2

# 4. Set app API URLs to this machine's current IP (no hardcoding when you change networks)
$mobilePath = Join-Path $RepoRoot "DyslexAI-Mobile"
$envPath = Join-Path $mobilePath ".env"
$lanIp = $null
try {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
        $_.IPAddress -match '^(192\.168\.|10\.)' -and
        $_.InterfaceAlias -notmatch 'vEthernet|Docker|Loopback|WSL|Bluetooth'
    }
    $lanIp = ($addrs | Where-Object { $_.IPAddress -match '^192\.168\.' } | Select-Object -First 1).IPAddress
    if (-not $lanIp) { $lanIp = ($addrs | Select-Object -First 1).IPAddress }
} catch { }
if (-not $lanIp) { $lanIp = '127.0.0.1' }

$apiUrl = "http://${lanIp}:8000"
$exerciseUrl = "http://${lanIp}:8001"
$envContent = @()
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    $envContent = $envContent -replace 'EXPO_PUBLIC_API_URL=.*', "EXPO_PUBLIC_API_URL=$apiUrl"
    $envContent = $envContent -replace 'EXPO_PUBLIC_EXERCISE_API_URL=.*', "EXPO_PUBLIC_EXERCISE_API_URL=$exerciseUrl"
    if ($envContent -notmatch 'EXPO_PUBLIC_API_URL=') { $envContent = "EXPO_PUBLIC_API_URL=$apiUrl`n" + $envContent }
    if ($envContent -notmatch 'EXPO_PUBLIC_EXERCISE_API_URL=') { $envContent = $envContent.TrimEnd() + "`nEXPO_PUBLIC_EXERCISE_API_URL=$exerciseUrl`n" }
} else {
    $envContent = "# Auto-updated by start-all.ps1 with this PC's IP`nEXPO_PUBLIC_API_URL=$apiUrl`nEXPO_PUBLIC_EXERCISE_API_URL=$exerciseUrl`n"
}
Set-Content -Path $envPath -Value $envContent.TrimEnd() -NoNewline:$false
Write-Host "`n[4/4] Expo app..." -ForegroundColor Yellow
Write-Host "  API URLs set to this PC: $apiUrl (scan), $exerciseUrl (exercises)" -ForegroundColor Green
Set-Location $mobilePath
Write-Host "  Run: npx expo start (in this window)" -ForegroundColor Green
Write-Host "`nBackends: 8000 (scan), 8001 (exercises). Press 'a' for Android or scan QR with Expo Go.`n" -ForegroundColor Cyan
npx expo start
