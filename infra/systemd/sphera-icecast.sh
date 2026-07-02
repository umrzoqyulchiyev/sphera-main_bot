#!/bin/bash
# Icecast2 — systemd service uchun (foreground)
ROOT="/mnt/d/KIro_projectsbot/sphera-main"
mkdir -p /tmp/icecast_logs
# icecast2 foreground'da ishlaydi (systemd Type=simple uchun)
exec icecast2 -c "$ROOT/infra/icecast/icecast.local.xml"
