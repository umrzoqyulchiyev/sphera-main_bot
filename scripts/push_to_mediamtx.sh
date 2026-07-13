#!/bin/bash
# MP3 faylni MediaMTX /live_ru ga (RTMP) uzatadi
PASS='MediaMTXPass2025!'
FILE="${1:-/tmp/tts_test.mp3}"
ffmpeg -re -i "$FILE" -c:a aac -b:a 128k -ar 44100 -ac 2 \
    -f flv \
    "rtmp://publisher:${PASS}@localhost:1935/live_ru" 2>&1 | tail -3
