"""Broadcast_Service — jonli efir (PDF: WebSocket → Icecast).

Doverenniy mikrofon audiosini (webm/opus chunks) WebSocket orqali oladi,
FFmpeg subprocess stdin'ga yozadi, FFmpeg uni Icecast mountpoint'ga uzatadi.
Butun guruh shu mountpoint'ni tinglaydi.

USE_ICECAST=false (dev) bo'lsa — jonli efir mavjud emas (AI playlist ishlaydi).
"""

import os
import subprocess

USE_ICECAST = os.getenv("USE_ICECAST", "false").lower() == "true"
ICECAST_HOST = os.getenv("ICECAST_HOST", "icecast")
ICECAST_PORT = int(os.getenv("ICECAST_PORT", "8000"))
ICECAST_PASS = os.getenv("ICECAST_PASS", "IcecastPass2025!")


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

    def start(self) -> None:
        # Jonli efir /live_ru mount'ga uzatiladi (tinglovchilar shu yerni eshitadi)
        mount = "/live_ru"
        icecast_url = (
            f"icecast://source:{ICECAST_PASS}@{ICECAST_HOST}:{ICECAST_PORT}{mount}"
        )
        cmd = [
            _ffmpeg_bin(),
            "-f", "webm", "-i", "pipe:0",      # stdin'dан webm/opus
            "-c:a", "libmp3lame", "-b:a", "128k",
            "-ar", "44100", "-ac", "2",
            "-content_type", "audio/mpeg",
            "-f", "mp3", icecast_url,
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
            return True
        except (BrokenPipeError, OSError):
            return False

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
    """Jonli efir mavjudmi (Icecast yoqilganmi)."""
    return USE_ICECAST


def is_busy(city: str) -> bool:
    return city in _active


def open_session(city: str, broadcaster_name: str) -> BroadcastSession | None:
    """Yangi efir sessiyasini ochadi. Shahar band bo'lsa — None."""
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
    """Tayyor mp3 faylni Icecast mountpoint'ga uzatadi (moderator одобрил → efir).

    Faqat USE_ICECAST=true bo'lganда ishlatiladi. Bloklovchi subprocess —
    chaqiruvchi tomon to_thread ichidaн chaqirsin yoki dev'da o'tkazib yuborsin.
    """
    if not USE_ICECAST:
        return 0
    mount = f"/{city}"
    icecast_url = (
        f"icecast://source:{ICECAST_PASS}@{ICECAST_HOST}:{ICECAST_PORT}{mount}"
    )
    cmd = [
        _ffmpeg_bin(), "-re", "-i", mp3_path,
        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-content_type", "audio/mpeg", "-f", "mp3", icecast_url,
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
    icecast_url = (
        f"icecast://source:{ICECAST_PASS}@{ICECAST_HOST}:{ICECAST_PORT}{mount}"
    )
    cmd = [
        _ffmpeg_bin(), "-re", "-i", mp3_path,
        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-content_type", "audio/mpeg", "-f", "mp3", icecast_url,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return proc.returncode


def push_files_multilang(paths: dict[str, str]) -> dict[str, int]:
    """Пушит mp3 каждого языка в свой mount /live_{lang}.

    Изоляция сбоев: код != 0 у одного языка не затрагивает остальные (Req 11.4).
    Returns: {lang: returncode}.
    """
    if not USE_ICECAST:
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
