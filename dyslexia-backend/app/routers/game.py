from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.deps import get_current_user
from app.models.day_completion import DayCompletion
from app.models.game_day import GameDay
from app.models.game_exercise import GameExercise
from app.models.user import User
from app.models.user_game_progress import UserGameProgress
from app.services.game_seed_html import ensure_game_seeded, find_seed_html_path

router = APIRouter(prefix="/api/game", tags=["game"])


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


def _phase_day_range(phase: int) -> tuple[int, int]:
    ranges = {
        1: (1, 7),
        2: (8, 21),
        3: (22, 35),
        4: (36, 49),
        5: (50, 63),
        6: (64, 90),
    }
    if phase not in ranges:
        raise ValueError("phase out of range")
    return ranges[phase]


def _get_or_create_progress(db: DBSession, user_id: int) -> UserGameProgress:
    progress = db.query(UserGameProgress).filter(UserGameProgress.user_id == user_id).first()
    if progress:
        return progress
    progress = UserGameProgress(user_id=user_id, current_day=1, streak=0)
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


class CompleteDayRequest(BaseModel):
    day_number: int = Field(..., ge=1, le=90)
    exercise_scores: list[int] = Field(default_factory=list, description="Per-exercise scores (0–100)")


@router.post("/seed")
def seed_game(db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Idempotent: seeds from seed_data_90_days.html if empty. Any logged-in user may call (no-op if already seeded)."""
    _ = current_user
    existing = db.query(GameDay).filter(GameDay.day_number == 1).first()
    if existing:
        return {"seeded": False, "message": "Game mode already seeded"}

    if not find_seed_html_path():
        raise HTTPException(
            status_code=500,
            detail="Game seed file not found (expected seed_data_90_days.html at repo root or dyslexia-backend/data/)",
        )

    ensure_game_seeded(db)
    if not db.query(GameDay).filter(GameDay.day_number == 1).first():
        raise HTTPException(status_code=500, detail="Game seed failed to create days")
    return {"seeded": True, "message": "Seeded 90 days from HTML"}


@router.get("/today")
def get_today(db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    progress = _get_or_create_progress(db, current_user.id)
    today_date = datetime.now(timezone.utc).date()

    # Prevent skipping uncompleted days:
    # If a student completes day N on some date, then on later dates they should
    # still see day (N+1) until they actually complete day (N+1).
    #
    # Example:
    # - Complete day 1 on Monday
    # - Skip day 2 on Tuesday
    # - Returning on Wednesday must show day 2 (not day 3).
    last_completion = (
        db.query(DayCompletion)
        .filter(DayCompletion.user_id == current_user.id)
        .order_by(DayCompletion.completed_at.desc())
        .first()
    )

    if not last_completion:
        progress.current_day = max(1, int(progress.current_day or 1))
        db.commit()
    else:
        last_completed_day_number = int(last_completion.day_number or 1)
        last_completed_date = last_completion.completed_at.date()

        if last_completed_date == today_date:
            # Same calendar day: keep the same day.
            progress.current_day = last_completed_day_number
        else:
            # Next unlock is ALWAYS the next uncompleted day.
            progress.current_day = min(90, last_completed_day_number + 1)

        # Keep progress.last_completed_date aligned with the latest completion.
        progress.last_completed_date = last_completed_date
        db.commit()

    day_number = int(progress.current_day or 1)

    if not db.query(GameDay).filter(GameDay.day_number == 1).first():
        if not find_seed_html_path():
            raise HTTPException(
                status_code=503,
                detail="Game curriculum file missing. Add seed_data_90_days.html to the project root.",
            )
        ensure_game_seeded(db)

    game_day = db.query(GameDay).filter(GameDay.day_number == day_number).first()
    if not game_day:
        raise HTTPException(status_code=503, detail="Game mode could not be loaded")

    exercises = (
        db.query(GameExercise)
        .filter(GameExercise.game_day_id == game_day.id)
        .order_by(GameExercise.order_in_day.asc())
        .all()
    )

    return {
        "day": {
            "day_number": game_day.day_number,
            "phase_number": game_day.phase_number,
            "title": game_day.title,
        },
        "progress": {
            "current_day": progress.current_day,
            "streak": progress.streak,
            "last_completed_date": progress.last_completed_date.isoformat() if progress.last_completed_date else None,
        },
        "exercises": [
            {
                "id": ex.id,
                "order_in_day": ex.order_in_day,
                "exercise_type": ex.exercise_type,
                "content": ex.content,
            }
            for ex in exercises
        ],
    }


@router.post("/complete-day")
def complete_day(
    payload: CompleteDayRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    progress = _get_or_create_progress(db, current_user.id)
    today = datetime.now(timezone.utc).date()

    # Enforce completing the current day only
    if int(payload.day_number) != int(progress.current_day):
        raise HTTPException(status_code=400, detail="Can only complete the current day")

    # Prevent double completion same day/day_number (unique constraint also protects)
    existing = (
        db.query(DayCompletion)
        .filter(DayCompletion.user_id == current_user.id, DayCompletion.day_number == payload.day_number)
        .first()
    )
    if existing:
        return {
            "completed": True,
            "already_completed": True,
            "day_number": existing.day_number,
            "score": existing.score,
            "puzzle_piece_earned": existing.puzzle_piece_earned,
        }

    # Students can practise the same game day multiple times within the same date.
    # The backend advances `progress.current_day` automatically when a new calendar day starts.
    scores_raw = payload.exercise_scores or []
    scores: list[int] = []
    for s in scores_raw:
        x = float(s)
        if x <= 1.0:
            x = x * 100.0
        scores.append(max(0, min(100, int(round(x)))))
    score = round(sum(scores) / len(scores)) if scores else 0

    completion = DayCompletion(
        user_id=current_user.id,
        day_number=payload.day_number,
        completed_at=datetime.now(timezone.utc),
        score=score,
        puzzle_piece_earned=True,
    )
    db.add(completion)

    # Update streak: if completed yesterday, +1; if last completed today, keep; else reset to 1
    if progress.last_completed_date == today:
        # same day: keep streak
        pass
    elif progress.last_completed_date == (today.fromordinal(today.toordinal() - 1)):
        progress.streak = int(progress.streak or 0) + 1
    else:
        progress.streak = 1

    progress.last_completed_date = today
    # NOTE: Do not increment current_day here. Advancement happens in GET /api/game/today
    # based on elapsed real calendar days.

    db.commit()
    db.refresh(progress)

    return {
        "completed": True,
        "already_completed": False,
        "day_number": completion.day_number,
        "score": completion.score,
        "puzzle_piece_earned": completion.puzzle_piece_earned,
        "next_day": progress.current_day,
        "streak": progress.streak,
    }


@router.get("/progress")
def get_progress(db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    progress = _get_or_create_progress(db, current_user.id)
    completions = (
        db.query(DayCompletion)
        .filter(DayCompletion.user_id == current_user.id)
        .order_by(DayCompletion.completed_at.asc())
        .all()
    )
    return {
        "progress": {
            "current_day": progress.current_day,
            "last_completed_date": progress.last_completed_date.isoformat() if progress.last_completed_date else None,
            "streak": progress.streak,
        },
        "completions": [
            {
                "day_number": c.day_number,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None,
                "score": c.score,
                "puzzle_piece_earned": c.puzzle_piece_earned,
                "phase_number": _phase_for_day(c.day_number),
            }
            for c in completions
        ],
    }


@router.get("/puzzle/{phase}")
def get_puzzle_phase(
    phase: int,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        start_day, end_day = _phase_day_range(int(phase))
    except ValueError:
        raise HTTPException(status_code=400, detail="Phase must be 1–6")

    completions = (
        db.query(DayCompletion.day_number)
        .filter(
            DayCompletion.user_id == current_user.id,
            DayCompletion.day_number >= start_day,
            DayCompletion.day_number <= end_day,
        )
        .all()
    )
    earned = sorted({int(row[0]) for row in completions})

    return {
        "phase": int(phase),
        "day_range": [start_day, end_day],
        "pieces_earned": earned,
        "pieces_total": (end_day - start_day + 1),
    }

