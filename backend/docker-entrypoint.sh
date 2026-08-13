#!/bin/sh
# INTRA GROUP — Docker entrypoint
# 1. FastAPI uvicorn (asosiy jarayon, PID 1)
# 2. Telegram Bot — fon (backend tayyor bo'lgach)
set -e

PORT="${PORT:-8001}"

# Bot — backend tayyor bo'lishini kutib fonda ishga tushadi
if [ -n "${BOT_TOKEN}" ]; then
    (
        i=0
        while [ $i -lt 60 ]; do
            if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
                echo "[bot] Backend ready, starting bot"
                exec python /app/bot/bot.py
            fi
            sleep 1
            i=$((i + 1))
        done
        echo "[bot] Backend not ready — bot skipped"
    ) &
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers 1 --log-level info
