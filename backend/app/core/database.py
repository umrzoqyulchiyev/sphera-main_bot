"""Database layer — asyncpg pool bilan.

- Connection retry logic (startup)
- Health check method
- Proper pool sizing
"""

import asyncio
import logging

import asyncpg

from app.core.config import settings

log = logging.getLogger("database")


class Database:
    """asyncpg connection pool wrapper with retry logic."""

    def __init__(self) -> None:
        self.pool: asyncpg.Pool | None = None

    async def connect(self, max_retries: int = 5, retry_delay: float = 2.0) -> None:
        """Pool yaratadi. Ulanish bo'lmasa retry qiladi."""
        # Render va boshqa cloud provayderlar DATABASE_URL beradi
        if settings.database_url:
            # postgresql://user:pass@host:port/db formatdan parse qilamiz
            import urllib.parse as urlparse
            u = urlparse.urlparse(settings.database_url)
            connect_kwargs = {
                "host": u.hostname,
                "port": u.port or 5432,
                "user": u.username,
                "password": u.password,
                "database": u.path.lstrip("/"),
                "min_size": settings.db_pool_min,
                "max_size": settings.db_pool_max,
                "command_timeout": 60,
                "ssl": "require",  # Render SSL talab qiladi
            }
        else:
            connect_kwargs = {
                "host": settings.db_host,
                "port": settings.db_port,
                "user": settings.db_user,
                "database": settings.db_name,
                "min_size": settings.db_pool_min,
                "max_size": settings.db_pool_max,
                "command_timeout": 60,
            }
            if settings.db_pass:
                connect_kwargs["password"] = settings.db_pass

        for attempt in range(1, max_retries + 1):
            try:
                self.pool = await asyncpg.create_pool(**connect_kwargs)
                log.info(
                    "Database connected (pool: %d-%d)",
                    settings.db_pool_min, settings.db_pool_max,
                )
                return
            except (asyncpg.PostgresError, OSError, ConnectionRefusedError) as exc:
                if attempt == max_retries:
                    log.error("Database connection failed after %d attempts: %s", max_retries, exc)
                    raise
                log.warning(
                    "Database connection attempt %d/%d failed: %s. Retrying in %.1fs...",
                    attempt, max_retries, exc, retry_delay,
                )
                await asyncio.sleep(retry_delay)
                retry_delay *= 1.5  # Exponential backoff

    async def disconnect(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
            log.info("Database disconnected")

    async def health_check(self) -> bool:
        """DB sog'ligini tekshiradi."""
        try:
            await self.fetchval("SELECT 1")
            return True
        except Exception:
            return False

    async def fetch(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def execute(self, query: str, *args):
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)


db = Database()
