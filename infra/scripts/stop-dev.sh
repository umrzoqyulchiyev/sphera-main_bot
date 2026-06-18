#!/bin/bash
# ============================================================
#  Sphera Radio AI — DEV jarayonlarini to'xtatish
# ============================================================
echo "Jarayonlar to'xtatilmoqda..."
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "backend/app/host/main.py" 2>/dev/null || true
pkill -f "bot/bot.py" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true

PG_BIN="/usr/lib/postgresql/16/bin"
"$PG_BIN/pg_ctl" stop -D "$(git rev-parse --show-toplevel)/.pgdata" -m fast 2>/dev/null || true

echo "✅ Hammasi to'xtatildi."
