# Integrating the Practice Exercises Backend

The **dyslexia-backend** (cloned from [alizaib84876/dyslexia-backend](https://github.com/alizaib84876/dyslexia-backend)) provides adaptive practice exercises (typing, handwriting, tracing), scoring, LLM feedback, and difficulty adjustment. The DyslexAI mobile app’s **Practice** flow uses this API.

**Important:** Pull the latest from GitHub for handwriting and tracing support:
```bash
cd dyslexia-backend
git pull origin main
```
The app expects `GET /exercises/next?student_id=X&type=X`, `POST /sessions/{id}/submit-handwriting`, and `POST /sessions/{id}/submit-tracing`. If your local backend is older, update it or the new flows will not work.

## Two backends

| Backend              | Port | Purpose                          |
|----------------------|------|-----------------------------------|
| **scan-backend**      | 8000 | Scan (DocTR + TrOCR + Groq)       |
| **dyslexia-backend**  | 8001 | Practice exercises (adaptive API) |

The app uses the **scan** API for “Scan & Correct” and the **exercise** API for “Start practice” from Learning Exercises.

## Run the exercise backend (port 8001)

1. **Docker**  
   Start PostgreSQL (once):
   ```bash
   docker run --name dyslexia-db -e POSTGRES_DB=dyslexia_db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:15
   ```
   Later: `docker start dyslexia-db`

2. **Python env** (from repo root):
   ```bash
   cd dyslexia-backend
   python -m venv venv
   venv\Scripts\activate
   pip install fastapi uvicorn sqlalchemy psycopg2-binary alembic python-dotenv python-Levenshtein pytest httpx pydantic groq transformers torch Pillow python-multipart
   ```
   (TrOCR for handwriting is optional but needed for `submit-handwriting`; first request may download the model.)

3. **.env** in `dyslexia-backend/`:
   ```
   DATABASE_URL=postgresql://dev:devpass@localhost:5432/dyslexia_db
   GROQ_API_KEY=your_groq_api_key_here
   ```

4. **Seed** (once):
   ```bash
   python db/seed.py
   ```

5. **Start API** (on port 8001 so it doesn’t conflict with the scan backend):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8001
   ```
   (Or use `python run.py` if the repo provides it.)

## App configuration

- **Scan backend:** `EXPO_PUBLIC_API_URL` (default `http://10.0.2.2:8000` for emulator).
- **Exercise backend:** `EXPO_PUBLIC_EXERCISE_API_URL` (default `http://10.0.2.2:8001` for emulator).

For a **physical device**, set both in `DyslexAI-Mobile/.env` to your PC’s IP, e.g.:
```
EXPO_PUBLIC_API_URL=http://192.168.1.12:8000
EXPO_PUBLIC_EXERCISE_API_URL=http://192.168.1.12:8001
```

## Exercise types (backend)

| type             | What the student does                    | Submit endpoint                |
|------------------|------------------------------------------|--------------------------------|
| word_typing      | Types word/sentence in a text box        | `POST /sessions/{id}/submit`    |
| sentence_typing  | Types word/sentence in a text box         | `POST /sessions/{id}/submit`    |
| handwriting      | Writes on paper; app uploads a photo     | `POST /sessions/{id}/submit-handwriting` (multipart `file`) |
| tracing          | Traces letter/word; app sends trace score| `POST /sessions/{id}/submit-tracing` (JSON: `trace_score`, `duration_seconds`, `stroke_errors`) |

- **Handwriting:** Start session with `is_handwriting: true`. Backend runs TrOCR and returns `ocr_text`, `ocr_confidence`, score, and feedback.
- **Tracing:** Backend does not evaluate strokes. The app computes (or the user self-reports) `trace_score` 0–1 and optional `stroke_errors` per letter, then sends them to submit-tracing.

Optional type filter: `GET /exercises/next?student_id=X&type=handwriting` (or `tracing`, `word_typing`, `sentence_typing`) to get only that type.

## App flow

1. User opens **Learning Exercises** and taps **Start practice**.
2. App gets or creates a **student** (stored locally) and calls `GET /exercises/next?student_id=...` (optionally with `&type=...`).
3. App reads `exercise.type` and shows the right UI:
   - **word_typing / sentence_typing:** content + text input → `POST /sessions/` (is_handwriting: false) → `POST /sessions/{id}/submit`.
   - **handwriting:** content + camera/gallery → user picks photo → `POST /sessions/` (is_handwriting: true) → `POST /sessions/{id}/submit-handwriting` with image.
   - **tracing:** content + “how well did you trace?” (e.g. 50–100%) → `POST /sessions/` (is_handwriting: false) → `POST /sessions/{id}/submit-tracing` with trace_score and optional stroke_errors.
4. App shows **score**, **feedback**, and optionally `ocr_text` (handwriting) or `stroke_errors` (tracing).
5. User taps **Next exercise** and repeats from step 2.

See [dyslexia-backend README](https://github.com/alizaib84876/dyslexia-backend) for full API details.
