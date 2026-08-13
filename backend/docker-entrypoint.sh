#!/bin/sh
# INTRA GROUP — Docker entrypoint
#
# Bitta containerda ishlaydi:
#   1. Icecast2 — fon (USE_ICECAST=true bo'lsa)
#   2. FastAPI — asosiy jarayon (PID 1 uchun exec)
#   3. Telegram Bot — fon (backend tayyor bo'lgach)
#
# Tartib muhim: avval uvicorn background'da, bot /health ni kutadi,
# keyin exec uvicorn PID 1 bo'ladi.
set -e

PORT="${PORT:-8001}"

# ── 1. Icecast2 (jonli efir) ──────────────────────────────
if [ "${USE_ICECAST:-false}" = "true" ]; then
    icecast2 -c /etc/icecast2/icecast.xml &
    echo "[entrypoint] Icecast2 started"
fi

# ── 2. Telegram Bot (fon, backend tayyor bo'lishini kutib) ──
# Bot alohida background script orqali ishga tushiriladi —
# uvicorn exec'dan keyin SIGCHLD to'g'ri handle qilinsin.
if [ -n "${BOT_TOKEN}" ]; then
    (
        echo "[bot-starter] Waiting for backend /health..."
        i=0
        while [ $i -lt 60 ]; do
            if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
                echo "[bot-starter] Backend ready, starting bot"
                exec python /app/bot/bot.py
            fi
            sleep 1
            i=$((i + 1))
        done
        echo "[bot-starter] Backend not ready after 60s — bot not started"
    ) &
else
    echo "[entrypoint] BOT_TOKEN not set — bot skipped"
fi

# ── 3. FastAPI uvicorn (PID 1) ────────────────────────────
echo "[entrypoint] Starting uvicorn on :${PORT}"
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers 1 \
    --log-level info
