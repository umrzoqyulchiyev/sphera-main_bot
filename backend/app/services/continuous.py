"""Uzluksiz Icecast oqimi (har til uchun) — Varl'ning «uzluksiz radio» talabi.

Muammo: `subprocess.run(ffmpeg ... mp3 → icecast)` har segmentni bir marta
uzatadi va mount uziladi → segmentlar orasida jimlik/uzilish.

Yechim: har til (`ru/lt/en`) uchun DOIMIY ishlovchi fon-jarayon (worker):
  - navbatда (queue) segment bo'lsa — uni Icecast mount'ga uzatadi
  - navbat bo'sh bo'lsa — qisqa "filler" (jimlik) uzatadi → mount tirik qoladi
  - tinglovchilar uzilmaydi, oqim uzluksiz

Bu liquidsoap'siz, faqat FFmpeg bilan ishlaydigan amaliy yechim (MVP).
"""

import os
import asyncio
import logging
import subprocess

log = logging.getLogger("continuous")

USE_ICECAST = os.getenv("USE_ICECAST", "false").lower() == "true"
ICECAST_HOST = os.getenv("ICECAST_HOST", "localhost")
ICECAST_PORT = int(os.getenv("ICECAST_PORT", "8000"))
ICECAST_PASS = os.getenv("ICECAST_PASS", "IcecastPass2025!")
AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")

LANGS = ("ru", "lt", "en")
FILLER_SECONDS = float(os.getenv("FILLER_SECONDS", "4"))  # navbat bo'sh bo'lganда jimlik bo'lagi

# Til bo'yicha segment navbati (mp3 yo'llari)
_queues: dict[str, asyncio.Queue] = {}
_workers: dict[str, asyncio.Task] = {}
_started = False

# Til bo'yicha pauza holati — jonli efir (mikrofon) mount'ni egallaganda True.
# Pauza paytida worker filler/segment uzatmaydi (mount'ni bo'shatadi).
_paused: dict[str, bool] = {}


def pause(lang: str) -> None:
    """Jonli efir boshlanganda — continuous worker'ni pauza qiladi (mount'ni bo'shatadi)."""
    _paused[lang] = True


def resume(lang: str) -> None:
    """Jonli efir tugaganda — continuous worker'ni davom ettiradi."""
    _paused[lang] = False


def is_paused(lang: str) -> bool:
    return _paused.get(lang, False)


def _ffmpeg_bin() -> str:
    from shutil import which
    sys_ff = which("ffmpeg")
    if sys_ff:
        return sys_ff
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _icecast_url(lang: str) -> str:
    return f"icecast://source:{ICECAST_PASS}@{ICECAST_HOST}:{ICECAST_PORT}/live_{lang}"


def enqueue(lang: str, mp3_path: str) -> bool:
    """Segmentni til navbatiga qo'shadi (moderator tasdiqlаганда)."""
    if lang not in _queues:
        return False
    try:
        _queues[lang].put_nowait(mp3_path)
        return True
    except Exception:
        return False


def enqueue_multilang(paths: dict[str, str]) -> None:
    """{lang: mp3_path} — har tilning navbatiga qo'shadi."""
    for lang, p in paths.items():
        if lang in _queues and p:
            enqueue(lang, p)


async def _stream_file(lang: str, mp3_path: str) -> None:
    """Bitta mp3 ni Icecast mount'ga real vaqtда (-re) uzatadi."""
    url = _icecast_url(lang)
    cmd = [
        _ffmpeg_bin(), "-hide_banner", "-loglevel", "error",
        "-re", "-i", mp3_path,
        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-content_type", "audio/mpeg", "-f", "mp3", url,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
    )
    await proc.wait()


async def _stream_filler(lang: str) -> None:
    """Navbat bo'sh bo'lganда jimlik uzatadi — mount tirik qoladi (uzilmaydi)."""
    url = _icecast_url(lang)
    cmd = [
        _ffmpeg_bin(), "-hide_banner", "-loglevel", "error",
        "-re", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", str(FILLER_SECONDS),
        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-content_type", "audio/mpeg", "-f", "mp3", url,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
    )
    await proc.wait()


async def _worker(lang: str) -> None:
    """Til uchun uzluksiz oqim: navbatда bor — segment, yo'q — filler."""
    q = _queues[lang]
    log.info("[continuous] %s worker ishga tushdi → /live_%s", lang, lang)
    while True:
        try:
            # Jonli efir (mikrofon) mount'ni egallagan bo'lsa — pauza, mount'ga tegmaymiz
            if _paused.get(lang, False):
                await asyncio.sleep(0.5)
                continue
            try:
                mp3 = q.get_nowait()
                if mp3 and os.path.isfile(mp3):
                    await _stream_file(lang, mp3)
                else:
                    await _stream_filler(lang)
            except asyncio.QueueEmpty:
                # Navbat bo'sh — jimlik bo'lagi (mount tirik qoladi)
                await _stream_filler(lang)
        except Exception as exc:  # noqa: BLE001
            log.warning("[continuous] %s worker xato: %s", lang, exc)
            await asyncio.sleep(1)


def is_running() -> bool:
    return _started


async def start() -> None:
    """Barcha tillar uchun uzluksiz oqim worker'larini ishga tushiradi.

    Faqat USE_ICECAST=true bo'lganда. main.py startup'дан chaqiriladi.
    """
    global _started
    if _started or not USE_ICECAST:
        return
    for lang in LANGS:
        _queues[lang] = asyncio.Queue()
        _workers[lang] = asyncio.create_task(_worker(lang))
    _started = True
    log.info("[continuous] Uzluksiz multiyazык oqim ishga tushdi (ru/lt/en)")


async def stop() -> None:
    global _started
    for t in _workers.values():
        t.cancel()
    _workers.clear()
    _queues.clear()
    _started = False
