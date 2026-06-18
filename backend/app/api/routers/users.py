"""Users/Profile router — INTRA GROUP v3.0.

Profil sahifasi:
1. Level (1-3)
2. Tanlangan til
3. ID
4. Points (kasr)
5. Display name / username tahrirlash
6. Point so'rash / berish / sotib olish
"""

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import db
from app.core.models import (
    UserProfileOut, UpdateProfileRequest, OkResponse,
    PointsBalanceOut, PointsTransferRequest, PointsTransactionOut,
    PointsRequestCreate, PointsRequestOut, PointsRequestDecision,
    PointPackageOut, PurchaseRequest,
)
from app.core.dependencies import get_current_user
from app.core.constants import LEVELS
from app.services import points as points_service

log = logging.getLogger("users")

router = APIRouter(prefix="/users", tags=["users"])


def _level_name(level: int) -> str:
    return LEVELS.get(level, "Слушатель")


# TZ §1: Rol nomi (role maydoni bo'yicha)
ROLE_DISPLAY: dict[str, str] = {
    "listener":   "Слушатель",
    "aktivniy":   "Активный",
    "doverenniy": "Доверенный",
    "admin":      "Администратор",
}


@router.get("/me", response_model=UserProfileOut)
async def get_me(user: dict = Depends(get_current_user)):
    """Profil ma'lumotlari (TZ §1 + §4: level, role, psixotip)."""
    return UserProfileOut(
        id=user["id"],
        telegram_id=user["telegram_id"],
        username=user["username"],
        display_name=user["display_name"] or user["full_name"],
        language=user["language"],
        level=user["level"],
        level_name=_level_name(user["level"]),
        points=user["points"],
        role=user["role"],
        # TZ §4: psixologik profil (oxirgi tahlil natijasi)
        focus_of_attention=user.get("focus_of_attention"),
        emotional_tone=user.get("emotional_tone"),
        key_topic=user.get("key_topic"),
    )


@router.put("/me", response_model=OkResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
):
    """Display name va username tahrirlash."""
    updates = []
    params = []
    idx = 1

    if payload.display_name is not None:
        if len(payload.display_name.strip()) < 1:
            raise HTTPException(status_code=400, detail="Display name cannot be empty")
        idx += 1
        updates.append(f"display_name = ${idx}")
        params.append(payload.display_name.strip()[:100])

    if payload.username is not None:
        if len(payload.username.strip()) < 1:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        idx += 1
        updates.append(f"username = ${idx}")
        params.append(payload.username.strip()[:50])

    if not updates:
        return OkResponse(detail={"message": "Nothing to update"})

    query = f"UPDATE users SET {', '.join(updates)} WHERE id = $1"
    await db.execute(query, user["id"], *params)
    return OkResponse(detail={"message": "Profile updated"})


# ============ Points ============
@router.get("/me/points", response_model=PointsBalanceOut)
async def get_points(user: dict = Depends(get_current_user)):
    """Joriy point balansi."""
    return PointsBalanceOut(
        points=user["points"],
        level=user["level"],
        level_name=_level_name(user["level"]),
    )


@router.get("/me/points/history", response_model=list[PointsTransactionOut])
async def get_points_history(user: dict = Depends(get_current_user)):
    """Oxirgi 50 ta tranzaksiya."""
    rows = await db.fetch(
        """
        SELECT id, amount, event_type, description, created_at
        FROM points_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        """,
        user["id"],
    )
    return [PointsTransactionOut(**dict(r)) for r in rows]


@router.post("/me/points/transfer", response_model=OkResponse)
async def transfer_points(
    payload: PointsTransferRequest,
    user: dict = Depends(get_current_user),
):
    """Boshqa foydalanuvchiga point o'tkazish (ID bo'yicha)."""
    result = await points_service.transfer(user["id"], payload.to_user_id, payload.amount)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("reason", "Transfer failed"))
    return OkResponse(detail={"points": result["points"]})


# ============ Point so'rovlari ============
@router.post("/me/points/request", response_model=OkResponse)
async def request_points(
    payload: PointsRequestCreate,
    user: dict = Depends(get_current_user),
):
    """Boshqa foydalanuvchidan point so'rash."""
    # user = so'rovchi (from), payload.from_user_id = kimdan so'ralyapti (to)
    target = await db.fetchrow("SELECT id FROM users WHERE id = $1", payload.from_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    result = await points_service.create_request(
        from_user_id=user["id"],
        to_user_id=payload.from_user_id,
        amount=payload.amount,
        message=payload.message,
    )
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("reason"))
    return OkResponse(detail={"request_id": result["request_id"]})


@router.get("/me/points/requests", response_model=list[PointsRequestOut])
async def get_my_requests(user: dict = Depends(get_current_user)):
    """Menga kelgan point so'rovlari (pending)."""
    rows = await db.fetch(
        """
        SELECT pr.*, u.display_name AS from_display_name
        FROM points_requests pr
        LEFT JOIN users u ON u.id = pr.from_user_id
        WHERE pr.to_user_id = $1 AND pr.status = 'pending'
        ORDER BY pr.created_at DESC
        """,
        user["id"],
    )
    return [PointsRequestOut(**dict(r)) for r in rows]


@router.post("/me/points/requests/{request_id}/decide", response_model=OkResponse)
async def decide_point_request(
    request_id: int,
    payload: PointsRequestDecision,
    user: dict = Depends(get_current_user),
):
    """Point so'rovini tasdiqlash yoki rad etish."""
    result = await points_service.decide_request(request_id, user["id"], payload.approve)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("reason"))
    return OkResponse(detail={"status": result["status"]})


# ============ Point sotib olish ============
@router.get("/me/points/packages", response_model=list[PointPackageOut])
async def get_packages():
    """Mavjud point paketlari (narxlar)."""
    rows = await db.fetch(
        "SELECT id, points_amount, price_eur, label FROM point_packages WHERE is_active = true ORDER BY price_eur"
    )
    return [PointPackageOut(**dict(r)) for r in rows]


@router.post("/me/points/purchase", response_model=OkResponse)
async def purchase_points(
    payload: PurchaseRequest,
    user: dict = Depends(get_current_user),
):
    """Point sotib olish (test rejim — real to'lov keyinchalik).

    Paket tanlash → bir marta points qo'shiladi + bir marta transaction yoziladi.
    """
    pkg = await db.fetchrow(
        "SELECT * FROM point_packages WHERE id = $1 AND is_active = true",
        payload.package_id,
    )
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")

    # add_points — ichida transaction ham yozadi, level ham yangilanadi
    result = await points_service.add_points(
        user["id"],
        pkg["points_amount"],
        event_type="purchase",
        description=f"Purchased {pkg['label']} for €{pkg['price_eur']}",
    )
    if not result["ok"]:
        raise HTTPException(status_code=500, detail="Purchase failed")

    return OkResponse(detail={"points": str(result["points"]), "purchased": str(pkg["points_amount"])})
