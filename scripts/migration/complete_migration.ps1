# Orchestrate Supabase migration steps 1-11 from scripts/migration/README.txt
#
# Usage (repo root):
#   Local only (backup + manifest + pg_dump when tools/DB available):
#     .\scripts\migration\complete_migration.ps1
#
#   Include Supabase restore + auth migration (needs SUPABASE_DATABASE_URL):
#     $env:SUPABASE_DATABASE_URL = "postgresql://postgres.[ref]:...@...:5432/postgres?sslmode=require"
#     .\scripts\migration\complete_migration.ps1 -SupabaseRestore
#
#   Optional: path to pg_dump file if you already have dyslexia_db.dump
#     .\scripts\migration\complete_migration.ps1 -SupabaseRestore -DumpPath C:\backups\dyslexia_db.dump

param(
    [switch]$SupabaseRestore,
    [string]$DumpPath = "",
    [string]$SqliteAuthDb = ""
)

# Continue: Python writes tracebacks to stderr; we check $LASTEXITCODE where needed.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root
. (Join-Path $PSScriptRoot "pg_path.ps1")

$ArtifactDir = Join-Path $Root "migration_artifacts"
New-Item -ItemType Directory -Path $ArtifactDir -Force | Out-Null

function Load-DyslexiaDatabaseUrl {
    $envFile = Join-Path $Root "dyslexia-backend\.env"
    if (-not (Test-Path $envFile)) { return $null }
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*DATABASE_URL=(.+)$') { return $Matches[1].Trim('"') }
    }
    return $null
}

function Load-ScanAuthDatabaseUrl {
    $envFile = Join-Path $Root "scan-backend\.env"
    if (-not (Test-Path $envFile)) { return $null }
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*AUTH_DATABASE_URL=(.+)$') { return $Matches[1].Trim('"') }
    }
    return $null
}

function Test-ValidPostgresUrl([string]$u) {
    if (-not $u) { return $false }
    $t = $u.Trim()
    if ($t -notmatch '^postgresql://') { return $false }
    # Reject docs placeholders and pasted instructions
    if ($t -match '[<>]|same URI|your \.env|placeholder|db\.xxxxx\.supabase|xxxxx\.supabase\.co') { return $false }
    return $true
}

if ($SupabaseRestore) {
    # Prefer .env files FIRST. A stale $env:SUPABASE_DATABASE_URL from an old session often still points at db.*.supabase.co and overrides the pooler URL in .env.
    $resolved = Load-DyslexiaDatabaseUrl
    if (-not (Test-ValidPostgresUrl $resolved)) {
        $resolved = Load-ScanAuthDatabaseUrl
    }
    if (-not (Test-ValidPostgresUrl $resolved)) {
        $resolved = $env:SUPABASE_DATABASE_URL
    }
    if (-not (Test-ValidPostgresUrl $resolved)) {
        Write-Host "ERROR: No valid postgresql:// URI for Supabase restore." -ForegroundColor Red
        Write-Host "  Set DATABASE_URL in dyslexia-backend/.env (pooler URI from Supabase Connect)." -ForegroundColor Yellow
        exit 1
    }
    $env:SUPABASE_DATABASE_URL = $resolved.Trim()
    $hostHint = if ($env:SUPABASE_DATABASE_URL -match '@([^/]+)') { $Matches[1] } else { "?" }
    Write-Host "[migration] Using URI host: $hostHint (from dyslexia-backend/.env if present)" -ForegroundColor DarkGray
}

$defaultDumpFile = Join-Path $ArtifactDir "dyslexia_db.dump"
$effectiveDumpPath = if ($DumpPath) { $DumpPath } else { $defaultDumpFile }
$dbUrlEarly = Load-DyslexiaDatabaseUrl
$pointsAtSupabase = $dbUrlEarly -and ($dbUrlEarly -match 'supabase\.co')
$haveDump = Test-Path $effectiveDumpPath

if ($SupabaseRestore -and -not $haveDump -and $pointsAtSupabase) {
    Write-Host "ERROR: No dump file for restore: $effectiveDumpPath" -ForegroundColor Red
    Write-Host "  dyslexia-backend/.env points at Supabase; this PC cannot pg_dump that host (DNS/IPv6)." -ForegroundColor Yellow
    Write-Host "  Fix A: Copy dyslexia_db.dump into migration_artifacts\ (from migration_backup_* or another machine)." -ForegroundColor Yellow
    Write-Host "  Fix B: Temporarily set DATABASE_URL to local Postgres, run:" -ForegroundColor Yellow
    Write-Host "    .\scripts\migration\complete_migration.ps1" -ForegroundColor Gray
    Write-Host "  then restore dyslexia-backend/.env to Supabase and run -SupabaseRestore again." -ForegroundColor Yellow
    exit 1
}

