# DyslexAI: Integrate DocTR + TrOCR + Groq (no T5) with the Mobile App

This guide covers running the **backend API** (DocTR, TrOCR, Groq) and connecting your **DyslexAI mobile app** to it. **T5 is not used** in this integration.

---

## Architecture

```
[Mobile App]  --(image)-->  [Backend API]  -->  DocTR (lines) --> TrOCR (text) --> Groq (optional)
                                |
                                +--> POST /scan  <-- returns raw_text, corrected_text, lines
```

- **DocTR**: Detects text lines in the image.
- **TrOCR**: Reads handwritten text for each line (Microsoft TrOCR large handwritten).
- **Groq**: Optional context correction (proper nouns, grammar) via Llama 3.3.

---

## Part 1: Backend (Python)

### 1.1 Location

- **Folder**: `scan-backend/`
- **API**: FastAPI app in `app/main.py`.

### 1.2 Setup (local or server)

1. **Create a virtual environment (recommended):**
   ```bash
   cd scan-backend
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Mac/Linux:
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   (First run will download DocTR and TrOCR weights; TrOCR is ~2.2 GB.)

3. **Optional – enable Groq:**
   - Get an API key from [Groq](https://console.groq.com).
   - Set the environment variable before starting the server:
   ```bash
   set GROQ_API_KEY=your_key_here
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   Or on Mac/Linux: `export GROQ_API_KEY=your_key_here`

4. **Run the API:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   Or: `python run.py` (if you use the provided `run.py`).

5. **Check:** Open `http://localhost:8000/health` – you should get `{"status":"ok","device":"cpu"}` (or `"cuda"` if GPU is used).

### 1.3 API

- **POST /scan**  
  - **Body:** multipart form with one file (e.g. `file`: image).  
  - **Response:**  
    - `raw_text`: OCR output (TrOCR) joined.  
    - `cleaned_text`: sanitized (regex).  
    - `corrected_text`: cleaned + Groq if `GROQ_API_KEY` is set; otherwise same as `cleaned_text`.  
    - `line_count`, `lines`: per-line text.

- **GET /health**  
  - Returns status and device (cpu/cuda).

---

## Part 2: Mobile App

### 2.1 What’s in the app

- **Upload screen:** Camera + gallery via `expo-image-picker`. On “Scan & Correct” it sends the image to the backend and navigates to Scan Results with the API response.
- **Scan Results screen:** Shows image, corrected text, and line list when opened with API result params.
- **API client:** `src/api/scan.ts` – `scanImage(imageUri)` calls `POST /scan` with the image.

### 2.2 Install app dependency

```bash
cd DyslexAI-Mobile
npm install expo-image-picker
```

### 2.3 Configure backend URL

The app uses **`API_BASE_URL`** in `src/constants/config.ts`:

- **Default:** `http://localhost:8000` (good for web or Android emulator on same PC).
- **Physical device (same Wi‑Fi):** Use your computer’s IP, e.g. `http://192.168.1.5:8000`.
- **Android emulator:** Use `http://10.0.2.2:8000` to reach the host machine’s `localhost:8000`.

To override without editing code (Expo):

1. In project root create or edit `.env`:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.5:8000
   ```
2. Use a different port if needed (e.g. `:8001`).

Then in `config.ts` the app already uses:

`process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'`

So the app will use the URL you set.

### 2.4 Run the app

```bash
cd DyslexAI-Mobile
npx expo start
```

- Pick an image (camera or gallery) and tap **Scan & Correct**.
- If the backend is running and the URL is correct, you’ll see the real OCR + corrected text and lines on the Scan Results screen.

---

## Part 3: Checklist

| Step | Action |
|------|--------|
| 1 | Backend: `cd scan-backend`, venv, `pip install -r requirements.txt` |
| 2 | Backend: (optional) set `GROQ_API_KEY` |
| 3 | Backend: `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| 4 | App: `npm install expo-image-picker` in DyslexAI-Mobile |
| 5 | App: Set `EXPO_PUBLIC_API_URL` or edit `config.ts` if using a physical device |
| 6 | App: `npx expo start` and test Scan & Correct |

---

## Models (no T5)

| Model | Role | Where |
|-------|------|--------|
| DocTR | Line detection | Downloaded at backend startup (Mindee CDN) |
| TrOCR large handwritten | Handwriting recognition | Hugging Face `microsoft/trocr-large-handwritten` |
| Groq Llama 3.3 | Context correction | Groq API (no local weights) |
| **T5** | **Not used** in this integration | — |

---

## Why scan takes 30–90+ seconds (and how to speed it up)

- **DocTR** finds text lines (fast).
- **TrOCR** runs once per line; each call is a neural net inference. More lines = more time.
- **TrOCR large** is a big model (~2.2 GB). On **CPU** it can be 5–15+ seconds per line; on **GPU** (CUDA) it’s much faster (often under 1 second per line).

**Ways to speed up:**

1. **Use a GPU** – Install PyTorch with CUDA and run the backend on a machine with an NVIDIA GPU. The backend will use `device = "cuda"` automatically if available.
2. **Fewer lines** – Crop the image to fewer lines of text before scanning.
3. **Faster machine** – Run the backend on a more powerful PC or a cloud VM with GPU.
4. **Optional: smaller TrOCR** – You could switch to a smaller TrOCR model (e.g. `microsoft/trocr-base-handwritten`) for faster but slightly less accurate results; that would require a small change in `app/main.py`.

The app shows a **“Reading your handwriting”** overlay with an estimate (30–90 seconds) so users know the wait is expected.

---

## Troubleshooting

- **“Scan failed” / network error:**  
  - Backend must be running.  
  - On a real device, use the PC’s IP and ensure phone and PC are on the same Wi‑Fi.  
  - If you use a custom port, set `EXPO_PUBLIC_API_URL` to include it (e.g. `http://192.168.1.5:8001`).

- **Backend slow:**  
  - First request loads models (DocTR + TrOCR). Later requests are faster.  
  - Using a GPU (CUDA) speeds up TrOCR; set up PyTorch with CUDA if available.

- **CORS:**  
  - FastAPI allows all origins by default. If you restrict CORS later, allow your app’s origin (e.g. `http://localhost:8081` for Expo web).

If you want, we can add T5 later as an optional step in the same backend and expose it via a separate endpoint or a flag on `/scan`.
