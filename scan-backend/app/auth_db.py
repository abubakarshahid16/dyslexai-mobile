"""
Auth: SQLite (default) or PostgreSQL (Supabase / shared DATABASE_URL).
Passwords hashed with bcrypt; JWT for sessions.

- Set AUTH_DATABASE_URL to a postgresql:// URL to use Postgres for users only.
- If unset, DATABASE_URL is used when it is a PostgreSQL URL (same DB as dyslexia-backend).
- Otherwise SQLite (AUTH_DB_PATH or scan-backend/dyslexai_auth.db).

For Supabase, add sslmode=require in the URL if your project requires it.
"""
import os
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from dotenv import load_dotenv

    _scan_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_scan_root, ".env"))
    load_dotenv()
except ImportError:
    pass

Base = declarative_base()


def _is_postgres_url(url: str) -> bool:
    u = (url or "").strip().lower()
    return u.startswith(("postgresql://", "postgresql+psycopg2://", "postgres://"))


def _sqlite_url() -> str:
    _dir = os.path.dirname(os.path.abspath(__file__))
    _parent = os.path.dirname(_dir)
    db_path = os.environ.get("AUTH_DB_PATH", os.path.join(_parent, "dyslexai_auth.db"))
    db_path = os.path.abspath(db_path)
    _db_dir = os.path.dirname(db_path)
    if _db_dir:
        os.makedirs(_db_dir, exist_ok=True)
    return f"sqlite:///{db_path.replace(os.sep, '/')}"


def _resolve_engine():
    auth_url = (os.environ.get("AUTH_DATABASE_URL") or "").strip()
    db_url = (os.environ.get("DATABASE_URL") or "").strip()

    if auth_url:
        if not _is_postgres_url(auth_url):
            raise ValueError("AUTH_DATABASE_URL must be a postgresql:// connection string when set.")
        engine = create_engine(
            auth_url,
            pool_pre_ping=True,
            pool_size=int(os.environ.get("DB_POOL_SIZE", "5")),
            max_overflow=int(os.environ.get("DB_MAX_OVERFLOW", "10")),
        )
        return engine, "postgres"

    if db_url and _is_postgres_url(db_url):
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=int(os.environ.get("DB_POOL_SIZE", "5")),
            max_overflow=int(os.environ.get("DB_MAX_OVERFLOW", "10")),
        )
        return engine, "postgres"

    url = _sqlite_url()
    engine = create_engine(url, connect_args={"check_same_thread": False})
    return engine, "sqlite"


engine, DB_DIALECT = _resolve_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="student")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def init_auth_db():
    Base.metadata.create_all(bind=engine)

    if DB_DIALECT != "sqlite":
        return

    try:
        with engine.connect() as conn:
            rows = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            existing_cols = {r[1] for r in rows}
            if "role" not in existing_cols:
                conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'student'"
                )
                conn.commit()
    except Exception as e:
        print(f"[auth_db] role migration skipped/failed: {e}")


def get_auth_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
