"""Test configuration — INTRA GROUP v3.0."""

import os
import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

# Env BEFORE imports
os.environ["SECRET_KEY"] = "test_secret_key_32chars_long_enough_ok!"
os.environ["DISABLE_GROUP_CHECK"] = "true"
os.environ["ADMIN_IDS"] = "123456"
os.environ["DEBUG"] = "true"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["INTERNAL_API_KEY"] = "test-internal-key"

from app.core.database import db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
def patch_db():
    """Patch db methods."""
    db._original_pool = db.pool
    db.pool = MagicMock()

    db.fetch = AsyncMock(return_value=[])
    db.fetchrow = AsyncMock(return_value=None)
    db.fetchval = AsyncMock(return_value=1)
    db.execute = AsyncMock(return_value="UPDATE 1")
    db.connect = AsyncMock()
    db.disconnect = AsyncMock()
    db.health_check = AsyncMock(return_value=True)

    yield db

    db.pool = db._original_pool


@pytest.fixture(autouse=True)
def patch_redis():
    """Mock Redis."""
    with patch("app.core.redis.connect", new_callable=AsyncMock), \
         patch("app.core.redis.disconnect", new_callable=AsyncMock), \
         patch("app.core.redis.is_available", return_value=False), \
         patch("app.core.redis.is_token_blacklisted", new_callable=AsyncMock, return_value=False):
        yield


@pytest.fixture
async def client(patch_db, patch_redis):
    """Test HTTP client."""
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def make_user(
    id=1,
    telegram_id=111111,
    username="testuser",
    full_name="Test User",
    display_name="Test",
    language="ru",
    level=1,
    points=Decimal("5.0000"),
    role="listener",
):
    """Helper: user dict yaratish."""
    return {
        "id": id,
        "telegram_id": telegram_id,
        "username": username,
        "full_name": full_name,
        "display_name": display_name,
        "language": language,
        "level": level,
        "points": points,
        "role": role,
        "city": None,
        "last_seen": None,
    }
