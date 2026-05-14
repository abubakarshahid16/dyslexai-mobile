"""Shared dependencies for auth enforcement."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.supabase_auth import SupabaseAuthError, supabase_get_user
import os
from jose import JWTError, jwt

SECRET_KEY = os.environ.get("JWT_SECRET", "dyslexai-dev-secret-change-in-production")
ALGORITHM = "HS256"

def get_current_user(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    """
    Require valid session (Supabase or local JWT) and return mapped local user.
    Use as Depends(get_current_user) on protected routes.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:].strip()
    
    # Try Supabase first if configured
    sb_user = None
    try:
        if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"):
            sb_user = supabase_get_user(token)
    except SupabaseAuthError:
        pass # Fallback to local JWT

    if sb_user:
        sb_uid = str(sb_user.get("id") or "").strip()
        email = str(sb_user.get("email") or "").strip().lower()
        if not sb_uid or not email:
            raise HTTPException(status_code=401, detail="Invalid session user payload")

        user = db.query(User).filter(User.supabase_user_id == sb_uid).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()
            if user and not user.supabase_user_id:
                user.supabase_user_id = sb_uid
                db.add(user)
                db.commit()
                db.refresh(user)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    # Fallback: Local JWT (from scan-backend)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user and email:
            user = db.query(User).filter(User.email == email.strip().lower()).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
