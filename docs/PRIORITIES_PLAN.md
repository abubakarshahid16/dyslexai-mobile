# DyslexAI – Priorities: Zero Cost, Low Latency, Single-App Experience

This doc translates your three priorities into concrete steps.

---

## 1. No extra cost

**Goal:** No paid cloud or GPU; run on your machine or use free tiers only.

| Option | What you do | Cost |
|--------|-------------|------|
| **A. All local** | Run PostgreSQL (Docker), exercise backend, and scan backend on your PC. Use **one start script** so you don’t manage 3 terminals (see §3). | **$0** (your electricity only). |
| **B. Free-tier backends** | Deploy **exercise backend + DB** to free tiers (e.g. Neon + Railway/Render free tier). Keep **scan backend local** or deploy to a free tier (e.g. Fly.io free allowance). App points to deployed URLs; you only open the app. | **$0** (within free limits). |
| **C. Hybrid** | Exercise backend + DB on free tier (so exercises work without running anything). Scan only when you run the scan backend locally (or later add a free/cheap scan API). | **$0** for exercises; scan optional. |

**Recommendation for now:** **Option A + single start script** so everything runs locally with one command and zero recurring cost. Option B/C when you want “install app and use” with no terminals.

---

## 2. Minimum latency: INT8 / ONNX (no GPU required)

**Goal:** Quantize scan-backend models to INT8 or run via ONNX so inference is faster on **CPU** (no paid GPU).

### 2.1 Where it applies

- **Scan backend** (port 8000): DocTR (line detection/recognition), TrOCR (handwriting), and any T5/LLM for correction.
- **Exercise backend** (port 8001): No heavy ML; no quantization needed.

### 2.2 Approach: ONNX + INT8 on CPU

| Step | Task |
|------|------|
| 1 | Add to `scan-backend/requirements.txt`: `optimum[onnxruntime]`, `onnxruntime` (CPU). No GPU needed. |
| 2 | **TrOCR:** Export to ONNX with `optimum-cli export onnx` (or script). Load with `ORTModelForVision2Seq`; run with `OnnxRuntime`. Optionally quantize to INT8 with `onnxruntime.quantization`. |
| 3 | **T5 (if used):** Same: export to ONNX, load with `ORTModelForSeq2SeqLM`, optionally INT8 quantize. |
| 4 | **DocTR:** Check if DocTR supports ONNX export; if not, keep PyTorch and optionally use FP16 only when GPU is present, or leave as-is for CPU. |
| 5 | Add env e.g. `USE_ONNX=true` and in model loading: if ONNX, load ONNX models; else load PyTorch. Keeps dev path unchanged. |
| 6 | Benchmark: measure time per scan (CPU, same machine) before/after ONNX and INT8. |

**Result:** Scan backend runs on your PC’s CPU with lower latency and no cloud/GPU cost. Same setup can later run on a free-tier or paid server if you add one.

### 2.3 Order of work

1. Implement ONNX export + load for TrOCR (and T5 if in pipeline).  
2. Add INT8 quantization for those ONNX models (optional but recommended).  
3. Wire `USE_ONNX` (and optional `USE_INT8`) in scan-backend startup.  
4. Document commands to export/quantize in `scan-backend/README` or this doc.

---

## 3. Accessibility: run like any other app (no “3 terminals”)

**Goal:** One action to start everything, or no terminals at all.

### 3.1 One-command local start (recommended for now)

A single script starts all services so you don’t open 3 terminals manually:

| What | How |
|------|-----|
| **One script** | Run `.\start-all.ps1` (or `npm run dev` that calls it). It starts: (1) Docker PostgreSQL, (2) exercise backend on 8001, (3) scan backend on 8000, (4) Expo. |
| **Where** | Script lives in repo root: `start-all.ps1` (Windows). Optionally add `start-all.sh` for Mac/Linux. |
| **First-time setup** | Once: create DB, run migration + seed (script can do this if Docker and venvs exist). |

**Result:** You run **one command**; after 30–60 seconds the app is reachable (e.g. via QR or tunnel). No need to remember which terminal does what.

### 3.2 “True” single-app experience (no terminals at all)

To use the app like any other installed app:

| Step | Task |
|------|------|
| 1 | Deploy **exercise backend + PostgreSQL** to free tiers (Neon + Railway/Render/Fly.io). |
| 2 | (Optional) Deploy **scan backend** to a free tier or keep it local for when you need scan. |
| 3 | Build the app with **EAS** and set production API URLs in EAS env. |
| 4 | Install the built app on the device (or use Expo Go with a published URL). |

**Result:** User installs the app and opens it; no terminals, no “start backend.” Everything works as long as the free-tier backends are up.

---

## Summary: what to do in order

1. **Single-command start (accessibility)**  
   - Add `start-all.ps1` (and optionally `start-all.sh`) that starts DB, exercise backend, scan backend, and Expo.  
   - Document: “To run the full app locally, execute `.\start-all.ps1` once.”

2. **INT8 / ONNX (latency, zero cost)**  
   - In scan-backend: add ONNX export + ONNX Runtime for TrOCR (and T5 if used).  
   - Add optional INT8 quantization for those models.  
   - Use CPU only; no GPU or cloud cost.

3. **No extra cost**  
   - Stay local with the one script; or when ready, move exercise backend + DB to free tiers so the app can run without any local terminals.

---

## Checklist

- [x] **start-all.ps1** and **start-all.sh**: start Docker DB, exercise backend, scan backend, Expo.
- [x] **Scan-backend:** ONNX load for TrOCR and T5 (Optimum); `USE_ONNX=1` env; fallback to PyTorch if ONNX fails.
- [x] **INT8:** T5 via `scripts/export_quantize_onnx.py`; DocTR via PyTorch quantize_dynamic on CPU. TrOCR INT8 skipped for now. `USE_INT8=1` to use.
- [x] **Docs:** RUN_COMMANDS.md has one-command start (`.\start-all.ps1`).
- [ ] (Later) Deploy exercise backend + DB to free tier; EAS build with production URLs for “install and use.”
