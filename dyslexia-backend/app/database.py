from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

_raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./dyslexia.db").strip()
# SQLAlchemy expects postgresql:// (postgres:// is a legacy alias)
if _raw_db_url.startswith("postgres://"):
    _raw_db_url = _raw_db_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = _raw_db_url
IS_SQLITE = DATABASE_URL.startswith("sqlite")

# SQLite needs check_same_thread; Postgres (e.g. Supabase) needs SSL on public endpoints
if IS_SQLITE:
    _connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=_connect_args)
else:
    _connect_args = {}
    if "supabase" in DATABASE_URL.lower() and "sslmode" not in DATABASE_URL.lower():
        _connect_args["sslmode"] = "require"
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args=_connect_args,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()