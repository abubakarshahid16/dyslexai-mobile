"""
Parse seed_data_90_days.html (repo root or dyslexia-backend/data/) and insert GameDay + GameExercise rows.

Auto-seeded on API startup / first /api/game/today — no teacher action required.
"""
from __future__ import annotations

import ast
import hashlib
import os
import random
import re
from pathlib import Path
from typing import Any

# SQLAlchemy models imported inside DB functions so pure parsing can run without DB deps.

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def _phase_for_day(day_number: int) -> int:
    if 1 <= day_number <= 7:
        return 1
    if 8 <= day_number <= 21:
        return 2
    if 22 <= day_number <= 35:
        return 3
    if 36 <= day_number <= 49:
        return 4
    if 50 <= day_number <= 63:
        return 5
    if 64 <= day_number <= 90:
        return 6
    raise ValueError("day_number out of range")


def _phase_title(phase: int) -> str:
    return {
        1: "Phonological Awareness",
        2: "Phonics & Decoding",
        3: "Fluency & Syllable Types",
        4: "Vocabulary & Morphology",
        5: "Syntax & Spelling Rules",
        6: "Reading Comprehension",
    }[phase]


def find_seed_html_path() -> Path | None:
    candidates = [
        REPO_ROOT / "seed_data_90_days.html",
        BACKEND_ROOT / "data" / "seed_data_90_days.html",
    ]
    env = os.environ.get("GAME_SEED_HTML_PATH")
    if env:
        candidates.insert(0, Path(env))
    for p in candidates:
        if p.is_file():
            return p.resolve()
    return None


