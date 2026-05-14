"""Image triage for adaptive OCR preprocessing."""

from __future__ import annotations

import math

import cv2
import numpy as np

from app.ocr.types import TriageResult


def to_gray(img_bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)


class ImageTriage:
    """Estimate document quality before deciding how much preprocessing to apply.

    The notebook already used this idea well. We keep it because aggressive image
    cleanup can hurt OCR on some handwritten samples, so the app should react to the
    image instead of blindly applying every transform.
    """

    @staticmethod
    def estimate_skew(gray: np.ndarray) -> float:
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges,
            1,
            np.pi / 180,
            threshold=80,
            minLineLength=max(30, gray.shape[1] // 8),
            maxLineGap=10,
        )
        if lines is None:
            return 0.0

        angles: list[float] = []
        for line in lines[:200]:
            x1, y1, x2, y2 = line[0]
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            if -45 <= angle <= 45:
                angles.append(angle)
        if not angles:
            return 0.0
        return float(np.median(angles))

    @staticmethod
    def analyze(img_bgr: np.ndarray) -> TriageResult:
        gray = to_gray(img_bgr)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(np.mean(gray))
        contrast = float(np.std(gray))
        skew = ImageTriage.estimate_skew(gray)

        is_low_contrast = contrast < 45
        should_threshold = is_low_contrast
        should_deskew = abs(skew) > 1.5

        return TriageResult(
            blur_score=blur_score,
            brightness=brightness,
            contrast=contrast,
            is_low_contrast=is_low_contrast,
            estimated_skew_angle=skew,
            should_threshold=should_threshold,
            should_deskew=should_deskew,
        )
