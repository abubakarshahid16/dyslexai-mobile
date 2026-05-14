# Run after Supabase migration: DB checks + join integrity.
# From repo root:
#   .\scripts\migration\verify_supabase_complete.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

. (Join-Path $PSScriptRoot "pg_path.ps1")

Write-Host "=== verify_supabase_complete.py ===" -ForegroundColor Cyan
python (Join-Path $Root "scripts\migration\verify_supabase_complete.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== verify_join_integrity.py ===" -ForegroundColor Cyan
$envFile = Join-Path $Root "dyslexia-backend\.env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*DATABASE_URL=(.+)$') { $env:DATABASE_URL = $Matches[1].Trim('"') }
    }
}
python (Join-Path $Root "scripts\migration\verify_join_integrity.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nAll Supabase verification checks passed." -ForegroundColor Green
Write-Host "Next: restart scan-backend + dyslexia-backend; test login and exercises in the app." -ForegroundColor Gray
