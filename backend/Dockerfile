FROM python:3.12-slim

WORKDIR /app

# Tizim kutubxonalari: ffmpeg (audio), curl (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python paketlari
RUN pip install --no-cache-dir \
    fastapi==0.111.0 \
    "uvicorn[standard]==0.30.0" \
    asyncpg==0.29.0 \
    "python-jose[cryptography]==3.3.0" \
    httpx==0.27.0 \
    google-generativeai==0.7.0 \
    edge-tts==6.1.10 \
    python-multipart==0.0.9 \
    "pydantic-settings==2.3.0" \
    "redis[hiredis]==5.0.0" \
    faster-whisper==1.0.3

# Ilova kodi
COPY app ./app

# Frontend static fayllar (backend/static/ da bo'lishi kerak)
COPY static ./static

# Xavfsizlik: root sifatida ishlamaydi
RUN useradd -m -r appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /tmp/sphera_audio /tmp/sphera_uploads && \
    chown appuser:appuser /tmp/sphera_audio /tmp/sphera_uploads

USER appuser

ENV MINIAPP_DIR=/app/static
ENV AUDIO_DIR=/tmp/sphera_audio
ENV UPLOAD_DIR=/tmp/sphera_uploads

EXPOSE 8001

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
