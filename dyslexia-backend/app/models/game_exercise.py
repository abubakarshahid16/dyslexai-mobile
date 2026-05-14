from sqlalchemy import Column, ForeignKey, Integer, JSON, String, UniqueConstraint

from app.database import Base


class GameExercise(Base):
    __tablename__ = "game_exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_day_id = Column(Integer, ForeignKey("game_days.id"), nullable=False, index=True)
    order_in_day = Column(Integer, nullable=False, default=0)
    exercise_type = Column(String(64), nullable=False, index=True)
    content = Column(JSON, nullable=False)  # prompt/options/answer/audio fields

    __table_args__ = (
        UniqueConstraint("game_day_id", "order_in_day", name="uq_game_exercises_day_order"),
    )

