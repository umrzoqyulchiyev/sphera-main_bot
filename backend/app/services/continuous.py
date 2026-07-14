"""Uzluksiz MediaMTX oqimi — PERSISTENT FFmpeg (radiovышka rejimi).

Eski muammo (size=0, uzilish):
  Har segment/filler uchun YANGI ffmpeg ishga tushardi va mount'ga
  qayta-qayta ulanardi → "source already connected", uzilishlar, size=0.

Yangi yechim (radiovышка):
  Har til (ru/lt/en) uchun BITTA doimiy ffmpeg jarayoni:
    ffmpeg -re -f mp3 -i pipe:0  →  rtmp://.../live_{lang}  (MediaMTX RTMP ingest)
  Mount BIR MARTA ulanadi va UZILMAYDI. Python writer pipe'ga uzluksiz
  bir xil formatdagi (44100/stereo/128k) audio bayt yozadi:
    - navbatда segment bo'lsa → segmentni shu formatga transcode qilib yozadi
    - navbat bo'sh bo'lsa → oldindan tayyorlangan jimlik bo'lagini yozadi
  -re va pipe backpressure tufayli yozish real-vaqtда sekinlashadi (mount tirik).

Jonli efir (mikrofon) uchun pause()/resume() — ru mount'ни vaqtincha bo'shatadi.
"""

import asyncio
import logging
import os
import subprocess

log = logging.getLogger("continuous")

USE_MEDIAMTX = os.getenv("USE_MEDIAMTX", "false").lower() == "true"
MEDIAMTX_HOST = os.getenv("MEDIAMTX_HOST", "localhost")
MEDIAMTX_RTMP_PORT = int(os.getenv("MEDIAMTX_RTMP_PORT", "1935"))
MEDIAMTX_PUBLISH_PASS = os.getenv("MEDIAMTX_PUBLISH_PASS", "MediaMTXPass2025!")
AUDIO_DIR = os.getenv("AUDIO_DIR", "/app/audio")

LANGS = ("ru", "lt", "en")

# Yagona audio format — barcha bo'laklar shu formatga keltiriladi (dekoder buzilmaydi)
SAMPLE_RATE = 44100
CHANNELS = 2
BITRATE = "128k"
SILENCE_CHUNK_SEC = 2.0  # bo'sh paytda yoziladigan jimlik bo'lagi uzunligi
PIPE_BLOCK = 16384  # pipe'ga blok-blok yozish (pauza'ni tez sezish uchun)

_queues: dict[str, asyncio.Queue] = {}
_workers: dict[str, asyncio.Task] = {}
_procs: dict[str, subprocess.Popen] = {}
_started = False
_silence_mp3: bytes = b""

_paused: dict[str, bool] = {}


def pause(lang: str) -> None:
    """Jonli efir boshlanganda — worker ffmpeg'ni yopadi (mount'ni bo'shatadi)."""
    _paused[lang] = True


def resume(lang: str) -> None:
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


def _rtmp_url(lang: str) -> str:
    # MediaMTX internal auth RTMP orqali userinfo (user:pass@host) emas,
    # query-parametr sifatida keladi: ?user=&pass=
    # https://mediamtx.org/docs/features/authentication
    return (
        f"rtmp://{MEDIAMTX_HOST}:{MEDIAMTX_RTMP_PORT}/live_{lang}"
        f"?user=publisher&pass={MEDIAMTX_PUBLISH_PASS}"
    )


def enqueue(lang: str, mp3_path: str) -> bool:
    """Segmentni til navbatiga qo'shadi (AI host yoki moderator tasdiqlаганда)."""
    if lang not in _queues:
        return False
    try:
        _queues[lang].put_nowait(mp3_path)
        return True
    except Exception:
        return False


def enqueue_multilang(paths: dict[str, str]) -> None:
    for lang, p in paths.items():
        if lang in _queues and p:
            enqueue(lang, p)


