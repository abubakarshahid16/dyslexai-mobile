from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, JSON
from sqlalchemy import ForeignKey
from datetime import datetime, timezone
import uuid
from app.database import Base

class Session(Base):
    __tablename__ = "sessions"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id       = Column(String, ForeignKey("students.id"), nullable=False)
    exercise_id      = Column(String, ForeignKey("exercises.id"), nullable=False)
    assignment_id    = Column(Integer, ForeignKey("assignments.id"), nullable=True, index=True)
    started_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    submitted_at     = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    student_response = Column(Text, nullable=True)
    expected         = Column(Text, nullable=True)
    score            = Column(Float, nullable=True)
    char_errors      = Column(JSON, default=list)
    phonetic_score   = Column(Float, nullable=True)
    feedback         = Column(Text, nullable=True)
    is_handwriting   = Column(Boolean, default=False)
    ocr_confidence   = Column(Float, nullable=True)