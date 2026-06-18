#!/bin/bash
# ============================================================
#  Sphera Radio AI — DEV ishga tushirish skripti
# ============================================================
set -e
cd "$(git rev-parse --show-toplevel)"
ROOT="$(pwd)"

PG_BIN="/usr/lib/postgresql/16/bin"
PGDATA="$ROOT/.pgdata"
VENV="$ROOT/.venv/bin"
LOGDIR="$ROOT/.logs"
mkdir -p "$LOGDIR"

set -a; [ -f .env ] && . ./.env; set +a

echo "================================"
echo "  Sphera Radio AI — DEV"
echo "================================"

# --- 1. PostgreSQL ---
if ! "$PG_BIN/pg_isready" -h /tmp -p 5433 >/dev/null 2>&1; then
    echo "[1/5] PostgreSQL ishga tushmoqda (port 5433)..."
    "$PG_BIN/postgres" -D "$PGDATA" -p 5433 -k /tmp > "$LOGDIR/postgres.log" 2>&1 &
    sleep 3
else
    echo "[1/5] PostgreSQL allaqachon ishlayapti."
fi

"$PG_BIN/psql" -h /tmp -p 5433 -U postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname='radio_db'" 2>/dev/null | grep -q 1 || \
    "$PG_BIN/psql" -h /tmp -p 5433 -U postgres -c "CREATE DATABASE radio_db" 2>/dev/null
"$PG_BIN/psql" -h /tmp -p 5433 -U postgres -d radio_db \
    -f backend/app/db/schema.sql > /dev/null 2>&1 || true

export DB_HOST=/tmp DB_PORT=5433 DB_USER=postgres DB_PASS="" DB_NAME=radio_db
export SECRET_KEY="${SECRET_KEY:-devsecretkey1234567890devsecret}"
export ADMIN_IDS="${ADMIN_IDS:-999999}"
export UPLOAD_DIR=/tmp/sphera_uploads
export AUDIO_DIR=/tmp/sphera_audio
export USE_ICECAST="${USE_ICECAST:-false}"
export ICECAST_HOST="${ICECAST_HOST:-localhost}"
export ICECAST_PORT="${ICECAST_PORT:-8000}"
export ICECAST_PASS="${ICECAST_PASS:-IcecastPass2025!}"
export WHISPER_MODEL=small
export GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
export RADIO_PUBLIC_URL="${RADIO_PUBLIC_URL:-http://localhost:8000}"
export MINIAPP_DIR="$ROOT/frontend"
export INTERNAL_API_URL=http://localhost:8001

# --- 2. Backend ---
echo "[2/5] Backend (FastAPI) ishga tushmoqda (port 8001)..."
cd "$ROOT/backend"
"$VENV/uvicorn" app.main:app --host 0.0.0.0 --port 8001 \
    > "$LOGDIR/backend.log" 2>&1 &
cd "$ROOT"
sleep 4

# --- 3. AI Radio Host ---
echo "[3/5] AI Radio Host ishga tushmoqda..."
SEGMENT_INTERVAL=180 PYTHONPATH="$ROOT/backend" \
    "$VENV/python" backend/app/host/main.py > "$LOGDIR/radio-host.log" 2>&1 &
sleep 2

# --- 4. Tunnel ---
echo "[4/5] HTTPS tunnel ochilmoqda..."
"$ROOT/bin/cloudflared" tunnel --url http://localhost:8001 --no-autoupdate \
    > "$LOGDIR/tunnel.log" 2>&1 &
sleep 8
TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOGDIR/tunnel.log" | head -1)
[ -n "$TUNNEL_URL" ] && echo "  ✅ Tunnel: $TUNNEL_URL" || echo "  ⚠️  Tunnel URL tayyor emas."

# --- 5. Bot ---
if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "your_botfather_token_here" ]; then
    echo "[5/5] Telegram bot ishga tushmoqda..."
    "$VENV/python" bot/bot.py > "$LOGDIR/bot.log" 2>&1 &
else
    echo "[5/5] ⚠️  BOT_TOKEN yo'q — bot ishga tushmadi."
fi

echo ""
echo "  Mini App : ${TUNNEL_URL:-http://localhost:8001}/index.html"
echo "  API docs : ${TUNNEL_URL:-http://localhost:8001}/docs"
echo "  Loglar   : $LOGDIR/"
echo "  To'xtatish: make stop"
echo "================================"