def extract_full_data_text(html: str) -> str:
    # Prefer content inside #full-data (plain text curriculum)
    m = re.search(r'<div\s+id=["\']full-data["\'][^>]*>(.*?)</div>\s*<script>', html, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return html


def _normalize_blob(blob: str) -> str:
    # Fix known typo in source file (DAY 88)
    blob = blob.replace('looking?",', 'looking?"')
    return blob


def _coerce_scalar(s: str) -> Any:
    s = s.strip()
    if not s:
        return s
    if s.startswith("["):
        return ast.literal_eval(s)
    if s.startswith('"') or s.startswith("'"):
        return ast.literal_eval(s)
    if s.isdigit() or (s.startswith("-") and s[1:].isdigit()):
        return int(s)
    return s


def _parse_line_keyvals(line: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    line = line.strip()
    if not line or line.startswith("---"):
        return out
    parts = [p.strip() for p in line.split(" | ")]
    for part in parts:
        if ":" not in part:
            continue
        k, v = part.split(":", 1)
        k = k.strip()
        v = v.strip()
        try:
            out[k] = _coerce_scalar(v)
        except (SyntaxError, ValueError):
            out[k] = v
    return out


def _parse_exercise_kv_lines(lines: list[str]) -> dict[str, Any]:
    kv: dict[str, Any] = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith("---"):
            break
        if "|" in line:
            kv.update(_parse_line_keyvals(line))
        elif ":" in line:
            k, v = line.split(":", 1)
            k = k.strip()
            v = v.strip()
            try:
                kv[k] = _coerce_scalar(v)
            except (SyntaxError, ValueError):
                kv[k] = v
    return kv


def _resolve_bin_label(short: str, bins: list[str]) -> str:
    s = str(short).strip().lower()
    for b in bins:
        bl = b.lower()
        if s in bl or bl.startswith(s) or s.replace(" ", "") in bl.replace(" ", ""):
            return b
    # map -ck / -k style
    if s in ("-ck", "ck"):
        for b in bins:
            if "-ck" in b.lower():
                return b
    if s in ("-k", "k"):
        for b in bins:
            if "-k" in b.lower() and "-ck" not in b.lower():
                return b
    if "doubled" in s:
        for b in bins:
            if "doubled" in b.lower():
                return b
    if "no doubling" in s or s == "no doubling":
        for b in bins:
            if "no doubling" in b.lower():
                return b
    if s in ("drop", "drop the e"):
        for b in bins:
            if "drop" in b.lower():
                return b
    if s in ("keep", "keep the e"):
        for b in bins:
            if "keep" in b.lower():
                return b
    return bins[0] if bins else short


def _normalize_syllable_bin(b: str) -> str:
    t = str(b).strip()
    if t.upper() == "VCE":
        return "VCe"
    return t


def _content_for_type(ex_type: str, kv: dict[str, Any], day_number: int) -> dict[str, Any]:
    h = int(hashlib.md5(ex_type.encode()).hexdigest()[:8], 16)
    rng = random.Random(42_000 + day_number + (h % 997))

    if ex_type == "syllable_tap":
        words = list(kv.get("words") or [])
        counts = list(kv.get("correct_counts") or [])
        answer = {str(w): int(c) for w, c in zip(words, counts)}
        return {"prompt": "Tap once for each syllable.", "words": words, "answer": answer}

    if ex_type == "rhyme_match":
        pairs = kv.get("pairs") or []
        return {"prompt": "Which pairs rhyme? Tap “They rhyme” or “They do not rhyme.”", "pairs": pairs}

    if ex_type == "sound_identify":
        word = str(kv.get("word") or "")
        pos = str(kv.get("position") or "first")
        ans = str(kv.get("answer") or kv.get("target_sound") or "")
        opts = kv.get("options")
        if not isinstance(opts, list):
            opts = []
        return {
            "prompt": f"Pick the letter for the {pos} sound.",
            "word": word,
            "position": pos if pos in ("first", "last") else "first",
            "options": opts,
            "answer": ans,
        }

    if ex_type == "sound_blend":
        phonemes = kv.get("phonemes") or []
        opts = kv.get("options") or []
        ans = str(kv.get("answer") or "")
        return {"prompt": "Listen to the sounds. Pick the word.", "phonemes": phonemes, "options": opts, "answer": ans}

    if ex_type == "letter_sound_match":
        letters = kv.get("letters") or []
        sounds = kv.get("sounds") or []
        return {"prompt": "Match each letter or blend to its sound.", "letters": letters, "sounds": sounds}

    if ex_type == "word_builder":
        letters = list(kv.get("letters") or [])
        distractors = list(kv.get("distractor_letters") or [])
        ans = str(kv.get("answer") or "")
        tiles = letters + distractors
        rng.shuffle(tiles)
        return {
            "prompt": "Build the word using the tiles.",
            "tiles": tiles,
            "letters": letters,
            "distractor_letters": distractors,
            "answer": ans
        }

    if ex_type == "odd_one_out":
        words = list(kv.get("words") or [])
        odd = str(kv.get("odd") or "")
        rule = str(kv.get("rule") or "the rule for this set")
        return {"prompt": f"Which word breaks the rule: {rule}?", "options": words, "answer": odd}

    if ex_type == "decode_word":
        w = str(kv.get("word") or kv.get("answer") or "")
        opts = kv.get("options") or []
        ans = str(kv.get("answer") or w)
        return {"prompt": "Listen and pick the correct word.", "word": w, "options": opts, "answer": ans}

    if ex_type == "syllable_split":
        w = str(kv.get("word") or "")
        idx = int(kv.get("split_index") or 0)
        return {"prompt": "Tap where the word splits into syllables.", "word": w, "answer": idx}

    if ex_type == "syllable_sort":
        words = list(kv.get("words") or [])
        bins = [_normalize_syllable_bin(b) for b in (kv.get("bins") or [])]
        ans_list = kv.get("answers") or []
        answer = {}
        for wi, a in zip(words, ans_list):
            answer[str(wi)] = _normalize_syllable_bin(str(a))
        return {"prompt": "Sort each word into the correct syllable type.", "bins": bins, "words": words, "answer": answer}

    if ex_type == "timed_flash_read":
        words = list(kv.get("words") or [])
        sec = int(kv.get("time_seconds") or 30)
        return {
            "prompt": "A word will flash. Tap the same word you saw.",
            "words": words,
            "time_seconds": sec,
        }

    if ex_type == "speed_sort":
        words = list(kv.get("words") or [])
        bins = [_normalize_syllable_bin(b) for b in (kv.get("bins") or [])]
        ans_list = kv.get("answers") or []
        answer = {}
        for wi, a in zip(words, ans_list):
            answer[str(wi)] = _normalize_syllable_bin(str(a))
        return {"prompt": "Sort each word into the correct group.", "bins": bins, "words": words, "answer": answer}

    if ex_type == "morpheme_builder":
        root = str(kv.get("root") or "")
        valids = [str(x) for x in (kv.get("valid_combinations") or []) if x]
        if not valids:
            return {"prompt": f"Build a word from “{root}”.", "root": root, "options": [], "answer": ""}
        correct = str(rng.choice(valids))
        n = min(4, len(valids))
        opts_set = {correct}
        pool = [v for v in valids if v != correct]
        rng.shuffle(pool)
        for v in pool:
            if len(opts_set) >= n:
                break
            opts_set.add(v)
        for v in valids:
            if len(opts_set) >= 4:
                break
            opts_set.add(v)
        opts = list(opts_set)
        rng.shuffle(opts)
        return {
            "prompt": f"Which word is built from the root “{root}”?",
            "root": root,
            "options": opts,
            "answer": correct,
            "valid_combinations": valids,
        }

    if ex_type == "definition_match":
        pairs = kv.get("pairs") or []
        return {"prompt": "Match each word to its meaning.", "pairs": pairs, "answer": {str(a): str(b) for a, b in pairs}}

    if ex_type == "word_family_sort":
        root = str(kv.get("root") or "")
        fam = list(kv.get("family") or [])
        non = list(kv.get("non_family") or [])
        all_w = list(fam) + list(non)
        rng.shuffle(all_w)
        return {
            "prompt": f"Select every word in the “{root}” word family.",
            "root": root,
            "words": all_w,
            "answer": fam,
        }

    if ex_type == "fill_blank":
        sent = str(kv.get("sentence") or "")
        opts = kv.get("options")
        if isinstance(opts, str):
            opts = [opts]
        opts = list(opts or [])
        ans = str(kv.get("answer") or "")
        return {"prompt": sent, "options": opts, "answer": ans}

    if ex_type == "spelling_rule_sort":
        words = list(kv.get("words") or [])
        bins = list(kv.get("bins") or [])
        ans_list = kv.get("answers") or []
        rule = str(kv.get("rule") or "")
        answer = {}
        for wi, a in zip(words, ans_list):
            answer[str(wi)] = _resolve_bin_label(str(a), bins)
        return {"prompt": rule or "Sort each word into the correct group.", "bins": bins, "words": words, "answer": answer}

    if ex_type == "sentence_unscramble":
        tiles = list(kv.get("words") or [])
        ans = str(kv.get("answer") or "")
        rng.shuffle(tiles)
        return {"prompt": "Put the words in order to make a sentence.", "tiles": tiles, "answer": ans}

    if ex_type == "spell_it":
        w = str(kv.get("word") or "")
        hint = str(kv.get("hint") or "")
        return {
            "prompt": hint or "Listen and type the word.",
            "tts_text": str(kv.get("audio_cue") or w),
            "hint": hint,
            "keyboard": list("abcdefghijklmnopqrstuvwxyz"),
            "answer": w,
        }

    if ex_type == "error_detect":
        sent = str(kv.get("sentence") or "")
        err = str(kv.get("error_word") or "")
        return {"prompt": "Tap the word that is not spelled or used correctly.", "sentence": sent, "answer": err}

    if ex_type == "passage_mcq":
        return {
            "passage": str(kv.get("passage") or ""),
            "question": str(kv.get("question") or ""),
            "options": list(kv.get("options") or []),
            "answer": str(kv.get("answer") or ""),
        }

    if ex_type == "sequence_events":
        sents = list(kv.get("sentences") or [])
        order = list(kv.get("correct_order") or list(range(len(sents))))
        answer = [sents[i] for i in order]
        tiles = list(sents)
        rng.shuffle(tiles)
        return {"prompt": "Put the events in the correct order.", "tiles": tiles, "answer": answer}

    if ex_type == "inference_question":
        return {
            "passage": str(kv.get("passage") or ""),
            "question": str(kv.get("question") or ""),
            "options": list(kv.get("options") or []),
            "answer": str(kv.get("answer") or ""),
        }

    if ex_type == "main_idea_picker":
        return {
            "passage": str(kv.get("passage") or ""),
            "options": list(kv.get("options") or []),
            "answer": str(kv.get("answer") or ""),
        }

    return {"prompt": "Complete the exercise.", "raw": kv}


def _split_days(raw: str) -> list[tuple[int, str]]:
    raw = _normalize_blob(raw)
    day_pat = re.compile(r"^DAY\s+(\d+)(?:\s+—[^\n]*)?\s*$", re.MULTILINE)
    matches = list(day_pat.finditer(raw))
    out: list[tuple[int, str]] = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        out.append((num, raw[start:end].strip()))
    return out


def _parse_day_block(day_number: int, block: str) -> list[tuple[str, dict[str, Any]]]:
    ex_pat = re.compile(
        r"^Ex([1-4])\s+type=(\w+)\s*$",
        re.MULTILINE,
    )
    matches = list(ex_pat.finditer(block))
    if len(matches) != 4:
        raise ValueError(f"Day {day_number}: expected 4 exercises, found {len(matches)}")

    exercises: list[tuple[str, dict[str, Any]]] = []
    for i, m in enumerate(matches):
        order = int(m.group(1))
        ex_type = m.group(2)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        body = block[start:end].strip()
        lines = body.splitlines()
        kv = _parse_exercise_kv_lines(lines)
        content = _content_for_type(ex_type, kv, day_number)
        exercises.append((ex_type, content))
        if order != len(exercises):
            pass
    return exercises


def parse_curriculum_from_html(html: str) -> dict[int, list[tuple[str, dict[str, Any]]]]:
    raw = extract_full_data_text(html)
    days = _split_days(raw)
    by_num: dict[int, list[tuple[str, dict[str, Any]]]] = {}
    for num, block in days:
        by_num[num] = _parse_day_block(num, block)
    return by_num


def seed_all_days_from_html(db: Any, html_text: str) -> int:
    from app.models.game_day import GameDay
    from app.models.game_exercise import GameExercise

    curriculum = parse_curriculum_from_html(html_text)
    created = 0
    for day_number in range(1, 91):
        exercises = curriculum.get(day_number)
        if not exercises or len(exercises) != 4:
            raise RuntimeError(f"Missing or invalid exercises for day {day_number}")

        phase = _phase_for_day(day_number)
        title = f"Day {day_number}: {_phase_title(phase)}"
        game_day = GameDay(day_number=day_number, phase_number=phase, title=title)
        db.add(game_day)
        db.flush()

        for idx, (ex_type, content) in enumerate(exercises, start=1):
            db.add(
                GameExercise(
                    game_day_id=game_day.id,
                    order_in_day=idx,
                    exercise_type=ex_type,
                    content=content,
                )
            )
        created += 1

    db.commit()
    return created


def ensure_game_seeded(db: Any) -> bool:
    """Idempotent: if day 1 exists, no-op. Otherwise load HTML and seed."""
    from app.models.game_day import GameDay

    existing = db.query(GameDay).filter(GameDay.day_number == 1).first()
    if existing:
        return False
    path = find_seed_html_path()
    if not path:
        return False
    html_text = path.read_text(encoding="utf-8")
    seed_all_days_from_html(db, html_text)
    return True
