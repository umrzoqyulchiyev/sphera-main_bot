#!/bin/sh
# Icecast'ni fon jarayonida ko'taradi (jonli efir manbai), keyin uvicorn'ni
# asosiy (PID 1) jarayon sifatida ishga tushiradi. Ikkalasi ham bitta
# konteynerda — Railay trial rejasida alohida servis ochish resurs limitiga
# uchraganda tanlangan yechim (infra/icecast/ alohida servis sifatida ham
# saqlanadi, keyin plan kengaytirilsa shunga o'tish mumkin).
set -e

if [ "${USE_ICECAST:-false}" = "true" ]; then
    icecast2 -c /etc/icecast2/icecast.xml &
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8001}"
