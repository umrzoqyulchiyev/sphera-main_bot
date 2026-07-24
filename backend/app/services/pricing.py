"""Pricing service — foydalanuvchi xizmatlar uchun to'laydigan point narxlari.

Faqat haqiqiy admin o'zgartira oladi (require_admin, moderator emas —
"как будет вестись оплата... сколько поинтов будет сниматься" faqat
egaga tegishli qaror). app_settings'da saqlanadi, in-memory keshlanadi
(har xabar yuborishda DB'ga bormaslik uchun) — admin o'zgartirganda
reload() chaqiriladi.
"""

import logging
from decimal import Decimal

from app.core.database import db

log = logging.getLogger("pricing")

_DEFAULTS: dict[str, Decimal] = {
    "price_text_message": Decimal("0.001"),
    "price_voice_message": Decimal("0.005"),
    "price_slot_per_hour": Decimal("200"),
}

_cache: dict[str, Decimal] = dict(_DEFAULTS)


async def reload() -> None:
    """app_settings'dan narxlarni qayta o'qiydi — app ishga tushganda va
    admin narx o'zgartirgandan keyin chaqiriladi."""
    rows = await db.fetch(
        "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
        list(_DEFAULTS.keys()),
    )
    for row in rows:
        try:
            _cache[row["key"]] = Decimal(row["value"])
        except Exception:
            continue


def get(key: str) -> Decimal:
    return _cache.get(key, _DEFAULTS[key])


def get_all() -> dict[str, Decimal]:
    return dict(_cache)


async def set_price(key: str, value: Decimal) -> None:
    if key not in _DEFAULTS:
        raise ValueError(f"Unknown price key: {key}")
    if value < 0:
        raise ValueError("Price cannot be negative")
    await db.execute(
        """
        INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
        """,
        key,
        str(value),
    )
    _cache[key] = value
