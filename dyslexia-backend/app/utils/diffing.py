"""Diff and text scoring helpers.

These functions preserve one of the notebook's most useful ideas: keep OCR outputs
transparent by exposing exactly what changed between the recognizer output and the
corrected text.
"""

from __future__ import annotations

import difflib
import hashlib
import re
from typing import Any


def normalize_spaces(text: str) -> str:
    """Collapse repeated whitespace without touching core content."""

    return re.sub(r"\s+", " ", (text or "")).strip()


def weird_char_ratio(text: str) -> float:
    """Estimate how noisy a span is based on uncommon characters."""

    if not text:
        return 1.0
    weird = len(re.findall(r"[^A-Za-z0-9\s.,!?;:'\"()\-/]", text))
    return weird / max(1, len(text))


def digit_ratio(text: str) -> float:
    """Useful heuristic for catching OCR lines that look unlike prose."""

    if not text:
        return 0.0
    digits = len(re.findall(r"\d", text))
    return digits / max(1, len(text))


# Minimal common words — tokens that are clearly valid English
_LEXICAL_COMMON = frozenset({
    "the", "a", "an", "to", "of", "in", "on", "at", "is", "it", "and", "or", "for",
    "with", "from", "you", "your", "i", "we", "he", "she", "they", "my", "was", "were",
    "are", "be", "been", "not", "but", "all", "can", "had", "her", "his", "one", "our",
    "will", "do", "if", "me", "so", "no", "up", "have", "has", "this", "that",
})


def lexical_suspicion_score(text: str) -> float:
    """Detect garbage or malformed OCR text. Returns 0.0 (clean) to 1.0 (definitely garbage).

    Flags malformed pseudo-words, abnormal token shape, fragmented semi-words,
    mixed handwriting-noise patterns, and weak line-level readability.
    """
    if not text or len(text) < 3:
        return 0.0

    text_lower = text.lower()
    words = [w for w in text_lower.split() if w]
    if not words:
        return 1.0

    score = 0.0

    # 1. Vowel density (most English words have vowels)
    vowels = len(re.findall(r"[aeiouy]", text_lower))
    alpha_count = len([c for c in text_lower if c.isalpha()])
    vowel_ratio = vowels / max(1, alpha_count)
    if vowel_ratio < 0.25:
        score += 0.5
    elif vowel_ratio < 0.38:
        score += 0.3

    # 2. Long malformed tokens (hallucinations / merged pseudo-words)
    max_word_len = max(len(w) for w in words)
    if max_word_len > 18:
        score += 0.5
    elif max_word_len > 12:
        score += 0.3
    elif max_word_len > 8:
        score += 0.15

    # 3. Pseudo-word density: tokens that are neither common nor clean numeric
    pseudo_count = 0
    for w in words:
        if w in _LEXICAL_COMMON:
            continue
        if w.isdigit():
            continue
        if len(w) <= 2 and w.isalnum():
            continue
        # Internal hyphen in pseudo-word ("moratle-i")
        if "-" in w and len(w) > 4:
            pseudo_count += 1
            continue
        # Rare consonant clusters (4+ consonants)
        if re.search(r"[bcdfghjklmnpqrstvwxz]{4,}", w):
            pseudo_count += 1
            continue
        # Long token not in common set (6+ chars)
        if len(w) >= 6:
            pseudo_count += 1
    if len(words) >= 2 and pseudo_count / len(words) >= 0.5:
        score += 0.35
    elif pseudo_count >= 2:
        score += 0.2

    # 4. Internal hyphenated malformed pseudo-words
    hyphen_pseudo = len(re.findall(r"[a-z]+-[a-z]+", text_lower))
    if hyphen_pseudo > 0:
        score += 0.3

    # 5. Camel/mixed-case oddities (e.g. "iWil") — not leading caps
    if re.search(r"[a-z][A-Z]|[A-Z]{2,}[a-z]", text):
        score += 0.25

    # 6. Fragmented short-token density (OCR fragmentation)
    short_tokens = [w for w in words if len(w) <= 2 and w.isalnum()]
    if len(words) > 3 and len(short_tokens) / len(words) > 0.5:
        score += 0.35
    elif len(words) >= 2 and len(short_tokens) / len(words) > 0.4:
        score += 0.2

    # 7. Repeated weird patterns (e.g. "iiiii", "llll")
    repeats = len(re.findall(r"(.)\1{2,}", text_lower))
    if repeats > 0:
        score += 0.3

    # 8. Mixed alpha-digit artifacts ("sch00l", "th1s", "100" amid words)
    mixed_alpha_digit = len(re.findall(r"[A-Za-z]\d|\d[A-Za-z]", text_lower))
    if mixed_alpha_digit > 0:
        score += min(0.45, mixed_alpha_digit * 0.25)
    numeric_tokens = len([w for w in words if w.isdigit()])
    if numeric_tokens >= 1 and len(words) <= 5:
        score += 0.2

    # 9. Low alphabetic coherence
    alpha = len(re.findall(r"[A-Za-z]", text_lower))
    total = len(re.findall(r"\S", text_lower))
    if total > 0 and alpha / total < 0.45 and len(text) > 4:
        score += 0.35

    # 10. Weak line-level readability: many tokens but few common words
    common_hits = sum(1 for w in words if w in _LEXICAL_COMMON)
    if len(words) >= 5 and common_hits <= 1:
        score += 0.25
    elif len(words) >= 4 and common_hits == 0:
        score += 0.2

    return min(1.0, score)


