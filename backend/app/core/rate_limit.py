"""Rate limiting — sliding window per IP/user.

Redis-based (agar mavjud), aks holda in-memory TTL dict.
Brute-force va DoS himoyasi.
"""

import time
import logging
from collections import defaultdict
from typing import Optional

from fastapi import Request, HTTPException, status

from app.core import redis as redis_client

log = logging.getLogger("rate_limit")

# In-memory fallback (Redis bo'lmasa)
_local_store: dict[str, list[float]] = defaultdict(list)
_CLEANUP_INTERVAL = 300  # 5 daqiqada bir tozalash
_last_cleanup = time.time()


def _cleanup_local():
    """Eskirgan yozuvlarni tozalaydi."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    _last_cleanup = now
    expired_keys = []
    for key, timestamps in _local_store.items():
        _local_store[key] = [t for t in timestamps if now - t < 60]
        if not _local_store[key]:
            expired_keys.append(key)
    for k in expired_keys:
        del _local_store[k]


async def _check_redis(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """Redis ZSET bilan sliding window."""
    import redis.asyncio as aioredis
    now = time.time()
    pipe = redis_client._redis.pipeline()
    pipe.zremrangebyscore(key, 0, now - window_seconds)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()
    count = results[2]
    return count > max_requests, count


async def _check_local(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """In-memory sliding window (single instance)."""
    _cleanup_local()
    now = time.time()
    timestamps = _local_store[key]
    # Remove old entries
    _local_store[key] = [t for t in timestamps if now - t < window_seconds]
    _local_store[key].append(now)
    count = len(_local_store[key])
    return count > max_requests, count


async def check_rate_limit(
    key: str,
    max_requests: int = 60,
    window_seconds: int = 60,
) -> tuple[bool, int]:
    """Rate limit tekshiradi. Returns: (is_limited, current_count)."""
    if redis_client.is_available():
        try:
            return await _check_redis(f"rl:{key}", max_requests, window_seconds)
        except Exception:
            pass
    return await _check_local(key, max_requests, window_seconds)


def rate_limit(max_requests: int = 30, window_seconds: int = 60, key_prefix: str = ""):
    """Dependency — endpoint uchun rate limiter.

    Usage: @router.post("/auth/telegram", dependencies=[Depends(rate_limit(10, 60))])
    """
    async def _limiter(request: Request):
        # IP + endpoint
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"{key_prefix or path}:{client_ip}"

        is_limited, count = await check_rate_limit(key, max_requests, window_seconds)
        if is_limited:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "rate_limit_exceeded",
                    "retry_after_seconds": window_seconds,
                },
            )

    return _limiter
