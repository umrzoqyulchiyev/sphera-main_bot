"""Authentication & Authorization dependencies.

- JWT token creation/validation
- Token blacklist (logout/ban support)
- Role-based access control
- Admin guard
"""

import logging
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core import redis as redis_client
from app.core.config import settings
from app.core.constants import ROLE_LEVELS
from app.core.database import db

log = logging.getLogger("auth")

ALGORITHM = settings.algorithm
TOKEN_EXPIRE_DAYS = settings.token_expire_days
SECRET_KEY = settings.secret_key
ADMIN_IDS = settings.admin_ids_set

security = HTTPBearer(auto_error=True)


def create_access_token(telegram_id: int) -> str:
    """JWT access token yaratadi."""
    expire = datetime.now(UTC) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(telegram_id),
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    """JWT token'ni decode qiladi. Xato bo'lsa HTTPException."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise JWTError("no subject")
        return int(sub)
    except (JWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Joriy foydalanuvchini oladi (token → blacklist check → membership → user)."""
    token = credentials.credentials

    # Token blacklist tekshiruvi (logout/ban)
    if await redis_client.is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    telegram_id = decode_token(token)

    # Guruhga bog'liqlik: 600s cache bilan a'zolik tekshiruvi
    from app.services import membership

    if not await membership.is_member_cached(telegram_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Group membership required",
        )

    row = await db.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # last_seen yangilash (har requestda emas, har 60s da)
    user = dict(row)
    now = datetime.now(UTC)
    last_seen = user.get("last_seen")
    if not last_seen or (now - last_seen.replace(tzinfo=UTC)).seconds > 60:
        await db.execute("UPDATE users SET last_seen = NOW() WHERE id = $1", user["id"])

    return user


def require_role(min_role: str):
    """Minimum rol talabi (dependency factory)."""

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        user_level = ROLE_LEVELS.get(user["role"], 0)
        needed = ROLE_LEVELS.get(min_role, 0)
        if user_level < needed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role '{min_role}' or higher",
            )
        return user

    return checker


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Admin-only access. Foydalanuvchi status/rolini o'zgartiradigan
    endpointlar FAQAT shu bilan qo'riqlanadi — moderator bu yerdan o'tolmaydi."""
    if user["telegram_id"] not in ADMIN_IDS and user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def is_staff(user: dict) -> bool:
    """Admin yoki moderator ekanini tekshiradi (dependency emas — oddiy
    bool, masalan guruh a'zoligi kabi shartli logikalar uchun)."""
    return user["telegram_id"] in ADMIN_IDS or user["role"] in ("admin", "moderator")


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Admin yoki moderator — admin-panelning deyarli barcha funksiyalari
    uchun (mavzular, efir, kasting, slotlar, musiqa, to'lov, poinт berish).
    Foydalanuvchi status/rolini o'zgartirish esa faqat require_admin talab
    qiladi — moderator boshqa hech kimning rolini o'zgartira olmaydi."""
    if not is_staff(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or moderator access required",
        )
    return user
