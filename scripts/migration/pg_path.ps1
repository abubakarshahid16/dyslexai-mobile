# Prepends PostgreSQL client bin to PATH for this PowerShell session.
# Fixes: IDE terminals that started before PATH was edited, or PATH not applied to Cursor.
#
# Optional: set PG_BIN to your bin folder, e.g.
#   $env:PG_BIN = "C:\Program Files\PostgreSQL\18\bin"

if ($env:PG_BIN) {
    $bin = $env:PG_BIN.Trim().TrimEnd('\')
    if (Test-Path (Join-Path $bin "pg_dump.exe")) {
        $env:Path = "$bin;$env:Path"
        Write-Host "[migration] PG_BIN -> prepended to session PATH" -ForegroundColor DarkGray
    } else {
        Write-Host "[migration] WARNING: PG_BIN set but pg_dump.exe not found: $bin" -ForegroundColor Yellow
    }
    return
}

$candidates = @(
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin"
)
foreach ($d in $candidates) {
    if (Test-Path (Join-Path $d "pg_dump.exe")) {
        $env:Path = "$d;$env:Path"
        Write-Host "[migration] Prepended to session PATH: $d" -ForegroundColor DarkGray
        return
    }
}