$skipLocalSteps = $SupabaseRestore -and $haveDump
if ($skipLocalSteps) {
    Write-Host "=== Skipping steps 1-3 (using existing dump for Supabase restore) ===" -ForegroundColor Cyan
    Write-Host "  Dump: $effectiveDumpPath" -ForegroundColor Gray
}

if (-not $skipLocalSteps) {
    Write-Host "=== Step 1: Baseline backup (SQLite + optional pg_dump) ===" -ForegroundColor Cyan
    & (Join-Path $Root "scripts\migration\backup_baseline.ps1")

    Write-Host "`n=== Step 2: Table count manifest ===" -ForegroundColor Cyan
    $dbUrl = Load-DyslexiaDatabaseUrl
    if (-not $dbUrl) {
        Write-Host "  SKIP: dyslexia-backend/.env has no DATABASE_URL" -ForegroundColor Yellow
    } else {
        $env:DATABASE_URL = $dbUrl
        $manifestOut = Join-Path $ArtifactDir "manifest_before.txt"
        python (Join-Path $Root "scripts\migration\table_counts.py") --manifest 2>&1 | Out-File -FilePath $manifestOut -Encoding utf8
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  FAILED (is PostgreSQL running?). See $manifestOut" -ForegroundColor Yellow
        } else {
            Write-Host "  Wrote $manifestOut" -ForegroundColor Green
        }
    }

    Write-Host "`n=== Step 3: pg_dump to migration_artifacts ===" -ForegroundColor Cyan
    $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
    if (-not $pgDump) {
        Write-Host "  SKIP: pg_dump not on PATH. Install: https://www.postgresql.org/download/windows/ (command-line tools only is OK)" -ForegroundColor Yellow
    } elseif (-not $dbUrl) {
        Write-Host "  SKIP: no DATABASE_URL" -ForegroundColor Yellow
    } elseif ($dbUrl -match 'supabase\.co') {
        Write-Host "  SKIP: DATABASE_URL is Supabase - cannot pg_dump from this PC; use an existing migration_artifacts\dyslexia_db.dump" -ForegroundColor Yellow
    } else {
        $dumpOut = Join-Path $ArtifactDir "dyslexia_db.dump"
        & pg_dump -Fc -f $dumpOut $dbUrl
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  FAILED: pg_dump exit $LASTEXITCODE" -ForegroundColor Yellow
        } else {
            Write-Host "  Wrote $dumpOut" -ForegroundColor Green
        }
    }
}

if (-not $SupabaseRestore) {
    Write-Host "`nDone (local steps only). For Supabase steps 4-11:" -ForegroundColor Cyan
    Write-Host "  1) Create a Supabase project and copy the Database connection string (direct, port 5432)." -ForegroundColor Gray
    Write-Host "  2) `$env:SUPABASE_DATABASE_URL = '<uri>?sslmode=require'" -ForegroundColor Gray
    Write-Host "  3) Run: .\scripts\migration\complete_migration.ps1 -SupabaseRestore" -ForegroundColor Gray
    exit 0
}

Write-Host "`n=== Steps 4-5: Restore dump to Supabase ===" -ForegroundColor Cyan
$supabaseUrl = $env:SUPABASE_DATABASE_URL
if (-not $supabaseUrl) {
    Write-Host "ERROR: Set SUPABASE_DATABASE_URL to your Supabase Postgres URI." -ForegroundColor Red
    exit 1
}
$restoreDump = $effectiveDumpPath
if (-not (Test-Path $restoreDump)) {
    Write-Host "ERROR: Dump not found: $restoreDump. Run step 3 first or pass -DumpPath" -ForegroundColor Red
    exit 1
}

