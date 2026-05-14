# Run both backends and the mobile app with one command.
# Backends open in new windows; mobile app runs in this window.

$Root = $PSScriptRoot
if (-not $Root) { $Root = Get-Location }

Write-Host "Starting DyslexAI..." -ForegroundColor Cyan
Write-Host "  Scan backend (port 8000) and Exercise backend (port 8001) will open in new windows." -ForegroundColor Gray
Write-Host "  Mobile app will start in this window." -ForegroundColor Gray
Write-Host ""

# Start exercise backend (port 8001) in a new window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root\dyslexia-backend'; if (Test-Path .\venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }; python run.py"
)

# Start scan backend (port 8000) in a new window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root\scan-backend'; if (Test-Path .\venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }; python run.py"
)

# Give backends a moment to bind
Write-Host "Waiting for backends to start..." -ForegroundColor Gray
Start-Sleep -Seconds 4

# Run mobile app in this window
Write-Host "Starting mobile app (Expo)..." -ForegroundColor Cyan
Set-Location "$Root\DyslexAI-Mobile"
npm start
