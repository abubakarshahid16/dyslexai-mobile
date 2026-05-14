from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from datetime import datetime, timezone
import uuid
from app.database import Base

class Student(Base):
    __tablename__ = "students"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)  # linked auth user (null for teacher-created students)
    name             = Column(String, nullable=False)
    age              = Column(Integer, nullable=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_active      = Column(DateTime, nullable=True)
    difficulty_level = Column(Integer, default=1)
    total_sessions   = Column(Integer, default=0)
    streak_days      = Column(Integer, default=0)