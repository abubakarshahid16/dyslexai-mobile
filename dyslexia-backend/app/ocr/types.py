"""Typed OCR result structures reused across the backend."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class TriageResult:
    blur_score: float
    brightness: float
    contrast: float
    is_low_contrast: bool
    estimated_skew_angle: float
    should_threshold: bool
    should_deskew: bool


@dataclass
class OCRLine:
    """One OCR line plus the metadata needed for routing and UI explainability."""

    bbox: tuple[int, int, int, int]
    raw_text: str
    confidence: float
    source: str
    corrected_text: str | None = None
    merged_text: str | None = None
    fallback_used: bool = False
    suspicious: bool = False
    chosen_variant: str | None = None
    uncertainty_score: float = 0.0
    candidate_scores: list[dict[str, Any]] = field(default_factory=list)
    is_signoff: bool = False
    signoff_score: float = 0.0
    signoff_reasons: list[str] | None = None
    lexical_changes_count: int = 0

    def final_text(self) -> str:
        return (self.corrected_text or self.merged_text or self.raw_text or "").strip()


@dataclass
class OCRResult:
    image_path: str
    raw_text: str
    corrected_text: str
    lines: list[OCRLine]
    triage: TriageResult
    metadata: dict[str, Any]
    annotated_image_path: str | None = None
    preprocessed_image_path: str | None = None
    correction_layer1: str | None = None
    correction_layer2: str | None = None
    correction_layer3: str | None = None


@dataclass
class ParagraphStructureResult:
    """Ordered paragraph line proposals plus structure-stage diagnostics."""

    lines: list[OCRLine]
    engine_name: str
    used_fallback: bool = False
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
