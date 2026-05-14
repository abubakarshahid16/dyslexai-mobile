"""Config for OCR pipeline when integrated into dyslexia-backend."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# When inside dyslexia-backend: app/core/config.py -> parents[2] = repo root
ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data" / "ocr"
UPLOAD_DIR = DATA_DIR / "uploads"
ARTIFACT_DIR = DATA_DIR / "artifacts"
MODEL_CACHE_DIR = DATA_DIR / "model_cache"
DB_PATH = DATA_DIR / "dyslexai_ocr.db"


def _ocr_mode() -> str:
    """notebook_parity (default, verified) | production (experimental). notebook_parity matches fyp.ipynb exactly."""
    return os.getenv("OCR_MODE", "notebook_parity").lower().strip() or "notebook_parity"


@dataclass
class ModelSettings:
    paddle_lang: str = os.getenv("PADDLE_LANG", "en")
    use_textline_orientation: bool = True
    trocr_model_name: str = os.getenv("TROCR_MODEL_NAME", "microsoft/trocr-large-handwritten")
    byt5_model_name: str = os.getenv("BYT5_MODEL_NAME", "google/byt5-small")
    van_checkpoint_path: str | None = None
    trocr_max_new_tokens: int = 64
    trocr_num_beams: int = 2
    trocr_fast: bool = os.getenv("TROCR_FAST", "0") == "1"
    notebook_parity: bool = field(default_factory=lambda: _ocr_mode() == "notebook_parity")
    correction_max_length: int = 192
    correction_num_beams: int = 4


@dataclass
class RoutingSettings:
    min_line_height: int = 12
    min_line_width: int = 20
    primary_accept_confidence: float = 0.84
    fallback_confidence: float = 0.62
    max_weird_char_ratio: float = 0.20
    max_digit_ratio_for_sentence: float = 0.55
    quality_mode: str = field(default_factory=lambda: os.getenv("QUALITY_MODE", "quality_local"))
    max_fallback_workers: int = field(default_factory=lambda: int(os.getenv("TROCR_WORKERS", "4")))
    enable_crop_cache: bool = True
    use_trocr_fallback: bool = True
    use_local_correction: bool = True
    use_van_paragraph_stage: bool = False  # Disable VAN for simpler integration
    # Temporary benchmark values; tune after evaluation.
    difficulty_easy_threshold: float = field(
        default_factory=lambda: float(os.getenv("DYSLEXAI_EASY_THRESHOLD", "0.5"))
    )
    difficulty_hard_threshold: float = field(
        default_factory=lambda: float(os.getenv("DYSLEXAI_HARD_THRESHOLD", "1.8"))
    )


@dataclass
class PreprocessSettings:
    enable_deskew: bool = True
    enable_denoise: bool = True
    enable_contrast: bool = True
    enable_adaptive_threshold: bool = True
    threshold_only_for_low_contrast: bool = True
    crop_margins: bool = True
    preserve_full_page: bool = True
    line_variant_include_soft_gray: bool = True
    line_variant_include_adaptive_thresh: bool = True
    line_variant_include_clahe: bool = True
    line_variant_include_otsu: bool = True


@dataclass
class AppSettings:
    app_name: str = "DyslexAI-OCR"
    api_prefix: str = "/api"
    debug: bool = os.getenv("DYSLEXAI_DEBUG", "0") == "1"
    save_debug_images: bool = False
    database_url: str = f"sqlite:///{DB_PATH.as_posix()}"
    upload_dir: Path = field(default_factory=lambda: UPLOAD_DIR)
    artifact_dir: Path = field(default_factory=lambda: ARTIFACT_DIR)
    model_cache_dir: Path = field(default_factory=lambda: MODEL_CACHE_DIR)
    models: ModelSettings = field(default_factory=ModelSettings)
    routing: RoutingSettings = field(default_factory=RoutingSettings)
    preprocess: PreprocessSettings = field(default_factory=PreprocessSettings)


def get_settings() -> AppSettings:
    settings = AppSettings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.artifact_dir.mkdir(parents=True, exist_ok=True)
    settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return settings
