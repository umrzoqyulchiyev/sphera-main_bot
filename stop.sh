#!/bin/bash
# ============================================================
#  INTRA GROUP — barcha xizmatlarni to'xtatish
#  Foydalanish: bash stop.sh
# ============================================================
echo "To'xtatilmoqda..."

pkill -f "uvicorn app.main:app"  2>/dev/null && echo "  Backend ✓"      || true
pkill -f "python.*bot/bot.py"    2>/dev/null && echo "  Bot ✓"          || true
pkill -f "python.*host/main.py"  2>/dev/null && echo "  AI Host ✓"      || true
pkill -f "cloudflared tunnel"    2>/dev/null && echo "  Tunnel ✓"       || true

echo "Hammasi to'xtatildi."
echo ""
echo "Eslatma: PostgreSQL, Redis, MediaMTX alohida xizmatlar — ular to'xtatilmadi."
echo "Ularni to'xtatish uchun: sudo service postgresql stop / redis-server stop / systemctl --user stop sphera-mediamtx"
