FROM python:3.12-slim

WORKDIR /app

# Tizim kutubxonalari: ffmpeg (audio), curl (healthcheck), build-essential (tgcrypto native build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python paketlari — requirements.txt yagona manba
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

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
