# DyslexAI – Detailed Production Plan

This document expands [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) with a step-by-step plan for productionizing the app, including **model quantization** for better latency.

---

## Overview

| Area | Goal |
|------|------|
| **Scan backend** | Deploy to cloud GPU; quantize models; optional async scan |
| **Exercise backend** | Deploy to cloud (PostgreSQL + API); no heavy ML |
| **Mobile app** | Build with EAS (Android/iOS) and/or export for web; single production API URL |
| **Ops** | HTTPS, env-based config, rate limiting, basic monitoring |

---

## Phase 1: Model quantization (better latency)

Quantization reduces model size and speeds up inference (often 1.5–3× with small accuracy trade-off). Do this **before** or **in parallel with** cloud deployment so you deploy already-optimized models.

### 1.1 Current models (scan-backend)

| Component | Model | Framework | Quantization options |
|----------|--------|-----------|----------------------|
| Line detection + recognition | DocTR `ocr_predictor` | PyTorch | FP16; optional ONNX export if supported |
| Handwriting OCR | TrOCR `microsoft/trocr-large-handwritten` | Hugging Face (PyTorch) | **INT8 (dynamic/static)** or **ONNX** |
| Grammar correction | T5 `vennify/t5-base-grammar-correction` | Hugging Face (PyTorch) | **INT8** or **ONNX** |

### 1.2 Quantization strategy

**Option A – PyTorch native (fastest to implement)**

- **TrOCR & T5:** Use `torch.quantization` or Hugging Face `bitsandbytes` (int8) / Optimum.
  - **Dynamic int8:** Easiest; no calibration. In Transformers: load with `load_in_8bit=True` (requires `bitsandbytes`) or use Optimum’s `ORTModelForCausalLM` / encoder-decoder equivalents with quantized ONNX.
  - **Static int8:** Better speed/memory; requires calibration data (e.g. a few dozen sample images/texts). Use `torch.ao.quantization` or Optimum.
- **DocTR:** Keep FP32/FP16 unless DocTR exposes quantized variants or ONNX; first win is **FP16** on GPU (`model.half()`).

**Option B – ONNX Runtime (often best latency)**

- Export TrOCR and T5 to ONNX (e.g. via `optimum` CLI or `transformers.onnx`), then run with **ONNX Runtime** and optional **quantization (int8)**.
- Benefits: Often 20–40% faster inference, portable, and ONNX Runtime has good GPU support.

**Recommended order**

1. **Quick win:** Run TrOCR and T5 in **FP16** on GPU (`model.half()`) — minimal code change, good speedup.
2. **TrOCR:** Add **dynamic int8** via Optimum (e.g. `OrtModelForVision2Seq`) or export to ONNX and quantize with `onnxruntime.quantization`.
3. **T5:** Same as TrOCR — Optimum ONNX + int8 or Hugging Face `bitsandbytes` load_in_8bit if acceptable for your deployment.
4. **DocTR:** FP16 only unless you find/official DocTR quantized/ONNX support.

### 1.3 Implementation steps (quantization)

| Step | Task | Notes |
|------|------|--------|
| 1 | Add `accelerate`, `bitsandbytes`, and/or `optimum[onnxruntime-gpu]` to scan-backend `requirements.txt` | Choose one path: Optimum ONNX vs bitsandbytes |
| 2 | Implement FP16: after loading TrOCR and T5, call `.half()` and run inputs in half precision on GPU | Guard with `if device == "cuda"` |
| 3 | (Optional) Replace TrOCR with Optimum ONNX + int8: export once, load `OrtModelForVision2Seq` with quantized session | Use a separate script to export/quantize; main app loads ONNX |
| 4 | (Optional) Replace T5 with Optimum ONNX + int8: same idea; `OrtModelForSeq2SeqLM` | Reduces T5 latency noticeably |
| 5 | Add env flag e.g. `USE_QUANTIZED_MODELS=true` and branch in `load_models()` to load quantized vs FP32 | Keeps dev flexibility |
| 6 | Benchmark: measure time per scan (DocTR + TrOCR + T5) before/after on same GPU | Document in README or PRODUCTION_PLAN |

### 1.4 DocTR note

DocTR’s `ocr_predictor` may bundle detection + recognition. If you only need **line detection** and use TrOCR for recognition, ensure you use the lightest DocTR config (e.g. detection-only if available). FP16 for DocTR is the safest first step.

---

## Phase 2: Deploy scan backend to cloud (GPU)

### 2.1 Infrastructure choice

| Option | Pros | Cons |
|--------|------|------|
| **VPS/VM with GPU** (e.g. AWS EC2, GCP, Azure, Lambda Labs, RunPod) | Full control; same code as local; easy to add quantization | You manage OS, CUDA, security |
| **Serverless GPU** (Modal, Replicate, RunPod Serverless) | Auto-scale; pay per run | May require adapting pipeline to their APIs; cold starts |
| **Managed container** (e.g. AWS ECS with GPU, GCP Cloud Run with GPU) | Middle ground; containerized | More setup than VM |

**Suggested for FYP:** Single **GPU VM** (e.g. Lambda Labs, RunPod, or AWS EC2 with GPU instance) to keep the current FastAPI app as-is; later you can add async jobs.

### 2.2 Deployment steps

