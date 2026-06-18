import os
import asyncio
import logging
import subprocess
import uuid

import httpx
import edge_tts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("radio-host")

# ---------- Konfiguratsiya ----------
GEMINI_KEY = os.getenv("GEMINI_KEY", "")
INTERNAL_API_URL = os.getenv("INTERNAL_API_URL", "http://radio-api:8001")
ICECAST_HOST = os.getenv("ICECAST_HOST", "icecast")
ICECAST_PORT = int(os.getenv("ICECAST_PORT", "8000"))
ICECAST_PASS = os.getenv("ICECAST_PASS", "IcecastPass2025!")
USE_ICECAST = os.getenv("USE_ICECAST", "false").lower() == "true"
AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")

# YANGI konsepsiya (TZ Шаг 3-4): efir kontenti ИИ-agregatsiya → moderator
# orqali o'tadi. radio-host endi avtomatik efirga PUSH QILMAYDI (moderatsiyani
# chetlab o'tmasligi uchun). Faqat AI_AUTO_BROADCAST=true bo'lsa eski rejim ishlaydi.
AI_AUTO_BROADCAST = os.getenv("AI_AUTO_BROADCAST", "false").lower() == "true"

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
VOICE = "ru-RU-DmitryNeural"
SEGMENT_INTERVAL = int(os.getenv("SEGMENT_INTERVAL", "300"))  # 5 daqiqa

CITIES = ["samarkand", "tashkent", "bukhara", "namangan", "andijan"]

CITY_NAMES_RU = {
    "samarkand": "Самарканд",
    "tashkent": "Ташкент",
    "bukhara": "Бухара",
    "namangan": "Наманган",
    "andijan": "Андижан",
}


