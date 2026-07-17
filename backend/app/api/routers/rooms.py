"""Rooms router — ведущий (level 3+) foydalanuvchilar yarata oladigan guruh chatlari.

Har kim ro'yxatni ko'radi va yozishi mumkin (asosiy chatdagi bilan bir xil
point narxlari). Guruh xabarlari umumiy chat_messages jadvalida saqlanadi
(room_id ustuni orqali ажратилади) — asosiy "Живой чат" tarixiga aralashmaydi.

V1: real-time yangilanish WebSocket orqali emas, klient tomonidan davriy
so'rov (polling) orqali — bu asosiy chat WS oqimini murakkablashtirmaydi.
"""

import asyncio
import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.routers.chat import _ALLOWED_AUDIO, _convert_to_mp3_background, _display_name
from app.core.config import settings
from app.core.database import db
from app.core.dependencies import get_current_user, require_role
from app.core.models import OkResponse, RoomCreate, RoomMessageRequest, RoomOut
from app.services import points as points_service

log = logging.getLogger("rooms")

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomOut)
async def create_room(payload: RoomCreate, user: dict = Depends(require_role("doverenniy"))):
    """[ведущий/admin] Yangi guruh yaratadi."""
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title required")

    row = await db.fetchrow(
        """
        INSERT INTO chat_rooms (title, description, host_user_id)
        VALUES ($1, $2, $3)
        RETURNING id, title, description, host_user_id, is_active, created_at
        """,
        title,
        payload.description.strip(),
        user["id"],
    )
    log.info("Room #%s created by user %s: %s", row["id"], user["id"], title)
    return RoomOut(**dict(row), host_display_name=_display_name(user))


@router.get("", response_model=list[RoomOut])
async def list_rooms(user: dict = Depends(get_current_user)):
    """Faol guruhlar ro'yxati — hammaga ko'rinadi."""
    rows = await db.fetch(
        """
        SELECT r.id, r.title, r.description, r.host_user_id, r.is_active, r.created_at,
               COALESCE(u.display_name, u.username, 'id' || u.telegram_id::text) AS host_display_name
        FROM chat_rooms r
        LEFT JOIN users u ON u.id = r.host_user_id
        WHERE r.is_active = true
        ORDER BY r.created_at DESC
        LIMIT 100
        """
    )
    return [RoomOut(**dict(r)) for r in rows]


@router.post("/{room_id}/close", response_model=OkResponse)
async def close_room(room_id: int, user: dict = Depends(get_current_user)):
    """Guruhni yopadi — faqat yaratgan ведущий yoki admin."""
    room = await db.fetchrow("SELECT host_user_id FROM chat_rooms WHERE id = $1", room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["host_user_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not your room")

    result = await db.execute("UPDATE chat_rooms SET is_active = false WHERE id = $1", room_id)
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Room not found")
    return OkResponse(detail={"room_id": room_id})


async def _get_active_room(room_id: int) -> None:
    exists = await db.fetchval("SELECT 1 FROM chat_rooms WHERE id = $1 AND is_active = true", room_id)
    if not exists:
        raise HTTPException(status_code=404, detail="Room not found")


@router.get("/{room_id}/messages")
async def get_room_messages(room_id: int, limit: int = 50, user: dict = Depends(get_current_user)):
    """Guruh chat tarixi (охирги N ta xabar)."""
    await _get_active_room(room_id)

    rows = await db.fetch(
        """
        SELECT c.id, u.username, u.display_name, c.message, c.message_type,
               c.audio_file_path, c.created_at
        FROM chat_messages c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.room_id = $1
        ORDER BY c.created_at DESC
        LIMIT $2
        """,
        room_id,
        limit,
    )
    out = []
    for r in reversed(rows):
        voice_url = f"/chat/voice/{r['audio_file_path']}" if r["message_type"] == "voice" and r["audio_file_path"] else None
        out.append(
            {
                "id": r["id"],
                "username": r["username"],
                "display_name": r["display_name"],
                "message": r["message"],
                "message_type": r["message_type"] or "text",
                "voice_url": voice_url,
                "created_at": r["created_at"].isoformat(),
            }
        )
    return out


@router.post("/{room_id}/messages", response_model=OkResponse)
async def send_room_message(
    room_id: int,
    payload: RoomMessageRequest,
    user: dict = Depends(get_current_user),
):
    """Guruhga matnli xabar — 0.001 point (asosiy chat bilan bir xil narx)."""
    await _get_active_room(room_id)

    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Empty message")

    spent = await points_service.spend_text(user["id"])
    if not spent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={"error": "insufficient_points", "points": str(spent["points"])},
        )

    row = await db.fetchrow(
        """
        INSERT INTO chat_messages (user_id, message, message_type, room_id)
        VALUES ($1, $2, 'text', $3)
        RETURNING id, created_at
        """,
        user["id"],
        message,
        room_id,
    )
    return OkResponse(detail={"points": str(spent["points"]), "id": row["id"]})


@router.post("/{room_id}/voice", response_model=OkResponse)
async def send_room_voice(
    room_id: int,
    audio_file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Guruhga ovozli xabar — 0.005 point. MP3 konvertatsiya fonda ishlaydi."""
    await _get_active_room(room_id)

    ext = os.path.splitext(audio_file.filename or "")[1].lower() or ".webm"
    if ext not in _ALLOWED_AUDIO:
        raise HTTPException(status_code=400, detail="Unsupported audio format")

    spent = await points_service.spend_voice(user["id"])
    if not spent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={"error": "insufficient_points", "points": str(spent["points"])},
        )

    os.makedirs(settings.upload_dir, exist_ok=True)
    content = await audio_file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    uid = uuid.uuid4().hex
    raw_fname = f"voice_{uid}{ext}"
    raw_fpath = os.path.join(settings.upload_dir, raw_fname)
    with open(raw_fpath, "wb") as f:
        f.write(content)

    fname = f"voice_{uid}.mp3"
    mp3_fpath = os.path.join(settings.upload_dir, fname)
    asyncio.create_task(_convert_to_mp3_background(raw_fpath, mp3_fpath))

    row = await db.fetchrow(
        """
        INSERT INTO chat_messages (user_id, message, message_type, audio_file_path, room_id)
        VALUES ($1, '', 'voice', $2, $3)
        RETURNING id, created_at
        """,
        user["id"],
        fname,
        room_id,
    )
    return OkResponse(
        detail={"points": str(spent["points"]), "voice_url": f"/chat/voice/{fname}", "id": row["id"]}
    )
