"""Membership_Verifier — Telegram guruh a'zoligini tekshiradi (PDF: Community-bound).

Faqat belgilangan Telegram guruhi a'zolari tizimdan foydalana oladi.
Dev rejimda DISABLE_GROUP_CHECK=true bilan bypass qilinadi.
"""

import os
import time

import httpx

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
COMMUNITY_CHAT_ID = os.getenv("COMMUNITY_CHAT_ID", "").strip()
DISABLE_GROUP_CHECK = os.getenv("DISABLE_GROUP_CHECK", "false").lower() == "true"

ALLOWED_STATUSES = {"creator", "administrator", "member", "restricted"}
_CACHE_TTL = 600  # sekund

# dict[telegram_id, (is_member, checked_at)]
_cache: dict[int, tuple[bool, float]] = {}


def is_enabled() -> bool:
    """Guruh tekshiruvi yoqilganmi (dev'да o'chirilgan)."""
    return not DISABLE_GROUP_CHECK and bool(COMMUNITY_CHAT_ID)


async def check_membership(telegram_id: int) -> bool:
    """Telegram getChatMember orqali a'zolikni tekshiradi.

    DISABLE_GROUP_CHECK=true yoki COMMUNITY_CHAT_ID yo'q bo'lsa — har doim True (dev).
    """
    if not is_enabled():
        return True
    if not BOT_TOKEN:
        return True

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                params={"chat_id": COMMUNITY_CHAT_ID, "user_id": telegram_id},
                timeout=10,
            )
        data = resp.json()
        if not data.get("ok"):
            return False
        status = data.get("result", {}).get("status")
        return status in ALLOWED_STATUSES
    except Exception:
        # Tarmoq xatosi — xavfsizlik uchun rad etamiz
        return False


async def is_member_cached(telegram_id: int) -> bool:
    """600 sekundlik cache bilan a'zolik tekshiruvi (Requirement 1.6)."""
    if not is_enabled():
        return True

    now = time.time()
    cached = _cache.get(telegram_id)
    if cached is not None and (now - cached[1]) < _CACHE_TTL:
        return cached[0]

    is_member = await check_membership(telegram_id)
    _cache[telegram_id] = (is_member, now)
    return is_member


def invalidate(telegram_id: int) -> None:
    _cache.pop(telegram_id, None)
