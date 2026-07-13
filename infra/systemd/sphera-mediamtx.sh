#!/bin/bash
# MediaMTX — systemd service uchun (foreground)
ROOT="/mnt/d/KIro_projectsbot/sphera-main"
export MEDIAMTX_PUBLISH_PASS='MediaMTXPass2025!'
# mediamtx foreground'da ishlaydi (systemd Type=simple uchun)
exec mediamtx "$ROOT/infra/mediamtx/mediamtx.yml"
