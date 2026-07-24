"""Efir jadvali (Broadcast Slots) — INTRA GROUP.

Boshliq g'oyasi: Admin ведущийga vaqt beradi ("soat 21:00 da efiring bor").
Ведущий bu linki ulashadi → odamlar kutadi → vaqt kelganda efir boshlanadi.

Endpointlar:
  GET  /slots                         — keldagi slotlar ro'yxati (hamma ko'radi)
  GET  /slots/upcoming                — keyingi 5 slot (mini-app anons uchun)
  POST /slots                         — [admin] yangi slot yaratish
  PUT  /slots/{id}/status             — [admin] status o'zgartirish (live/done/cancelled)
  GET  /slots/my                      — mening slotlarim (ведущий)
  GET  /slots/{id}                    — bitta slot
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import db
from app.core.dependencies import get_current_user, require_admin, require_staff
from app.core.models import OkResponse
from app.services import points as points_service
from app.services import pricing

log = logging.getLogger("slots")

router = APIRouter(prefix="/slots", tags=["slots"])

# TZ §3/§9/§12: ведущий эфир учун поинт билан tо'lайди — soatiga narx admin
# panelidan sozlanadi (app.services.pricing, "price_slot_per_hour").


class SlotCreateRequest(BaseModel):
    host_user_id: int  # kimga berilayapti
    title: str  # "Kechki efir: Sport haqida"
    description: str = ""
    scheduled_at: datetime  # efir boshlanadigan vaqt (UTC)
    duration_min: int = 60  # daqiqalarda


class SlotStatusRequest(BaseModel):
    status: str  # scheduled | live | done | cancelled


def _fmt_slot(r: dict) -> dict:
    """Slot'ni JSON-friendly formatga o'tkazadi + countdown qo'shadi."""
    now = datetime.now(UTC)
    sched = r["scheduled_at"]
    if sched.tzinfo is None:
        sched = sched.replace(tzinfo=UTC)

    diff = sched - now
    total_sec = int(diff.total_seconds())
    countdown = max(0, total_sec)

    return {
        **r,
        "scheduled_at": sched.isoformat(),
        "countdown_sec": countdown,  # frontend countdown timer uchun
        "is_soon": 0 < countdown < 3600,  # 1 soatdan kam qolgan
        "is_live_now": r["status"] == "live",
    }


# ──────────────────────────────────────────────────────────
# Public — hamma ko'radi
# ──────────────────────────────────────────────────────────


@router.get("/upcoming")
async def get_upcoming_slots(user: dict = Depends(get_current_user)):
    """Keyingi 5 ta rejalashtirilgan efir (anons uchun)."""
    rows = await db.fetch(
        """
        SELECT s.id, s.title, s.description, s.scheduled_at, s.duration_min,
               s.status, s.share_url,
               u.username, u.display_name, u.telegram_id as host_telegram_id
        FROM broadcast_slots s
        LEFT JOIN users u ON u.id = s.host_user_id
        WHERE s.status IN ('scheduled', 'live')
          AND s.scheduled_at >= NOW() - INTERVAL '10 minutes'
        ORDER BY s.scheduled_at ASC
        LIMIT 5
        """
    )
    return [_fmt_slot(dict(r)) for r in rows]


@router.get("/")
async def list_slots(user: dict = Depends(get_current_user)):
    """Barcha slotlar (admin + ведущий uchun to'liq ro'yxat)."""
    rows = await db.fetch(
        """
        SELECT s.id, s.title, s.description, s.scheduled_at, s.duration_min,
               s.status, s.share_url, s.cost_points, s.created_at,
               u.username, u.display_name, u.telegram_id as host_telegram_id
        FROM broadcast_slots s
        LEFT JOIN users u ON u.id = s.host_user_id
        ORDER BY s.scheduled_at DESC
        LIMIT 50
        """
    )
    return [_fmt_slot(dict(r)) for r in rows]


@router.get("/my")
async def my_slots(user: dict = Depends(get_current_user)):
    """Mening slotlarim (ведущий)."""
    rows = await db.fetch(
        """
        SELECT s.id, s.title, s.description, s.scheduled_at, s.duration_min,
               s.status, s.share_url
        FROM broadcast_slots s
        WHERE s.host_user_id = $1
        ORDER BY s.scheduled_at DESC
        LIMIT 20
        """,
        user["id"],
    )
    return [_fmt_slot(dict(r)) for r in rows]


