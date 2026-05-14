"""
DyslexAI Backend API
- DocTR: line detection
- TrOCR: handwritten text recognition per line
- T5: grammar/spelling correction (vennify/t5-base-grammar-correction)
- Groq (optional): context correction (LLM)

Set USE_ONNX=1 to use ONNX Runtime (CPU) for TrOCR and T5.
Set USE_INT8=1 to use INT8-quantized ONNX (run scripts/export_quantize_onnx.py once first) and DocTR INT8 on CPU.
"""
import os
import re
import difflib
from collections import Counter
from statistics import median
from typing import Optional

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from doctr.models import ocr_predictor
from transformers import TrOCRProcessor, VisionEncoderDecoderModel, T5Tokenizer, T5ForConditionalGeneration, AutoTokenizer, AutoModelForSeq2SeqLM

# Optional: Groq for context correction (set GROQ_API_KEY in env to enable)
GROQ_API_KEY: Optional[str] = None
try:
    from groq import Groq
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
except ImportError:
    pass

from app.auth_db import init_auth_db
from app.auth_routes import router as auth_router

app = FastAPI(title="DyslexAI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)

# T5 grammar correction model (suitable for OCR + dyslexic text: grammar & spelling)
T5_PREFIX = "correct dyslexia: "
T5_MAX_INPUT_LENGTH = 256  # tokens per chunk to stay under 512

DEFAULT_T5_PATHS = [
    os.getenv("DYSLEXAI_T5_MODEL_PATH"),
    "DyslexAI_Model_Unzipped",
    "DyslexAI_Best_Model (1)",
    "DyslexAI_Best_Best_Model_unzipped",
    "../DyslexAI/dyslexia-backend/DyslexAI_Model_Unzipped",
]
T5_MAX_INPUT_LENGTH = 256  # tokens per chunk to stay under 512

# Global model refs (loaded once at startup)
detection_model = None
trocr_processor = None
trocr_model = None
t5_tokenizer = None
t5_model = None
device = "cpu"
use_onnx = False
use_int8 = False

# Path to quantized ONNX models (run scripts/export_quantize_onnx.py once)
_SCAN_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_QUANT_TROCR_DIR = os.path.join(_SCAN_BACKEND_ROOT, "models_quantized", "trocr_int8")
_QUANT_T5_DIR = os.path.join(_SCAN_BACKEND_ROOT, "models_quantized", "t5_int8")


def _use_onnx() -> bool:
    return os.environ.get("USE_ONNX", "").strip().lower() in ("1", "true", "yes")


def _use_int8() -> bool:
    return os.environ.get("USE_INT8", "").strip().lower() in ("1", "true", "yes")


@app.on_event("startup")
async def load_models():
    init_auth_db()
    global detection_model, trocr_processor, trocr_model, t5_tokenizer, t5_model, device, use_onnx, use_int8
    use_onnx = _use_onnx()
    use_int8 = _use_int8()
    if use_int8:
        use_onnx = True  # INT8 implies ONNX
    device = "cuda" if (torch.cuda.is_available() and not use_onnx) else "cpu"
    print(f"Using device: {device}" + (" (ONNX" + (" INT8" if use_int8 else "") + " for TrOCR/T5)" if use_onnx else ""))

    print("Loading DocTR (line detection)...")
    detection_model = ocr_predictor(pretrained=True).to(device).eval()
    if device == "cpu" and use_int8:
        try:
            import torch.ao.quantization as quantization
            # Dynamic INT8 for Linear layers (works on DocTR's internal modules)
            detection_model = quantization.quantize_dynamic(
                detection_model, {torch.nn.Linear}, dtype=torch.qint8
            )
            print("  DocTR: INT8 dynamic quantization applied")
        except Exception as e:
            print("  DocTR INT8 skipped:", e)

    if use_onnx:
        try:
            from optimum.onnxruntime import ORTModelForVision2Seq, ORTModelForSeq2SeqLM
            # Prefer INT8-quantized ONNX if available
            if use_int8 and os.path.isdir(_QUANT_TROCR_DIR) and os.path.isdir(_QUANT_T5_DIR):
                print("Loading TrOCR (ONNX INT8)...")
                trocr_processor = TrOCRProcessor.from_pretrained(_QUANT_TROCR_DIR)
                trocr_model = ORTModelForVision2Seq.from_pretrained(_QUANT_TROCR_DIR)
                print("Loading T5 (ONNX INT8)...")
                t5_tokenizer = T5Tokenizer.from_pretrained(_QUANT_T5_DIR)
                t5_model = ORTModelForSeq2SeqLM.from_pretrained(_QUANT_T5_DIR)
            else:
                if use_int8 and (not os.path.isdir(_QUANT_TROCR_DIR) or not os.path.isdir(_QUANT_T5_DIR)):
                    print("INT8 dirs not found; run: python scripts/export_quantize_onnx.py")
                print("Loading TrOCR (ONNX FP32)...")
                trocr_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-large-handwritten")
                trocr_model = ORTModelForVision2Seq.from_pretrained(
                    "microsoft/trocr-large-handwritten",
                    from_transformers=True,
                )
                print("Loading T5 (ONNX FP32)...")
                t5_tokenizer = T5Tokenizer.from_pretrained(T5_MODEL_NAME)
                t5_model = ORTModelForSeq2SeqLM.from_pretrained(T5_MODEL_NAME, export=True)
        except Exception as e:
            print("ONNX load failed, falling back to PyTorch:", e)
            use_onnx = False
            use_int8 = False
            device = "cuda" if torch.cuda.is_available() else "cpu"

    if not use_onnx:
        print("Loading TrOCR large handwritten (PyTorch)...")
        trocr_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-large-handwritten")
        trocr_model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-large-handwritten").to(device).eval()
        
        print("Loading T5 dyslexia correction (PyTorch)...")
        loaded_custom_t5 = False
        for path in DEFAULT_T5_PATHS:
            if path and os.path.isdir(path):
                try:
                    print(f"Loading custom T5 from {path}...")
                    t5_tokenizer = AutoTokenizer.from_pretrained(path)
                    t5_model = AutoModelForSeq2SeqLM.from_pretrained(path).to(device).eval()
                    loaded_custom_t5 = True
                    break
                except Exception as e:
                    print(f"Failed to load custom T5 from {path}: {e}")
        
        if not loaded_custom_t5:
            print("Falling back to vennify/t5-base-grammar-correction...")
            t5_tokenizer = T5Tokenizer.from_pretrained("vennify/t5-base-grammar-correction")
            t5_model = T5ForConditionalGeneration.from_pretrained("vennify/t5-base-grammar-correction").to(device).eval()
            global T5_PREFIX
            T5_PREFIX = "grammar: "

    print("Backend ready. Groq:", "enabled" if GROQ_API_KEY else "disabled")


def run_ocr(image_bytes: bytes) -> tuple[list[dict], str]:
    """Run DocTR line detection + TrOCR per line. Returns (lines, paragraph)."""
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    img_gray_rgb = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2RGB)
    height, width = img_rgb.shape[:2]

    result = detection_model([img_gray_rgb])
    results = []
    line_count = 0

    for page in result.pages:
        for block in page.blocks:
            for line in block.lines:
                (x0, y0), (x1, y1) = line.geometry
                x_min = max(0, int(x0 * width) - 5)
                y_min = max(0, int(y0 * height) - 5)
                x_max = min(width, int(x1 * width) + 5)
                y_max = min(height, int(y1 * height) + 5)

                crop = img_gray_rgb[y_min:y_max, x_min:x_max]
                if crop.shape[0] < 5 or crop.shape[1] < 5:
                    continue

                line_count += 1
                pixel_values = trocr_processor(images=crop, return_tensors="pt").pixel_values
                if use_onnx:
                    pixel_values = pixel_values.to("cpu")
                else:
                    pixel_values = pixel_values.to(device)
                with torch.no_grad():
                    generated_ids = trocr_model.generate(pixel_values)
                text = trocr_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                y_center = (y_min + y_max) / 2.0
                results.append({
                    "line_number": line_count,
                    "bbox": [x_min, y_min, x_max, y_max],
                    "y_center": y_center,
                    "text": text,
                })

    results_sorted = sorted(results, key=lambda r: (r["y_center"], r["bbox"][0]))
    heights = [r["bbox"][3] - r["bbox"][1] for r in results_sorted]
    if heights:
        median_h = median(heights)
        clustered = []
        current = [results_sorted[0]]
        for r in results_sorted[1:]:
            if abs(r["y_center"] - current[-1]["y_center"]) <= median_h * 0.5:
                current.append(r)
            else:
                clustered.extend(sorted(current, key=lambda x: x["bbox"][0]))
                current = [r]
        clustered.extend(sorted(current, key=lambda x: x["bbox"][0]))
        results_sorted = clustered

    paragraph = " ".join([r["text"].strip() for r in results_sorted if r["text"].strip()]).strip()
    return results_sorted, paragraph


