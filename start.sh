#!/bin/bash
# ============================================================
#  INTRA GROUP — AI Radio: BITTA BUYRUQ bilan hammasi
#  Foydalanish:  bash start.sh
#
#  Bu skript avtomatik:
#    1. PostgreSQL / Redis / Icecast tekshiradi
#    2. HTTPS tunnel ochadi va URL oladi
#    3. .env va frontend/.env ni yangi URL bilan yangilaydi
#    4. Frontend'ni build qiladi
#    5. Backend'ni ishga tushiradi (Icecast worker bilan)
#    6. Telegram bot'ni ishga tushiradi
#    7. AI Radio Host'ni ishga tushiradi
# ============================================================
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv/bin"
LOGDIR="$ROOT/.logs"
mkdir -p "$LOGDIR" /tmp/sphera_uploads /tmp/sphera_audio

echo "==============================================="
echo "   INTRA GROUP — AI Radio ishga tushmoqda"
echo "==============================================="

# .env yuklash
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a

# ── 1. PostgreSQL ──────────────────────────────────────────
if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
    echo "[1/7] PostgreSQL ✓"
else
    echo "[1/7] ❌ PostgreSQL ishlamayapti → sudo service postgresql start"
    exit 1
fi

# ── 2. Redis ───────────────────────────────────────────────
if redis-cli ping >/dev/null 2>&1; then
    echo "[2/7] Redis ✓"
else
    echo "[2/7] ❌ Redis ishlamayapti → sudo service redis-server start"
    exit 1
fi

# ── 3. Icecast2 ────────────────────────────────────────────
if curl -s --max-time 3 http://localhost:8000/status.xsl >/dev/null 2>&1; then
    echo "[3/7] Icecast2 ✓"
else
    echo "[3/7] ⚠️  Icecast2 javob bermayapti (efir ishlamasligi mumkin)"
fi

# ── 4. HTTPS Tunnel ────────────────────────────────────────
echo "[4/7] HTTPS tunnel ochilmoqda..."
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1
"$ROOT/bin/cloudflared" tunnel --url http://localhost:8001 --no-autoupdate \
    > "$LOGDIR/tunnel.log" 2>&1 &

TUNNEL_URL=""
for i in $(seq 1 25); do
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOGDIR/tunnel.log" 2>/dev/null | head -1)
    [ -n "$TUNNEL_URL" ] && break
    sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
    echo "[4/7] ❌ Tunnel URL topilmadi. Internet/DNS tekshiring."
    echo "        (DNS muammosi bo'lsa: sudo resolvectl dns <interface> 8.8.8.8)"
    exit 1
fi
echo "[4/7] Tunnel ✓ → $TUNNEL_URL"

# URL' larni .env va frontend/.env ga yozish
WSS_URL="wss://${TUNNEL_URL#https://}"
sed -i "s|^MINI_APP_URL=.*|MINI_APP_URL=$TUNNEL_URL|" "$ROOT/.env"
cat > "$ROOT/frontend/.env" <<EOF
# Same-origin API (backend frontendni o'zi serve qiladi)
VITE_API_URL=
VITE_WS_URL=$WSS_URL
VITE_RADIO_URL=
VITE_DEFAULT_CITY=global
EOF

# ── 5. Frontend build ──────────────────────────────────────
echo "[5/7] Frontend build bo'lmoqda..."
( cd "$ROOT/frontend" && npm run build > "$LOGDIR/frontend-build.log" 2>&1 )
echo "[5/7] Frontend ✓"

# ── 6. Backend ─────────────────────────────────────────────
echo "[6/7] Backend ishga tushmoqda (port 8001)..."
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1
# ALLOWED_ORIGINS ga yangi tunnel qo'shamiz
export ALLOWED_ORIGINS="http://localhost:5173,http://localhost:8001,$TUNNEL_URL"
( cd "$ROOT/backend" && bash "$ROOT/start_backend.sh" > "$LOGDIR/backend.log" 2>&1 ) &
for i in $(seq 1 15); do
    curl -s http://localhost:8001/health >/dev/null 2>&1 && break
    sleep 1
done
if curl -s http://localhost:8001/health >/dev/null 2>&1; then
    echo "[6/7] Backend ✓"
else
    echo "[6/7] ❌ Backend ishga tushmadi → cat $LOGDIR/backend.log"
    exit 1
fi

# ── 7. Telegram Bot + AI Host ──────────────────────────────
if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "your_botfather_token_here" ]; then
    echo "[7/7] Telegram bot + AI Host ishga tushmoqda..."
    pkill -f "python.*bot/bot.py" 2>/dev/null || true
    pkill -f "python.*host/main.py" 2>/dev/null || true
    sleep 1
    # Bot
    bash -c "set -a && source '$ROOT/.env' && set +a && '$VENV/python' '$ROOT/bot/bot.py'" \
        > "$LOGDIR/bot.log" 2>&1 &
    # AI Radio Host
    bash -c "set -a && source '$ROOT/.env' && set +a && \
        export AI_AUTO_BROADCAST=true INTERNAL_API_URL=http://localhost:8001 \
        AUDIO_DIR=/tmp/sphera_audio SEGMENT_INTERVAL=1800 && \
        '$VENV/python' '$ROOT/backend/app/host/main.py'" \
        > "$LOGDIR/radio-host.log" 2>&1 &
    echo "[7/7] Bot + AI Host ✓"
else
    echo "[7/7] ⚠️  BOT_TOKEN yo'q — bot ishga tushmadi."
fi

echo ""
echo "==============================================="
echo "   ✅ HAMMASI TAYYOR!"
echo "==============================================="
echo "   Mini App : $TUNNEL_URL"
echo "   Bot      : @sfera5radio_bot  (Telegram'da /start)"
echo "   Backend  : http://localhost:8001"
echo "   Loglar   : $LOGDIR/"
echo ""
echo "   To'xtatish:  bash stop.sh"
echo "==============================================="
