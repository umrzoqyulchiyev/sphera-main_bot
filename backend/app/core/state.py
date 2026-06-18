import os
import time
from typing import Optional

from app.core.config import settings

RADIO_PUBLIC_URL = settings.radio_public_url
AUDIO_DIR = settings.audio_dir
USE_ICECAST = settings.use_icecast

# Amaldagi shaharlar (bazadan yuklanadi, dinamik kengayadi)
VALID_CITIES: set[str] = set()


def set_valid_cities(slugs) -> None:
    """Startupда bazadan shaharlar ro'yxatini yuklaydi (set'ni o'rinда o'zgartiradi)."""
    VALID_CITIES.clear()
    VALID_CITIES.update(slugs)


def add_valid_city(slug: str) -> None:
    """Yangi shahar qo'shilganda ro'yxatga qo'shadi."""
    VALID_CITIES.add(slug)


def is_valid_city(slug: str) -> bool:
    """Shahar amaldagilar ro'yxatidami (dinamik tekshiruv)."""
    return slug in VALID_CITIES


MAX_SEGMENTS = 20  # har shahar uchun saqlanadigan oxirgi segmentlar soni


class CityRadioState:
    def __init__(self, city: str) -> None:
        self.city = city
        self.is_live: bool = False
        self.broadcaster_type: Optional[str] = None
        self.broadcaster_name: Optional[str] = None
        # Playlist: [{id, filename, script, created_at, duration_sec}]
        self.segments: list[dict] = []

    def stream_url(self, lang: str = None) -> str:
        if USE_ICECAST:
            # Мультипоток: /live_{lang}. Без языка — RU по умолчанию.
            lng = lang if lang in ("ru", "lt", "en") else "ru"
            return f"{RADIO_PUBLIC_URL}/live_{lng}"
        # Ichki rejim: eng oxirgi segment URL
        if self.segments:
            return f"/radio/audio/{self.city}/{self.segments[-1]['filename']}"
        return None

    def add_segment(self, filename: str, script: str, duration_sec: int) -> dict:
        seg = {
            "id": int(time.time() * 1000),
            "filename": filename,
            "script": script,
            "duration_sec": duration_sec,
            "created_at": time.time(),
        }
        self.segments.append(seg)
        # Eski segmentlarni cheklaymiz (fayllarni ham tozalaymiz)
        while len(self.segments) > MAX_SEGMENTS:
            old = self.segments.pop(0)
            old_path = os.path.join(AUDIO_DIR, self.city, old["filename"])
            try:
                os.remove(old_path)
            except OSError:
                pass
        return seg

    def to_dict(self, listeners_count: int = 0) -> dict:
        return {
            "is_live": self.is_live,
            "broadcaster_type": self.broadcaster_type,
            "broadcaster_name": self.broadcaster_name,
            "listeners_count": listeners_count,
            "stream_url": self.stream_url(),
            "use_icecast": USE_ICECAST,
            "current_segment": self.segments[-1] if self.segments else None,
        }


radio_states: dict[str, CityRadioState] = {}


def get_state(city: str) -> CityRadioState:
    if city not in radio_states:
        radio_states[city] = CityRadioState(city)
    return radio_states[city]