def hash_bytes(blob: bytes) -> str:
    """Stable cache key for cropped image content."""

    return hashlib.md5(blob).hexdigest()


def levenshtein_ops(before: str, after: str) -> list[dict[str, Any]]:
    """Return a UI-friendly edit summary.

    SequenceMatcher is not a perfect linguistic diff, but it is simple, local,
    dependency-free, and good enough for side-by-side highlighting in the first
    production version of the app.
    """

    matcher = difflib.SequenceMatcher(a=before or "", b=after or "")
    ops: list[dict[str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        ops.append(
            {
                "op": tag,
                "from": (before or "")[i1:i2],
                "to": (after or "")[j1:j2],
                "a_span": [i1, i2],
                "b_span": [j1, j2],
            }
        )
    return ops


def correction_ratio(before: str, after: str) -> float:
    """How much text changed, normalized by source length."""

    before = before or ""
    changes = sum(
        max(i2 - i1, j2 - j1)
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=before, b=after or "").get_opcodes()
        if tag != "equal"
    )
    return changes / max(1, len(before))


def _similarity(a: str, b: str) -> float:
    """Character-level similarity 0..1 (SequenceMatcher ratio)."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def _has_repetition(text: str) -> bool:
    """True if 4+ word phrase appears 2+ times (hallucination)."""
    words = (text or "").split()
    for n in range(4, min(12, len(words) // 2 + 1)):
        for i in range(len(words) - n):
            phrase = " ".join(words[i : i + n])
            if phrase and (text or "").count(phrase) >= 2:
                return True
    return False


def _has_echo_or_prompt_leakage(text: str) -> bool:
    """True if model echoed prompt/instruction instead of correcting."""
    lower = (text or "").lower()
    if lower.startswith("repair ocr noise") or lower.startswith("correct ocr"):
        return True
    if lower.count("repair ocr noise") >= 2 or lower.count("the paragraph:") >= 2:
        return True
    return False


def acceptance_gate(raw: str, previous: str, corrected: str) -> tuple[bool, str]:
    """Do-no-harm gate: accept corrected only if it does not corrupt.

    Returns (accepted, reason).
    Reject if: repetition, echo/prompt leakage, or lower similarity to raw than previous.
    """
    if not corrected or not corrected.strip():
        return False, "empty"
    if _has_repetition(corrected):
        return False, "repetition"
    if _has_echo_or_prompt_leakage(corrected):
        return False, "echo_or_prompt_leakage"
    sim_raw_prev = _similarity(raw or "", previous or "")
    sim_raw_corr = _similarity(raw or "", corrected)
    if sim_raw_corr < sim_raw_prev - 0.05:
        return False, f"lower_similarity_to_raw(sim={sim_raw_corr:.3f}<{sim_raw_prev:.3f})"
    if sim_raw_corr < 0.5 and (raw or "").strip():
        return False, f"similarity_to_raw_too_low(sim={sim_raw_corr:.3f})"
    return True, "ok"
