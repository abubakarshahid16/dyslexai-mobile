from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint

from app.database import Base


class DayCompletion(Base):
    __tablename__ = "day_completions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    day_number = Column(Integer, nullable=False, index=True)  # 1–90
    completed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    score = Column(Integer, nullable=False, default=0)  # 0–100
    puzzle_piece_earned = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("user_id", "day_number", name="uq_day_completion_user_day"),
    )

