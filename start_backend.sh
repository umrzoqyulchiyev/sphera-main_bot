#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
set -a
source "$ROOT/.env"
set +a
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASS=postgres
export DB_NAME=radio_db
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY="${SECRET_KEY:-change_this_to_a_random_32char_secret_now}"
export MINIAPP_DIR="$ROOT/frontend/dist"
# MediaMTX (efir uzatish) — .env dan olinadi
export USE_MEDIAMTX=true
export MEDIAMTX_HOST=localhost
export MEDIAMTX_RTMP_PORT=1935
export MEDIAMTX_PUBLISH_PASS='MediaMTXPass2025!'
# start.sh chaqirganда joriy tunnel domenini ALLOWED_ORIGINS orqali beradi —
# shu qiymatni saqlab qolamiz (eskirgan tunnel domenini qattiq yozib qo'ymaymiz).
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://localhost:5173,http://localhost:8001}"
VENV="$ROOT/.venv_mac"
[ -x "$VENV/bin/uvicorn" ] || VENV="$ROOT/.venv"
exec "$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8001
