# DyslexAI – Project Context (Handoff)

Use this document to continue work on the project in a new chat. It summarizes architecture, setup, key files, and current state.

---

## 1. Project goals

- **DyslexAI**: FYP mobile app (Expo/React Native) for dyslexia support.
- **Features**: (1) **Scan & Correct** – photograph handwriting → OCR (DocTR + TrOCR) → T5 grammar correction → Groq; (2) **Learning Exercises** – adaptive word/sentence typing (and optionally handwriting); (3) **Library** – save scans; (4) **Gamification** – XP, levels, badges, streak; (5) **Auth** – signup/login + “Skip sign in”.

---

## 2. Architecture

```
[Device: DyslexAI-Mobile (Expo)]
        │
        ├──► scan-backend (port 8000)   → Scan image, auth (signup/login), JWT
        │    • DocTR (lines) → TrOCR → T5 (grammar) → Groq
        │    • SQLite auth DB
        │
        └──► dyslexia-backend (port 8001) → Practice exercises
             • PostgreSQL (Docker: dyslexia-db)
             • Adaptive exercises: get next → start session → submit (typed / handwriting / tracing)
             • Word mastery, difficulty level, LLM feedback (Groq)
```

| Component           | Folder              | Port  | Purpose |
|--------------------|---------------------|-------|---------|
| **Scan backend**   | `scan-backend/`     | 8000  | Scan, auth |
| **Exercise backend** | `dyslexia-backend/` | 8001  | Exercises, sessions, stats |
| **Mobile app**     | `DyslexAI-Mobile/`  | Expo  | UI, calls both backends |
| **DB (exercises)** | Docker `dyslexia-db`| 5432  | PostgreSQL for exercises |

- **Workspace root**: `c:\Users\syeda\Downloads\FYP\MCP_Stitch` (or your clone path).

---

## 3. Folder structure (key paths)

```
MCP_Stitch/
├── scan-backend/           # Scan API + auth (FastAPI, DocTR, TrOCR, T5, Groq)
│   ├── app/
│   │   ├── main.py
│   │   ├── auth_routes.py, auth_db.py
│   │   └── ...
│   ├── .env                # GROQ_API_KEY, etc.
│   ├── requirements.txt
│   └── venv/
├── dyslexia-backend/       # Exercise API (FastAPI, PostgreSQL, Groq, TrOCR for handwriting)
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/        # students.py, exercises.py, sessions.py
│   │   ├── models/         # student, exercise, session, word_mastery
│   │   ├── schemas/
│   │   └── services/       # evaluator.py, llm.py, ocr.py (TrOCR)
│   ├── db/
│   │   ├── seed.py         # Seeds exercises; run after Session table cleared first
│   │   └── create_tables.py
│   ├── .env                # DATABASE_URL, GROQ_API_KEY
│   ├── requirements.txt
│   └── venv/
├── DyslexAI-Mobile/        # Expo / React Native app
│   ├── src/
│   │   ├── api/            # scan.ts, auth.ts, exercises.ts, health.ts
│   │   ├── screens/        # Auth, dashboard, upload, ScanResults, Library, exercises (Learning, Practice)
│   │   ├── context/        # AuthContext
│   │   ├── utils/          # studentStorage (per-user), gamification, libraryStorage
│   │   ├── theme/, constants/, types/
│   │   └── App.tsx
│   ├── .env                # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_EXERCISE_API_URL (device IP or 10.0.2.2)
│   └── package.json
├── INTEGRATION_EXERCISES.md
├── TASKS_ORDER.md
├── PRODUCTION_READINESS.md
├── NETWORK_FIX.md
├── SETUP_ALL.md
└── PROJECT_CONTEXT.md      # this file
```

---

## 4. How to run (full stack)

**Prereqs:** Docker Desktop, Python 3.12, Node/npm, Expo.

1. **PostgreSQL (Docker)**  
   First time:  
   `docker run --name dyslexia-db -e POSTGRES_DB=dyslexia_db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15`  
   Later: `docker start dyslexia-db`

2. **Seed exercises (once, or after DB reset)**  
   In a separate terminal (not the one running 8001):  
   `cd dyslexia-backend` → `.\venv\Scripts\Activate.ps1` → `python db/seed.py`  
   (Seed deletes sessions then exercises, then inserts seeded exercises.)

3. **Scan backend (8000)**  
   `cd scan-backend` → `.\venv\Scripts\Activate.ps1` → `uvicorn app.main:app --host 0.0.0.0 --port 8000`

4. **Exercise backend (8001)**  
   `cd dyslexia-backend` → `.\venv\Scripts\Activate.ps1` → `uvicorn app.main:app --host 0.0.0.0 --port 8001`

5. **Mobile app**  
   `cd DyslexAI-Mobile` → `npx expo start` → press **a** (Android) or scan QR with Expo Go.

