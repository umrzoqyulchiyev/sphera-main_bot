#!/bin/bash
# MediaMTX efir test skripti — test signalni RTMP orqali mount'ga uzatadi
# Foydalanish: bash test_mediamtx.sh [mount] [sekund]
PASS='MediaMTXPass2025!'
MOUNT="${1:-live_ru}"
DUR="${2:-90}"

# Quloqqa yoqimliroq test ohangi: ikki ohang navbatma-navbat (pi-po-pi-po)
ffmpeg -f lavfi -i "sine=frequency=523:duration=${DUR}" \
       -af "tremolo=f=2:d=0.7,volume=0.5" \
       -acodec libmp3lame -b:a 128k /tmp/test_tone.mp3 -y >/dev/null 2>&1

echo "Test signal ${DUR}s davomida /${MOUNT} ga uzatilmoqda..."
ffmpeg -re -i /tmp/test_tone.mp3 -c:a aac -b:a 128k -ar 44100 -ac 2 \
    -f flv \
    "rtmp://publisher:${PASS}@localhost:1935/${MOUNT}" 2>&1 | tail -3
echo "Test tugadi."
