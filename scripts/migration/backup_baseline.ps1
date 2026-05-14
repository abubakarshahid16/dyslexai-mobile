# Baseline backups + row-count manifest before Supabase cutover.
# Run from repo root: .\scripts\migration\backup_baseline.ps1
# Requires: pg_dump (on PATH, or standard PostgreSQL install; see pg_path.ps1)

# Do not Stop on pg_dump stderr (handled manually)
$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "pg_path.ps1")
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Out = Join-Path $Root "migration_backup_$Stamp"
New-Item -ItemType Directory -Path $Out -Force | Out-Null

Write-Host "Writing backups to: $Out" -ForegroundColor Cyan

# 1) SQLite auth DB (copy file)
$SqliteDefault = Join-Path $Root "scan-backend\dyslexai_auth.db"
if (Test-Path $SqliteDefault) {
    Copy-Item $SqliteDefault (Join-Path $Out "dyslexai_auth.db.bak")
    Write-Host "  Copied scan-backend/dyslexai_auth.db" -ForegroundColor Green
} else {
    Write-Host "  (skip) dyslexai_auth.db not found at $SqliteDefault" -ForegroundColor Yellow
}

# 2) pg_dump dyslexia Postgres - set DATABASE_URL in env or dyslexia-backend\.env
$DyslexiaEnvFile = Join-Path $Root "dyslexia-backend\.env"
if (Test-Path $DyslexiaEnvFile) {
    Get-Content $DyslexiaEnvFile | ForEach-Object {
        if ($_ -match '^\s*DATABASE_URL=(.+)$') { $env:DATABASE_URL = $Matches[1].Trim('"') }
    }
}
if ($env:DATABASE_URL -and $env:DATABASE_URL -match '^postgres') {
    if ($env:DATABASE_URL -match 'supabase\.co') {
        Write-Host "  (skip) DATABASE_URL points at Supabase - pg_dump must run against local Postgres only." -ForegroundColor Yellow
        Write-Host "        Use migration_artifacts\dyslexia_db.dump from an earlier local dump, or set DATABASE_URL to localhost for one run." -ForegroundColor Yellow
    } else {
        $dumpPath = Join-Path $Out "dyslexia_db.dump"
        $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
        if (-not $pgDump) {
            Write-Host "  (skip) pg_dump not on PATH - install PostgreSQL client tools, then re-run" -ForegroundColor Yellow
        } else {
            & pg_dump -Fc -f $dumpPath $env:DATABASE_URL
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  WARNING: pg_dump failed (exit $LASTEXITCODE). Check local Postgres is running and DATABASE_URL is correct." -ForegroundColor Yellow
            } else {
                Write-Host "  pg_dump custom format -> dyslexia_db.dump" -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host "  (skip) DATABASE_URL not set to postgres - set dyslexia-backend/.env DATABASE_URL and re-run" -ForegroundColor Yellow
}

$manifestHint = Join-Path $Out "manifest_before.txt"
Write-Host ('Done. Next: python scripts/migration/table_counts.py --manifest (redirect output to): ' + $manifestHint) -ForegroundColor Cyan