@router.get("/{slot_id}")
async def get_slot(slot_id: int, user: dict = Depends(get_current_user)):
    """Bitta slot (countdown bilan)."""
    row = await db.fetchrow(
        """
        SELECT s.id, s.title, s.description, s.scheduled_at, s.duration_min,
               s.status, s.share_url, s.cost_points,
               u.username, u.display_name, u.telegram_id as host_telegram_id
        FROM broadcast_slots s
        LEFT JOIN users u ON u.id = s.host_user_id
        WHERE s.id = $1
        """,
        slot_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Slot not found")
    return _fmt_slot(dict(row))


# ──────────────────────────────────────────────────────────
# Admin — slot boshqarish
# ──────────────────────────────────────────────────────────


@router.post("/", response_model=OkResponse)
async def create_slot(
    payload: SlotCreateRequest,
    # Slot ochish (ведущийga vaqt va poinт xarajatini belgilash) — resurs
    # taqsimoti qarori, FAQAT admin. Moderator status/live/cancel bilan
    # ishlashda davom etadi (require_staff, pastda), lekin yangi slot
    # ochа olmaydi.
    admin: dict = Depends(require_admin),
):
    """[admin] Yangi efir sloti yaratish."""
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title required")

    # broadcast_slots.scheduled_at ustuni TIMESTAMP (timezone'siz), lekin
    # frontend har doim ISO string (masalan "...Z") yuboradi — Pydantic buni
    # timezone-aware datetime'ga aylantiradi. asyncpg esa timezone-siz
    # ustunga timezone-aware datetime bersa "can't subtract offset-naive
    # and offset-aware datetimes" xatosi bilan yiqiladi (500). UTC'ga
    # normallashtirib, tzinfo'ni olib tashlaymiz — _fmt_slot ham xuddi shu
    # "DB'dagi naive datetime = UTC" shartnomasiga tayanadi.
    scheduled_at = payload.scheduled_at
    if scheduled_at.tzinfo is not None:
        scheduled_at = scheduled_at.astimezone(UTC).replace(tzinfo=None)

    # Ведущий mavjudmi va level 3+ mi?
    host = await db.fetchrow(
        "SELECT id, username, display_name, level, role FROM users WHERE id = $1",
        payload.host_user_id,
    )
    if not host:
        raise HTTPException(status_code=404, detail="Host user not found")
    if host["level"] < 3 and host["role"] not in ("doverenniy", "admin"):
        raise HTTPException(status_code=400, detail="Host must be level 3 (doverenniy) or admin")

    # TZ §3/§9: ведущий слот учун поинт билан tо'lайди.
    cost_points = (
        pricing.get("price_slot_per_hour") * Decimal(payload.duration_min) / Decimal(60)
    ).quantize(Decimal("0.0001"))

    # Avval slotni yaratamiz, keyin to'lovni yechamiz (spend() va INSERT
    # bitta tranzaksiyada emas — spend() birinchi bo'lsa-yu INSERT keyin
    # muvaffaqiyatsiz tugasa, poinт allaqachon yechilgan bo'lardi-yu, slot
    # hech qachon yaratilmasdi). Shu tartibda: agar to'lov muvaffaqiyatsiz
    # bo'lsa, endigina yaratilgan slotni o'chirib, holatni tozalaymiz.
    bot_username = "mybot_12_bot"  # env'dan olish mumkin keyinroq
    row = await db.fetchrow(
        """
        INSERT INTO broadcast_slots
          (host_user_id, title, description, scheduled_at, duration_min, created_by, cost_points)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, title, scheduled_at
        """,
        payload.host_user_id,
        title,
        payload.description.strip(),
        scheduled_at,
        payload.duration_min,
        admin["id"],
        cost_points,
    )

    spent = await points_service.spend(payload.host_user_id, "slot_booking", cost_points)
    if not spent["ok"]:
        await db.execute("DELETE FROM broadcast_slots WHERE id = $1", row["id"])
        raise HTTPException(
            status_code=402,
            detail={
                "error": "insufficient_points",
                "required": str(cost_points),
                "points": str(spent["points"]),
            },
        )

    # Share URL'ni yangilaymiz
    share_url = f"https://t.me/{bot_username}?start=slot_{row['id']}"
    await db.execute(
        "UPDATE broadcast_slots SET share_url = $1 WHERE id = $2",
        share_url,
        row["id"],
    )

    log.info(
        "Slot created: id=%d title=%s host=%s scheduled=%s",
        row["id"],
        title,
        host["username"],
        payload.scheduled_at,
    )
    return OkResponse(
        detail={
            "slot_id": row["id"],
            "title": row["title"],
            "share_url": share_url,
            "scheduled_at": row["scheduled_at"].isoformat(),
        }
    )


@router.put("/{slot_id}/status", response_model=OkResponse)
async def update_slot_status(
    slot_id: int,
    payload: SlotStatusRequest,
    admin: dict = Depends(require_staff),
):
    """[admin] Slot statusini o'zgartirish."""
    valid = {"scheduled", "live", "done", "cancelled"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")

    result = await db.execute(
        "UPDATE broadcast_slots SET status = $1 WHERE id = $2",
        payload.status,
        slot_id,
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Slot not found")

    log.info("Slot %d status → %s (by admin %d)", slot_id, payload.status, admin["id"])
    return OkResponse(detail={"slot_id": slot_id, "status": payload.status})


@router.delete("/{slot_id}", response_model=OkResponse)
async def delete_slot(slot_id: int, admin: dict = Depends(require_staff)):
    """[admin] Slotni o'chirish (faqat scheduled holat)."""
    slot = await db.fetchrow("SELECT status FROM broadcast_slots WHERE id = $1", slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot["status"] == "live":
        raise HTTPException(status_code=400, detail="Cannot delete live slot")

    await db.execute("DELETE FROM broadcast_slots WHERE id = $1", slot_id)
    return OkResponse(detail={"slot_id": slot_id, "deleted": True})