def sanitize(text: str) -> str:
    text = text.replace(" . ", " ")
    text = re.sub(r'[^a-zA-Z0-9\s.,!?\'"-]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def strip_repeated_tail(text: str) -> str:
    """Remove trailing garbage from model output (e.g. repeated 'D.D.D' or 'L.S.O.O')."""
    if not text or len(text) < 30:
        return text
    # Look for last plausible end of sentence (letter then . or end)
    for i in range(len(text) - 1, max(0, len(text) - 80), -1):
        tail = text[i:]
        if len(tail) < 15:
            continue
        # If tail is mostly the same 1–2 chars (or a short pattern), truncate before it
        letters = [c for c in tail if c.isalnum() or c in ".,"]
        if not letters:
            continue
        counts = Counter(letters)
        most_common, cnt = counts.most_common(1)[0]
        if cnt >= len(letters) * 0.6:
            return text[:i].rstrip()
        # Check for repeated 2–3 char pattern
        for pat_len in (2, 3):
            if len(tail) < pat_len * 4:
                continue
            pattern = tail[:pat_len]
            repeats = tail.count(pattern)
            if repeats * pat_len >= len(tail) * 0.5:
                return text[:i].rstrip()
    return text


def _split_into_chunks(text: str) -> list[str]:
    """Split text into sentence-like chunks under T5 max length for grammar correction."""
    if not text.strip():
        return []
    # Split on sentence boundaries
    parts = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = []
    current_len = 0
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # Approximate token count (words * 1.3)
        approx = len(p.split()) * 2
        if current_len + approx > T5_MAX_INPUT_LENGTH and current:
            chunks.append(" ".join(current))
            current = [p]
            current_len = approx
        else:
            current.append(p)
            current_len += approx
    if current:
        chunks.append(" ".join(current))
    return chunks


def t5_correct(text: str) -> str:
    """Run T5 grammar/spelling correction. Uses vennify/t5-base-grammar-correction with 'grammar: ' prefix."""
    if not text.strip() or t5_tokenizer is None or t5_model is None:
        return text
    chunks = _split_into_chunks(text)
    if not chunks:
        return text
    t5_device = "cpu" if use_onnx else device
    corrected_parts = []
    for chunk in chunks:
        if not chunk.strip():
            continue
        input_text = T5_PREFIX + chunk
        inputs = t5_tokenizer(
            input_text,
            return_tensors="pt",
            truncation=True,
            max_length=T5_MAX_INPUT_LENGTH,
            padding=True,
        )
        inputs = {k: v.to(t5_device) for k, v in inputs.items()}
        with torch.no_grad():
            out = t5_model.generate(
                **inputs,
                max_new_tokens=min(150, inputs["input_ids"].shape[1] + 50),
                num_beams=5,
                early_stopping=True,
            )
        decoded = t5_tokenizer.decode(out[0], skip_special_tokens=True).strip()
        corrected_parts.append(decoded)
    return " ".join(corrected_parts).strip() if corrected_parts else text


def groq_correct(text: str) -> str:
    if not GROQ_API_KEY or not text.strip():
        return text
    try:
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    "You are an expert English Editor specializing in fixing OCR errors and dyslexic text.\n"
                    "Your Task:\n"
                    "1. Fix spelling and grammatical errors based on context.\n"
                    "2. Specifically look for historical or proper noun errors (e.g., \"13 Stakes\" -> \"13 States\", \"Nklymuh\" -> \"Nkrumah\").\n"
                    "3. Do NOT add conversational filler. Output ONLY the corrected text."
                )},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        out = (completion.choices[0].message.content or "").strip()
        return out if out else text
    except Exception as e:
        print("Groq error:", e)
        return text


