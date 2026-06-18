"""Redis client — pub/sub, caching, token blacklist.

Graceful degradation: Redis bo'lmasa ham app ishlaydi (in-memory fallback).
"""

import logging
from typing import Optional

log = logging.getLogger("redis")

_redis = None
_available = False


async def connect() -> None:
    """Redis'ga ulanadi. Bo'lmasa ogohlantiradi va davom etadi."""
    global _redis, _available
    try:
        import redis.asyncio as aioredis
        from app.core.config import settings
        _redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            retry_on_timeout=True,
        )
        await _redis.ping()
        _available = True
        log.info("Redis connected: %s", settings.redis_url)
    except Exception as exc:
        _available = False
        log.warning("Redis unavailable (falling back to in-memory): %s", exc)


async def disconnect() -> None:
    global _redis, _available
    if _redis:
        await _redis.aclose()
    _redis = None
    _available = False


def is_available() -> bool:
    return _available


async def get(key: str) -> Optional[str]:
    if not _available:
        return None
    try:
        return await _redis.get(key)
    except Exception:
        return None


async def set_key(key: str, value: str, ex: int = None) -> bool:
    if not _available:
        return False
    try:
        await _redis.set(key, value, ex=ex)
        return True
    except Exception:
        return False


async def delete(key: str) -> bool:
    if not _available:
        return False
    try:
        await _redis.delete(key)
        return True
    except Exception:
        return False


async def exists(key: str) -> bool:
    if not _available:
        return False
    try:
        return bool(await _redis.exists(key))
    except Exception:
        return False


async def publish(channel: str, message: str) -> None:
    """Pub/sub — multi-instance WebSocket sync uchun."""
    if not _available:
        return
    try:
        await _redis.publish(channel, message)
    except Exception:
        pass


# ============ Token Blacklist ============
_TOKEN_PREFIX = "blacklist:token:"
_local_blacklist: set[str] = set()  # fallback agar Redis yo'q


async def blacklist_token(token: str, ttl_seconds: int = 30 * 86400) -> None:
    """Token'ni blacklist'ga qo'shadi (logout, ban)."""
    key = f"{_TOKEN_PREFIX}{token}"
    stored = await set_key(key, "1", ex=ttl_seconds)
    if not stored:
        _local_blacklist.add(token)


async def is_token_blacklisted(token: str) -> bool:
    """Token blacklist'dami tekshiradi."""
    if token in _local_blacklist:
        return True
    key = f"{_TOKEN_PREFIX}{token}"
    return await exists(key)
