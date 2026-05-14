# Restore pg_dump custom-format backup into Supabase Postgres.
# Usage:
#   $env:SUPABASE_DATABASE_URL = "postgresql://..."
#   .\scripts\migration\restore_dyslexia_to_supabase.ps1 -DumpPath C:\backups\dyslexia_db.dump

param(
    [Parameter(Mandatory = $true)]
    [string]$DumpPath
)

$ErrorActionPreference = "Stop"
if (-not $env:SUPABASE_DATABASE_URL) {
    Write-Error "Set SUPABASE_DATABASE_URL to your Supabase connection string (often direct, not pooler, for pg_restore)."
}
if (-not (Test-Path $DumpPath)) {
    Write-Error "Dump not found: $DumpPath"
}

Write-Host "Restoring to Supabase (this may take several minutes)..." -ForegroundColor Cyan
& pg_restore --verbose --clean --if-exists --no-owner --no-acl -d $env:SUPABASE_DATABASE_URL $DumpPath
if ($LASTEXITCODE -ne 0) {
    throw "pg_restore failed with exit code $LASTEXITCODE"
}
Write-Host "Done. Run table_counts.py against DATABASE_URL to verify row counts." -ForegroundColor Green
