#!/bin/bash
# Voice Chat session string'ni .env ga qo'shadi va backendni qayta ishga tushiradi.
# Foydalanish:
#   bash backend/scripts/set_session.sh "SESSION_STRING_BU_YERGA"

set -e

ROOT="/mnt/d/KIro_projectsbot/sphera-main"
ENV_FILE="$ROOT/.env"

SESSION="$1"
if [ -z "$SESSION" ]; then
    echo "❌ Session string berilmadi."
    echo "Foydalanish: bash backend/scripts/set_session.sh \"<SESSION_STRING>\""
    exit 1
fi

# .env da TG_SESSION_STRING bor bo'lsa — almashtiramiz, yo'q bo'lsa — qo'shamiz
if grep -q "^TG_SESSION_STRING=" "$ENV_FILE"; then
    # Maxsus belgilarni xavfsiz almashtirish uchun python ishlatamiz
    python3 - "$ENV_FILE" "$SESSION" <<'PYEOF'
import sys
env_file, session = sys.argv[1], sys.argv[2]
lines = []
with open(env_file) as f:
    for line in f:
        if line.startswith("TG_SESSION_STRING="):
            lines.append(f"TG_SESSION_STRING={session}\n")
        else:
            lines.append(line)
with open(env_file, "w") as f:
    f.writelines(lines)
PYEOF
    echo "✅ TG_SESSION_STRING yangilandi (.env)"
else
    echo "TG_SESSION_STRING=$SESSION" >> "$ENV_FILE"
    echo "✅ TG_SESSION_STRING qo'shildi (.env)"
fi

# Backendni qayta ishga tushirish
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
echo "🔄 Backend qayta ishga tushirilmoqda..."
pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
sleep 3
systemctl --user start sphera-backend
sleep 10

# Tekshirish
STATUS=$(curl -s http://localhost:8001/health -o /dev/null -w "%{http_code}")
echo "Backend health: $STATUS"
echo ""
echo "Voice Chat holatini tekshirish uchun botda /efir bosing."
