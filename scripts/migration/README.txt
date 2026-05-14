Supabase / unified Postgres migration (lossless)

If restore fails with "could not translate host name" for db.*.supabase.co:
  Your PC likely has IPv6-only DNS for the direct host. Use the Session pooler URI from
  Supabase Connect (host like aws-0-REGION.pooler.supabase.com) in both .env files.
  See: scripts/migration/supabase_pooler_instructions.txt

If pg_dump is "not found" in Cursor but exists under Program Files: your terminal inherited an old PATH.
  Fix: fully quit and reopen Cursor, OR set PG_BIN for one session:
    $env:PG_BIN = "C:\Program Files\PostgreSQL\18\bin"
  Migration scripts also auto-prepend that folder via scripts/migration/pg_path.ps1

Quick path (runs steps 1-3 locally; 4-11 when you set SUPABASE_DATABASE_URL):
  From repo root:
    .\scripts\migration\complete_migration.ps1
  Then with Supabase URI:
    $env:SUPABASE_DATABASE_URL = "postgresql://..."
    .\scripts\migration\complete_migration.ps1 -SupabaseRestore

Manual steps:

1) Baseline backups (PowerShell, from repo root)
   .\scripts\migration\backup_baseline.ps1

2) Record table counts before move
   cd dyslexia-backend
   ..\venv\Scripts\activate   (or your venv)
   set DATABASE_URL=postgresql://...local...
   python ..\scripts\migration\table_counts.py > ..\manifest_before.txt

3) Dump local dyslexia DB
   pg_dump -Fc -f dyslexia_db.dump %DATABASE_URL%

4) Create Supabase project; copy direct connection URI (often port 5432) for pg_restore.

5) Restore into Supabase
   set SUPABASE_DATABASE_URL=postgresql://...
   .\scripts\migration\restore_dyslexia_to_supabase.ps1 -DumpPath dyslexia_db.dump

6) Verify counts match
   set DATABASE_URL=<supabase same url>
   python scripts\migration\table_counts.py
   Compare to manifest_before.txt

7) Create users table on Supabase if not in dump: run scan-backend once with AUTH_DATABASE_URL set so init_auth_db creates public.users.

8) Migrate SQLite auth users (preserves ids and password hashes)
   python scan-backend\scripts\migrate_auth_sqlite_to_postgres.py --sqlite scan-backend\dyslexai_auth.db
   python scan-backend\scripts\migrate_auth_sqlite_to_postgres.py --sqlite scan-backend\dyslexai_auth.db --verify-only

9) Point both backends at Supabase (same DATABASE_URL / AUTH_DATABASE_URL in .env files).

10) Optional FK (after users exist)
   psql %DATABASE_URL% -f dyslexia-backend\db\migrations\add_assignment_teacher_fk.sql

11) Verify joins
   python scripts\migration\verify_join_integrity.py

12) Deploy FastAPI hosts; set DyslexAI-Mobile EXPO_PUBLIC_* to HTTPS URLs.

After migration (sanity check):
  .\scripts\migration\verify_supabase_complete.ps1

Notes:
- Use Session pooler URI in .env if db.*.supabase.co fails (IPv6-only DNS on Windows).
- migrate_auth_sqlite_to_postgres.py creates public.users if missing, then copies SQLite rows.
- Step 7 above: users table is created by that script (or create_users_table.sql), not only by scan-backend init.

Optional later:
- Supabase Storage: add buckets for retained scan/handwriting images; upload from FastAPI using service role.
- Supabase Auth (replaces custom JWT): large change; requires UUID/teacher_id strategy — defer until DB migration is stable.
