#!/bin/bash
# Icecast tunnel (port 8000) — systemd service uchun
# URL o'zgarganda backend'ni restart qiladi (yangi URL bilan)
ROOT="/mnt/d/KIro_projectsbot/sphera-main"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"
: > "$LOGS/tunnel-icecast.log"
# Eski URL faylini tozalaymiz
rm -f "$LOGS/icecast_tunnel_url.txt"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

# URL aniqlanishi va backend restart uchun fon kuzatuvchi
(
  for i in $(seq 1 90); do
    URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOGS/tunnel-icecast.log" | head -1)
    if [ -n "$URL" ]; then
      echo "$URL" > "$LOGS/icecast_tunnel_url.txt"
      sleep 8  # DNS tarqalishi uchun kutamiz
      # Backend'ni yangi ICECAST_PUBLIC_URL bilan restart qilamiz
      systemctl --user restart sphera-backend 2>/dev/null || true
      break
    fi
    sleep 1
  done
) &

exec "$ROOT/bin/cloudflared" tunnel --url http://localhost:8000 --no-autoupdate 2>&1 | tee -a "$LOGS/tunnel-icecast.log"
