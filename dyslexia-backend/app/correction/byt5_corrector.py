"""Local ByT5 correction wrapper."""

from __future__ import annotations

import re

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from app.core.config import ModelSettings
from app.core.logging import get_logger
from app.utils.diffing import normalize_spaces

logger = get_logger(__name__)


class ByT5Corrector:
    """Context-aware OCR post-correction using a byte-level seq2seq model.

    A byte-level model is a practical local choice for OCR-noisy text because it can
    reason over misspellings and corrupted tokens without relying on clean subword
    tokenization. This makes it a better fit than many wordpiece-only approaches for
    dyslexic handwriting and OCR noise.
    """

    def __init__(self, config: ModelSettings):
        logger.info("Loading local ByT5 correction model: %s", config.byt5_model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(config.byt5_model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(config.byt5_model_name)
        self.model.to("cpu")
        self.model.eval()
        self.max_length = config.correction_max_length
        self.num_beams = config.correction_num_beams
        self.prefix = (
            "Repair OCR noise in this paragraph. Preserve names, topic, sentence order, and factual meaning. "
            "Only fix likely recognition errors, spacing, punctuation, and obvious spelling mistakes supported by context. "
            "Do not add new facts or rewrite the paragraph into a different message. Return only the corrected paragraph: "
        )
        self.echo_markers = [
            "Correct OCR and dyslexia-related spelling errors while preserving meaning:",
            "Repair OCR noise in this paragraph while preserving meaning, names, and the original order of ideas.",
            "Do not invent new facts. Return only the corrected paragraph:",
            "the corrected paragraph:",
        ]

    def chunk_text(self, text: str, max_chars: int = 220) -> list[str]:
        """Split long paragraphs into sentence-aware chunks.

        The notebook corrected line by line. For better paragraph support we keep
        chunks small enough for local inference, but large enough to preserve context.
        """

        text = normalize_spaces(text)
        if len(text) <= max_chars:
            return [text] if text else []

        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks: list[str] = []
        current = ""
        for sentence in sentences:
            proposal = normalize_spaces(f"{current} {sentence}")
            if current and len(proposal) > max_chars:
                chunks.append(current)
                current = sentence
            else:
                current = proposal
        if current:
            chunks.append(current)
        return chunks

    def _correct_chunk(self, text: str) -> str:
        if not text.strip():
            return text
        prompt = self.prefix + text
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True)
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_length=self.max_length,
                num_beams=self.num_beams,
                early_stopping=True,
            )
        decoded = normalize_spaces(self.tokenizer.decode(outputs[0], skip_special_tokens=True))
        for marker in self.echo_markers:
            decoded = normalize_spaces(decoded.replace(marker, " "))
        # Reject prompt echo (model outputs instruction instead of correction)
        lower = decoded.lower()
        if lower.startswith("repair ocr noise") or lower.startswith("correct ocr"):
            return text
        if lower.count("repair ocr noise") >= 2 or lower.count("the paragraph:") >= 2:
            return text
        # Reject hallucinated repetition (model echoes/repeats input)
        stripped = text.strip()
        if stripped and decoded.count(stripped) >= 2:
            return text
        if len(decoded) > 2 * len(text) + 20 and stripped and stripped in decoded:
            return text
        # Reject phrase-level repetition (e.g. "were an occasion worthy of his presence" repeated)
        words = decoded.split()
        for n in range(4, min(12, len(words) // 2 + 1)):
            for i in range(len(words) - n):
                phrase = " ".join(words[i : i + n])
                if phrase and decoded.count(phrase) >= 2:
                    return text
        return decoded or text

    def correct(self, text: str) -> str:
        chunks = self.chunk_text(text)
        return normalize_spaces(" ".join(self._correct_chunk(chunk) for chunk in chunks))
