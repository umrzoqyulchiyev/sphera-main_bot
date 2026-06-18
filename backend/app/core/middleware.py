"""Request/Response logging middleware.

Har bir HTTP so'rovni logga yozadi:
- Method, path, status code, duration
- Production: JSON formatda (ELK/Grafana uchun)
- WebSocket va health endpointlarni o'tkazib yuboradi (noise kamaytirish)
"""

import time
import logging

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

log = logging.getLogger("http")

# Bu endpointlar loglanmaydi (health check spam oldini olish)
_SKIP_PATHS = {"/health", "/health/ready", "/favicon.ico"}


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Har so'rovni log qiluvchi middleware."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Health check va favicon'ni o'tkazib yuboramiz
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        # WebSocket upgrade ni o'tkazib yuboramiz
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # Client IP
        client_ip = request.client.host if request.client else "-"

        # Log level: 5xx=ERROR, 4xx=WARNING, else=INFO
        status = response.status_code
        if status >= 500:
            log.error(
                "%s %s → %d (%.1fms) [%s]",
                request.method, request.url.path, status, duration_ms, client_ip,
            )
        elif status >= 400:
            log.warning(
                "%s %s → %d (%.1fms) [%s]",
                request.method, request.url.path, status, duration_ms, client_ip,
            )
        else:
            log.info(
                "%s %s → %d (%.1fms) [%s]",
                request.method, request.url.path, status, duration_ms, client_ip,
            )

        # Response headerga timing qo'shamiz (debugging uchun)
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        return response
