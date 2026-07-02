#!/bin/bash
# Cloudflare tunnel — systemd service uchun (foreground)
# Tunnel URL aniqlangach faylga yozadi VA botni restart qiladi (yangi URL bilan).
ROOT="/mnt/d/KIro_projectsbot/sphera-main"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"
: > "$LOGS/tunnel.log"
# Eski URL'ni o'chiramiz — bot eski (o'lik) URL'ni o'qib qolmasin
rm -f "$LOGS/tunnel_url.txt"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

# Tunnel URL ni aniqlab faylga yozadi va botni yangi URL bilan qayta ishga tushiradi
(
  for i in $(seq 1 90); do
    URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOGS/tunnel.log" | head -1)
    if [ -n "$URL" ]; then
      OLD=$(cat "$LOGS/tunnel_url.txt" 2>/dev/null)
      echo "$URL" > "$LOGS/tunnel_url.txt"
      # URL tayyor bo'lguncha biroz kutamiz (DNS tarqalishi), keyin botni yangilaymiz
      sleep 8
      if [ "$URL" != "$OLD" ]; then
        systemctl --user restart sphera-bot 2>/dev/null || true
      fi
      break
    fi
    sleep 1
  done
) &

exec "$ROOT/bin/cloudflared" tunnel --url http://localhost:8001 --no-autoupdate 2>&1 | tee -a "$LOGS/tunnel.log"
