"""Voice Chat router — Telegram guruh ovozli chatini boshqarish (admin/modarator).

Boss talabi: efir Telegram Voice Chat orqali. Modarator mikrofon beradi/oladi.
  - Faqat admin/doverenniy Voice Chat'ni boshqaradi.
  - Mikrofon faqat level >= 2 (broadcaster) ga beriladi.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.constants import ROLE_LEVELS
from app.core.database import db
from app.core.dependencies import get_current_user, require_staff
from app.services import voicechat

log = logging.getLogger("voicechat.router")

router = APIRouter(prefix="/voice", tags=["voicechat"])


class AudioUrlRequest(BaseModel):
    audio_url: str | None = None


class MicRequest(BaseModel):
    user_telegram_id: int


@router.get("/status")
async def voice_status(user: dict = Depends(get_current_user)):
    """Voice Chat holati (hamma ko'ra oladi)."""
    return {
        "configured": voicechat.is_configured(),
        "in_call": voicechat.is_in_call(),
    }


@router.post("/join")
async def voice_join(payload: AudioUrlRequest, _: dict = Depends(require_staff)):
    """[admin] Userbot'ni Voice Chat'ga ulaydi (ixtiyoriy audio bilan)."""
    if not voicechat.is_configured():
        raise HTTPException(
            status_code=503, detail="Voice Chat not configured (userbot session missing)"
        )
    res = await voicechat.join_call(payload.audio_url)
    if not res["ok"]:
        raise HTTPException(status_code=502, detail=res.get("reason", "join failed"))
    return res


@router.post("/leave")
async def voice_leave(_: dict = Depends(require_staff)):
    """[admin] Userbot'ni Voice Chat'dan chiqaradi."""
    res = await voicechat.leave_call()
    if not res["ok"]:
        raise HTTPException(status_code=502, detail=res.get("reason", "leave failed"))
    return res


@router.post("/play")
async def voice_play(payload: AudioUrlRequest, _: dict = Depends(require_staff)):
    """[admin] Voice Chat'da audio almashtiradi (yangi stream/fayl)."""
    if not payload.audio_url:
        raise HTTPException(status_code=400, detail="audio_url required")
    res = await voicechat.play_audio(payload.audio_url)
    if not res["ok"]:
        raise HTTPException(status_code=502, detail=res.get("reason", "play failed"))
    return res


@router.post("/grant-mic")
async def grant_mic(payload: MicRequest, _: dict = Depends(require_staff)):
    """[admin/modarator] Ishtirokchiga mikrofon beradi — faqat level >= 2."""
    target = await db.fetchrow(
        "SELECT role, level FROM users WHERE telegram_id = $1", payload.user_telegram_id
    )
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Faqat broadcaster (doverenniy/admin) mikrofon ola oladi (efirga chiqish huquqi)
    if ROLE_LEVELS.get(target["role"], 0) < ROLE_LEVELS["doverenniy"]:
        raise HTTPException(
            status_code=403,
            detail="Only broadcaster (doverenniy/admin) can receive microphone",
        )

    res = await voicechat.set_participant_muted(payload.user_telegram_id, muted=False)
    if not res["ok"]:
        raise HTTPException(status_code=502, detail=res.get("reason", "grant failed"))
    return {"ok": True, "user_telegram_id": payload.user_telegram_id, "can_speak": True}


@router.post("/revoke-mic")
async def revoke_mic(payload: MicRequest, _: dict = Depends(require_staff)):
    """[admin/modarator] Ishtirokchidan mikrofonni oladi (mute)."""
    res = await voicechat.set_participant_muted(payload.user_telegram_id, muted=True)
    if not res["ok"]:
        raise HTTPException(status_code=502, detail=res.get("reason", "revoke failed"))
    return {"ok": True, "user_telegram_id": payload.user_telegram_id, "can_speak": False}
