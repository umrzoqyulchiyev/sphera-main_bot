#!/bin/bash
# MediaMTX — systemd service uchun (foreground)
ROOT="/mnt/d/KIro_projectsbot/sphera-main"
# MediaMTX o'z mediamtx.yml ichidagi ${VAR}ni substitutsiya qilmaydi — parolni
# shu MTX_ prefiksli env orqali beramiz (backend'dagi MEDIAMTX_PUBLISH_PASS
# bilan bir xil qiymat bo'lishi kerak).
export MTX_AUTHINTERNALUSERS_0_PASS='MediaMTXPass2025!'
# mediamtx foreground'da ishlaydi (systemd Type=simple uchun)
exec mediamtx "$ROOT/infra/mediamtx/mediamtx.yml"
