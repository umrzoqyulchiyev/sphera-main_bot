# 🎙 INTRA GROUP — AI Radio Platform

> Telegram Mini App formatidagi interaktiv AI radio platformasi. Foydalanuvchilar jonli efir tinglaydi, real vaqtda chat qiladi, ovozli xabar yuboradi va mikrofon bilan efirga chiqadi.

---

## 📋 Mundarija

- [Loyiha haqida](#-loyiha-haqida)
- [Arxitektura](#-arxitektura)
- [Texnologiyalar](#-texnologiyalar)
- [Loyiha strukturasi](#-loyiha-strukturasi)
- [Ishga tushirish](#-ishga-tushirish)
- [Xizmatlar va portlar](#-xizmatlar-va-portlar)
- [API endpointlar](#-api-endpointlar)
- [Muhit o'zgaruvchilari](#-muhit-ozgaruvchilari)
- [Rol tizimi](#-rol-tizimi)
- [Funksionallik](#-funksionallik)

---

## 🚀 Loyiha haqida

INTRA GROUP — bu Telegram Mini App sifatida ishlaydigan jonli radio platformasi. Asosiy g'oya:

- **AI Radio Host**: Google Gemini AI efir matni yozadi → gTTS/Edge TTS ovozga aylantiradi → FFmpeg orqali Icecast serveriga uzatadi
- **Jonli efir**: Ruxsatli foydalanuvchilar mikrofon bilan WebSocket orqali to'g'ridan-to'g'ri efirga chiqadi
- **Real-time chat**: Barcha tinglovchilar WebSocket orqali jonli chat qiladi
- **Gamifikatsiya**: Xabar yuborish uchun point sarflanadi, faol foydalanuvchilar reyting yig'adi

---

## 🏗 Arxitektura

```
Telegram Bot (python-telegram-bot)
        ↓ /start → Mini App URL
Cloudflare Tunnel (HTTPS)
        ↓
FastAPI Backend (port 8001)
    ├── REST API          → Auth, Users, Chat, Radio, News, Messages
    ├── WebSocket         → /chat/ws  (real-time chat)
    ├── WebSocket         → /radio/{city}/broadcast/ws  (jonli efir)
    ├── Radio Proxy       → /radio/live/{lang}  → Icecast
    ├── Static Files      → frontend/dist  (React SPA)
    └── Continuous Worker → /live_ru, /live_lt, /live_en  (uzluksiz oqim)
        ↓
Icecast2 Server (port 8000)
    ├── /live_ru    → RU efir
    ├── /live_lt    → LT efir
    └── /live_en    → EN efir
        ↓
React Frontend (Telegram Mini App)
    ├── EfirScreen    → Radio pleyer + chat + GO LIVE tugmasi
    ├── AudioPlayer   → Icecast stream (/radio/live/ru via proxy)
    └── ChatMessages  → Ovozli va matnli xabarlar
```

---

## 🛠 Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| **Backend** | Python 3.12, FastAPI 0.111, asyncpg, pydantic-settings |
| **Database** | PostgreSQL 16 |
| **Cache/Pub-Sub** | Redis 7 |
| **Streaming** | Icecast2, FFmpeg |
| **AI** | Google Gemini 2.5 Flash |
| **TTS** | Microsoft Edge TTS (fallback: gTTS) |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **Bot** | python-telegram-bot 22 |
| **Tunnel** | Cloudflare Tunnel (cloudflared) |

---

## 📁 Loyiha strukturasi

```
sphera-main/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   └── routers/        # REST va WebSocket endpointlar
│   │   │       ├── auth.py         # Telegram auth, JWT token
│   │   │       ├── users.py        # Profil, points, level
│   │   │       ├── chat.py         # Chat (matn + ovoz), WebSocket
│   │   │       ├── radio.py        # Efir proxy, broadcast WS, enqueue
│   │   │       ├── messages.py     # Studiyaga xabar
│   │   │       ├── news.py         # Yangiliklar (til bo'yicha)
│   │   │       └── admin.py        # Admin panel
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic Settings (barcha env)
│   │   │   ├── models.py           # Pydantic sxemalar
│   │   │   ├── database.py         # asyncpg pool
│   │   │   ├── redis.py            # Redis client
│   │   │   ├── dependencies.py     # JWT dependency, rol tekshirish
│   │   │   ├── ws_manager.py       # WebSocket manager (city-based rooms)
│   │   │   ├── state.py            # Radio holat (in-memory)
│   │   │   ├── constants.py        # Rol darajalari, cost modeli
│   │   │   ├── middleware.py       # HTTP so'rov logging
│   │   │   └── internal_auth.py    # Service-to-service auth
│   │   ├── services/
│   │   │   ├── broadcast.py        # Mikrofon → FFmpeg → Icecast sessiya
│   │   │   ├── continuous.py       # Uzluksiz oqim worker (ru/lt/en)
│   │   │   ├── points.py           # Point sarflash logikasi
│   │   │   ├── aggregator.py       # Xabarlarni AI uchun to'plash
│   │   │   ├── assistant.py        # AI assistant
│   │   │   ├── gemini.py           # Google Gemini integratsiya
│   │   │   ├── membership.py       # A'zolik tekshiruv
│   │   │   ├── psychotype.py       # Psixologik profil (AI)
│   │   │   ├── tts.py              # TTS abstraktsiya
│   │   │   └── whisper_stt.py      # Ovozni matnga aylantirish
│   │   ├── host/
│   │   │   └── main.py             # AI Radio Host (Gemini → TTS → Icecast)
│   │   ├── db/
│   │   │   └── schema.sql          # PostgreSQL sxema
│   │   └── main.py                 # FastAPI app, lifespan, router mounting
│   ├── tests/                  # Pytest testlar
│   ├── requirements.txt        # Python bog'liqliklar
│   ├── Dockerfile              # Backend Docker image
│   └── alembic/                # DB migratsiyalar
│
├── frontend/                   # React + TypeScript SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── radio/          # Asosiy radio ekranlari
│   │   │   │   ├── EfirScreen.tsx      # Asosiy ekran (pleyer + chat + GO LIVE)
│   │   │   │   ├── AudioPlayer.tsx     # Radio pleyer UI
│   │   │   │   ├── GoLiveButton.tsx    # Mikrofon bilan efirga chiqish
│   │   │   │   ├── ChatMessage.tsx     # Chat xabar (matn + ovoz player)
│   │   │   │   ├── ChatMessages.tsx    # Xabarlar ro'yxati
│   │   │   │   ├── ChatInput.tsx       # Xabar yuborish (matn + ovoz yozish)
│   │   │   │   ├── Chat.tsx            # Chat konteyneri
│   │   │   │   └── Visualizer.tsx      # Waveform animatsiya
│   │   │   ├── admin/          # Admin panel
│   │   │   ├── layout/         # Navigatsiya, layout
│   │   │   ├── profile/        # Foydalanuvchi profili
│   │   │   └── ui/             # Umumiy UI (Toast, Modal)
│   │   ├── hooks/
│   │   │   ├── useAudioPlayer.ts   # Icecast stream / playlist player
│   │   │   ├── useWebSocket.ts     # Chat WebSocket
│   │   │   └── useTranslation.ts   # i18n
│   │   ├── lib/
│   │   │   ├── api.ts          # Barcha backend API chaqiruvlar
│   │   │   ├── auth.ts         # JWT token storage
│   │   │   └── config.ts       # API_URL, WS_URL, konstrantlar
│   │   ├── locales/            # RU/EN/LT tarjimalar
│   │   ├── pages/              # Sahifalar (Efir, Profil, Admin)
│   │   └── types/              # TypeScript type'lar
│   ├── dist/                   # Build natijasi (backend tomonidan serve qilinadi)
│   ├── .env                    # Vite env (VITE_WS_URL va h.k.)
│   └── vite.config.ts          # Vite config (proxy, build sozlamalari)
│
├── bot/
│   ├── bot.py                  # Telegram bot (python-telegram-bot)
│   └── Dockerfile              # Bot Docker image
│
├── infra/
│   ├── icecast/
│   │   ├── icecast.xml         # Icecast2 production konfiguratsiya
│   │   └── icecast.local.xml   # Lokal dev konfiguratsiya
│   └── scripts/
│       ├── run-dev.sh          # Lokal dev muhitni ishga tushirish
│       └── stop-dev.sh         # Dev muhitni to'xtatish
│
├── bin/
│   └── cloudflared             # Cloudflare Tunnel binary
│
├── .env                        # Asosiy muhit o'zgaruvchilari (git'da yo'q)
├── .env.example                # .env namunasi (git'da bor)
├── docker-compose.yml          # Docker Compose (postgres, redis, icecast, backend, bot)
├── Makefile                    # Qulay buyruqlar (dev, build, test, logs)
├── start_backend.sh            # Lokal backend ishga tushirish skripti
└── test_icecast.sh             # Icecast efir test signali
```

---

## ⚡ Ishga tushirish

### Talablar

- Python 3.12+
- Node.js 18+
- PostgreSQL 16
- Redis 7
- Icecast2
- FFmpeg
- Cloudflare Tunnel (`bin/cloudflared`)

### 1. O'rnatish

```bash
# Repo clone
git clone <repo-url>
cd sphera-main

# .env yaratish
cp .env.example .env
# .env faylni tahrirlash (BOT_TOKEN, GEMINI_KEY, parollar)

# Python venv
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/pip install gTTS python-telegram-bot

# Frontend
cd frontend && npm install && npm run build && cd ..
```

### 2. Database

```bash
# PostgreSQL'da baza yaratish
sudo -u postgres psql -c "CREATE DATABASE radio_db;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -d radio_db -f backend/app/db/schema.sql
```

### 3. Icecast2

```bash
# O'rnatish (Ubuntu/Debian)
sudo apt install icecast2

# Konfiguratsiya tekshirish
sudo cat /etc/icecast2/icecast.xml
# source-password va admin-password ni .env ga yozing
```

### 4. Barcha xizmatlarni ishga tushirish

```bash
# Terminal 1 — Backend (Icecast worker + Radio proxy)
bash start_backend.sh

# Terminal 2 — Telegram Bot
bash -c 'set -a && source .env && set +a && .venv/bin/python bot/bot.py'

# Terminal 3 — HTTPS Tunnel
bin/cloudflared tunnel --url http://localhost:8001 --no-autoupdate
# → Tunnel URL olganidan keyin .env da MINI_APP_URL ni yangilang
# → Frontend'ni qayta build qiling: cd frontend && npm run build

# Terminal 4 (ixtiyoriy) — AI Radio Host
AI_AUTO_BROADCAST=true SEGMENT_INTERVAL=120 \
  bash -c 'set -a && source .env && set +a && .venv/bin/python backend/app/host/main.py'
```

### 5. Tunnel URL yangilash

Har safar tunnel yangi URL olgandan keyin:

```bash
# .env va frontend/.env ni yangilang
NEW_URL="https://your-new-tunnel.trycloudflare.com"
sed -i "s|MINI_APP_URL=.*|MINI_APP_URL=$NEW_URL|" .env
sed -i "s|VITE_WS_URL=.*|VITE_WS_URL=wss://$(echo $NEW_URL | sed 's|https://||')|" frontend/.env

# Frontend qayta build
cd frontend && npm run build && cd ..

# Bot qayta ishga tushirish (yangi MINI_APP_URL bilan)
```

---

## 🔌 Xizmatlar va portlar

| Xizmat | Port | Manzil |
|--------|------|--------|
| FastAPI Backend | 8001 | `http://localhost:8001` |
| API Docs (dev) | 8001 | `http://localhost:8001/docs` |
| Icecast2 | 8000 | `http://localhost:8000` |
| Icecast Admin | 8000 | `http://localhost:8000/admin/` |
| PostgreSQL | 5432 | `localhost:5432/radio_db` |
| Redis | 6379 | `redis://localhost:6379/0` |
| Cloudflare Tunnel | — | `https://*.trycloudflare.com` |

### Icecast Mountlar

| Mount | Til | URL |
|-------|-----|-----|
| `/live_ru` | Rus | `http://localhost:8000/live_ru` |
| `/live_lt` | Litva | `http://localhost:8000/live_lt` |
| `/live_en` | Ingliz | `http://localhost:8000/live_en` |

---

## 📡 API endpointlar

### Auth
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| POST | `/auth/telegram` | Telegram ID bilan login/ro'yxat |
| POST | `/auth/select-language` | Til tanlash |

### Users
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/users/me` | Profil ma'lumotlari |
| PUT | `/users/me` | Profilni yangilash |
| GET | `/users/me/points` | Point balansi |
| POST | `/users/me/points/transfer` | Point yuborish |

### Chat
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/chat/history` | Oxirgi 50 xabar |
| POST | `/chat/send` | Matnli xabar (0.001 pt) |
| POST | `/chat/voice` | Ovozli xabar → MP3 konvert (0.005 pt) |
| GET | `/chat/voice/{filename}` | Ovoz faylini yuklab olish |
| WS | `/chat/ws?token=...` | Real-time chat WebSocket |

### Radio
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/radio/live/{lang}` | Icecast oqim proxy (ru/lt/en) |
| GET | `/radio/status?city=...` | Efir holati |
| POST | `/radio/enqueue` | AI audio navbatga qo'shish (internal) |
| POST | `/radio/broadcast/clear` | Qolgan sessiyani tozalash |
| WS | `/radio/{city}/broadcast/ws?token=...` | Mikrofon → Icecast WebSocket |

### Health
| Method | Endpoint | Tavsif |
|--------|----------|--------|
| GET | `/health` | `{"status": "ok"}` |
| GET | `/health/ready` | DB + Redis holati |

---

## 🔧 Muhit o'zgaruvchilari

`.env.example` fayldan nusxa oling:

```bash
cp .env.example .env
```

Asosiy o'zgaruvchilar:

| O'zgaruvchi | Tavsif | Misol |
|-------------|--------|-------|
| `BOT_TOKEN` | Telegram bot token (@BotFather) | `123456:ABC...` |
| `ADMIN_IDS` | Admin Telegram ID'lari | `7993413019` |
| `GEMINI_KEY` | Google AI Studio API key | `AIza...` |
| `MINI_APP_URL` | Mini App HTTPS URL (tunnel) | `https://abc.trycloudflare.com` |
| `DB_PASS` | PostgreSQL paroli | `postgres` |
| `SECRET_KEY` | JWT imzolash kaliti (≥32 belgi) | `randomsecret32chars` |
| `USE_ICECAST` | Icecast yoqish/o'chirish | `true` |
| `ICECAST_PASS` | Icecast source paroli | `IcecastPass2025!` |
| `AI_AUTO_BROADCAST` | AI host avtomatik efir | `true` |

---

## 👥 Rol tizimi

| Rol | Daraja | Imkoniyatlar |
|-----|--------|--------------|
| `listener` | 1 | Radio tinglash, chat ko'rish |
| `aktivniy` | 2 | Chat yozish, studiyaga xabar, ovoz yuborish |
| `doverenniy` | 3 | Mikrofon bilan jonli efirga chiqish |
| `admin` | 99 | Hamma huquqlar + admin panel |

Rol o'zgartirish (admin tomonidan, DB orqali):
```sql
UPDATE users SET role='doverenniy' WHERE telegram_id = 123456789;
```

---

## 🎯 Funksionallik

### ✅ Amalga oshirilgan

- [x] Telegram Mini App orqali kirish (Telegram auth, JWT)
- [x] Jonli radio efiri — Icecast2 + FFmpeg
- [x] 3 til oqimi: RU, LT, EN (`/live_ru`, `/live_lt`, `/live_en`)
- [x] Uzluksiz oqim (continuous worker — mount uzilmaydi)
- [x] Backend proxy `/radio/live/{lang}` — tunnel orqali ham ishlaydi
- [x] AI Radio Host (Gemini AI + gTTS/Edge TTS)
- [x] Real-time chat (WebSocket)
- [x] Ovozli xabarlar → MP3 konvert (FFmpeg, barcha platformalarda ishlaydi)
- [x] Mikrofon bilan jonli efirga chiqish (WebSocket → FFmpeg → Icecast)
- [x] Point tizimi (xabar sarflaydi, transfer, level)
- [x] Ko'p tilli interfeys (RU/EN/LT)
- [x] Admin panel
- [x] Cloudflare Tunnel (lokal serverda HTTPS)
- [x] Docker Compose konfiguratsiya

### 🔄 Keyingi bosqich

- [ ] Edge TTS muammosi hal qilish (Microsoft API 403)
- [ ] Doimiy Cloudflare tunnel (to'liq account)
- [ ] Production deployment (VPS/Railway)
- [ ] Push notifications

---

## 🐳 Docker bilan ishga tushirish

```bash
cp .env.example .env
# .env ni tahrirlash

docker compose up -d

# Loglar
docker compose logs -f backend
```

---

## 🧪 Testlar

```bash
cd backend
../.venv/bin/pytest tests/ -v
```

---

## 📝 Eslatmalar

**Tunnel URL** har restart bo'lganda o'zgaradi (bepul trycloudflare.com). O'zgarganda:
1. `.env` da `MINI_APP_URL` ni yangilang
2. `frontend/.env` da `VITE_WS_URL` ni yangilang  
3. `cd frontend && npm run build` qiling
4. Botni qayta ishga tushiring

**Broadcast sessiyasi qolsa:**
```bash
curl -X POST "http://localhost:8001/radio/broadcast/clear?city=global"
```

**Icecast mount tekshirish:**
```bash
curl -u "admin:IcecastAdmin2025!" http://localhost:8000/admin/listmounts
```
