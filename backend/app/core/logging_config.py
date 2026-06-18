"""Structured logging konfiguratsiyasi.

JSON formatda loglar — observability uchun (Grafana, Loki, ELK).
Dev rejimda human-readable, production'da JSON.
"""

import logging
import sys
import json
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Production JSON log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_data"):
            log_entry["data"] = record.extra_data
        return json.dumps(log_entry, ensure_ascii=False)


class DevFormatter(logging.Formatter):
    """Dev human-readable formatter."""

    def __init__(self):
        super().__init__(
            fmt="%(asctime)s [%(levelname)-7s] %(name)-20s: %(message)s",
            datefmt="%H:%M:%S",
        )


def setup_logging(debug: bool = False) -> None:
    """Logging tizimini sozlaydi."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)

    # Remove existing handlers
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG if debug else logging.INFO)

    if debug:
        handler.setFormatter(DevFormatter())
    else:
        handler.setFormatter(JSONFormatter())

    root.addHandler(handler)

    # Noisy loggerlarni suslash
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("faster_whisper").setLevel(logging.WARNING)