async def _gen_silence() -> bytes:
    """Bir marta ~2s jimlik MP3 (yagona format) generatsiya qiladi."""
    cmd = [
        _ffmpeg_bin(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"anullsrc=r={SAMPLE_RATE}:cl=stereo",
        "-t",
        str(SILENCE_CHUNK_SEC),
        "-c:a",
        "libmp3lame",
        "-b:a",
        BITRATE,
        "-ar",
        str(SAMPLE_RATE),
        "-ac",
        str(CHANNELS),
        "-write_xing",
        "0",
        "-id3v2_version",
        "0",
        "-f",
        "mp3",
        "pipe:1",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
    )
    data, _ = await proc.communicate()
    return data or b""


async def _transcode_uniform(mp3_path: str) -> bytes:
    """Segmentni yagona formatga (44100/stereo/128k) keltirib bayt qaytaradi.

    Shu tufayli persistent ffmpeg pipe'da format sakramaydi → dekoder buzilmaydi.
    """
    cmd = [
        _ffmpeg_bin(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        mp3_path,
        "-c:a",
        "libmp3lame",
        "-b:a",
        BITRATE,
        "-ar",
        str(SAMPLE_RATE),
        "-ac",
        str(CHANNELS),
        "-write_xing",
        "0",
        "-id3v2_version",
        "0",
        "-f",
        "mp3",
        "pipe:1",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
    )
    data, _ = await proc.communicate()
    return data or b""


def _spawn_ffmpeg(lang: str) -> subprocess.Popen:
    """Til uchun DOIMIY ffmpeg: pipe:0 (mp3) → MediaMTX RTMP mount. Bir marta ulanadi."""
    cmd = [
        _ffmpeg_bin(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-re",
        "-f",
        "mp3",
        "-i",
        "pipe:0",
        "-c:a",
        "aac",
        "-b:a",
        BITRATE,
        "-ar",
        str(SAMPLE_RATE),
        "-ac",
        str(CHANNELS),
        "-f",
        "flv",
        _rtmp_url(lang),
    ]
    return subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _close_proc(lang: str) -> None:
    proc = _procs.pop(lang, None)
    if proc is None:
        return
    try:
        if proc.stdin:
            proc.stdin.close()
    except OSError:
        pass
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


async def _write_blocks(lang: str, data: bytes) -> bool:
    """Baytlarni pipe'ga blok-blok yozadi (pauza/uzilishни tez sezish uchun).

    Yozish bloklovchi — to_thread ichida. -re tufayli real-vaqtда sekinlashadi.
    """
    proc = _procs.get(lang)
    if proc is None or proc.stdin is None:
        return False
    mv = memoryview(data)
    for i in range(0, len(mv), PIPE_BLOCK):
        if _paused.get(lang, False):
            return False
        block = mv[i : i + PIPE_BLOCK]
        try:
            await asyncio.to_thread(proc.stdin.write, block)
            await asyncio.to_thread(proc.stdin.flush)
        except (BrokenPipeError, OSError, ValueError):
            return False
    return True


async def _worker(lang: str) -> None:
    """Til uchun uzluksiz oqim: bitta ffmpeg, navbat bor — segment, yo'q — jimlik."""
    q = _queues[lang]
    log.info("[continuous] %s worker ishga tushdi → /live_%s", lang, lang)

    while True:
        try:
            # Jonli efir (mikrofon) mount'ni egallagan — ffmpeg'ni yopib kutamiz
            if _paused.get(lang, False):
                if lang in _procs:
                    _close_proc(lang)
                await asyncio.sleep(0.3)
                continue

            # Doimiy ffmpeg tirikligini ta'minlaymiz (o'lgan bo'lsa qayta ochamiz)
            proc = _procs.get(lang)
            if proc is None or proc.poll() is not None:
                if proc is not None and proc.poll() is not None:
                    log.warning(
                        "[continuous] %s ffmpeg o'ldi (rc=%s), qayta ochamiz", lang, proc.poll()
                    )
                _close_proc(lang)
                _procs[lang] = _spawn_ffmpeg(lang)
                await asyncio.sleep(0.2)

            # Navbatdan segment, bo'lmasa jimlik
            data: bytes
            try:
                mp3 = q.get_nowait()
                if mp3 and os.path.isfile(mp3):
                    data = await _transcode_uniform(mp3)
                    if not data:
                        data = _silence_mp3
                    else:
                        log.info("[continuous] %s segment efirga: %s", lang, os.path.basename(mp3))
                else:
                    data = _silence_mp3
            except asyncio.QueueEmpty:
                data = _silence_mp3

            ok = await _write_blocks(lang, data)
            if not ok and not _paused.get(lang, False):
                # Pipe uzildi — ffmpeg qayta ochiladi (keyingi tsiklda)
                _close_proc(lang)
                await asyncio.sleep(0.3)

        except asyncio.CancelledError:
            _close_proc(lang)
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("[continuous] %s worker xato: %s", lang, exc)
            _close_proc(lang)
            await asyncio.sleep(1)


def is_running() -> bool:
    return _started


async def start() -> None:
    """Barcha tillar uchun persistent oqim worker'larini ishga tushiradi."""
    global _started, _silence_mp3
    if _started or not USE_MEDIAMTX:
        return

    _silence_mp3 = await _gen_silence()
    if not _silence_mp3:
        log.error("[continuous] Jimlik MP3 generatsiya bo'lmadi — ffmpeg yo'qmi?")
        return
    log.info("[continuous] Jimlik bo'lagi tayyor (%d bayt)", len(_silence_mp3))

    for lang in LANGS:
        _queues[lang] = asyncio.Queue()
        _paused[lang] = False
        _workers[lang] = asyncio.create_task(_worker(lang))
    _started = True
    log.info("[continuous] Persistent multiyazык oqim ishga tushdi (ru/lt/en)")


async def stop() -> None:
    global _started
    for t in _workers.values():
        t.cancel()
    for lang in list(_procs.keys()):
        _close_proc(lang)
    _workers.clear()
    _queues.clear()
    _started = False
