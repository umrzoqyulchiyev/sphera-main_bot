# 📝 CHANGELOG

Loyihada amalga oshirilgan o'zgarishlar va tuzatishlar tarixi.

---

## [Sessiya] — Icecast efir, ovozli xabar va jonli efir tuzatishlari

### 🎙 Icecast jonli efir (yangi)

- **Radio router ulandi** (`backend/app/main.py`): `radio.router` umuman ulanmagan edi — endi `/radio/*` endpointlari ishlaydi.
- **Yetishmayotgan modellar qo'shildi** (`core/models.py`): `RadioStatusUpdate`, `SegmentRegister`, `SegmentOut`, hamda `RadioStatus` ga `stream_url`, `use_icecast`, `current_segment` maydonlari.
- **Uzluksiz oqim ishga tushirildi** (`main.py` lifespan): `continuous.start()` startup'da chaqirilmagan edi. Endi `USE_ICECAST=true` bo'lganda 3 til uchun (`/live_ru`, `/live_lt`, `/live_en`) doimiy mount ochiladi — kontent bo'lmasa jimlik uzatiladi, mount uzilmaydi.
- **Radio proxy mustahkamlandi** (`routers/radio.py`): `/radio/live/{lang}` endi uzilishlarda avtomatik qayta ulanadi, to'g'ri streaming header'lar bilan. Tunnel orqali ham ishlaydi.
- **`/radio/enqueue` endpoint qo'shildi**: AI host tayyor MP3 ni continuous worker navbatiga qo'shadi (to'g'ridan-to'g'ri push o'rniga — bitta mount'ga ikki source ulanish muammosi hal qilindi).
- **`/radio/broadcast/clear` endpoint qo'shildi**: qolib ketgan broadcast sessiyasini tozalash uchun.
- **`global` shahar qo'llab-quvvatlandi**: `radio_status`, `broadcast_ws` endi `global` ni qabul qiladi (loyihada `cities` jadvali yo'q, til-based efir ishlatiladi).

### 🔴 Mikrofon bilan jonli efirga chiqish (GO LIVE)

- **`GoLiveButton` ulandi** (`EfirScreen.tsx`): komponent mavjud edi lekin hech qayerda ishlatilmagan. Endi `admin`/`doverenniy` roli uchun ko'rsatiladi.
- Mikrofon ovozi WebSocket (`/radio/{city}/broadcast/ws`) orqali backend'ga → FFmpeg → Icecast'ga uzatiladi.
- **CORS** sozlandi: tunnel URL `ALLOWED_ORIGINS` ga qo'shildi.

### 🤖 AI Radio Host

- **gTTS fallback qo'shildi** (`host/main.py`): Microsoft Edge TTS 403 xato berganda Google gTTS ga o'tadi.
- **`global` shahar va `/live_ru` mount** ga moslandi.
- AI matn (Gemini) → ovoz (gTTS) → `/radio/enqueue` orqali efirga.

### 🔊 Ovozli xabarlar (chat)

- **MP3 konvertatsiya** (`routers/chat.py`): har qanday yuklangan ovoz (`webm/ogg/m4a`) avtomatik MP3 ga o'giriladi (`_convert_to_mp3` + FFmpeg). Sabab: Telegram WebView (ayniqsa iOS) `webm` audio'ni ijro eta olmaydi.
- **Relative URL**: voice URL'lar `http://localhost:8001/...` o'rniga `/chat/voice/...` (same-origin) — tunnel orqali ishlaydi, URL o'zgarsa buzilmaydi.
- **To'g'ri Content-Type**: fayl kengaytmasiga qarab `audio/mpeg`, `audio/ogg` h.k. qaytariladi.
- **Frontend ovoz pleyeri** (`ChatMessage.tsx`): play/pause holati, xato bo'lganda qizil "!" va yuklab olish havolasi.
- **Yozish formati** (`ChatInput.tsx`): brauzer qo'llab-quvvatlaydigan eng mos format tanlanadi (mp4 → mpeg → ogg → webm).

### 🌐 Frontend / Mini App

- **Same-origin API** (`frontend/.env`): `VITE_API_URL` bo'sh qoldirildi — backend frontend'ni o'zi serve qiladi, shuning uchun nisbiy URL ishlatiladi (tunnel domeni avtomatik to'g'ri bo'ladi).
- **`getRadioStatus` haqiqiy API ga ulandi** (`lib/api.ts`): avval stub edi (`use_icecast: false` qaytarardi) — endi `/radio/status` dan oladi, fallback bilan.
- Frontend build `frontend/dist` ga, backend `MINIAPP_DIR=frontend/dist` ni serve qiladi.

### ⚙️ Infratuzilma va tuzatishlar

- **Redis o'rnatildi** va ulandi.
- **PostgreSQL auth** tuzatildi (`postgres` user paroli o'rnatildi).
- **DNS muammosi** hal qilindi (`8.8.8.8` — tunnel va TTS uchun).
- **Cloudflare Tunnel** binary o'rnatildi (`bin/cloudflared`).

### 🧹 Loyiha tozalandi

- O'chirildi: `RAILWAY_DEPLOY.md`, `railway.toml`, `render.yaml`, `render.env`, `run-all.sh`, `start-backend.sh`, `convert_old_voices.sh`, root `backend.log`.
- `requirements.txt` (root) tozalandi — tizim pip-freeze o'rniga loyihaning haqiqiy bog'liqliklari.
- `start.sh` / `stop.sh` qayta yozildi — hozirgi konfiguratsiyaga mos.
- Utility skriptlar `scripts/` papkasiga ko'chirildi.
- `.gitignore` yangilandi.
- To'liq `README.md` yozildi.

---

## Ma'lum muammolar / keyingi qadamlar

- **Edge TTS 403**: Microsoft API ba'zan bloklaydi → hozir gTTS fallback ishlatiladi.
- **Tunnel URL o'zgaruvchan**: bepul `trycloudflare.com` har restart'da URL o'zgartiradi. Doimiy yechim — to'liq Cloudflare account yoki VPS.
- **Token rol yangilanishi**: foydalanuvchi roli o'zgarganda, yangi JWT olish uchun Mini App qayta ochilishi kerak.
