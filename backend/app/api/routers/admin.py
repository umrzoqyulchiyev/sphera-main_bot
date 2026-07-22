"""Admin router — INTRA GROUP v3.0.

- Foydalanuvchi level o'zgartirish
- Point qo'shish
- Yangilik boshqarish (news router'da)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import db
from app.core.dependencies import require_admin
from app.core.models import (
    AdminAddPointsRequest,
    AdminSetAdminRequest,
    AdminSetLevelRequest,
    OkResponse,
    PackageCreate,
    PackageOut,
    PackageUpdate,
    PaymentSettingsOut,
    PaymentSettingsUpdate,
)
from app.core.ws_manager import manager
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
        payload.level,
        role,
        payload.user_id,
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="User not found")

    log.info(
        "Admin %d set level=%d role=%s for user=%d",
        admin["id"],
        payload.level,
        role,
        payload.user_id,
    )
    return OkResponse(detail={"user_id": payload.user_id, "level": payload.level, "role": role})


@router.post("/users/set-admin", response_model=OkResponse)
async def set_admin(
    payload: AdminSetAdminRequest,
    admin: dict = Depends(require_admin),
):
    """[admin] To'liq admin huquqini berish yoki qaytarib olish.

    level 1/2/3 zinapoyasidan alohida — bu doverenniy'dan ham yuqori,
    cheklovsiz huquq (butun /admin panelga kirish, jumladan boshqa
    foydalanuvchilarga ham admin bera olish). Faqat mavjud admin bera oladi
    (require_admin), va o'zini-o'zi qaytarib ololmaydi — aks holda bitta
    xato bosish bilan hech kim panelga kira olmay qolishi mumkin edi.
    """
    if payload.user_id == admin["id"] and not payload.is_admin:
        raise HTTPException(status_code=400, detail="Cannot revoke your own admin access")

    # Qaytarib olinganda "doverenniy"ga tushadi — bu eng yuqori
    # admin-bo'lmagan ishonch darajasi, aniqroq fallback yo'q.
    new_role = "admin" if payload.is_admin else "doverenniy"
    result = await db.execute(
        "UPDATE users SET role = $1, level = 3 WHERE id = $2",
        new_role,
        payload.user_id,
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="User not found")

    log.info(
        "Admin %d %s admin rights for user=%d",
        admin["id"],
        "granted" if payload.is_admin else "revoked",
        payload.user_id,
    )
    return OkResponse(detail={"user_id": payload.user_id, "role": new_role})


@router.post("/users/add-points", response_model=OkResponse)
async def add_points(
    payload: AdminAddPointsRequest,
    admin: dict = Depends(require_admin),
):
    """Admin: foydalanuvchiga point qo'shish."""
    result = await points_service.add_points_admin(payload.user_id, payload.amount)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result.get("reason"))
    # Oluvchini darhol xabardor qilish — 20s poll yoki mini appni qayta
    # ochishni kutmasin (chat_ws barcha ulanishlarni "global" xonaga
    # qo'shadi, frontend user_id bo'yicha filtrlaydi).
    await manager.broadcast(
        "global",
        {
            "type": "points_update",
            "data": {"user_id": payload.user_id, "points": str(result["points"])},
        },
    )
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


# ============================================================
# To'lov sozlamalari — admin poinт to'lovi qanday ishlashini belgilaydi
# (Telegram Stars orqali avtomatik, yoki qo'lda/kontakt orqali)
# ============================================================
@router.get("/settings/payment", response_model=PaymentSettingsOut)
async def get_payment_settings(admin: dict = Depends(require_admin)):
    rows = await db.fetch(
        "SELECT key, value FROM app_settings WHERE key IN ('payment_method', 'payment_instructions')"
    )
    values = {r["key"]: r["value"] for r in rows}
    return PaymentSettingsOut(
        method=values.get("payment_method", "stars"),
        instructions=values.get("payment_instructions", ""),
    )


@router.put("/settings/payment", response_model=PaymentSettingsOut)
async def update_payment_settings(
    payload: PaymentSettingsUpdate,
    admin: dict = Depends(require_admin),
):
    if payload.method not in ("stars", "manual"):
        raise HTTPException(status_code=400, detail="method must be 'stars' or 'manual'")

    await db.execute(
        """
        INSERT INTO app_settings (key, value, updated_at) VALUES ('payment_method', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        """,
        payload.method,
    )
    await db.execute(
        """
        INSERT INTO app_settings (key, value, updated_at) VALUES ('payment_instructions', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        """,
        payload.instructions.strip(),
    )
    log.info("Admin %d payment settings o'zgartirdi: method=%s", admin["id"], payload.method)
    return PaymentSettingsOut(method=payload.method, instructions=payload.instructions.strip())