def _normalize_for_compare(s: str) -> str:
    """Normalize text for equality check (ignore case and extra spaces)."""
    return " ".join(s.lower().split()).strip()


def _words_only(s: str) -> list[str]:
    """Extract words (letters only, lowercase) for meaningful-diff check."""
    return re.findall(r"[a-z]+", s.lower())


def _line_has_real_correction(original: str, corrected: str) -> bool:
    """True only if at least one word from the original was corrected away (replaced or removed).
    Avoids highlighting when T5 only changes punctuation, spacing, or rephrases without fixing errors.
    """
    a = set(_words_only(original))
    b = set(_words_only(corrected))
    if not a:
        return False
    # Highlight only when a word from the original is missing in corrected (was corrected/replaced)
    words_corrected_away = a - b
    return len(words_corrected_away) > 0


def _map_corrected_to_lines(lines: list[dict], corrected_text: str) -> list[str]:
    """
    Map paragraph-level corrected text back to per-line corrected slices using proportional word counts.
    This avoids running T5 per line and keeps error_regions aligned with the single corrected_text.
    Returns a list of corrected strings, one per line (same length as lines).
    """
    corrected_words = corrected_text.split()
    if not corrected_words:
        return [""] * len(lines)

    line_word_counts = []
    for r in lines:
        t = (r.get("text") or "").strip()
        line_word_counts.append(len(t.split()) if t else 0)

    total_original = sum(line_word_counts)
    if total_original == 0:
        return [""] * len(lines)

    n_words = len(corrected_words)
    # Cumulative word indices so we assign all corrected words across lines
    cumul = [0]
    for count in line_word_counts:
        if count == 0:
            cumul.append(cumul[-1])
        else:
            next_idx = cumul[-1] + max(1, round(n_words * count / total_original))
            cumul.append(min(next_idx, n_words))
    cumul[-1] = n_words  # last line gets any remainder

    result = []
    for i, count in enumerate(line_word_counts):
        if count == 0:
            result.append("")
            continue
        start, end = cumul[i], cumul[i + 1]
        if start >= end:
            result.append("")
            continue
        result.append(" ".join(corrected_words[start:end]))

    return result


