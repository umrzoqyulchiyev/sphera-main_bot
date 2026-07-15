FROM python:3.12-slim

WORKDIR /app

# Tizim kutubxonalari: ffmpeg (audio), curl (healthcheck), build-essential (tgcrypto native build)
# icecast2 — jonli efir manbai (past kechikish). Debconf so'rovlarisiz o'rnatish
# uchun "icecast-setup" savolini oldindan "false" qilib javob beramiz (o'z
# icecast.xml'imizni beramiz, paket avtomatik sozlamasin).
RUN echo "icecast2 icecast2/icecast-setup boolean false" | debconf-set-selections && \
    DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    build-essential \
    icecast2 \
    && rm -rf /var/lib/apt/lists/*

# Python paketlari — requirements.txt yagona manba
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ilova kodi
COPY app ./app

# Frontend static fayllar (backend/static/ da bo'lishi kerak)
COPY static ./static

# Icecast konfiguratsiyasi (infra/icecast/icecast.xml bilan bir xil — Docker
# build context faqat backend/ ekani uchun shu yerga nusxa saqlanadi)
COPY icecast.xml /etc/icecast2/icecast.xml
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Xavfsizlik: root sifatida ishlamaydi. Icecast /var/log/icecast2 va
# /etc/icecast2 ga yozishi/o'qishi kerak — appuser'ga beramiz.
RUN useradd -m -r appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /tmp/sphera_audio /tmp/sphera_uploads /var/log/icecast2 && \
    chown -R appuser:appuser /tmp/sphera_audio /tmp/sphera_uploads /var/log/icecast2 /etc/icecast2

USER appuser

ENV MINIAPP_DIR=/app/static
ENV AUDIO_DIR=/tmp/sphera_audio
ENV UPLOAD_DIR=/tmp/sphera_uploads

EXPOSE 8001

CMD ["docker-entrypoint.sh"]
