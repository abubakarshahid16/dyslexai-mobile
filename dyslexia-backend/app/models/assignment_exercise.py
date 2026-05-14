from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint

from app.database import Base


class AssignmentExercise(Base):
    __tablename__ = "assignment_exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    exercise_id = Column(String, ForeignKey("exercises.id"), nullable=False, index=True)
    position = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("assignment_id", "exercise_id", name="uq_assignment_exercise"),
    )

