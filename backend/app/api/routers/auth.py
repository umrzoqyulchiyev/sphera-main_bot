"""Auth router — INTRA GROUP v3.0.

Flow:
1. POST /auth/telegram → token + is_new_user
2. Agar is_new_user=True → frontend til tanlash ekranini ko'rsatadi
3. POST /auth/select-language → til saqlanadi, yangiliklar ko'rsatiladi
"""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import db
from app.core.config import settings
from app.core.models import (
    TelegramAuthRequest, AuthResponse, SelectLanguageRequest, OkResponse,
)
from app.core.dependencies import create_access_token, get_current_user
from app.core.rate_limit import rate_limit
from app.core.constants import SUPPORTED_LANGUAGES, INITIAL_POINTS

log = logging.getLogger("auth")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/telegram",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
async def auth_telegram(payload: TelegramAuthRequest):
    """Telegram orqali kirish. Yangi foydalanuvchi bo'lsa is_new_user=True."""
    row = await db.fetchrow(
        "SELECT * FROM users WHERE telegram_id = $1", payload.telegram_id
    )

    is_new = False
    if row is None:
        row = await db.fetchrow(
            """
            INSERT INTO users (telegram_id, username, full_name, display_name, points)
            VALUES ($1, $2, $3, $3, $4)
            RETURNING *
            """,
            payload.telegram_id,
            payload.username,
            payload.full_name,
            Decimal(str(INITIAL_POINTS)),
        )
        is_new = True
        log.info("New user: telegram_id=%d", payload.telegram_id)
    else:
        row = await db.fetchrow(
            """
            UPDATE users
            SET username = COALESCE($2, username),
                full_name = COALESCE($3, full_name),
                last_seen = NOW()
            WHERE telegram_id = $1
            RETURNING *
            """,
            payload.telegram_id,
            payload.username,
            payload.full_name,
        )

    token = create_access_token(payload.telegram_id)

    return AuthResponse(
        token=token,
        is_new_user=is_new,
        language=row["language"],
        level=row["level"],
        points=row["points"],
    )


@router.post("/select-language", response_model=OkResponse)
async def select_language(
    payload: SelectLanguageRequest,
    user: dict = Depends(get_current_user),
):
    """Foydalanuvchi tilni tanlaydi (birinchi kirganida yoki profilda)."""
    if payload.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language. Use: ru, en, lt")

    await db.execute(
        "UPDATE users SET language = $1 WHERE id = $2",
        payload.language, user["id"],
    )
    return OkResponse(detail={"language": payload.language})
