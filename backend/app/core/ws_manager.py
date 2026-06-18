"""WebSocket Connection Manager — multi-instance ready.

Single instance: direct broadcast.
Multi instance: Redis pub/sub orqali barcha instancelarga yetkazadi.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

from app.core import redis as redis_client

log = logging.getLogger("ws_manager")

_CHANNEL_PREFIX = "ws:broadcast:"


class ConnectionManager:
    """Shahar bo'yicha WebSocket xonalarini boshqaradi.

    Multi-instance deployment:
    - broadcast() Redis pub/sub orqali barcha instancelarga yuboriadi
    - Har instance o'z local connectionlariga yetkazadi
    """

    def __init__(self) -> None:
        self.rooms: dict[str, list[WebSocket]] = {}
        self._subscriber_task: asyncio.Task | None = None

    async def start_subscriber(self) -> None:
        """Redis pub/sub subscriber'ni ishga tushiradi (multi-instance sync)."""
        if not redis_client.is_available():
            return
        try:
            import redis.asyncio as aioredis
            self._subscriber_task = asyncio.create_task(
                self._subscribe_loop(), name="ws_subscriber"
            )
            log.info("WebSocket Redis subscriber started")
        except Exception as exc:
            log.warning("Redis subscriber failed to start: %s", exc)

    async def _subscribe_loop(self) -> None:
        """Redis channellarni tinglaydi va local broadcast qiladi."""
        try:
            import redis.asyncio as aioredis
            pubsub = redis_client._redis.pubsub()
            await pubsub.psubscribe(f"{_CHANNEL_PREFIX}*")
            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    city = channel.replace(_CHANNEL_PREFIX, "")
                    try:
                        data = json.loads(message["data"])
                        await self._local_broadcast(city, data)
                    except (json.JSONDecodeError, Exception):
                        pass
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            log.error("Redis subscriber error: %s", exc)

    async def stop_subscriber(self) -> None:
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass

    async def connect(self, city: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(city, []).append(websocket)

    def disconnect(self, city: str, websocket: WebSocket) -> None:
        conns = self.rooms.get(city)
        if conns and websocket in conns:
            conns.remove(websocket)
        if conns is not None and not conns:
            self.rooms.pop(city, None)

    def listeners_count(self, city: str) -> int:
        return len(self.rooms.get(city, []))

    async def broadcast(self, city: str, data: dict) -> None:
        """Broadcast — Redis orqali (multi-instance) yoki local."""
        if redis_client.is_available():
            try:
                await redis_client.publish(
                    f"{_CHANNEL_PREFIX}{city}",
                    json.dumps(data, ensure_ascii=False, default=str),
                )
                # Local ham (o'z instance'imiz Redis'dan olmasligi uchun)
                await self._local_broadcast(city, data)
                return
            except Exception:
                pass
        # Fallback: direct local broadcast
        await self._local_broadcast(city, data)

    async def _local_broadcast(self, city: str, data: dict) -> None:
        """Faqat shu instance'dagi connectionlarga yuboradi."""
        conns = list(self.rooms.get(city, []))
        if not conns:
            return

        dead: list[WebSocket] = []

        # asyncio.gather bilan parallel yuborish (performance)
        async def _send(ws: WebSocket):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)

        await asyncio.gather(*[_send(ws) for ws in conns], return_exceptions=True)

        for ws in dead:
            self.disconnect(city, ws)


manager = ConnectionManager()
