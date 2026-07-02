"""Voice Chat servisi — Telegram guruh ovozli chatini boshqaradi (userbot).

Boss talabi (22.06.2026): Icecast/radio o'rniga Telegram Group Voice Chat.
  - Userbot (Pyrogram) guruh Voice Chat'iga ulanadi.
  - pytgcalls orqali audio stream qiladi (kerak bo'lsa — AI dialog/musiqa).
  - Modarator mikrofon berish/olishni boshqaradi (faqat level 2+ gapira oladi).

DIQQAT: Voice Chat'ni oddiy Bot API boshqara olmaydi — userbot (MTProto) shart.
Sozlamalar bo'sh bo'lsa (TG_SESSION_STRING yo'q) — servis xato bermaydi, jim
"o'chiq" rejimda turadi (lokal dev uchun).
"""

import logging
from typing import Optional

from app.core.config import settings

log = logging.getLogger("voicechat")

# Lazy importlar — pyrogram/pytgcalls o'rnatilmagan bo'lsa ham backend ishlaydi
_client = None          # pyrogram.Client
_pytgcalls = None        # pytgcalls.PyTgCalls
_started = False
_in_call = False


def is_configured() -> bool:
    """Userbot sozlamalari to'liqmi."""
    return bool(
        settings.tg_api_id
        and settings.tg_api_hash
        and settings.tg_session_string
        and settings.voice_chat_group_id
    )


def is_in_call() -> bool:
    return _in_call


def _group_id() -> int:
    return int(settings.voice_chat_group_id)


async def start() -> None:
    """Userbot va pytgcalls ni ishga tushiradi (startup'da chaqiriladi).

    Sozlamalar yo'q bo'lsa — jim o'tkazib yuboradi (xato bermaydi).
    """
    global _client, _pytgcalls, _started
    if _started:
        return
    if not is_configured():
        log.info("[voicechat] Sozlamalar yo'q (TG_SESSION_STRING) — Voice Chat o'chiq")
        return

    try:
        from pyrogram import Client
        from pytgcalls import PyTgCalls

        _client = Client(
            name="sphera_userbot",
            api_id=settings.tg_api_id,
            api_hash=settings.tg_api_hash,
            session_string=settings.tg_session_string,
            in_memory=True,
        )
        _pytgcalls = PyTgCalls(_client)
        await _pytgcalls.start()
        _started = True
        log.info("[voicechat] Userbot va pytgcalls ishga tushdi")
    except Exception as exc:  # noqa: BLE001
        log.error("[voicechat] Ishga tushmadi: %s", exc)


async def stop() -> None:
    """Shutdown — call'dan chiqadi va to'xtaydi."""
    global _started, _in_call
    if _pytgcalls and _in_call:
        try:
            await leave_call()
        except Exception:
            pass
    _started = False


async def join_call(audio_url: Optional[str] = None) -> dict:
    """Voice Chat'ga ulanadi va (ixtiyoriy) audio stream qiladi.

    audio_url: Icecast yoki fayl URL. Bo'sh bo'lsa — jim ulanadi (faqat tinglash).
    """
    global _in_call
    if not _started or _pytgcalls is None:
        return {"ok": False, "reason": "not_configured"}
    try:
        from pytgcalls.types import MediaStream

        # audio_url berilgan bo'lsa — o'sha oqimni efirga uzatamiz.
        # Berilmasa — jim ulanish (silence). pytgcalls bo'sh string qabul qilmaydi,
        # shuning uchun kichik silence fayl ishlatamiz (mavjud bo'lsa).
        if audio_url:
            await _pytgcalls.play(_group_id(), MediaStream(audio_url))
        else:
            import os
            silence = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "silence.mp3")
            silence = os.path.abspath(silence)
            if os.path.exists(silence):
                await _pytgcalls.play(_group_id(), MediaStream(silence))
            else:
                # Silence fayl yo'q — ulanishni rad etmaymiz, lekin ogohlantiramiz
                log.warning("[voicechat] silence.mp3 yo'q — audio_url bilan ulaning")
                return {"ok": False, "reason": "audio_url required (no silence file)"}
        _in_call = True
        log.info("[voicechat] Voice Chat'ga ulandi (group=%s)", _group_id())
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        log.error("[voicechat] join_call xato: %s", exc)
        return {"ok": False, "reason": str(exc)}


async def leave_call() -> dict:
    """Voice Chat'dan chiqadi."""
    global _in_call
    if not _started or _pytgcalls is None:
        return {"ok": False, "reason": "not_configured"}
    try:
        await _pytgcalls.leave_call(_group_id())
        _in_call = False
        log.info("[voicechat] Voice Chat'dan chiqdi")
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        log.error("[voicechat] leave_call xato: %s", exc)
        return {"ok": False, "reason": str(exc)}


async def play_audio(audio_url: str) -> dict:
    """Joriy Voice Chat'da audio'ni almashtiradi (yangi stream)."""
    if not _started or _pytgcalls is None:
        return {"ok": False, "reason": "not_configured"}
    try:
        from pytgcalls.types import MediaStream
        await _pytgcalls.play(_group_id(), MediaStream(audio_url))
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        log.error("[voicechat] play_audio xato: %s", exc)
        return {"ok": False, "reason": str(exc)}


# ── Mikrofon boshqaruvi (modarator) ──

async def set_participant_muted(user_telegram_id: int, muted: bool) -> dict:
    """Ishtirokchini mute/unmute qiladi (Voice Chat mikrofon boshqaruvi).

    muted=False — mikrofon beradi (faqat level 2+ uchun chaqiriladi).
    muted=True  — mikrofonni oladi.
    """
    if not _started or _client is None:
        return {"ok": False, "reason": "not_configured"}
    try:
        from pyrogram.raw.functions.phone import EditGroupCallParticipant
        from pyrogram.raw.functions.channels import GetFullChannel

        # Guruh call peer'ini olish
        chat = await _client.resolve_peer(_group_id())
        # Joriy group call'ni olamiz
        full = await _client.invoke(GetFullChannel(channel=chat))
        call = full.full_chat.call
        if call is None:
            return {"ok": False, "reason": "no_active_call"}

        participant = await _client.resolve_peer(user_telegram_id)
        await _client.invoke(EditGroupCallParticipant(
            call=call,
            participant=participant,
            muted=muted,
        ))
        log.info("[voicechat] user=%s muted=%s", user_telegram_id, muted)
        return {"ok": True, "muted": muted}
    except Exception as exc:  # noqa: BLE001
        log.error("[voicechat] set_muted xato: %s", exc)
        return {"ok": False, "reason": str(exc)}
