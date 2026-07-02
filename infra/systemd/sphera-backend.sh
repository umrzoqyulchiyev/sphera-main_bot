#!/bin/bash
# Backend (FastAPI) — systemd service uchun (foreground)
ROOT="/mnt/d/KIro_projectsbot/sphera-main"
VENV="$ROOT/.venv/bin"

export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASS=postgres DB_NAME=radio_db
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY=devsecretkey1234567890devsecret
export UPLOAD_DIR=/mnt/d/KIro_projectsbot/sphera-main/.uploads AUDIO_DIR=/mnt/d/KIro_projectsbot/sphera-main/.audio
export MINIAPP_DIR="$ROOT/frontend/dist"
export FILLER_SECONDS=30
export BOT_TOKEN=8858693463:AAEf2t1kWgBD6gv7-Nlm7si1HPABdRA9C-0
export COMMUNITY_CHAT_ID=-1003883809940
export ADMIN_IDS=7993413019
export DISABLE_GROUP_CHECK=true
export GEMINI_KEY=AIzaSyBQvjFvGyIJjkJPlr2IJilVHkKnOOo-pJ0
export GEMINI_MODEL=gemini-2.5-flash
export USE_ICECAST=true ICECAST_HOST=localhost ICECAST_PORT=8000
export ICECAST_PASS='IcecastPass2025!' ICECAST_ADMIN_PASS='IcecastAdmin2025!'
export TTS_PROVIDER=edge TTS_FALLBACK_EDGE=true
export AI_HOST_INTERVAL=60

# Icecast tunnel URL — har safar fayl dan o'qiymiz (reboot'dan keyin avtomatik yangilanadi)
ICECAST_URL_FILE="$ROOT/.logs/icecast_tunnel_url.txt"
if [ -f "$ICECAST_URL_FILE" ]; then
  export ICECAST_PUBLIC_URL=$(cat "$ICECAST_URL_FILE")
fi

cd "$ROOT/backend"
exec "$VENV/uvicorn" app.main:app --host 0.0.0.0 --port 8001
