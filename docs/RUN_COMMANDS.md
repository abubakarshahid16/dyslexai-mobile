# Commands to run the full stack (Windows)

---

## One command (recommended)

From the **repo root** (e.g. `C:\Users\syeda\Downloads\FYP\MCP_Stitch`):

```powershell
.\start-all.ps1
```

This starts: (1) PostgreSQL in Docker, (2) exercise backend (8001) in a new window, (3) scan backend (8000) in a new window, (4) Expo in the current window. You only run one command; then press **a** for Android or scan the QR code with Expo Go. **Your practice progress is kept** across restarts (seed is not run automatically). After a full shutdown and reboot, run the same command again (ensure Docker is running first, if it does not start with Windows).

**First time:** Ensure Docker is installed and that you’ve run `npm install` in `DyslexAI-Mobile` and created venvs in `dyslexia-backend` and `scan-backend` (e.g. `python -m venv venv` and `pip install -r requirements.txt` in each). Seed the exercise DB once so exercises exist: `cd dyslexia-backend`, activate venv, then `python db/seed.py`.

**Mac/Linux:** From repo root run `chmod +x start-all.sh` once, then `./start-all.sh`.

**Lower scan latency (CPU):** Use ONNX: set `USE_ONNX=1`. Use INT8 (smaller/faster): run once `cd scan-backend && python scripts/export_quantize_onnx.py` (exports T5 INT8; TrOCR INT8 is skipped), then set `USE_INT8=1` when starting the scan backend. With `start-all.sh`: `USE_INT8=1 ./start-all.sh`. DocTR is also quantized to INT8 on CPU when `USE_INT8=1`.

---

## Manual: Exercise module only (PostgreSQL + seed + backend on 8001)

Run these in order. Use **3 terminals** (or run 1 and 2, then keep 3 open).

**Terminal 1 – start database (once per session):**
```powershell
docker start dyslexia-db
```
*(First time ever: use the "First time only" Docker command in section 1 below.)*

**Terminal 2 – add tracing column and seed exercises (once, or after DB reset):**
```powershell
cd c:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend
.\venv\Scripts\Activate.ps1
python db/migrate_stroke_errors.py
python db/seed.py
```
*(Run `migrate_stroke_errors.py` once so the DB can store tracing data; then seed.)*

**Terminal 3 – start exercise backend (keep this running):**
```powershell
cd c:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

When you see `Uvicorn running on http://0.0.0.0:8001`, the exercise module is ready. Use the app’s **Daily Exercises** and check **Backend status** on the dashboard (Exercises 8001 + DB should be OK).

---

## 1. PostgreSQL (Docker)

**First time only:**
```powershell
docker run --name dyslexia-db -e POSTGRES_DB=dyslexia_db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15
```

**Every time after:**
```powershell
docker start dyslexia-db
```

---

## 2. Seed exercises (once, or after DB reset)

In a **new terminal** (not the one running the exercise backend):

```powershell
cd c:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend
.\venv\Scripts\Activate.ps1
python db/seed.py
```

---

## 3. Scan backend (port 8000)

**New terminal:**

```powershell
cd c:\Users\syeda\Downloads\FYP\MCP_Stitch\scan-backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 4. Exercise backend (port 8001)

**New terminal:**

```powershell
cd c:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## 5. Mobile app (Expo)

**New terminal:**

```powershell
cd c:\Users\syeda\Downloads\FYP\MCP_Stitch\DyslexAI-Mobile
npm install
npx expo start
```

Then press **a** for Android emulator or scan the QR code with Expo Go.

---

## If exercises or progress don't load

1. **Order matters:** Start **PostgreSQL first**, then run **migration** (once) and **seed** (step 2), then **exercise backend** (step 4). The app needs all three. If you use tracing, run `python db/migrate_stroke_errors.py` once so the `sessions` table has a `stroke_errors` column.
2. **Dashboard:** On the app dashboard, check **Backend status**. If "Exercises (8001)" is Unreachable, the exercise backend is not running or the device can't reach your PC. If "DB" shows "No data", run step 2 (seed) and pull down to retry.
3. **Same Wi‑Fi:** Phone/emulator must reach your PC. When you run `.\start-all.ps1`, the script **auto-detects your PC's IP** and writes it to `DyslexAI-Mobile/.env`, so you don't need to edit it when you change networks. If you start the app without the script, set `EXPO_PUBLIC_API_URL` to your PC IP (e.g. `http://192.168.100.9:8000`). Restart Expo after changing `.env`.
4. **Restart exercise backend** after pulling new code so new health routes load.
5. **Test from browser:** Open `http://YOUR_PC_IP:8001/diagnose` (e.g. http://192.168.18.47:8001/diagnose). If you see `"ok": true` and `"message": "All steps OK..."`, the backend and DB are fine; the issue is then app or network (URL in .env, firewall, or device not reaching PC).

---

## After code changes

- **Mobile (React/Expo):** Reload the app (press **r** in the Expo terminal, or shake device → Reload). Restart Expo only if you added new native deps or changed config.
- **Scan backend (8000):** Restart the `uvicorn` process (Ctrl+C, then run the command again).
- **Exercise backend (8001):** Restart the `uvicorn` process to pick up Python changes.
- **PostgreSQL:** No restart needed for app/backend code changes.
