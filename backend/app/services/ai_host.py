"""AI Radio Host — backend ichidagi uzluksiz efir kontenti generatori.

Vazifa: efir hech qachon jim qolmasin. Davriy ravishda:
  1. Tinglovchilarning studiyaga yuborgan xabarlarini oladi (messages, pending).
  2. Gemini bilan jonli radio efir matni yaratadi (xabarlar bo'lsa — ularga
     javob, bo'lmasa — umumiy qiziqarli segment).
  3. Matnni 3 tilga (ru/lt/en) tayyorlaydi va TTS qiladi.
  4. Har til uchun mp3'ni continuous navbatiga qo'shadi → Icecast efiriga chiqadi.

USE_ICECAST=false bo'lsa ishlamaydi (efir yo'q).
"""

import os
import uuid
import asyncio
import logging

from app.core.database import db
from app.services import gemini, tts
from app.services import continuous

log = logging.getLogger("ai_host")

USE_ICECAST = os.getenv("USE_ICECAST", "false").lower() == "true"
AUDIO_DIR = os.getenv("AUDIO_DIR", "/tmp/sphera_audio")
HOST_INTERVAL = int(os.getenv("AI_HOST_INTERVAL", "60"))   # segmentlar orasidagi pauza
MAX_MSGS = 5

_started = False
_task: asyncio.Task | None = None

WITH_MSGS_PROMPT = """Ты — ведущий прямого эфира Radio AI.
В студию поступили обращения слушателей:

{block}

Озвучь их в эфире как живой радиоведущий:
- Поприветствуй слушателей, обратись к каждому по имени, перескажи суть обращения и ответь.
- Живой, тёплый, энергичный радио-стиль.
- 90-140 слов, ТОЛЬКО на русском языке.
- Верни ТОЛЬКО текст эфира, без пояснений и кавычек."""

NO_MSGS_PROMPT = """Ты — ведущий прямого эфира Radio AI.
Сейчас новых обращений нет. Создай короткий живой радио-сегмент:
интересный факт, лёгкое размышление о дне, музыкальное настроение, и призыв
присылать обращения в студию.
80-130 слов, ТОЛЬКО на русском языке, живой радио-стиль.
Верни ТОЛЬКО текст эфира, без пояснений и кавычек."""


async def _fetch_recent_messages() -> list[dict]:
    """Studiyaga yuborilgan, hali efirga chiqmagan xabarlarni oladi va belgilaydi."""
    rows = await db.fetch(
        """
        SELECT m.id, m.text, u.username, u.full_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.user_id
        WHERE m.is_for_studio = true AND m.status = 'pending'
              AND m.text IS NOT NULL AND m.text <> ''
        ORDER BY m.created_at ASC
        LIMIT $1
        """,
        MAX_MSGS,
    )
    pool = [dict(r) for r in rows]
    if pool:
        ids = [m["id"] for m in pool]
        await db.execute(
            "UPDATE messages SET status = 'approved' WHERE id = ANY($1::int[])",
            ids,
        )
    return pool


def _build_block(pool: list[dict]) -> str:
    lines = []
    for m in pool:
        author = m.get("username") or m.get("full_name") or "слушатель"
        text = (m.get("text") or "").strip()
        lines.append(f"- {author}: {text}")
    return "\n".join(lines)


async def _make_script(pool: list[dict]) -> tuple[str, bool]:
    """Gemini bilan efir matni. Qaytaradi: (matn, gemini_ishladimi)."""
    if pool:
        prompt = WITH_MSGS_PROMPT.format(block=_build_block(pool))
    else:
        prompt = NO_MSGS_PROMPT

    try:
        text = await gemini.generate_text(prompt)
        if text.strip():
            return text.strip(), True
    except Exception as exc:  # noqa: BLE001
        log.warning("Gemini script failed: %s", exc)

    # Fallback (Gemini yo'q yoki xato/kvota)
    if pool:
        parts = ["Здравствуйте, дорогие слушатели Radio AI! У нас обращения в эфире."]
        for m in pool:
            author = m.get("username") or m.get("full_name") or "слушатель"
            parts.append(f"{author} пишет: {(m.get('text') or '').strip()}. Спасибо, мы вас услышали!")
        parts.append("Присылайте свои обращения, оставайтесь на волне Radio AI!")
        return " ".join(parts), False
    return (
        "Вы слушаете Radio AI — живой эфир, который создаём мы вместе. "
        "Присылайте свои обращения в студию, и я озвучу их прямо здесь. "
        "Оставайтесь на нашей волне, впереди ещё много интересного!"
    ), False


async def _generate_and_enqueue() -> None:
    """Bitta tsikl: matn → 3 til TTS → navbatga."""
    os.makedirs(AUDIO_DIR, exist_ok=True)
    pool = await _fetch_recent_messages()
    script_ru, ai_ok = await _make_script(pool)
    log.info("[ai_host] segment matni tayyor (%d so'z, %d zayavka, gemini=%s)",
             len(script_ru.split()), len(pool), ai_ok)

    # 3 tilga matn. Gemini ishlagandagina tarjima qilamiz (kvota tejash —
    # Gemini yo'q/kvota tugagan bo'lsa, RU matnni 3 tilда ham ishlatamiz).
    scripts = {"ru": script_ru}
    if ai_ok:
        for lang in ("lt", "en"):
            try:
                scripts[lang] = await gemini.translate(script_ru, lang)
            except Exception:
                scripts[lang] = script_ru
    else:
        scripts["lt"] = script_ru
        scripts["en"] = script_ru

    # Har til uchun TTS + navbatga qo'shish (xato izolyatsiyasi)
    for lang, text in scripts.items():
        try:
            out = os.path.join(AUDIO_DIR, f"aihost_{lang}_{uuid.uuid4().hex}.mp3")
            await tts.synthesize(text, out, lang)
            if os.path.isfile(out) and os.path.getsize(out) > 800:
                continuous.enqueue(lang, out)
                log.info("[ai_host] %s segment navbatga → /live_%s", lang, lang)
            else:
                log.warning("[ai_host] %s TTS bo'sh chiqdi", lang)
        except Exception as exc:  # noqa: BLE001
            log.error("[ai_host] %s TTS/enqueue xato: %s", lang, exc)


async def _loop() -> None:
    log.info("[ai_host] AI radio host ishga tushdi (interval=%ds)", HOST_INTERVAL)
    # Boshlanishida biroz kutamiz (continuous worker'lar ulanib olsin)
    await asyncio.sleep(5)
    while True:
        try:
            await _generate_and_enqueue()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.error("[ai_host] tsikl xato: %s", exc)
        await asyncio.sleep(HOST_INTERVAL)


async def start() -> None:
    global _started, _task
    if _started or not USE_ICECAST:
        return
    _task = asyncio.create_task(_loop())
    _started = True


async def stop() -> None:
    global _started, _task
    if _task is not None:
        _task.cancel()
        _task = None
    _started = False
