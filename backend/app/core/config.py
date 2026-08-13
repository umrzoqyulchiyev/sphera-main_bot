"""Markazlashtirilgan konfiguratsiya — Pydantic Settings orqali.

Barcha env variablelar bu yerda validatsiya qilinadi.
Import: `from app.core.config import settings`
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide settings with validation."""

    # ── App ──
    app_name: str = "Sfera5 Radio API"
    app_version: str = "2.0.0"
    debug: bool = False

    # ── Security ──
    secret_key: str = Field(default="INSECURE_DEV_KEY_CHANGE_IN_PRODUCTION", min_length=24)
    algorithm: str = "HS256"
    token_expire_days: int = 30
    internal_api_key: str = Field(
        default="", description="Key for internal service-to-service calls"
    )
    allowed_origins: str = "*"

    # ── Database ──
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_pass: str = "postgres"
    db_name: str = "radio_db"
    db_pool_min: int = 2
    db_pool_max: int = 20
    database_url: str = ""  # Render: postgresql://user:pass@host/db

    # ── Redis ──
    redis_url: str = "redis://localhost:6379/0"

    # ── Telegram ──
    bot_token: str = ""
    bot_username: str = ""  # @ belgisiz, masalan: intra_group_bot (deep-link uchun)
    admin_ids: str = ""
    community_chat_id: str = ""
    disable_group_check: bool = True

    # ── Telegram MTProto (userbot — Voice Chat boshqaruvi uchun) ──
    tg_api_id: int = 0
    tg_api_hash: str = ""
    tg_session_string: str = ""  # Pyrogram userbot session
    voice_chat_group_id: str = ""  # Voice Chat ochilgan guruh ID

    # ── Telegram Payments (point sotib olish) ──
    payment_provider_token: str = ""  # BotFather → Payments
    payment_currency: str = "XTR"  # XTR = Telegram Stars, yoki USD/EUR (provider bilan)

    # ── CryptoBot (TON/USDT/BTC to'lovi) ──
    cryptobot_api_token: str = ""  # @CryptoBot → Create App → API token

    # ── AI ──
    gemini_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # ── STT ──
    whisper_model: str = "small"

    # ── TTS ──
    tts_provider: str = "edge"  # elevenlabs | edge
    tts_fallback_edge: bool = True
    elevenlabs_api_key: str = ""
    eleven_model: str = "eleven_multilingual_v2"
    eleven_voice_ru: str = ""
    eleven_voice_lt: str = ""
    eleven_voice_en: str = ""

    # ── MediaMTX (RTMP ingest / HLS delivery) ──
    use_mediamtx: bool = False
    mediamtx_host: str = "localhost"
    mediamtx_rtmp_port: int = 1935
    mediamtx_hls_port: int = 8888
    mediamtx_publish_pass: str = "MediaMTXPass2025!"

    # ── Icecast (jonli efir — past kechikish, ~6-8s target) ──
    use_icecast: bool = False
    icecast_host: str = "localhost"
    icecast_port: int = 8000
    icecast_pass: str = "IcecastPass2025!"

    # ── Storage ──
    # Default yo'llar — Docker/Railway uchun /app/ prefiksi, lokal dev uchun
    # .audio/ va .uploads/ (loyiha ildir papkasida). .env da AUDIO_DIR va
    # UPLOAD_DIR orqali o'zgartiriladi.
    audio_dir: str = "/app/.audio"
    upload_dir: str = "/app/.uploads"
    max_upload_mb: int = 20

    # ── Radio ──
    miniapp_dir: str = ""
    api_url: str = ""  # To'liq URL (voice/file URL lar uchun)

    # ── Points cost-model ──
    cost_chat: int = 1
    cost_chat_voice: int = 1
    cost_studio: int = 1
    cost_studio_voice: int = 2
    initial_points: int = 50

    # ── Aggregator ──
    aggregator_min_messages: int = 5
    aggregator_interval: int = 120

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str) -> str:
        return v

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def admin_ids_set(self) -> set[int]:
        return {int(x) for x in self.admin_ids.split(",") if x.strip().isdigit()}

    @property
    def db_dsn(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_pass}@{self.db_host}:{self.db_port}/{self.db_name}"

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


# Convenience alias
settings = get_settings()