async def fetch_cities(client: httpx.AsyncClient) -> list[dict]:
    """Bazadagi amaldagi shaharlarni API orqali oladi."""
    try:
        resp = await client.get(f"{INTERNAL_API_URL}/cities", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            for c in data:
                CITY_NAMES_RU[c["slug"]] = c["name_ru"]
            return data
    except Exception as exc:  # noqa: BLE001
        log.warning("cities fetch failed: %s", exc)
    # Fallback
    return [{"slug": s, "name_ru": CITY_NAMES_RU.get(s, s)} for s in
            ["samarkand", "tashkent", "bukhara", "namangan", "andijan"]]

os.makedirs(AUDIO_DIR, exist_ok=True)

_genai = None
if GEMINI_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        _genai = genai
    except Exception as exc:  # noqa: BLE001
        log.warning("Gemini import/config failed: %s", exc)


PROMPT_TEMPLATE = """Sen {city} shahri uchun Radio AI jonli boshlovchisisan.
Sening vazifang — tinglovchilarning murojaatlarini efirga olib chiqib, ular bilan suhbatlashish.

{listener_block}

Yuqoridagi murojaatlarga radio boshlovchi sifatida javob ber:
- Har bir tinglovchini ismi bilan eshittirib sala, murojaatini takrorlab javob ber
- Jonli, samimiy, qiziqarli radio uslubida gapir
- 120-180 so'z, faqat rus tilida
- Faqat efir matnini qaytar, boshqa hech narsa yozma"""

NO_MESSAGES_PROMPT = """Sen {city} shahri uchun Radio AI boshlovchisisan.
Hozir yangi murojaatlar yo'q. Tinglovchilarni murojaat yuborishga undab,
qiziqarli radio segmenti yarat: shahar haqida, kayfiyat haqida, musiqa haqida.
120-180 so'z, rus tili, jonli radio uslubi. Faqat matn qaytar."""


async def fetch_listener_messages(client: httpx.AsyncClient, city: str) -> list[dict]:
    """AI efirga olib chiqish uchun oxirgi tinglovchi murojaatlarini oladi."""
    try:
        resp = await client.post(
            f"{INTERNAL_API_URL}/messages/recent/{city}",
            params={"limit": 5},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("recent messages fetch failed for %s: %s", city, exc)
    return []


def _build_listener_block(messages: list[dict]) -> str:
    lines = ["Tinglovchilar murojaatlari:"]
    for m in messages:
        author = m.get("author", "слушатель")
        text = (m.get("text") or "").strip()
        tone = m.get("emotional_tone") or ""
        lines.append(f'- {author} ({tone}): "{text}"')
    return "\n".join(lines)


async def generate_script(city: str, messages: list[dict]) -> str:
    """Gemini orqali tinglovchi murojaatlariga javob beruvchi efir matni yaratadi."""
    city_ru = CITY_NAMES_RU.get(city, city)

    if messages:
        listener_block = _build_listener_block(messages)
        prompt = PROMPT_TEMPLATE.format(city=city_ru, listener_block=listener_block)
    else:
        prompt = NO_MESSAGES_PROMPT.format(city=city_ru)

    if _genai is None:
        # Gemini yo'q — murojaatlarni o'zimiz efirga o'qiymiz (fallback)
        if messages:
            parts = [f"Здравствуйте, дорогие слушатели {city_ru}! У нас новые обращения в эфире."]
            for m in messages:
                author = m.get("author", "слушатель")
                text = (m.get("text") or "").strip()
                parts.append(f"{author} пишет: «{text}». Спасибо за ваше сообщение, мы вас услышали!")
            parts.append("Продолжайте присылать свои обращения, оставайтесь на волне Radio AI!")
            return " ".join(parts)
        return (
            f"Добрый день, дорогие слушатели города {city_ru}! "
            "Вы слушаете Radio AI. Присылайте свои голосовые и текстовые обращения, "
            "и я обязательно озвучу их в прямом эфире. Оставайтесь с нами на волне!"
        )

    model = _genai.GenerativeModel(MODEL_NAME)

    def _call() -> str:
        resp = model.generate_content(prompt)
        return (resp.text or "").strip()

    try:
        return await asyncio.to_thread(_call)
    except Exception as exc:  # noqa: BLE001
        log.error("Gemini generation failed: %s", exc)
        return (
            f"Вы слушаете Radio AI, город {city_ru}. "
            "Оставайтесь на волне, скоро продолжим эфир."
        )


async def synthesize(text: str, out_path: str) -> None:
    """Matnni mp3 ga aylantiradi. Edge TTS → gTTS fallback."""
    # Avval Edge TTS sinab ko'ramiz
    try:
        communicate = edge_tts.Communicate(text, VOICE)
        await communicate.save(out_path)
        if os.path.isfile(out_path) and os.path.getsize(out_path) > 1000:
            return
    except Exception as exc:
        log.warning("Edge TTS failed (%s), trying gTTS fallback...", exc)

    # gTTS fallback (Google TTS — internetda ishlaydi)
    try:
        from gtts import gTTS
        import asyncio
        def _gtts_save():
            tts = gTTS(text, lang="ru")
            tts.save(out_path)
        await asyncio.to_thread(_gtts_save)
        log.info("gTTS fallback OK: %s", out_path)
    except Exception as exc2:
        log.error("gTTS also failed: %s", exc2)
        raise


def stream_to_icecast(mp3_path: str, city: str) -> int:
    """FFmpeg orqali mp3 ni Icecast /live_ru mount ga uzatadi."""
    # Continuous worker /live_ru ishlatadi, shuning uchun shu mountga uzatamiz
    mount = "/live_ru"
    icecast_url = (
        f"icecast://source:{ICECAST_PASS}@{ICECAST_HOST}:{ICECAST_PORT}{mount}"
    )
    cmd = [
        "ffmpeg", "-re", "-i", mp3_path,
        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-content_type", "audio/mpeg", "-f", "mp3", icecast_url,
    ]
    log.info("FFmpeg → Icecast %s", mount)
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        log.error("FFmpeg error (%s): %s", city, proc.stderr.decode()[-400:])
    return proc.returncode


async def register_segment(
    client: httpx.AsyncClient, city: str, filename: str, script: str, duration: int
) -> None:
    """Ichki rejim: segmentni radio-api ga ro'yxatdan o'tkazadi."""
    try:
        await client.post(
            f"{INTERNAL_API_URL}/radio/segment",
            json={
                "city": city,
                "filename": filename,
                "script": script,
                "duration_sec": duration,
            },
            timeout=10,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("segment register failed for %s: %s", city, exc)


async def update_status(
    client: httpx.AsyncClient, city: str, script: str, duration: int
) -> None:
    try:
        await client.post(
            f"{INTERNAL_API_URL}/radio/status",
            json={
                "city": city,
                "is_live": True,
                "broadcaster_type": "ai",
                "broadcaster_name": "AI Host",
                "script": script,
                "duration_sec": duration,
            },
            timeout=10,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("status update failed for %s: %s", city, exc)


async def process_city(client: httpx.AsyncClient, city: str) -> None:
    log.info("=== %s segmentini tayyorlash ===", city)

    messages = await fetch_listener_messages(client, city)
    if messages:
        log.info("[%s] %d ta tinglovchi murojaati efirga olinmoqda", city, len(messages))
    script = await generate_script(city, messages)
    log.info("[%s] script (%d so'z)", city, len(script.split()))

    duration = max(15, int(len(script.split()) / 2.5))

    if USE_ICECAST:
        # Production: vaqtinchalik faylga TTS, keyin backend API orqali navbatga
        tmp_path = os.path.join(AUDIO_DIR, f"global_{uuid.uuid4().hex}.mp3")
        await synthesize(script, tmp_path)
        await update_status(client, city, script, duration)
        # Backend enqueue API ga yuboramiz
        try:
            resp = await client.post(
                f"{INTERNAL_API_URL}/radio/enqueue",
                json={"lang": "ru", "mp3_path": tmp_path},
                timeout=10,
            )
            if resp.status_code == 200:
                log.info("[%s] Segment navbatga qo'shildi → /live_ru", city)
            else:
                log.warning("enqueue failed: %s", resp.status_code)
        except Exception as exc:
            log.warning("enqueue request failed: %s", exc)
    else:
        # Dev rejim: segmentni saqlaymiz va API ga ro'yxatdan o'tkazamiz
        city_dir = os.path.join(AUDIO_DIR, city)
        os.makedirs(city_dir, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.mp3"
        out_path = os.path.join(city_dir, filename)
        await synthesize(script, out_path)
        await register_segment(client, city, filename, script, duration)
        log.info("[%s] segment tayyor: %s (%ds)", city, filename, duration)


async def main_loop() -> None:
    log.info(
        "Radio AI Host (USE_ICECAST=%s, AI_AUTO_BROADCAST=%s)",
        USE_ICECAST, AI_AUTO_BROADCAST,
    )
    if not AI_AUTO_BROADCAST:
        log.info(
            "AI_AUTO_BROADCAST o'chiq — efir kontenti ИИ-agregatsiya → moderator "
            "orqali o'tadi (radio-api). radio-host bo'sh kutib turadi."
        )
        # Yangi konsepsiyada efir moderator orqali to'ldiriladi.
        # radio-host'ни ishlatishni xohlasangiz AI_AUTO_BROADCAST=true qo'ying.
        while True:
            await asyncio.sleep(3600)

    async with httpx.AsyncClient() as client:
        while True:
            # Global shahar uchun bir segment (loyihada cities jadvali yo'q)
            cities = [{"slug": "global", "name_ru": "Глобальный"}]
            for c in cities:
                city = c["slug"]
                try:
                    await process_city(client, city)
                except Exception as exc:  # noqa: BLE001
                    log.error("process_city(%s) failed: %s", city, exc)

            log.info("Tsikl tugadi, %d sekund kutamiz", SEGMENT_INTERVAL)
            await asyncio.sleep(SEGMENT_INTERVAL)


if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        log.info("To'xtatildi")
