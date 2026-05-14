# DyslexAI – Intended Pipeline & Task Order

## Intended correction pipeline

The scan/correction flow is meant to run in this order:

1. **DocTR** – line detection (find text regions)
2. **TrOCR** – handwritten text recognition per line
3. **T5** – correction model (to be added; user will provide the model)
4. **LLM** – context/spelling/grammar correction (e.g. Groq/Llama)

Current backend: DocTR → TrOCR → **T5** (vennify/t5-base-grammar-correction) → [optional Groq].

---

## Tasks (in order)

| # | Task | Status |
|---|------|--------|
| 1 | **Add T5 to the correction module** | Done (using vennify/t5-base-grammar-correction) |
| 2 | **Fix the LLM** | Done (verified; empty-response guard added) |
| 3 | **Fix the network issue** | Done (Dashboard backend status + NETWORK_FIX.md) |
| 4 | **Dashboard** | Pending |
| 5 | **Error Highlighting** | Done (image overlay with error regions from backend) |

Work through these in order: 1 → 2 → 3 → 4 → 5.