# ============================================================
# Point paketlari — narx/miqdor/faollik admin tomonidan boshqariladi
# ============================================================
@router.get("/packages", response_model=list[PackageOut])
async def admin_list_packages(admin: dict = Depends(require_admin)):
    rows = await db.fetch(
        "SELECT id, points_amount, price_eur, label, is_active FROM point_packages ORDER BY price_eur"
    )
    return [PackageOut(**dict(r)) for r in rows]


@router.post("/packages", response_model=PackageOut)
async def admin_create_package(payload: PackageCreate, admin: dict = Depends(require_admin)):
    row = await db.fetchrow(
        """
        INSERT INTO point_packages (points_amount, price_eur, label, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING id, points_amount, price_eur, label, is_active
        """,
        payload.points_amount,
        payload.price_eur,
        payload.label.strip(),
    )
    log.info("Admin %d yangi paket yaratdi: %s", admin["id"], payload.label)
    return PackageOut(**dict(row))


@router.put("/packages/{package_id}", response_model=PackageOut)
async def admin_update_package(
    package_id: int, payload: PackageUpdate, admin: dict = Depends(require_admin)
):
    row = await db.fetchrow(
        """
        UPDATE point_packages
        SET points_amount = $2, price_eur = $3, label = $4, is_active = $5
        WHERE id = $1
        RETURNING id, points_amount, price_eur, label, is_active
        """,
        package_id,
        payload.points_amount,
        payload.price_eur,
        payload.label.strip(),
        payload.is_active,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Package not found")
    return PackageOut(**dict(row))


@router.delete("/packages/{package_id}", response_model=OkResponse)
async def admin_delete_package(package_id: int, admin: dict = Depends(require_admin)):
    result = await db.execute("DELETE FROM point_packages WHERE id = $1", package_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Package not found")
    return OkResponse(detail={"package_id": package_id})


# ============================================================
# Efir mavzulari (topics) — admin boshqaradi
# ============================================================
class TopicCreateRequest(BaseModel):
    title: str
    description: str = ""


@router.post("/topics")
async def create_topic(payload: TopicCreateRequest, admin: dict = Depends(require_admin)):
    """[admin] Yangi efir mavzusi yaratadi. Eski faollarni 'closed' qiladi."""
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title required")

    # Avvalgi faol mavzularni yopamiz (bir vaqtda bitta faol mavzu)
    await db.execute("UPDATE topics SET status = 'closed' WHERE status = 'active'")

    row = await db.fetchrow(
        """
        INSERT INTO topics (title, description, status, created_by)
        VALUES ($1, $2, 'active', $3)
        RETURNING id, title, description, status, created_at
        """,
        title,
        payload.description.strip(),
        admin["id"],
    )
    log.info("Admin %d yangi mavzu yaratdi: %s", admin["id"], title)
    return dict(row)


@router.get("/topics")
async def list_topics(admin: dict = Depends(require_admin)):
    """[admin] Barcha mavzular ro'yxati (fikrlar soni bilan)."""
    rows = await db.fetch(
        """
        SELECT t.id, t.title, t.description, t.status, t.created_at,
               COUNT(o.id) AS opinion_count
        FROM topics t
        LEFT JOIN opinions o ON o.topic_id = t.id
        GROUP BY t.id
        ORDER BY t.created_at DESC
        LIMIT 100
        """
    )
    return [dict(r) for r in rows]


@router.post("/topics/{topic_id}/close", response_model=OkResponse)
async def close_topic(topic_id: int, admin: dict = Depends(require_admin)):
    """[admin] Mavzuni yopadi (fikr yig'ish to'xtaydi)."""
    result = await db.execute("UPDATE topics SET status = 'closed' WHERE id = $1", topic_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Topic not found")
    return OkResponse(detail={"topic_id": topic_id, "status": "closed"})


@router.get("/topics/{topic_id}/opinions")
async def topic_opinions(topic_id: int, admin: dict = Depends(require_admin)):
    """[admin] Mavzudagi barcha fikrlar (moderatsiya/ko'rish uchun)."""
    rows = await db.fetch(
        """
        SELECT o.id, o.kind, o.text, o.tg_file_id, o.tg_message_id,
               o.points_spent, o.status, o.created_at,
               u.username, u.display_name, u.telegram_id
        FROM opinions o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.topic_id = $1
        ORDER BY o.created_at DESC
        LIMIT 500
        """,
        topic_id,
    )
    return [dict(r) for r in rows]


# ============================================================
# OPINION AGREGATSIYA — boshliq asosiy g'oyasi
# Fikrlar → 3 pozitsiya → 2 personaj dialog → efir
# ============================================================


@router.post("/topics/{topic_id}/aggregate")
async def aggregate_topic_opinions(topic_id: int, admin: dict = Depends(require_admin)):
    """[admin] Mavzu bo'yicha fikrlarni yig'ib, 3 pozitsiya va dialog yaratadi.

    Boshliqning asosiy g'oyasi:
      Opinions → Gemini → 1/2/3 ko'pchilik pozitsiya → 2 personaj (Aleksey+Maya) dialog
      → broadcast_drafts da 'pending' → tasdiqlansa efirga chiqadi.
    """
    from app.services.opinion_aggregator import aggregate_opinions

    draft = await aggregate_opinions(topic_id)
    if draft is None:
        # Fikr soni yetarli emas yoki mavzu topilmadi
        topic = await db.fetchrow(
            "SELECT id, (SELECT COUNT(*) FROM opinions WHERE topic_id=$1 AND kind='text') cnt FROM topics WHERE id=$1",
            topic_id,
        )
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        raise HTTPException(
            status_code=400,
            detail=f"Fikr yetarli emas (hozir: {topic['cnt']}, kerak: 3+). "
            "Avval foydalanuvchilar fikr yuborgach agregatsiya qiling.",
        )
    return {
        "ok": True,
        "draft_id": draft["id"],
        "topic": draft["main_topic"],
        "source_count": draft["source_count"],
        "status": draft["status"],
        "message": "Dialog yaratildi. /admin/drafts/{id} dan ko'ring va tasdiqlang.",
    }


@router.get("/drafts")
async def list_drafts(admin: dict = Depends(require_admin)):
    """[admin] Barcha broadcast drafts (pending/approved/rejected)."""
    rows = await db.fetch(
        """
        SELECT id, city, main_topic, source_count, status, created_at,
               LEFT(script, 300) as script_preview
        FROM broadcast_drafts
        ORDER BY created_at DESC
        LIMIT 50
        """
    )
    return [dict(r) for r in rows]


@router.get("/drafts/{draft_id}")
async def get_draft(draft_id: int, admin: dict = Depends(require_admin)):
    """[admin] Draft to'liq (dialog matni + META)."""
    from app.services.opinion_aggregator import get_draft_dialog

    draft = await get_draft_dialog(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.post("/drafts/{draft_id}/approve")
async def approve_draft(draft_id: int, admin: dict = Depends(require_admin)):
    """[admin] Dilaogni tasdiqlaydi va MediaMTX efirga yuboradi.

    Zanjir: draft.script (dialog) → TTS (3 til) → continuous navbatiga → efir.
    """
    from app.services.opinion_aggregator import get_draft_dialog

    draft = await get_draft_dialog(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Draft already {draft['status']}")

    # Statusni yangilaymiz
    await db.execute("UPDATE broadcast_drafts SET status = 'approved' WHERE id = $1", draft_id)

    # TTS va efirga yuborish (fon vazifasi — bloklamasin)
    import asyncio

    asyncio.create_task(_broadcast_dialog(draft))

    return {
        "ok": True,
        "draft_id": draft_id,
        "message": "Dialog tasdiqlandi. TTS va efirga yuborish boshlandi.",
    }


@router.post("/drafts/{draft_id}/reject")
async def reject_draft(draft_id: int, admin: dict = Depends(require_admin)):
    """[admin] Dialogni rad etadi."""
    result = await db.execute(
        "UPDATE broadcast_drafts SET status = 'rejected' WHERE id = $1", draft_id
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"ok": True, "draft_id": draft_id, "status": "rejected"}


async def _broadcast_dialog(draft: dict) -> None:
    """Dialog matnini TTS qilib MediaMTX'ga yuboradi (fon vazifasi)."""
    import os
    import uuid

    from app.services import continuous, tts

    dialog_text = draft.get("dialog", draft.get("script", ""))
    if not dialog_text:
        log.warning("_broadcast_dialog: dialog matni bo'sh, draft_id=%s", draft.get("id"))
        return

    audio_dir = os.getenv("AUDIO_DIR", "/mnt/d/KIro_projectsbot/sphera-main/.audio")
    os.makedirs(audio_dir, exist_ok=True)

    log.info(
        "[broadcast_dialog] draft #%s TTS boshlandi (%d so'z)",
        draft.get("id"),
        len(dialog_text.split()),
    )

    # Har 3 tilda TTS + navbatga
    for lang in ("ru", "lt", "en"):
        try:
            out = os.path.join(audio_dir, f"dialog_{lang}_{uuid.uuid4().hex}.mp3")
            await tts.synthesize(dialog_text, out, lang)
            if os.path.isfile(out) and os.path.getsize(out) > 800:
                continuous.enqueue(lang, out)
                log.info("[broadcast_dialog] %s → MediaMTX navbatiga (%s)", lang, out)
            else:
                log.warning("[broadcast_dialog] %s TTS bo'sh chiqdi", lang)
        except Exception as exc:
            log.error("[broadcast_dialog] %s TTS xato: %s", lang, exc)
