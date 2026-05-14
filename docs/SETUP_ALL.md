# DyslexAI – Where and How to Run Everything

Use this as a checklist. Open **two or three PowerShell windows**. All paths assume your project is at:

`C:\Users\syeda\Downloads\FYP\MCP_Stitch`

---

## Part 1: Scan backend (DocTR + TrOCR) – port 8000

**Where:** One PowerShell window, dedicated to the scan backend.

**Steps:**

| Step | What to do |
|------|------------|
| 1 | Open PowerShell. Go to the scan backend folder: |
| | `cd C:\Users\syeda\Downloads\FYP\MCP_Stitch\scan-backend` |
| 2 | (First time only) Create and activate the virtual environment: |
| | `python -m venv venv` |
| | `.\venv\Scripts\activate` |
| 3 | (First time only) Install dependencies: |
| | `pip install -r requirements.txt` |
| 4 | (Optional) Set Groq for text correction: |
| | `$env:GROQ_API_KEY="your_groq_api_key_here"` |
| 5 | Start the scan API (leave this window open): |
| | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |

**Check:** In a browser open `http://localhost:8000/health` — you should see `{"status":"ok",...}`.

---

## Part 2: Exercise backend (practice exercises) – port 8001

**Where:** A **second** PowerShell window, dedicated to the exercise backend.

**Steps:**

| Step | What to do |
|------|------------|
| 1 | Make sure **Docker Desktop** is running. |
| 2 | Open a **new** PowerShell. Start the database (only needed once ever): |
| | `docker run --name dyslexia-db -e POSTGRES_DB=dyslexia_db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15` |
| | (If the container already exists and was stopped: `docker start dyslexia-db`) |
| 3 | Go to the exercise backend folder: |
| | `cd C:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend` |
| 4 | (First time only) Create and activate the virtual environment: |
| | `python -m venv venv` |
| | `.\venv\Scripts\activate` |
| 5 | (First time only) Install dependencies: |
| | `pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv python-Levenshtein pydantic groq` |
| 6 | (First time only) Create a file named `.env` **inside** `dyslexia-backend` with: |
| | `DATABASE_URL=postgresql://dev:devpass@localhost:5432/dyslexia_db` |
| | `GROQ_API_KEY=your_groq_api_key_here` |
| 7 | (First time only) Seed the database: |
| | `python db/seed.py` |
| | You should see: `Seeded 30 exercises successfully.` |
| 8 | Start the exercise API (leave this window open): |
| | `python run.py` |
| | Or: `uvicorn app.main:app --host 0.0.0.0 --port 8001` |

**Check:** In a browser open `http://localhost:8001/` — you should see `{"status":"ok","message":"Dyslexia Support API is running"}`.

---

## Part 3: Mobile app (Expo)

**Where:** A **third** PowerShell window.

**Steps:**

| Step | What to do |
|------|------------|
| 1 | (If you had script execution errors before) Allow scripts once: |
| | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| 2 | Go to the mobile app folder: |
| | `cd C:\Users\syeda\Downloads\FYP\MCP_Stitch\DyslexAI-Mobile` |
| 3 | (First time only) Install dependencies: |
| | `npm install` |
| 4 | (Optional) For **Android emulator**, the app is already set to use `10.0.2.2:8000` and `10.0.2.2:8001`. For a **physical phone**, create or edit a file named `.env` **inside** `DyslexAI-Mobile` with your PC’s IP (from `ipconfig`), e.g.: |
| | `EXPO_PUBLIC_API_URL=http://192.168.1.12:8000` |
| | `EXPO_PUBLIC_EXERCISE_API_URL=http://192.168.1.12:8001` |
| 5 | Start the app (leave this window open): |
| | `npx expo start` |
| 6 | Press **a** to open on Android emulator, or scan the QR code with Expo Go on your phone. |

---

## Summary: three windows

| Window | Folder | Command to run (after first-time setup) |
|--------|--------|----------------------------------------|
| **1 – Scan** | `C:\Users\syeda\Downloads\FYP\MCP_Stitch\scan-backend` | `.\venv\Scripts\activate` then `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| **2 – Exercises** | `C:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend` | `.\venv\Scripts\activate` then `uvicorn app.main:app --host 0.0.0.0 --port 8001` |
| **3 – App** | `C:\Users\syeda\Downloads\FYP\MCP_Stitch\DyslexAI-Mobile` | `npx expo start` |

---

## Next time you start your PC

1. **Window 1:** `cd C:\Users\syeda\Downloads\FYP\MCP_Stitch\scan-backend` → `.\venv\Scripts\activate` → `uvicorn app.main:app --host 0.0.0.0 --port 8000`
2. **Window 2:** `docker start dyslexia-db` then `cd C:\Users\syeda\Downloads\FYP\MCP_Stitch\dyslexia-backend` → `.\venv\Scripts\activate` → `uvicorn app.main:app --host 0.0.0.0 --port 8001`
3. **Window 3:** `cd C:\Users\syeda\Downloads\FYP\MCP_Stitch\DyslexAI-Mobile` → `npx expo start`
