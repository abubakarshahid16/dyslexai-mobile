from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, UniqueConstraint

from app.database import Base


class UserGameProgress(Base):
    __tablename__ = "user_game_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    current_day = Column(Integer, nullable=False, default=1)  # 1–90
    last_completed_date = Column(Date, nullable=True)
    streak = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_game_progress_user_id"),
    )

