import os
import uuid
import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from app.core.database import db
from app.core.models import (
    TextMessageRequest,
    MessageResponse,
    PsychotypeOut,
)
from app.core.dependencies import get_current_user
from app.core.state import VALID_CITIES
from app.services import whisper_stt, psychotype, points
from app.core.ws_manager import manager

router = APIRouter(prefix="/messages", tags=["messages"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def _save_psychotype(user_id: int, analysis: dict) -> PsychotypeOut:
    """Psixotip tahlilini DB'ga saqlaydi (psychotypes jadvali + users profili).

    TZ §4: focus_of_attention, emotional_tone users jadvaliga ham yoziladi
    (oxirgi tahlil profil kartasida ko'rinadi).
    """
    await db.execute(
        """
        INSERT INTO psychotypes
            (user_id, focus_of_attention, emotional_tone, key_topic, priority_score, raw_json)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        user_id,
        analysis["focus_of_attention"],
        analysis["emotional_tone"],
        analysis["key_topic"],
        analysis["priority_score"],
        analysis.get("raw_json", "{}"),
    )
    # Users profiliga oxirgi tahlilni yozish (profil kartasida ko'rsatish uchun)
    await db.execute(
        """
        UPDATE users
        SET focus_of_attention = $2,
            emotional_tone     = $3,
            key_topic          = $4
        WHERE id = $1
        """,
        user_id,
        analysis["focus_of_attention"],
        analysis["emotional_tone"],
        analysis["key_topic"],
    )
    return PsychotypeOut(
        focus_of_attention=analysis["focus_of_attention"],
        emotional_tone=analysis["emotional_tone"],
        key_topic=analysis["key_topic"],
        priority_score=analysis["priority_score"],
    )


async def _award_and_notify(user: dict, event_type: str, amount: int, city: str):
    """[DEPRECATED] Старая reward-модель. Не используется в cost-модели."""
    result = await points.award(user["id"], event_type, amount)
    return result


async def _process_voice_background(path: str, user_id: int, city: str, lang: str | None, to_studio: bool):
    """Фон: для студии — STT + психотип (для ИИ/модератора).

    TZ v2.0: аудиофайл СОХРАНЯЕТСЯ (audio_file_path), чтобы голос можно было
    прослушать в чате (как в Telegram). Для чата STT не нужен.
    """
    import logging
    log = logging.getLogger("messages.voice_bg")

    if not to_studio:
        return  # обычный голос в чат — файл просто остаётся для прослушивания

    transcript = ""
    try:
        transcript = await whisper_stt.transcribe(path)
    except Exception as exc:
        log.warning("STT failed for user_id=%d: %s", user_id, exc)
        transcript = ""

    if transcript.strip():
        try:
            await db.execute(
                """
                INSERT INTO messages (user_id, city, text, audio_path, status, is_for_studio, lang)
                VALUES ($1, $2, $3, $4, 'pending', true, $5)
                """,
                user_id, city, transcript.strip(), os.path.basename(path), lang,
            )
            analysis = await psychotype.analyze(transcript)
            await _save_psychotype(user_id, analysis)
        except Exception as exc:
            log.error("Failed to save studio message for user_id=%d: %s", user_id, exc)


@router.post("/voice", response_model=MessageResponse)
async def voice_message(
    city: str = Form(...),
    audio_file: UploadFile = File(...),
    destination: str = Form("studio"),   # "chat" | "studio"
    lang: str = Form(None),
    user: dict = Depends(get_current_user),
):
    """Голосовое сообщение: в чат (chat_voice) или в студию (studio_voice).

    - destination=chat: голос в общий чат, лимит chat_voice (роль не важна).
    - destination=studio: голос в студию, лимит studio_voice (только aktivniy+),
      STT в фоне → messages(is_for_studio=true) для модератора/ИИ.
    Дубль голоса виден всем в чате как плеер (динамика).
    """
    if city not in VALID_CITIES and VALID_CITIES:
        pass  # VALID_CITIES bo'sh bo'lsa — qabul qilamiz

    to_studio = destination == "studio"

    # Studiyaga yuborish uchun points tekshirish (role emas — points asosida)
    event = "studio_voice" if to_studio else "chat_voice"
    spent = await points.spend(user["id"], event, points.COST[event])
    if not spent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={"error": "insufficient_points", "points": str(spent["points"])},
        )

    ext = os.path.splitext(audio_file.filename or "")[1] or ".webm"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)

    content = await audio_file.read()
    with open(path, "wb") as f:
        f.write(content)

    # Голос виден/слышен всем в чате (и для чата, и для студии — динамика)
    voice_url = f"/messages/voice/{filename}"
    username = user["username"] or user["full_name"] or f"id{user['telegram_id']}"
    label = "🎤🎙 [в студию]" if to_studio else "🎤 [голосовое]"
    mtype = "studio_voice" if to_studio else "voice"
    # TZ v2.0: ovoz chatда SAQLANADI (message_type + audio_file_path) — tarix yo'qolmaydi
    await db.execute(
        """
        INSERT INTO chat_messages (user_id, city, message, message_type, audio_file_path)
        VALUES ($1, $2, $3, $4, $5)
        """,
        user["id"], city, label, mtype, filename,
    )
    await manager.broadcast(city, {
        "type": "chat",
        "data": {
            "username": username,
            "voice_url": voice_url,
            "message": label,
            "kind": mtype,
            "message_type": mtype,
            "created_at": datetime.utcnow().isoformat(),
        },
    })

    _lang = lang if lang in ("ru", "lt", "en") else None
    # STT в фоне + авто-удаление; в студию — попадает в очередь модератора/ИИ
    asyncio.create_task(_process_voice_background(path, user["id"], city, _lang, to_studio))

    return MessageResponse(
        transcript=None, psychotype=None, ai_reply=None,
        voice_url=voice_url, points=str(spent["points"]),
    )


@router.get("/voice/{filename}")
async def get_voice(filename: str):
    """Ovozli xabarni jonli tinglash uchun (fayl o'chirilgunга qadar)."""
    safe = os.path.basename(filename)
    path = os.path.join(UPLOAD_DIR, safe)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Voice expired")
    return FileResponse(path, media_type="audio/webm")


@router.post("/text", response_model=MessageResponse)
async def text_message(
    payload: TextMessageRequest,
    user: dict = Depends(get_current_user),
):
    """Studiyaga matn xabar. aktivniy+ yoki yetarli points bo'lsa ishlaydi.

    Points yetmasa → 402 (insufficient_points)
    Role yetmasa va points ham yo'q → 402 (foydali xabar frontendga)
    """
    city = payload.city if payload.city else "global"

    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    spent = await points.spend(user["id"], "studio", points.COST["studio"])
    if not spent["ok"]:
        raise HTTPException(
            status_code=402,
            detail={"error": "insufficient_points", "points": str(spent["points"])},
        )

    _lang = payload.lang if getattr(payload, "lang", None) in ("ru", "lt", "en") else None
    await db.execute(
        """
        INSERT INTO messages (user_id, city, text, status, is_for_studio, lang)
        VALUES ($1, $2, $3, 'pending', true, $4)
        """,
        user["id"],
        city,
        payload.text,
        _lang,
    )

    analysis = await psychotype.analyze(payload.text)
    pt = await _save_psychotype(user["id"], analysis)

    return MessageResponse(
        transcript=None, psychotype=pt, ai_reply=None, points=str(spent["points"]),
    )


@router.post("/recent/{city}")
async def recent_messages(city: str, limit: int = 5):
    """ИИ agregatsiya uchun: muhokama qilinmagan oxirgi murojaatlar.

    POST ishlatiladi chunki so'rov statusni o'zgartiradi (side-effect).
    """
    if city not in VALID_CITIES:
        raise HTTPException(status_code=400, detail="Unknown city")

    rows = await db.fetch(
        """
        SELECT m.id, m.text, u.username, u.full_name,
               p.emotional_tone, p.key_topic, p.priority_score
        FROM messages m
        LEFT JOIN users u ON u.id = m.user_id
        LEFT JOIN LATERAL (
            SELECT emotional_tone, key_topic, priority_score
            FROM psychotypes
            WHERE user_id = m.user_id
            ORDER BY created_at DESC
            LIMIT 1
        ) p ON true
        WHERE m.city = $1 AND m.status = 'pending'
              AND m.text IS NOT NULL AND m.text <> ''
        ORDER BY COALESCE(p.priority_score, 5) DESC, m.created_at ASC
        LIMIT $2
        """,
        city,
        limit,
    )

    if rows:
        ids = [r["id"] for r in rows]
        await db.execute(
            "UPDATE messages SET status = 'approved' WHERE id = ANY($1::int[])",
            ids,
        )

    return [
        {
            "id": r["id"],
            "text": r["text"],
            "author": r["username"] or r["full_name"] or "слушатель",
            "emotional_tone": r["emotional_tone"],
            "key_topic": r["key_topic"],
            "priority_score": r["priority_score"],
        }
        for r in rows
    ]
