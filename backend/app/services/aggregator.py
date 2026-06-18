"""ИИ-agregatsiya (TZ Шаг 3).

ИИ endi har bir foydalanuvchiga 1-на-1 javob bermaydi. O'rniga:
  1. Chatdan oxirgi xabarlar puli yig'iladi.
  2. Asosiy mavzu aniqlanadi.
  3. Bitta umumiy efir matni (diktor monologi) generatsiya qilinadi.
  4. Matn `broadcast_drafts` ga `pending` holatда saqlanadi → moderatorga boradi.

Ishga tushish: vaqt bo'yicha (interval) yoki xabarlar soni bo'yicha (trigger).
"""

import asyncio
import logging

from app.core.database import db
from app.services import gemini

log = logging.getLogger("aggregator")

# Trigger sozlamalari
MIN_MESSAGES = 5          # shuncha yangi xabar to'planса agregatsiya
CHECK_INTERVAL = 120      # yoki har 120 sekundда tekshiramiz
MAX_POOL = 30             # bir martada nechta xabar olinadi

AGGREGATE_PROMPT = """Ты — редактор радиоэфира Radio AI.
Ниже — заявки слушателей «в студию» (могут быть на русском, литовском или английском):

{messages}

Задача:
1. Выдели ОБЩУЮ суть («сливки») этих заявок — о чём люди просят/говорят.
2. Напиши ОДИН сценарий диктора, обобщающий заявки и оживляющий эфир.

Правила:
- Не отвечай каждому лично, говори обобщённым образом.
- 100-160 слов, ТОЛЬКО на русском языке, живой радио-стиль.

Верни ТОЛЬКО JSON:
{{
  "main_topic": "основная тема (2-4 слова, на русском)",
  "script": "текст монолога диктора (на русском)"
}}"""


async def _fetch_studio_pool(city: str) -> list[dict]:
    """Берёт студийные заявки (is_for_studio=true, status=pending) и не переиспользует их."""
    rows = await db.fetch(
        """
        SELECT m.id, m.text, m.lang, u.username, u.full_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.city = $1 AND m.is_for_studio = true AND m.status = 'pending'
              AND m.text IS NOT NULL AND m.text <> ''
        ORDER BY m.created_at ASC
        LIMIT $2
        """,
        city, MAX_POOL,
    )
    return [dict(r) for r in rows]


def _build_studio_block(pool: list[dict]) -> str:
    lines = []
    for m in pool:
        author = m.get("username") or m.get("full_name") or "слушатель"
        text = (m.get("text") or "").strip()
        lang = m.get("lang") or "?"
        lines.append(f"- {author} ({lang}): {text}")
    return "\n".join(lines) if lines else "(нет заявок)"


def _fallback(pool: list[dict]) -> dict:
    """Gemini yo'q bo'lsa — sodda umumlashtirish."""
    count = len(pool)
    return {
        "main_topic": "Заявки слушателей",
        "script": (
            "Дорогие слушатели Radio AI! В студию поступило "
            f"около {count} заявок. Спасибо, что вы с нами и делитесь своими "
            "мыслями. Мы собрали самое важное и расскажем об этом в эфире. "
            "Продолжайте присылать заявки — оставайтесь на волне!"
        ),
    }


async def aggregate_studio(city: str) -> dict | None:
    """Собирает студийные заявки → «сливки» → 1 RU-сценарий → broadcast_drafts.

    Возвращает: dict драфта или None (заявок меньше порога).
    """
    pool = await _fetch_studio_pool(city)
    if len(pool) < MIN_MESSAGES:
        return None

    prompt = AGGREGATE_PROMPT.format(messages=_build_studio_block(pool))
    try:
        data = await gemini.generate_json(prompt)
        main_topic = (data.get("main_topic") or "").strip()[:200]
        script = (data.get("script") or "").strip()
        if not script:
            raise ValueError("empty script")
    except Exception as exc:  # noqa: BLE001
        log.warning("aggregate_studio gemini failed (%s): %s", city, exc)
        fb = _fallback(pool)
        main_topic, script = fb["main_topic"], fb["script"]

    # Заявки-источники потреблены (status=approved, не переиспользуются)
    ids = [m["id"] for m in pool]
    if ids:
        await db.execute(
            "UPDATE messages SET status = 'approved' WHERE id = ANY($1::int[])",
            ids,
        )

    row = await db.fetchrow(
        """
        INSERT INTO broadcast_drafts (city, main_topic, source_count, script, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id, city, main_topic, source_count, script, status, created_at
        """,
        city, main_topic, len(pool), script,
    )
    log.info("[%s] studio draft #%s yaratildi (%d zayavka): %s",
             city, row["id"], len(pool), main_topic)
    return dict(row)


# Обратная совместимость: старое имя
async def aggregate_once(city: str) -> dict | None:
    return await aggregate_studio(city)


async def aggregation_loop(cities_provider):
    """Fon jarayoni: vaqt/xabar soni bo'yicha agregatsiya qiladi.

    cities_provider — joriy shaharlar ro'yxatini qaytaruvchi callable.
    Yangi draft yaratilса, moderatorlarga WebSocket orqali xabar beriladi.
    """
    from app.core.ws_manager import manager
    log.info("Aggregation loop ishga tushdi (interval=%ds, min_msgs=%d)",
             CHECK_INTERVAL, MIN_MESSAGES)
    while True:
        try:
            cities = cities_provider()
            for city in list(cities):
                try:
                    draft = await aggregate_once(city)
                    if draft:
                        await manager.broadcast(city, {
                            "type": "new_draft",
                            "data": {
                                "id": draft["id"],
                                "main_topic": draft["main_topic"],
                                "source_count": draft["source_count"],
                            },
                        })
                except Exception as exc:  # noqa: BLE001
                    log.error("aggregate_once(%s) failed: %s", city, exc)
        except Exception as exc:  # noqa: BLE001
            log.error("aggregation_loop error: %s", exc)
        await asyncio.sleep(CHECK_INTERVAL)
