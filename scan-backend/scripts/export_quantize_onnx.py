"""
Export T5 to ONNX and apply INT8 dynamic quantization.
TrOCR INT8 is skipped for now (export/quantize is memory-heavy).
Run once from scan-backend with venv active:
  python scripts/export_quantize_onnx.py

Output: models_quantized/t5_int8/
Set USE_INT8=1 when starting the server to use T5 INT8 and DocTR INT8.
"""
import os
import sys
import shutil

# Add parent so we can import app constants
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models_quantized")
# Use TROCR_SMALL=1 or TROCR_BASE=1 to reduce memory during export (avoids MemoryError on limited RAM)
if os.environ.get("TROCR_BASE"):
    TROCR_HF = "microsoft/trocr-base-handwritten"
elif os.environ.get("TROCR_SMALL"):
    TROCR_HF = "microsoft/trocr-small-handwritten"
else:
    TROCR_HF = "microsoft/trocr-large-handwritten"
T5_HF = "vennify/t5-base-grammar-correction"


def _normalize_onnx_opset_for_quantization(model_path: str) -> str:
    """Ensure model has exactly one default-domain opset so quantize_dynamic accepts it. Returns path to normalized model."""
    import onnx
    from onnx import helper

    model = onnx.load(model_path)
    # quantize_dynamic expects exactly one opset with domain "" or "ai.onnx"
    default = [o for o in model.opset_import if (o.domain == "" or o.domain == "ai.onnx")]
    other = [o for o in model.opset_import if o.domain != "" and o.domain != "ai.onnx"]

    if len(default) == 0:
        new_default = [helper.make_opsetid("ai.onnx", 17)]
    elif len(default) > 1:
        version = max(o.version for o in default)
        new_default = [helper.make_opsetid("ai.onnx", version)]
    else:
        single = default[0]
        new_default = [helper.make_opsetid("ai.onnx", single.version)]

    # Replace opset_import: build list then clear+extend (protobuf repeated doesn't support slice assign)
    new_opsets = other + new_default
    del model.opset_import[:]
    model.opset_import.extend(new_opsets)

    tmp_path = model_path + ".norm.onnx"
    onnx.save(model, tmp_path)
    return tmp_path


def quantize_onnx_dynamic(model_path: str, out_path: str) -> None:
    """Apply INT8 dynamic quantization to an ONNX model."""
    from onnxruntime.quantization import quantize_dynamic, QuantType

    norm_path = _normalize_onnx_opset_for_quantization(model_path)
    try:
        quantize_dynamic(
            norm_path,
            out_path,
            weight_type=QuantType.QInt8,
            extra_options={"WeightSymmetric": True},
        )
    finally:
        if os.path.isfile(norm_path):
            try:
                os.remove(norm_path)
            except OSError:
                pass


def export_and_quantize_trocr() -> bool:
    """Export TrOCR to ONNX and quantize to INT8. Returns True on success, False on OOM/skip."""
    from transformers import TrOCRProcessor
    from optimum.onnxruntime import ORTModelForVision2Seq

    trocr_dir = os.path.join(OUT_DIR, "trocr_int8")
    os.makedirs(trocr_dir, exist_ok=True)
    tmp_dir = os.path.join(OUT_DIR, "_tmp_trocr")
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        print("Exporting TrOCR to ONNX...", f"(model: {TROCR_HF})")
        processor = TrOCRProcessor.from_pretrained(TROCR_HF)
        processor.save_pretrained(trocr_dir)
        model = ORTModelForVision2Seq.from_pretrained(TROCR_HF, export=True)
        model.save_pretrained(tmp_dir)

        print("Quantizing TrOCR encoder/decoder to INT8...")
        for name in os.listdir(tmp_dir):
            src = os.path.join(tmp_dir, name)
            dst = os.path.join(trocr_dir, name)
            if name.endswith(".onnx"):
                quantize_onnx_dynamic(src, dst)
            else:
                if os.path.isfile(src):
                    shutil.copy2(src, dst)
                elif os.path.isdir(src):
                    shutil.copytree(src, dst, dirs_exist_ok=True)

        shutil.rmtree(tmp_dir, ignore_errors=True)
        print(f"  Saved to {trocr_dir}")
        return True
    except (MemoryError, OSError) as e:
        if "bad allocation" in str(e).lower() or isinstance(e, MemoryError):
            print("  TrOCR failed (out of memory). Skip TrOCR INT8; T5 will still be exported.")
            print("  To reduce memory use: set TROCR_SMALL=1 or TROCR_BASE=1 and run again.")
        else:
            print(f"  TrOCR failed: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        shutil.rmtree(trocr_dir, ignore_errors=True)  # avoid partial dir; server will skip TrOCR INT8
        return False


def export_and_quantize_t5() -> None:
    from transformers import T5Tokenizer
    from optimum.onnxruntime import ORTModelForSeq2SeqLM

    t5_dir = os.path.join(OUT_DIR, "t5_int8")
    os.makedirs(t5_dir, exist_ok=True)
    tmp_dir = os.path.join(OUT_DIR, "_tmp_t5")
    os.makedirs(tmp_dir, exist_ok=True)

    print("Exporting T5 to ONNX...")
    tokenizer = T5Tokenizer.from_pretrained(T5_HF)
    tokenizer.save_pretrained(t5_dir)
    model = ORTModelForSeq2SeqLM.from_pretrained(T5_HF, export=True)
    model.save_pretrained(tmp_dir)

    print("Quantizing T5 to INT8...")
    for name in os.listdir(tmp_dir):
        src = os.path.join(tmp_dir, name)
        dst = os.path.join(t5_dir, name)
        if name.endswith(".onnx"):
            quantize_onnx_dynamic(src, dst)
        else:
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            elif os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)

    shutil.rmtree(tmp_dir, ignore_errors=True)
    print(f"  Saved to {t5_dir}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("INT8 quantization: T5 (TrOCR skipped for now)")
    print("Output directory:", OUT_DIR)
    export_and_quantize_t5()
    print("Done. Set USE_INT8=1 when starting the server to use T5 INT8 and DocTR INT8.")


if __name__ == "__main__":
    main()
