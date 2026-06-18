#!/bin/bash
set -a
source /mnt/d/KIro_projectsbot/sphera-main/.env
set +a
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASS=postgres
export DB_NAME=radio_db
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY=change_this_to_a_random_32char_secret_now
export MINIAPP_DIR=/mnt/d/KIro_projectsbot/sphera-main/frontend/dist
# Icecast (efir uzatish) — .env dan olinadi
export USE_ICECAST=true
export ICECAST_HOST=localhost
export ICECAST_PORT=8000
export ALLOWED_ORIGINS='http://localhost:5173,http://localhost:8001,https://colorado-leaders-fruit-everything.trycloudflare.com'
exec /mnt/d/KIro_projectsbot/sphera-main/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001
export ICECAST_PASS='IcecastPass2025!'
