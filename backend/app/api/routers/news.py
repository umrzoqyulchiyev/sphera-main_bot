"""News router — onboarding yangiliklari.

Foydalanuvchi til tanlagandan keyin — o'sha davlat haqida yangiliklar ko'rsatiladi.
Admin yangiliklar qo'shadi/o'chiradi.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import db
from app.core.models import NewsOut, OkResponse, AdminNewsCreate
from app.core.dependencies import get_current_user, require_admin
from app.core.constants import SUPPORTED_LANGUAGES

log = logging.getLogger("news")

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/{language}", response_model=list[NewsOut])
async def get_news(language: str):
    """Tanlangan til bo'yicha yangiliklar (onboarding ekrani).

    Til tanlagandan keyin — shu davlat haqida yangiliklar ro'yxati.
    """
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language")

    rows = await db.fetch(
        """
        SELECT id, title, body, image_url, created_at
        FROM news
        WHERE language = $1 AND is_active = true
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 20
        """,
        language,
    )
    return [NewsOut(**dict(r)) for r in rows]


@router.post("", response_model=OkResponse, dependencies=[Depends(require_admin)])
async def create_news(payload: AdminNewsCreate):
    """Admin: yangilik qo'shish."""
    if payload.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported language")

    await db.execute(
        """
        INSERT INTO news (language, title, body, image_url)
        VALUES ($1, $2, $3, $4)
        """,
        payload.language, payload.title, payload.body, payload.image_url,
    )
    return OkResponse(detail={"message": "News created"})


@router.delete("/{news_id}", response_model=OkResponse, dependencies=[Depends(require_admin)])
async def delete_news(news_id: int):
    """Admin: yangilikni o'chirish (soft delete)."""
    await db.execute("UPDATE news SET is_active = false WHERE id = $1", news_id)
    return OkResponse(detail={"deleted": news_id})
