"""
Auth routes: signup (hashed password), login (JWT).
"""
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import bcrypt
from jose import JWTError, jwt
from app.auth_db import User, get_auth_db, init_auth_db, SessionLocal
from typing import Literal

router = APIRouter(prefix="/auth", tags=["Auth"])
security = HTTPBearer(auto_error=False)

SECRET_KEY = os.environ.get("JWT_SECRET", "dyslexai-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


class SignupRequest(BaseModel):
    name: str
    email: str  # validated as email in route
    password: str
    role: Literal["student", "teacher"] = "student"


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _password_bytes(password: str) -> bytes:
    """Bcrypt accepts at most 72 bytes. Truncate to avoid ValueError."""
    b = password.encode("utf-8")
    return b[:72] if len(b) > 72 else b


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_password_bytes(plain), hashed.encode("ascii"))


def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "email": email, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/signup", response_model=AuthResponse)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    email = (data.email or "").strip().lower()
    name = (data.name or "").strip() or "Learner"
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user = User(
            email=email,
            password_hash=hash_password(data.password),
            name=name,
            role=data.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user.id, user.email, user.role)
        return AuthResponse(
            access_token=token,
            user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
        )
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id, user.email, user.role)
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    )


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> int | None:
    if not credentials or credentials.credentials == "null":
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload.get("sub", 0))
    except (JWTError, ValueError):
        return None


@router.get("/me")
def me(user_id: int | None = Depends(get_current_user_id), db: Session = Depends(get_db)):
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}


@router.get("/user-by-email")
def user_by_email(email: str = Query(..., description="User email"), db: Session = Depends(get_db)):
    """
    Lightweight lookup used by teacher assignment flow to add a student by email.
    Returns whether a user exists in auth DB and basic profile info.
    """
    e = (email or "").strip().lower()
    if not e:
        raise HTTPException(status_code=400, detail="Email is required")
    user = db.query(User).filter(User.email == e).first()
    if not user:
        return {"found": False}
    return {
        "found": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    }