function Get-HostnameFromPostgresUrl([string]$url) {
    if ($url -match '@([^/:@]+)') { return $Matches[1].Trim() }
    return $null
}
$dbHost = Get-HostnameFromPostgresUrl $supabaseUrl
if ($dbHost -and ($dbHost -match '^db\..+\.supabase\.co$')) {
    try {
        $addrs = [System.Net.Dns]::GetHostAddresses($dbHost)
        $hasV4 = $addrs | Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork }
        if (-not $hasV4) {
            Write-Host ""
            Write-Host "  *** Direct db.*.supabase.co resolves to IPv6 only on this PC (no IPv4). ***" -ForegroundColor Yellow
            Write-Host "  pg_restore / psycopg2 often fail. Use Session pooler URI from Supabase -> Connect." -ForegroundColor Yellow
            Write-Host "  Help: scripts/migration/supabase_pooler_instructions.txt" -ForegroundColor Yellow
            Write-Host ""
        }
    } catch { }
}

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) {
    Write-Host "ERROR: pg_restore not on PATH." -ForegroundColor Red
    exit 1
}
& pg_restore --verbose --clean --if-exists --no-owner --no-acl -d $supabaseUrl $restoreDump
if ($LASTEXITCODE -ne 0) { Write-Host "WARNING: pg_restore returned $LASTEXITCODE (sometimes OK if objects already exist)" -ForegroundColor Yellow }

Write-Host "`n=== Step 6: Verify table counts on Supabase ===" -ForegroundColor Cyan
$env:DATABASE_URL = $supabaseUrl
$manifestAfter = Join-Path $ArtifactDir "manifest_after_supabase.txt"
python (Join-Path $Root "scripts\migration\table_counts.py") --manifest | Out-File -FilePath $manifestAfter -Encoding utf8
Write-Host "  Compare manifest_before.txt vs manifest_after_supabase.txt" -ForegroundColor Green

Write-Host "`n=== Step 7: Ensure users table (scan-backend init) ===" -ForegroundColor Cyan
$scanEnv = Join-Path $Root "scan-backend\.env"
if (-not (Test-Path $scanEnv)) {
    @"
AUTH_DATABASE_URL=$supabaseUrl
JWT_SECRET=change-me-in-production
"@ | Out-File -FilePath $scanEnv -Encoding utf8
    Write-Host "  Created scan-backend/.env with AUTH_DATABASE_URL" -ForegroundColor Green
} else {
    Write-Host "  Merge AUTH_DATABASE_URL=$supabaseUrl into scan-backend/.env manually if not set." -ForegroundColor Yellow
}

Write-Host "`n=== Step 8: Migrate SQLite users to Postgres ===" -ForegroundColor Cyan
$sqlitePath = $SqliteAuthDb
if (-not $sqlitePath) { $sqlitePath = Join-Path $Root "scan-backend\dyslexai_auth.db" }
if (-not (Test-Path $sqlitePath)) {
    Write-Host "  SKIP: SQLite auth DB not found: $sqlitePath" -ForegroundColor Yellow
} else {
    $env:AUTH_DATABASE_URL = $supabaseUrl
    $env:DATABASE_URL = $supabaseUrl
    python (Join-Path $Root "scan-backend\scripts\migrate_auth_sqlite_to_postgres.py") --sqlite $sqlitePath
    python (Join-Path $Root "scan-backend\scripts\migrate_auth_sqlite_to_postgres.py") --sqlite $sqlitePath --verify-only
}

Write-Host "`n=== Step 9: Point dyslexia-backend .env at Supabase ===" -ForegroundColor Cyan
$dex = Join-Path $Root "dyslexia-backend\.env"
if (Test-Path $dex) {
    Write-Host "  Set DATABASE_URL in dyslexia-backend/.env to the same Supabase URI (merge manually)." -ForegroundColor Yellow
} else {
    "DATABASE_URL=$supabaseUrl" | Out-File -FilePath $dex -Encoding utf8
    Write-Host "  Created dyslexia-backend/.env" -ForegroundColor Green
}

Write-Host "`n=== Step 10: Optional FK (psql) ===" -ForegroundColor Cyan
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "  SKIP: psql not on PATH. Run manually:" -ForegroundColor Yellow
    Write-Host "  psql `"$supabaseUrl`" -f dyslexia-backend/db/migrations/add_assignment_teacher_fk.sql" -ForegroundColor Gray
} else {
    $fkSql = Join-Path $Root "dyslexia-backend\db\migrations\add_assignment_teacher_fk.sql"
    & psql $supabaseUrl -f $fkSql
}

Write-Host "`n=== Step 11: Join integrity + deploy reminder ===" -ForegroundColor Cyan
$env:DATABASE_URL = $supabaseUrl
python (Join-Path $Root "scripts\migration\verify_join_integrity.py")

Write-Host "`n  Deploy scan-backend + dyslexia-backend; set DyslexAI-Mobile EXPO_PUBLIC_API_URL / EXPO_PUBLIC_EXERCISE_API_URL." -ForegroundColor Green
Write-Host "All automated steps attempted." -ForegroundColor Cyan
