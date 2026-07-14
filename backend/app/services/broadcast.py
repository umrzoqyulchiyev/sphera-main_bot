"""Broadcast_Service — jonli efir (WebSocket → MediaMTX RTMP).

Doverenniy mikrofon audiosini (webm/opus chunks) WebSocket orqali oladi,
FFmpeg subprocess stdin'ga yozadi, FFmpeg uni MediaMTX mountpoint'ga uzatadi.
Butun guruh shu mountpoint'ni tinglaydi.

USE_MEDIAMTX=false (dev) bo'lsa — jonli efir mavjud emas (AI playlist ishlaydi).
"""

import os
import subprocess
import time

USE_MEDIAMTX = os.getenv("USE_MEDIAMTX", "false").lower() == "true"
# Mikrofon chunk'lari har ~0.5s kelib turishi kerak (GoLiveButton.tsx).
# Shuncha vaqt chunk kelmasa — sessiya "osilib qolgan" deb hisoblanadi
# (masalan foydalanuvchi /stop chaqirmasdan ilovani yopib qo'ygan).
STALE_TIMEOUT_SEC = 15
MEDIAMTX_HOST = os.getenv("MEDIAMTX_HOST", "mediamtx")
MEDIAMTX_RTMP_PORT = int(os.getenv("MEDIAMTX_RTMP_PORT", "1935"))
MEDIAMTX_PUBLISH_PASS = os.getenv("MEDIAMTX_PUBLISH_PASS", "MediaMTXPass2025!")


def _ffmpeg_bin() -> str:
    """FFmpeg binarini topadi (tizimda yoki imageio-ffmpeg)."""
    from shutil import which

    sys_ff = which("ffmpeg")
    if sys_ff:
        return sys_ff
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


class BroadcastSession:
    """Bitta shahar uchun jonli efir sessiyasi."""

    def __init__(self, city: str, broadcaster_name: str) -> None:
        self.city = city
        self.broadcaster_name = broadcaster_name
        self.proc: subprocess.Popen | None = None
        self.last_activity = time.monotonic()

    def start(self) -> None:
        # Jonli efir /live_ru mount'ga uzatiladi (tinglovchilar shu yerni eshitadi)
        mount = "/live_ru"
        # MediaMTX internal auth RTMP orqali userinfo (user:pass@host) emas,
        # query-parametr sifatida keladi: ?user=&pass=
        rtmp_url = (
            f"rtmp://{MEDIAMTX_HOST}:{MEDIAMTX_RTMP_PORT}{mount}?user=publisher&pass={MEDIAMTX_PUBLISH_PASS}"
        )
        cmd = [
            _ffmpeg_bin(),
            "-f",
            "webm",
            "-i",
            "pipe:0",  # stdin'dан webm/opus
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-f",
            "flv",
            rtmp_url,
        ]
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def write(self, chunk: bytes) -> bool:
        """Audio chunk'ni FFmpeg stdin'ga yozadi. Muvaffaqiyat — True."""
        if self.proc is None or self.proc.stdin is None:
            return False
        try:
            self.proc.stdin.write(chunk)
            self.proc.stdin.flush()
            self.last_activity = time.monotonic()
            return True
        except (BrokenPipeError, OSError):
            return False

    def is_stale(self) -> bool:
        return time.monotonic() - self.last_activity > STALE_TIMEOUT_SEC

    def stop(self) -> None:
        if self.proc is not None:
            try:
                if self.proc.stdin:
                    self.proc.stdin.close()
            except OSError:
                pass
            try:
                self.proc.terminate()
                self.proc.wait(timeout=5)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
            self.proc = None


# Bitta shaharда bitta broadcaster (Requirement 5.5)
_active: dict[str, BroadcastSession] = {}


def is_available() -> bool:
    """Jonli efir mavjudmi (MediaMTX yoqilganmi)."""
    return USE_MEDIAMTX


def _reap_if_stale(city: str) -> None:
    """Chunk oqimi to'xtab qolgan (klient /stop chaqirmasdan uzilgan) sessiyani tozalaydi."""
    session = _active.get(city)
    if session is not None and session.is_stale():
        close_session(city)


def is_busy(city: str) -> bool:
    _reap_if_stale(city)
    return city in _active


def open_session(city: str, broadcaster_name: str) -> BroadcastSession | None:
    """Yangi efir sessiyasini ochadi. Shahar band bo'lsa — None."""
    _reap_if_stale(city)
    if city in _active:
        return None
    session = BroadcastSession(city, broadcaster_name)
    session.start()
    _active[city] = session
    return session


def feed(city: str, chunk: bytes) -> bool:
    """Audio chunk'ni sessiyaga uzatadi."""
    session = _active.get(city)
    if session is None:
        return False
    return session.write(chunk)


def close_session(city: str) -> None:
    session = _active.pop(city, None)
    if session is not None:
        session.stop()


def push_file(city: str, mp3_path: str) -> int:
    """Tayyor mp3 faylni MediaMTX mountpoint'ga uzatadi (moderator одобрил → efir).

    Faqat USE_MEDIAMTX=true bo'lganда ishlatiladi. Bloklovchi subprocess —
    chaqiruvchi tomon to_thread ichidaн chaqirsin yoki dev'da o'tkazib yuborsin.
    """
    if not USE_MEDIAMTX:
        return 0
    mount = f"/{city}"
    rtmp_url = (
        f"rtmp://{MEDIAMTX_HOST}:{MEDIAMTX_RTMP_PORT}{mount}?user=publisher&pass={MEDIAMTX_PUBLISH_PASS}"
    )
    cmd = [
        _ffmpeg_bin(),
        "-re",
        "-i",
        mp3_path,
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-f",
        "flv",
        rtmp_url,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return proc.returncode


# ============ Мультипоток (multilang-studio-broadcast) ============
BROADCAST_LANGS = ("ru", "lt", "en")


def mount_for(lang: str) -> str:
    """Имя mountpoint по языку. Только из белого списка (защита от инъекции)."""
    if lang not in BROADCAST_LANGS:
        raise ValueError(f"Invalid broadcast lang: {lang}")
    return f"/live_{lang}"


def _push_one(lang: str, mp3_path: str) -> int:
    """Пушит один mp3 в mount /live_{lang} через FFmpeg."""
    mount = mount_for(lang)  # валидация языка
    rtmp_url = (
        f"rtmp://{MEDIAMTX_HOST}:{MEDIAMTX_RTMP_PORT}{mount}?user=publisher&pass={MEDIAMTX_PUBLISH_PASS}"
    )
    cmd = [
        _ffmpeg_bin(),
        "-re",
        "-i",
        mp3_path,
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-f",
        "flv",
        rtmp_url,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return proc.returncode


def push_files_multilang(paths: dict[str, str]) -> dict[str, int]:
    """Пушит mp3 каждого языка в свой mount /live_{lang}.

    Изоляция сбоев: код != 0 у одного языка не затрагивает остальные (Req 11.4).
    Returns: {lang: returncode}.
    """
    if not USE_MEDIAMTX:
        return {}
    results: dict[str, int] = {}
    for lang, mp3 in paths.items():
        if lang not in BROADCAST_LANGS:
            continue
        try:
            results[lang] = _push_one(lang, mp3)
        except Exception:  # noqa: BLE001
            results[lang] = -1
    return results
