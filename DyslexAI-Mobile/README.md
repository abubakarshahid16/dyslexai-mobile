# DyslexAI Mobile

React Native (Expo) app for DyslexAI: scan handwritten text, get OCR and corrected text, practice with exercises, and save scans to My Library. The app talks to a **Python backend** (DocTR + TrOCR + optional Groq) for handwriting recognition and correction.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | LTS (v18 or v20). [Download](https://nodejs.org/) |
| **npm** | Comes with Node.js |
| **Python** | 3.8+ (for backend). [Download](https://www.python.org/downloads/) |
| **Expo Go** | On your phone (App Store / Play Store), or use an emulator |
| **Optional** | NVIDIA GPU + CUDA for faster backend; [Groq](https://console.groq.com) API key for grammar correction |

Project layout (repo root):

```
MCP_Stitch/
├── DyslexAI-Mobile/    ← this app
├── scan-backend/       ← Python API (required for Scan & Correct)
└── INTEGRATION_GUIDE.md
```

---

## 1. Backend setup and run

The backend runs DocTR (line detection) and TrOCR (handwriting recognition). First run downloads models (~2.2 GB for TrOCR).

### 1.1 Open backend folder and create venv

```bash
cd scan-backend
python -m venv venv
```

### 1.2 Activate virtual environment

**Windows (PowerShell or CMD):**
```bash
venv\Scripts\activate
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

### 1.3 Install dependencies

```bash
pip install -r requirements.txt
```

*(First run downloads DocTR and TrOCR weights; this can take several minutes.)*

### 1.4 (Optional) Enable Groq correction

For grammar/context correction via Groq Llama 3.3:

**Windows:**
```bash
set GROQ_API_KEY=your_groq_api_key_here
```

**macOS / Linux:**
```bash
export GROQ_API_KEY=your_groq_api_key_here
```

### 1.5 Start the API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- `--host 0.0.0.0` lets your phone on the same Wi‑Fi reach the backend.
- Leave this terminal open while using the app.

### 1.6 Check backend is running

Open in a browser: **http://localhost:8000/health**

You should see something like: `{"status":"ok","device":"cpu"}` (or `"cuda"` if GPU is available).

---

## 2. Mobile app setup and run

### 2.1 Install dependencies

From the **repo root** (e.g. `MCP_Stitch`), then:

```bash
cd DyslexAI-Mobile
npm install
```

If you see dependency/peer conflicts, try:

```bash
npx expo install --fix
```

### 2.2 Set the backend URL

The app calls the backend using **`API_BASE_URL`** in `src/constants/config.ts`. It also reads `EXPO_PUBLIC_API_URL` from the environment.

| How you run the app | URL to use |
|---------------------|------------|
| **Physical device (same Wi‑Fi as PC)** | Your PC’s IP, e.g. `http://192.168.1.12:8000` |
| **Android emulator** | `http://10.0.2.2:8000` |
| **Web / same machine** | `http://localhost:8000` |

**Option A – Edit `src/constants/config.ts`**

Set the default inside the file, e.g.:

```ts
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.12:8000';
```

**Option B – Use environment variable (no code change)**

In `DyslexAI-Mobile`, create or edit `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.12:8000
```

Replace with your PC’s IP if using a physical device. Restart Expo after changing `.env`.

**Finding your PC IP (for physical device):**

- **Windows:** `ipconfig` → look for IPv4 (e.g. 192.168.1.12).
- **macOS/Linux:** `ifconfig` or `ip addr` → look for your LAN address.

### 2.3 Start the app

```bash
cd DyslexAI-Mobile
npx expo start
```

- Scan the QR code with **Expo Go** (Android) or the **Camera** app (iOS), or  
- Press **`a`** for Android emulator / **`i`** for iOS simulator.

### 2.4 Test Scan & Correct

1. Open the app → sign up / in if needed → go to **Upload** (or Scan Text from Dashboard).
2. Pick an image (camera or gallery) and tap **Scan & Correct**.
3. Wait for the “Reading your handwriting” overlay (first scan can take 30–90 seconds on CPU).
4. You should see **Scan Results** with raw and corrected text and lines.

---

## 3. Quick checklist

| Step | Command / action |
|------|-------------------|
| 1 | `cd scan-backend` → `python -m venv venv` → activate venv |
| 2 | `pip install -r requirements.txt` |
| 3 | (Optional) Set `GROQ_API_KEY` |
| 4 | `uvicorn app.main:app --host 0.0.0.0 --port 8000` — leave running |
| 5 | `cd DyslexAI-Mobile` → `npm install` |
| 6 | Set backend URL in `src/constants/config.ts` or `.env` (e.g. PC IP for physical device) |
| 7 | `npx expo start` → open in Expo Go or emulator |

---

## 4. Tech stack

| Part | Stack |
|------|--------|
| **App** | Expo ~54, React Native 0.81, TypeScript, React Navigation |
| **Backend** | FastAPI, DocTR, TrOCR (microsoft/trocr-large-handwritten), optional Groq |
| **Storage** | AsyncStorage (My Library) |

---

## 5. Screens

- **Landing / Auth** – Sign up, sign in
- **Dashboard** – Scan Text, Daily Exercises, My Library, Recent Progress
- **Upload** – Camera or gallery → **Scan & Correct** → calls backend `POST /scan`
- **Scan Results** – Image, raw/corrected text, per-line list; Save to Library, Practice, Rescan
- **Learning Exercises** – Progress, modules (Letter Matching, Phonics Fun, etc.)
- **My Library** – Saved scans; tap to open, delete with confirmation, pull to refresh

---

## 6. Troubleshooting

- **“Scan failed” / network error**  
  - Backend must be running (`http://localhost:8000/health` returns OK).  
  - On a **physical device**, use your PC’s IP in `API_BASE_URL` and ensure phone and PC are on the same Wi‑Fi.  
  - Backend must be started with `--host 0.0.0.0`.

- **Scan is very slow**  
  - First request loads models; later ones are faster.  
  - On CPU, expect ~30–90 seconds per scan; using a GPU (CUDA) speeds it up a lot.  
  - See **INTEGRATION_GUIDE.md** (repo root) for “Why scan takes 30–90+ seconds” and optimization tips.

- **Expo / dependency errors**  
  - Run `npx expo install --fix` in `DyslexAI-Mobile`.  
  - If needed: `npm install --legacy-peer-deps`.

For more detail on API, models, and integration, see **INTEGRATION_GUIDE.md** in the repo root.
