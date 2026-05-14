# DyslexAI – Production Readiness

This doc summarizes current gaps and how to fix them. **Recommendation: finish features first (TASKS_ORDER.md), then do a dedicated production pass.**

**For a step-by-step plan (including model quantization and async scan), see [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md).**

---

## Current gaps

| Gap | Why it matters |
|-----|----------------|
| **Models run on your machine** | Not scalable; only works when your PC is on and reachable; no redundancy. |
| **Pipeline takes minutes** | Poor UX; users expect results in seconds. |
| **App runs via QR code (Expo Go)** | Dev workflow only; real users need a standalone app or web build. |
| **Network/config** | Emulator vs device IP, firewall; fine for dev, brittle for production. |

---

## How to fix each

### 1. Models no longer on “your machine” (backend in the cloud)

- **Deploy the scan backend to a cloud server with GPU** so DocTR, TrOCR, and T5 run there.
- **Options:**
  - **VPS/VM with GPU** (e.g. AWS EC2, GCP, Azure, Lambda Labs, RunPod): install Python, run `uvicorn` (or gunicorn + uvicorn), point domain to it.
  - **Serverless GPU** (e.g. **Modal**, **Replicate**): run the pipeline as a function; they handle scaling and GPU. You may need to adapt the pipeline to their APIs.
  - **Managed ML** (if you ever replace models): e.g. use an OCR API + your T5/LLM elsewhere; less control, simpler ops.
- **Result:** Mobile app talks to a **stable URL** (e.g. `https://api.dyslexai.com`), not your laptop. No QR needed for *backend*; QR is about how the **app** is run (see below).

### 2. Pipeline takes minutes (speed)

- **Use a GPU** in the cloud (same as above). GPU greatly speeds up DocTR, TrOCR, and T5.
- **Quantization (better latency):** Run models in **FP16** on GPU (quick win); then **int8** or **ONNX** for TrOCR and T5. See [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md#phase-1-model-quantization-better-latency).
- **Other optimizations:**
  - **Smaller models:** e.g. TrOCR-base instead of large; smaller T5 if accuracy is acceptable.
  - **Async flow:** upload image → return `job_id` immediately → process in background → app polls or uses push for result. UX: “We’re processing…” then “Done.” No need to keep the request open for minutes.
- **Quick win:** Moving to a GPU server alone will cut time a lot (often 2–5×). Async + smaller/quantized models can get you toward “tens of seconds” instead of minutes.

### 3. No QR code / “real” app for users

- **Expo QR code** is only for **development** (Expo Go). For production you don’t rely on it.
- **Options:**
  - **Standalone mobile app (recommended for “app”):**
    - Use **EAS Build** (Expo Application Services): build `.apk` / `.aab` (Android) and `.ipa` (iOS). Users install from the store or a download link; no QR.
    - Configure `app.json`/`app.config.*` with your production API URL and build with EAS.
  - **Web app:**
    - Run `expo export:web` and host the output (e.g. Netlify, Vercel, GitHub Pages). Users open a URL in the browser; no install, no QR.
  - **Internal/testing:** You can use a tunnel (e.g. `ngrok`) and open the tunnel URL on the device, but that’s not production.
- **Result:** “Production” = either a **store/downloadable app** or a **web URL**; no dependency on scanning a dev QR.

### 4. Network and config

- **Production:** One backend URL (e.g. `https://api.dyslexai.com`). App is built with that URL (or reads it from config). No per-device or emulator IPs.
- **Dev:** Keep using `.env` with emulator IP (e.g. `10.0.2.2`) or your PC IP for physical devices, as in NETWORK_FIX.md.

---

## Should this be done now or after features?

**Recommendation: after all planned features are added.**

| Do first | Why |
|----------|-----|
| **Features (TASKS_ORDER.md)** | So you productionize the **final** product once. Deploying and re-deploying after every feature change is costly and distracting. |
| **Then production pass** | Deploy backend to cloud GPU, add async scan if needed, build with EAS (or web), set production API URL, then test and release. |

**Exceptions (can do during feature work):**

- **Async scan (upload → job_id → poll result):** Improves UX now and fits production later. Can be added when you work on “Fix the LLM” or “Dashboard” if you want the app to feel responsive during long runs.
- **Backend URL in one place:** Already you have `.env`; for production you’ll point that to the cloud URL. No need to wait.

---

## Suggested production order (after tasks 1–5)

1. **Quantize models** (FP16, then optional int8/ONNX for TrOCR and T5) for better latency — see [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md).
2. **Deploy scan backend** to a GPU server; set a stable API URL.
3. **Optional:** Add async scan (job queue + poll) so the app doesn’t block for minutes.
4. **Deploy exercise backend** (PostgreSQL + API) to cloud.
5. **Build the app:** EAS Build for iOS/Android and/or `expo export:web`; configure production API URL.
6. **Point app to production URL** and test end-to-end.
7. **Harden:** HTTPS, rate limiting, auth, monitoring, backups.

For detailed steps and a full checklist, see **[PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md)**.