**Config (device vs emulator):**  
- Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`, `EXPO_PUBLIC_EXERCISE_API_URL=http://10.0.2.2:8001`  
- Physical device: use your PC’s LAN IP (e.g. `http://192.168.x.x:8000`, same for 8001). See `NETWORK_FIX.md`.

---

## 5. Exercise flow (current behavior)

- **Learning screen** has:
  - **Start practice** – adaptive mix (no type filter).
  - **Word Typing** – navigates to Practice with `exerciseType: 'word_typing'` (only word exercises).
  - **Sentence Builder** – navigates to Practice with `exerciseType: 'sentence_typing'` (only sentence exercises).
- **Tracing** is disabled in the UI and in backend selection (tracing exercises are never returned); backend code for tracing (e.g. `submit-tracing`) is kept.
- **Start practice logic (no type):**
  - If the student has **weak words** (mastery &lt; 60%): struggle pool is **word_typing only** for those words (practice word first).
  - If **no weak words**: level pool is weighted toward **sentence_typing** (50% sentences, 30% words, 20% stretch).

**Backend (dyslexia-backend):**
- `GET /exercises/next?student_id=UUID&type=word_typing|sentence_typing` – optional `type` filter.
- When `type` is omitted, exercises with `type == "tracing"` are excluded from selection.
- `POST /sessions/` → `POST /sessions/{id}/submit` (typed) or `.../submit-handwriting` (image) or `.../submit-tracing` (JSON; tracing disabled from selection but endpoint exists).
- `POST /exercises/generate?student_id=UUID&type=...` – generate more exercises (optional type).

---

## 6. Per-user progress (auth ↔ exercises)

- **Exercise “student”** is stored **per auth user**: key `@dyslexai/exercise_student_${userId}` (e.g. `_0` for guest).
- **studentStorage**: `getStoredStudentId(userId)`, `getOrCreateStudent(userId, name, age)` – `userId` from `useAuth().user?.id ?? 0`.
- **PracticeScreen**, **StudentDashboardScreen**, **LearningExercisesScreen** pass `user?.id ?? 0` so each logged-in user (and guest) has separate exercise progress.
- **Gamification** (XP, level, badges, streak) is **per user**: stored under `@dyslexai/{suffix}_${userId}` so each auth user (and guest) has separate progress.

---

## 7. Key API surface

**scan-backend (8000)**  
- `POST /auth/signup`, `POST /auth/login`  
- `POST /scan` – image upload → raw_text, corrected_text, error_regions, etc.

**dyslexia-backend (8001)**  
- `POST /students/` – create student  
- `GET /students/{id}`, `GET /students/{id}/stats`, `GET /students/{id}/mastery`  
- `GET /exercises/next?student_id=&type=`  
- `GET /exercises/{id}`, `POST /exercises/generate?student_id=&type=`  
- `POST /sessions/` (body: student_id, exercise_id, is_handwriting)  
- `POST /sessions/{id}/submit` (typed)  
- `POST /sessions/{id}/submit-handwriting` (multipart `file`)  
- `POST /sessions/{id}/submit-tracing` (JSON: trace_score, duration_seconds, stroke_errors) – selection disabled, code kept

---

## 8. Important implementation details

- **Seed:** `db/seed.py` deletes **sessions** first, then **exercises**, to satisfy foreign keys. If you add new tables that reference exercises/sessions, clear them in seed before deleting exercises.
- **Backend venv:** If the folder was renamed (e.g. DyslexAI-Backend → scan-backend), recreate venv in the new folder so paths in scripts point to the right place.
- **student_id in app:** Always pass a **string** (UUID) to the exercise API; the app was fixed to avoid passing an object (which caused `[object Object]` and 422).
- **Fallback in get_next:** If no exercise is chosen from pools, backend picks a random non-tracing exercise not in the last 5 sessions; a warning is logged (student_id, level, all_at_level count, recent_ids count).

---

## 9. TODOs / future work (from project state)

- **TASKS_ORDER.md:** Dashboard task still listed as pending; error highlighting done.
- **PRODUCTION_READINESS.md:** Deploy backends to cloud, GPU for pipeline, EAS Build or web for app, async scan for long runs.
- **Gamification:** XP/badges/streak are now scoped by auth user (store by `userId`). Done.
- **Re-enable tracing:** Re-add tracing to Learning UI and remove the “exclude tracing” filter in `dyslexia-backend` when ready.

---

## 10. Docs to open for details

| Topic              | File |
|--------------------|------|
| Exercise API & run | `INTEGRATION_EXERCISES.md` |
| Pipeline & tasks   | `TASKS_ORDER.md` |
| Production         | `PRODUCTION_READINESS.md` |
| Network / device   | `NETWORK_FIX.md` |
| Full run steps     | `SETUP_ALL.md` |

---

*Last updated to reflect: tracing disabled (UI + backend selection), Word Typing / Sentence Builder only in Learning with type-specific practice, Start practice logic (word vs sentence by weak words), per-user exercise student, and seed order (sessions then exercises).*
