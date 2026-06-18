"""Admin router — INTRA GROUP v3.0.

- Foydalanuvchi level o'zgartirish
- Point qo'shish
- Yangilik boshqarish (news router'da)
"""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import db
from app.core.models import AdminSetLevelRequest, AdminAddPointsRequest, OkResponse
from app.core.dependencies import require_admin
from app.services import points as points_service

log = logging.getLogger("admin")

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users/set-level", response_model=OkResponse)
async def set_user_level(
    payload: AdminSetLevelRequest,
    admin: dict = Depends(require_admin),
):
    """Foydalanuvchi levelini o'zgartirish (1, 2, 3).

    TZ §1:
      level 1 → listener   (tinglash)
      level 2 → aktivniy   (pointlar bor, chat + studiya)
      level 3 → doverenniy (admin beradi, efirga chiqish huquqi)
    """
    if payload.level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")

    # TZ §1: level 3 = doverenniy — FAQAT admin beradi
    role_map = {1: "listener", 2: "aktivniy", 3: "doverenniy"}
    role = role_map[payload.level]

    result = await db.execute(
        "UPDATE users SET level = $1, role = $2 WHERE id = $3",
        payload.level, role, payload.user_id,
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="User not found")

    log.info("Admin %d set level=%d role=%s for user=%d", admin["id"], payload.level, role, payload.user_id)
    return OkResponse(detail={"user_id": payload.user_id, "level": payload.level, "role": role})


@router.post("/users/add-points", response_model=OkResponse)
async def add_points(
    payload: AdminAddPointsRequest,
    admin: dict = Depends(require_admin),
):
    """Admin: foydalanuvchiga point qo'shish."""
    result = await points_service.add_points_admin(payload.user_id, payload.amount)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result.get("reason"))
    return OkResponse(detail={"user_id": payload.user_id, "points": str(result["points"])})


@router.get("/users", response_model=list)
async def list_users(admin: dict = Depends(require_admin)):
    """Barcha foydalanuvchilar ro'yxati."""
    rows = await db.fetch(
        """
        SELECT id, telegram_id, username, display_name, language, level, points, role, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 200
        """
    )
    return [dict(r) for r in rows]
