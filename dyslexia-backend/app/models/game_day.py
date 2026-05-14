from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.database import Base


class GameDay(Base):
    __tablename__ = "game_days"

    id = Column(Integer, primary_key=True, autoincrement=True)
    day_number = Column(Integer, nullable=False, index=True)  # 1–90
    phase_number = Column(Integer, nullable=False, index=True)  # 1–6
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("day_number", name="uq_game_days_day_number"),
    )