def _similarity(a: str, b: str) -> float:
    if not a and not b: return 1.0
    if not a or not b: return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def _has_repetition(text: str) -> bool:
    words = (text or "").split()
    for n in range(4, min(12, len(words) // 2 + 1)):
        for i in range(len(words) - n):
            phrase = " ".join(words[i : i + n])
            if phrase and (text or "").count(phrase) >= 2:
                return True
    return False


def _has_echo_or_prompt_leakage(text: str) -> bool:
    lower = (text or "").lower()
    if lower.startswith("repair ocr noise") or lower.startswith("correct ocr"):
        return True
    if lower.count("repair ocr noise") >= 2 or lower.count("the paragraph:") >= 2:
        return True
    return False


def acceptance_gate(raw: str, previous: str, corrected: str) -> tuple[bool, str]:
    if not corrected or not corrected.strip():
        return False, "empty"
    if _has_repetition(corrected):
        return False, "repetition"
    if _has_echo_or_prompt_leakage(corrected):
        return False, "echo_or_prompt_leakage"
    sim_raw_prev = _similarity(raw or "", previous or "")
    sim_raw_corr = _similarity(raw or "", corrected)
    if sim_raw_corr < sim_raw_prev - 0.05:
        return False, "lower_similarity_to_raw"
    if sim_raw_corr < 0.5 and (raw or "").strip():
        return False, "similarity_to_raw_too_low"
    return True, "ok"


@app.post("/scan")
async def scan_image(file: UploadFile = File(...)):
    """Upload a handwriting image; returns raw OCR, T5-corrected, LLM-corrected text, and error regions for highlighting."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(400, "Empty file")

    img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not decode image")
    image_height, image_width = img.shape[:2]

    try:
        lines, raw_paragraph = run_ocr(contents)
    except Exception as e:
        raise HTTPException(500, f"OCR failed: {str(e)}")

    # Full pipeline for final corrected text (T5 then LLM once) with Notebook gates
    cleaned = sanitize(raw_paragraph)
    
    t5_corrected = t5_correct(cleaned)
    ok2, _ = acceptance_gate(raw_paragraph, cleaned, t5_corrected)
    t5_final = t5_corrected if ok2 else cleaned
    
    if GROQ_API_KEY:
        groq_corrected = groq_correct(t5_final)
        ok3, _ = acceptance_gate(raw_paragraph, t5_final, groq_corrected)
        corrected = groq_corrected if ok3 else t5_final
    else:
        corrected = t5_final
        
    corrected = strip_repeated_tail(corrected)

    # Error regions from single paragraph-level correction: map corrected text back to lines
    corrected_per_line = _map_corrected_to_lines(lines, corrected)
    error_regions = []
    for r, line_corrected in zip(lines, corrected_per_line):
        line_text = r["text"].strip()
        if not line_text:
            continue
        if _line_has_real_correction(line_text, line_corrected):
            x_min, y_min, x_max, y_max = r["bbox"]
            error_regions.append({
                "bbox": [x_min, y_min, x_max, y_max],
                "original": line_text,
                "corrected": line_corrected,
            })

    return {
        "raw_text": raw_paragraph,
        "cleaned_text": cleaned,
        "t5_corrected_text": t5_corrected,
        "corrected_text": corrected,
        "line_count": len(lines),
        "lines": [{"line_number": r["line_number"], "text": r["text"]} for r in lines],
        "image_width": image_width,
        "image_height": image_height,
        "error_regions": error_regions,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "device": device, "use_onnx": use_onnx, "use_int8": use_int8}