| Step | Task |
|------|------|
| 1 | Provision a GPU server (Ubuntu 22.04 or similar); install CUDA, Python 3.11+, Docker (optional). |
| 2 | Clone repo; create venv; install dependencies (including quantization deps if used). |
| 3 | Set env: `GROQ_API_KEY`, `DATABASE_URL` (if any), `USE_QUANTIZED_MODELS`, etc. |
| 4 | Run with **gunicorn + uvicorn** for production: e.g. `gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000` (1 worker if GPU memory is tight). |
| 5 | Put a **reverse proxy** (Nginx or Caddy) in front; terminate **HTTPS**; optional basic auth or rate limit. |
| 6 | Reserve a domain or subdomain (e.g. `api.dyslexai.com`); point DNS to server IP. |
| 7 | Open firewall for 80/443 only; keep 8000 bound to localhost or internal. |

### 2.3 Async scan (optional but recommended)

To avoid long-lived HTTP requests (minutes):

| Step | Task |
|------|------|
| 1 | Add a **job store**: e.g. Redis or SQLite/PostgreSQL table (`job_id`, `status`, `result`, `created_at`). |
| 2 | `POST /scan` → save upload to temp or object storage; create job with `status=pending`; return `{ "job_id": "..." }`. |
| 3 | Background worker (same process with asyncio or Celery/Redis) runs DocTR → TrOCR → T5 → Groq; writes result to job store. |
| 4 | `GET /scan/result/{job_id}` → return status and, when done, full scan result. |
| 5 | App: after upload, show “Processing…” and poll `GET /scan/result/{job_id}` until complete, then show result. |

---

## Phase 3: Deploy exercise backend to cloud

### 3.1 Components

- **PostgreSQL:** Managed (e.g. AWS RDS, Supabase, Neon) or self-hosted on same/different server.
- **API:** FastAPI app (no heavy ML); can run on a **small CPU-only** VM or container.

### 3.2 Deployment steps

| Step | Task |
|------|------|
| 1 | Create PostgreSQL instance; set `DATABASE_URL` (e.g. `postgresql://user:pass@host:5432/dyslexia_db`). |
| 2 | Deploy dyslexia-backend (clone, venv, install deps); run migrations/create tables; run seed if needed. |
| 3 | Run with gunicorn + uvicorn on port 8001 (or 443 via reverse proxy path, e.g. `/exercise-api`). |
| 4 | HTTPS and domain, e.g. `exercises.dyslexai.com` or same domain with path. |

---

## Phase 4: Production app build and config

### 4.1 Single production API URL

- **Scan API:** `https://api.dyslexai.com` (or your chosen host).
- **Exercise API:** `https://exercises.dyslexai.com` or `https://api.dyslexai.com/exercise` (path-based).

App already reads from env: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_EXERCISE_API_URL`. For production builds you set these at **build time** (EAS env or `app.config.js`).

### 4.2 EAS Build (standalone mobile app)

| Step | Task |
|------|------|
| 1 | Install EAS CLI: `npm i -g eas-cli`; log in: `eas login`. |
| 2 | In `DyslexAI-Mobile`, run `eas build:configure`; adjust `app.json` / `app.config.js` (name, slug, bundle IDs). |
| 3 | Add **EAS environment variables** for production profile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_EXERCISE_API_URL` (production URLs). |
| 4 | Build: `eas build --platform android --profile production` (and iOS if needed). |
| 5 | Submit to stores or distribute via download link (e.g. internal testing). |

### 4.3 Web export (optional)

| Step | Task |
|------|------|
| 1 | Ensure all API calls and storage work in web (e.g. no native-only APIs without guards). |
| 2 | Run `npx expo export:web`; host the output on Netlify, Vercel, or GitHub Pages. |
| 3 | Set production API URLs via env at build time for web. |

---

## Phase 5: Harden and operate

| Step | Task |
|------|------|
| 1 | **HTTPS only** for all backends and app (EAS/web). |
| 2 | **Rate limiting:** e.g. FastAPI middleware or Nginx limit_req on `/scan` and `/auth/login` to avoid abuse. |
| 3 | **Auth:** Scan backend already has JWT; ensure tokens have expiry and exercise backend accepts or mirrors auth if needed. |
| 4 | **Secrets:** No keys in repo; use env or secret manager on the server and in EAS. |
| 5 | **Monitoring:** Log errors and optionally expose `/health`; optional uptime checks (e.g. UptimeRobot) on scan and exercise APIs. |
| 6 | **Backups:** Regular PostgreSQL backups for exercise backend; any user data in scan backend (e.g. job store) backed up if persistent. |

---

## Suggested execution order

1. **Quantization (Phase 1):** FP16 + optional int8/ONNX for TrOCR and T5; benchmark.
2. **Scan backend (Phase 2):** Deploy to GPU server with quantized/FP16 models; add HTTPS and domain.
3. **Async scan (Phase 2.3):** Implement job queue + poll so the app doesn’t block for minutes.
4. **Exercise backend (Phase 3):** Deploy with managed or self-hosted PostgreSQL.
5. **App (Phase 4):** Set production URLs; EAS Build for Android (and iOS); test end-to-end.
6. **Harden (Phase 5):** Rate limiting, monitoring, backups.

---

## Checklist summary

- [ ] **Quantization:** FP16 for TrOCR/T5 (and DocTR if GPU); optional int8/ONNX for TrOCR and T5.
- [ ] **Scan backend:** GPU server, gunicorn+uvicorn, reverse proxy, HTTPS, domain.
- [ ] **Async scan:** Job store, POST returns job_id, GET result, app polls.
- [ ] **Exercise backend:** PostgreSQL + API on CPU server, HTTPS, domain.
- [ ] **App:** Production API URLs in env; EAS Build (and/or web); no QR dependency.
- [ ] **Ops:** Rate limiting, health checks, backups, secrets from env.

This plan keeps feature work separate from production work and adds explicit model quantization steps for better latency before and after deployment.
