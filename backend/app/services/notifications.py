"""Notifications — bot orqali foydalanuvchilarga shaxsiy xabar yuborish.

membership.py'dagi send_to_community() bilan bir xil pattern (to'g'ridan-to'g'ri
Telegram Bot API, alohida bot process shart emas), lekin community guruhi
o'rniga aniq telegram_id'ga (shaxsiy chat) yuboradi. Muvaffaqiyatsiz bo'lsa
(masalan, foydalanuvchi botni bloklagan/hali /start bosmagan) jim o'tkazib
yuboriladi — bildirishnoma asosiy oqimni to'xtatmasligi kerak, shuning uchun
barcha chaqiruvchilar buni fire-and-forget (asyncio.create_task) qilishi kerak.
"""

import logging
import os
from decimal import Decimal

import httpx

from app.core.database import db

log = logging.getLogger("notifications")

BOT_TOKEN = os.getenv("BOT_TOKEN", "")


async def send_dm(telegram_id: int, text: str) -> bool:
    if not BOT_TOKEN:
        return False
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url, json={"chat_id": telegram_id, "text": text}, timeout=10
            )
        ok = bool(resp.json().get("ok"))
        if not ok:
            log.info("[notifications] DM yuborilmadi (%s): %s", telegram_id, resp.text[:200])
        return ok
    except Exception as exc:  # noqa: BLE001
        log.warning("[notifications] DM xato (%s): %s", telegram_id, exc)
        return False


async def notify_points_received_tg(telegram_id: int, amount: Decimal, reason: str = "") -> None:
    """telegram_id allaqachon ma'lum bo'lganda (masalan transfer — payload
    o'zi telegram_id) — qo'shimcha DB so'rovisiz to'g'ridan-to'g'ri yuboradi."""
    if amount <= 0:
        return
    text = f"💰 Вам начислено +{amount} поинтов"
    if reason:
        text += f"\n{reason}"
    await send_dm(telegram_id, text)


async def notify_points_received(user_id: int, amount: Decimal, reason: str = "") -> None:
    """Ichki users.id bo'yicha — avval telegram_id'ni DB'dan topadi."""
    if amount <= 0:
        return
    row = await db.fetchrow("SELECT telegram_id FROM users WHERE id = $1", user_id)
    if not row:
        return
    await notify_points_received_tg(row["telegram_id"], amount, reason)


async def notify_admins_new_casting(display_name: str) -> None:
    """Yangi kasting arizasi haqida barcha adminlarga (DB role='admin' +
    ADMIN_IDS env) xabar beradi — moderator ko'ra olmaydi, shuning uchun
    faqat haqiqiy adminlarga yetkaziladi."""
    from app.core.config import settings

    text = f"🎙 Новая заявка на кастинг от {display_name}.\nПроверьте в админ-панели → Кастинг."
    rows = await db.fetch("SELECT telegram_id FROM users WHERE role = 'admin'")
    ids = {r["telegram_id"] for r in rows} | settings.admin_ids_set
    for tg_id in ids:
        await send_dm(tg_id, text)
