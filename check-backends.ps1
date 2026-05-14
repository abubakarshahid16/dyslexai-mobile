# Quick check: are both backends reachable from this PC?
# Run from PowerShell: .\check-backends.ps1

Write-Host "Checking scan backend (port 8000)..." -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "  OK: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  -> Start the scan backend: cd DyslexAI-Backend, .\venv\Scripts\activate, uvicorn app.main:app --host 0.0.0.0 --port 8000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Checking exercise backend (port 8001)..." -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8001/" -UseBasicParsing -TimeoutSec 5
    Write-Host "  OK: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  -> Start the exercise backend: cd dyslexia-backend, .\venv\Scripts\activate, python run.py" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "If both show OK but the app still fails, add Windows Firewall rules for TCP 8000 and 8001 (see NETWORK_FIX.md)." -ForegroundColor Yellow
