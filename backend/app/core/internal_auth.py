"""Internal API himoyasi — service-to-service authentication.

radio-host va boshqa ichki servislar X-Internal-Key header orqali autentifikatsiya qiladi.
Bu /radio/segment, /radio/status POST kabi endpointlarni tashqi hujumdan himoyalaydi.
"""

import os
from fastapi import Depends, HTTPException, status, Request

from app.core.config import settings

INTERNAL_KEY = settings.internal_api_key


async def require_internal_key(request: Request) -> None:
    """Internal API endpoint'larni himoyalaydi.

    Agar INTERNAL_API_KEY bo'sh bo'lsa (dev) — o'tkazib yuboriladi.
    Production'da albatta qo'yish kerak.
    """
    if not INTERNAL_KEY:
        # Dev rejim — key yo'q, hamma o'tadi
        return

    key = request.headers.get("X-Internal-Key", "")
    if key != INTERNAL_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing internal API key",
        )
