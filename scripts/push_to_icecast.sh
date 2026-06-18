#!/bin/bash
# MP3 faylni Icecast /live_ru ga uzatadi
PASS='IcecastPass2025!'
FILE="${1:-/tmp/tts_test.mp3}"
ffmpeg -re -i "$FILE" -c:a libmp3lame -b:a 128k -ar 44100 -ac 2 \
    -content_type audio/mpeg -f mp3 \
    "icecast://source:${PASS}@localhost:8000/live_ru" 2>&1 | tail -3
