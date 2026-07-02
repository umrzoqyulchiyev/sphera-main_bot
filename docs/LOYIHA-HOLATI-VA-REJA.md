# 🎯 INTRA GROUP LOYIHA — TO'LIQ HOLAT VA REJA

> **Oxirgi yangilanish**: 2026-01-01  
> **Kiro sessiya**: Context transfer uchun to'liq ma'lumot  
> **Boshliq talablari**: 100% aniq bajarilishi shart

---

## 📌 LOYIHA QISQACHA

**INTRA GROUP** — Telegram Mini App orqali ishlaydigan jonli radio platforma:
- **AI Radio Host** — Google Gemini AI efir matni yozadi + TTS → Icecast2 orqali jonli efir
- **Tinglovchilar** — Mini App'da radio tinglaydi, chat qiladi, ovozli xabar yuboradi
- **Point tizimi** — Xabar yuborish uchun point sarflanadi (0.001 text, 0.005 voice)
- **Level tizimi** — 1=Tinglovchi, 2=Faol, 3=Ведущий (mikrofon)
- **3 til** — Rus, Ingliz, Litva (alohida yangiliklar, alohida efir oqimi)

---

## 🏗 TEXNIK STACK

### Backend
- **Python 3.12** + **FastAPI 0.111**
- **PostgreSQL 16** — foydalanuvchilar, chat, tranzaksiyalar
- **Redis 7** — cache, pub/sub
- **Icecast2** — radio stream server (3 mount: /live_ru, /live_lt, /live_en)
- **FFmpeg** — audio konvertatsiya, stream
- **Google Gemini 2.5 Flash** — AI dialog yaratish
- **Edge TTS / gTTS** — Text-to-Speech
- **faster-whisper** — Speech-to-Text (ovozli xabarlar uchun)

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **TailwindCSS** — styling
- **Telegram Mini App SDK** — auth, launch params
- **WebSocket** — real-time chat
- **Audio API** — Icecast stream player

### Infra
- **Cloudflare Tunnel** — lokal HTTPS (dev)
- **Docker Compose** — production
- **python-telegram-bot 22** — Telegram bot

---

## 📁 LOYIHA STRUKTURASI

```
sphera-main/
├── backend/
│   ├── app/
│   │   ├── api/routers/          # API endpointlar
│   │   │   ├── auth.py           # Telegram auth → JWT
│   │   │   ├── users.py          # Profil, points, level
│   │   │   ├── chat.py           # Chat (matn+ovoz), WebSocket
│   │   │   ├── radio.py          # Efir proxy, broadcast WS
│   │   │   ├── news.py           # Yangiliklar (til bo'yicha)
│   │   │   ├── messages.py       # Studiyaga xabar
│   │   │   ├── admin.py          # Admin panel
│   │   │   ├── opinions.py       # Mavzu bo'yicha fikrlar
│   │   │   ├── voicechat.py      # Telegram Voice Chat API
│   │   │   ├── stats.py          # Statistika
│   │   │   └── favorites.py      # Sevimli musiqa
│   │   ├── core/
│   │   │   ├── config.py         # Barcha .env settings
│   │   │   ├── database.py       # asyncpg pool
│   │   │   ├── redis.py          # Redis client
│   │   │   ├── dependencies.py   # JWT, rol check
│   │   │   ├── ws_manager.py     # WebSocket manager
│   │   │   ├── state.py          # Radio holat (in-memory)
│   │   │   └── constants.py      # Rol, cost modeli
│   │   ├── services/
│   │   │   ├── continuous.py     # Uzluksiz oqim (Icecast har tilga)
│   │   │   ├── broadcast.py      # Mikrofon → FFmpeg → Icecast
│   │   │   ├── ai_host.py        # AI Radio Host worker
│   │   │   ├── gemini.py         # Gemini integratsiya
│   │   │   ├── tts.py            # TTS abstraktsiya
│   │   │   ├── whisper_stt.py    # STT (ovoz → matn)
│   │   │   ├── points.py         # Point sarflash
│   │   │   └── voicechat.py      # Telegram Voice Chat bridge (pytgcalls)
│   │   ├── db/
│   │   │   └── schema.sql        # PostgreSQL schema
│   │   └── main.py               # FastAPI app, lifespan
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── radio/            # Radio ekranlari
│   │   │   │   ├── EfirScreen.tsx       # Asosiy ekran (pleyer + chat)
│   │   │   │   ├── AudioPlayer.tsx      # Radio pleyer
│   │   │   │   ├── GoLiveButton.tsx     # Mikrofon → efir
│   │   │   │   ├── ChatMessages.tsx     # Chat ro'yxati
│   │   │   │   └── ChatInput.tsx        # Xabar yuborish
│   │   │   ├── admin/            # Admin panel
│   │   │   ├── profile/          # Profil
│   │   │   ├── layout/           # TopBar, BottomNav
│   │   │   └── ui/               # Modal, Toast
│   │   ├── pages/
│   │   │   ├── Welcome.tsx       # Til tanlash + yangilik
│   │   │   ├── Radio.tsx         # Asosiy sahifa
│   │   │   └── Admin.tsx         # Admin panel
│   │   ├── hooks/
│   │   │   ├── useAudioPlayer.ts # Icecast player
│   │   │   ├── useWebSocket.ts   # Chat WS
│   │   │   └── useTranslation.ts # i18n
│   │   ├── lib/
│   │   │   ├── api.ts            # Backend API
│   │   │   ├── auth.ts           # JWT storage
│   │   │   └── config.ts         # API_URL, WS_URL
│   │   └── locales/              # ru/en/lt tarjimalar
│   ├── dist/                     # Build (backend serve qiladi)
│   └── vite.config.ts
│
├── bot/
│   └── bot.py                    # Telegram bot
│
├── .env                          # Muhit o'zgaruvchilari (git'da yo'q!)
├── .env.example                  # .env namunasi
├── docker-compose.yml
├── Makefile
├── start_backend.sh              # Backend ishga tushirish
└── README.md                     # To'liq qo'llanma
```

---

## ✅ HOZIRDA TAYYOR

### Backend (85% tayyor)
- ✅ **Auth** — Telegram ID → JWT token
- ✅ **Foydalanuvchi modeli** — ID, username, display_name, level (1-3), role, points (kasr)
- ✅ **Point tizimi** — transfer, request, sarflash (0.001 text, 0.005 voice)
- ✅ **Chat** — matn + ovozli xabar, WebSocket, FFmpeg konvert (mp3)
- ✅ **Radio stream** — Icecast2 (3 mount: ru/lt/en)
- ✅ **Uzluksiz oqim** — continuous worker (har til uchun alohida)
- ✅ **Radio proxy** — `/radio/live/{lang}` (Icecast → backend → tunnel)
- ✅ **Mikrofon → efir** — WebSocket `/radio/{city}/broadcast/ws` (level 3)
- ✅ **AI** — Google Gemini integratsiya
- ✅ **TTS** — Edge TTS, gTTS fallback
- ✅ **STT** — faster-whisper (ovozli xabar → matn)
- ✅ **Yangiliklar** — `/news?lang=ru` (til bo'yicha)
- ✅ **Admin panel** — foydalanuvchilar, mavzular, AI dialog yaratish, moderatsiya
- ✅ **Opinions** — mavzu bo'yicha fikr yuborish
- ✅ **Aggregator** — fikrlarni tahlil qilib 3 pozitsiya ajratish
- ✅ **AI Dialog** — 2 personaj dialogi (8-15 daqiqa)
- ✅ **Draft moderatsiya** — admin tasdiqlaydi/rad etadi
- ✅ **Cloudflare Tunnel** — HTTPS (dev)

### Frontend (75% tayyor)
- ✅ **Til tanlash** — Welcome screen (EN → LT → RU tartib)
- ✅ **Yangiliklar** — podcast stili (til bo'yicha)
- ✅ **Radio sahifasi** — pleyer + chat + mikrofon
- ✅ **Audio player** — Icecast stream, play/pause, waveform
- ✅ **Chat** — matn + ovoz yuborish, ovoz ijro etish
- ✅ **WebSocket** — real-time chat
- ✅ **Profil** — display_name tahrirlash, balans, level, ID, til
- ✅ **Point transfer/request** — ID bo'yicha yuborish/so'rash
- ✅ **Admin panel** — mavzular, dialog yaratish, moderatsiya
- ✅ **Responsive** — mobile-first (390-520px)
- ✅ **Dark glassmorphism UI** — Stitch design (cyan/purple gradient)
- ✅ **3 til UI** — ru/en/lt tarjimalar

---

## ❌ QOLGAN ISHLAR (Boshliq talablari)

### 1. **WELCOME SCREEN — Til tanlash + Yangilik**

**Boshliq talabi:**
> Birinchi start bosib kirganda botga til tanlanishi kerak (EN → LT → RU). Til tanlab bo'lgandan keyin o'sha davlat haqida yangilik chiqadi (podcast, reklama). Yangiliklarni bosgandan keyin asosiy sahifaga kiradi (INTRA GROUP).

**Hozirgi holat:**
- ✅ Welcome.tsx mavjud
- ✅ Til tanlash (EN/LT/RU) — tartib to'g'ri
- ✅ Yangilik (podcast stili) — til bo'yicha
- ⚠️ **MUAMMO**: `/news` endpoint yangiliklar qaytarmayabdi (DB bo'sh)

**Bajarilishi kerak:**
1. `backend/app/db/schema.sql` da `news` jadvalini to'ldirish:
   ```sql
   INSERT INTO news (title, body, language) VALUES
   ('UK Tech Innovation', 'Latest developments in AI...', 'en'),
   ('Lietuvos technologijos', 'Naujienos apie AI...', 'lt'),
   ('Российские технологии', 'Новости об ИИ...', 'ru');
   ```
2. Yoki admin panel orqali yangilik qo'shish API yaratish

---

### 2. **PROFIL — Level va ID ko'rinishi**

**Boshliq talabi:**
> Ong tomonda tillar bo'limi o'rniga:
> 1. **Уровень** — 1 слушатель, 2 слушатель, 3 слушатель и ведущий
> 2. **Язык** — tanlangan til
> 3. **ID** — foydalanuvchi ID raqami
> 
> Profil qismida: ID → username → display_name (tahrirlanadi).  
> Mini App'ga kirganda dumaloq radio belgisi tebranib turishi kerak (gradient, Jarvis stili).

**Hozirgi holat:**
- ✅ Profil komponent mavjud
- ✅ Level, til, ID backend'da bor
- ⚠️ **MUAMMO**: UI'da level matnli ko'rinmayabdi ("Слушатель", "Активный", "Ведущий")
- ⚠️ **MUAMMO**: Animatsion radio orb yo'q

**Bajarilishi kerak:**
1. `ProfileScreen.tsx` da level matnini ko'rsatish:
   ```typescript
   const levelLabels = { 1: tx('lvl1'), 2: tx('lvl2'), 3: tx('lvl3') };
   // lvl1: "Слушатель", lvl2: "Активный", lvl3: "Ведущий"
   ```
2. Asosiy sahifada animatsion orb (CSS animation, gradient pulse):
   ```css
   @keyframes pulse {
     0%, 100% { box-shadow: 0 0 20px rgba(56,225,255,0.5); }
     50% { box-shadow: 0 0 40px rgba(56,225,255,0.8); }
   }
   ```

---

### 3. **POINT TIZIMI — Sotib olish (real to'lov)**

**Boshliq talabi:**
> Point sotib olish — real pul uchun. Narx: 5 euro = X point.  
> Profil → "Sotib olish" tugmasi → to'lov (Click/Payme/Telegram Payment).

**Hozirgi holat:**
- ⚠️ **Yo'q** — faqat transfer/request mavjud

**Bajarilishi kerak:**
1. Backend: `/users/me/points/purchase` endpoint
2. Telegram Payment integratsiyasi:
   ```python
   from telegram import LabeledPrice
   await context.bot.send_invoice(
       chat_id=user_id,
       title="100 Points",
       description="Buy 100 points for 5 EUR",
       payload="points_100",
       provider_token=PAYMENT_PROVIDER_TOKEN,
       currency="EUR",
       prices=[LabeledPrice("100 Points", 500)]  # 5.00 EUR
   )
   ```
3. Frontend: `BuyPointsModal.tsx` komponent

---

### 4. **EFIR HOLATI — Icecast + AI aralashishi**

**Boshliq talabi:**
> Jonli efir qilishi kerak. AI aralashishi kerak. Icecast ishlashi kerak.  
> Backend'da hamma narsa tayyor bo'lishi kerak. Bot vazifani bajarib berishi kerak.

**Hozirgi holat:**
- ✅ Icecast2 o'rnatilgan (`localhost:8000`, 3 mount)
- ✅ Uzluksiz oqim (continuous worker) — har til uchun
- ✅ AI Radio Host (Gemini → TTS → Icecast) — `/backend/app/services/ai_host.py`
- ⚠️ **MUAMMO**: AI host avtomatik ishlamayabdi (`.env` da `AI_AUTO_BROADCAST=false`?)

**Bajarilishi kerak:**
1. `.env` da `AI_AUTO_BROADCAST=true` qo'yish
2. AI host'ni ishga tushirish:
   ```bash
   AI_AUTO_BROADCAST=true SEGMENT_INTERVAL=120 \
     bash -c 'set -a && source .env && set +a && .venv/bin/python backend/app/services/ai_host.py'
   ```
3. Test qilish:
   ```bash
   curl http://localhost:8000/live_ru  # oqim bor/yo'qligini tekshirish
   ```

---

### 5. **TELEGRAM VOICE CHAT — Bot efirni guruhga translirovat qilishi**

**Boshliq talabi:**
> Telegram guruh Voice Chat'da bot Icecast oqimini uzatishi kerak.  
> Hamma tinglovchilar guruhda radio eshitishi kerak.

**Hozirgi holat:**
- ⚠️ **Qisman tayyor** — `voicechat.py` service mavjud lekin to'liq ishlamaydi
- ⚠️ **Muammo**: `pytgcalls` + `pyrogram` userbot kerak (bot emas!)

**Texnik talablar:**
- **pytgcalls** — Telegram Voice Chat'ga programmatik ulanganda ishlatiladigan kutubxona
- **Userbot** — haqiqiy Telegram account (bot emas!) kerak
- **API_ID + API_HASH** — https://my.telegram.org dan olish kerak
- **Session string** — userbot sessiyasi

**Bajarilishi kerak:**
1. `.env` ga qo'shish:
   ```env
   TG_API_ID=12345678
   TG_API_HASH=abcdef1234567890abcdef1234567890
   TG_SESSION_STRING=...   # Pyrogram session
   VOICE_CHAT_GROUP_ID=-1003883809940
   ```
2. Userbot sessiya yaratish:
   ```bash
   .venv/bin/python -c "
   from pyrogram import Client
   app = Client('bridge_account', api_id=TG_API_ID, api_id=TG_API_HASH)
   app.start()
   print(app.export_session_string())
   app.stop()
   "
   ```
3. `voicechat.py` service'ni to'liq amalga oshirish (hozirda stub)

**MUHIM:** Boshliq bu funksiyani so'ragan, lekin bu **userbot** talab qiladi (Telegram ToS ga zid bo'lishi mumkin agar bot sifatida ishlatilsa). Production uchun bu masala hal qilinishi kerak.

---

### 6. **FRONTEND RESPONSIVE + DIZAYN**

**Boshliq talabi:**
> Mini App'da hamma joy responsive bo'lishi kerak. Har yerda chat ishlashi kerak.  
> Chat joyi, ovoz yuborish, efir tinglash — hamma narsa qulaylik bilan ishlashi kerak.

**Hozirgi holat:**
- ✅ Asosiy sahifalar responsive (390-520px)
- ⚠️ **Muammolar**:
  - Chat xabarlar ro'yxati ba'zan scroll qilish qiyin
  - Ovozli xabar player ba'zi joylarda chiqmayabdi
  - "GO LIVE" tugmasi (mikrofon) faqat level 3 uchun ko'rinishi kerak

**Bajarilishi kerak:**
1. `ChatMessages.tsx` — scroll optimizatsiya:
   ```typescript
   useEffect(() => {
     if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
   }, [messages]);
   ```
2. `ChatMessage.tsx` — ovoz player'ni har xabar uchun alohida render qilish
3. `GoLiveButton.tsx` — faqat `user.level >= 3` bo'lsa ko'rsatish

---

### 7. **STITCH DESIGN — Glassmorphism UI**

**Boshliq talabi:**
> Google Stitch'da dizayn qildim. Shu dizayn bo'yicha frontend yasalishi kerak.  
> INTRA GROUP — uch rangli logo (oq, cyan, purple). Dark futuristik.

**Stitch design talablari:**
- **Rang palitrasi**:
  - Fon: `#060a14` (dark navy)
  - Asosiy: `#38e1ff` (cyan)
  - Ikkinchi: `#7c5cff` (purple)
  - Matn: `#dbe9ff`, `#bbc9cd` (light grey)
- **Glassmorphism**:
  ```css
  .glass {
    background: rgba(19,24,36,0.6);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(56,225,255,0.2);
  }
  ```
- **Logo gradient**:
  ```css
  .logo-gradient {
    background: linear-gradient(90deg, #fff 0%, #38e1ff 50%, #7c5cff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  ```

**Hozirgi holat:**
- ✅ TailwindCSS konfiguratsiyada glassmorphism klasslar mavjud
- ✅ Logo gradient qo'llanilgan
- ⚠️ **Muammo**: Ba'zi sahifalarda (Admin, Profile) eskichiroq stil qolgan

**Bajarilishi kerak:**
- Barcha sahifalarni Stitch design'ga moslashtirish
- `index.css` da global stil yangilash

---

## 🔥 ENG MUHIM XATOLAR (Tezda tuzatilishi kerak)

### 1. **Yangiliklar bo'sh**
- **Sabab**: `news` jadvalida ma'lumot yo'q
- **Yechim**: SQL INSERT yoki admin API

### 2. **AI host ishlamayabdi**
- **Sabab**: `AI_AUTO_BROADCAST=false` yoki service ishga tushmagan
- **Yechim**: `.env` + manual ishga tushirish

### 3. **Voice Chat bot yo'q**
- **Sabab**: pytgcalls service to'liq ishlanmagan
- **Yechim**: userbot sessiya + API keys

### 4. **Ovozli xabar ba'zan ijro bo'lmaydi**
- **Sabab**: `/uploads` path Frontend'da noto'g'ri
- **Yechim**: `api.ts` da URL to'g'rilash

### 5. **Point sotib olish yo'q**
- **Sabab**: Backend endpoint mavjud emas
- **Yechim**: `/users/me/points/purchase` + Telegram Payment

---

## 📋 KEYINGI QADAMLAR (Prioritet tartibida)

### **Yuqori prioritet** (1-3 kun)
1. ✅ Yangiliklar DB'ga qo'shish yoki API yaratish
2. ✅ AI host'ni to'liq ishga tushirish (avtomatik efir)
3. ✅ Profil UI'da level matnini ko'rsatish
4. ✅ Frontend responsive muammolarini hal qilish
5. ✅ Ovozli xabar player'ni tuzatish

### **O'rta prioritet** (1 hafta)
6. ⚠️ Point sotib olish — Telegram Payment integratsiya
7. ⚠️ Voice Chat bot — pytgcalls to'liq amalga oshirish
8. ⚠️ Animatsion radio orb (gradient pulse)
9. ⚠️ Admin panel — barcha sahifalarni Stitch design'ga moslashtirish

### **Past prioritet** (keyingi bosqich)
10. ⚠️ Musiqa ovoz berish tizimi
11. ⚠️ Efir jadvali (ведущийlar uchun slot booking)
12. ⚠️ Kasting va ovoz berish (3-daraja ведущийlarni tanlash)
13. ⚠️ Push notification'lar
14. ⚠️ Production deployment (VPS, domen, SSL)

---

## 🚀 ISHGA TUSHIRISH (Dev muhit)

### 1. Talablar
- Python 3.12+
- Node.js 18+
- PostgreSQL 16
- Redis 7
- Icecast2
- FFmpeg

### 2. O'rnatish
```bash
# Repo
cd sphera-main

# .env
cp .env.example .env
# .env ni tahrirlash: BOT_TOKEN, GEMINI_KEY, ICECAST_PASS

# Python
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && npm run build && cd ..

# Database
sudo -u postgres psql -c "CREATE DATABASE radio_db;"
sudo -u postgres psql -d radio_db -f backend/app/db/schema.sql
```

### 3. Ishga tushirish
```bash
# Terminal 1 — Backend
bash start_backend.sh

# Terminal 2 — Bot
bash -c 'set -a && source .env && set +a && .venv/bin/python bot/bot.py'

# Terminal 3 — Tunnel
bin/cloudflared tunnel --url http://localhost:8001 --no-autoupdate
# URL olib .env ga qo'yish

# Terminal 4 (ixtiyoriy) — AI Host
AI_AUTO_BROADCAST=true .venv/bin/python backend/app/services/ai_host.py
```

### 4. Test
```bash
# Health check
curl http://localhost:8001/health

# Icecast
curl http://localhost:8000/live_ru

# Mini App
# Telegram bot'ga /start yuborish → Mini App ochiladi
```

---

## 📞 BOSHLIQ BILAN KELISHILGAN NARSALAR

### ✅ Tasdiqlanganlar
1. **3 til**: EN → LT → RU (tartib muhim!)
2. **Kasr point**: 0.001 (text), 0.005 (voice)
3. **Level tizimi**: 1 (tinglovchi), 2 (faol), 3 (ведущий)
4. **Point iqtisodiyoti**: transfer, so'rash, sotib olish
5. **AI dialog**: 3 pozitsiya → 2 personaj dialogi
6. **Glassmorphism UI**: cyan/purple, dark futuristik

### ⚠️ Ochiq savollar
1. **Voice Chat userbot** — qaysi account ishlatiladi?
2. **Point narxi** — 5 euro = necha point?
3. **To'lov tizimi** — Telegram Payment, Click, Payme?
4. **Production server** — qayerda (VPS, Railway, GCP)?

---

## 🎯 YAKUNIY MAQSAD

**MVP1** — Asosiy funksional ishlayotgan versiya:
- ✅ Til tanlash + yangilik
- ✅ Radio tinglash (Icecast)
- ✅ Chat (matn + ovoz)
- ✅ Point tizimi (transfer, so'rash)
- ✅ AI dialog yaratish
- ✅ Admin moderatsiya
- ⚠️ Point sotib olish (to'lov)
- ⚠️ Voice Chat bot (Telegram guruhda efir)

**MVP2** (keyingi bosqich):
- Efir jadvali
- Musiqa ovoz berish
- Kasting tizimi
- Push notifications
- Production deployment

---

## 📝 ESLATMALAR

1. **Tunnel URL** har restart'da o'zgaradi → `.env` + frontend rebuild
2. **Icecast** lokal ishlatilayabdi → production'da domen kerak
3. **AI host** kontent yaratish uchun `GEMINI_KEY` kerak
4. **pytgcalls** userbot talab qiladi (bot emas!)
5. **FFmpeg** ovoz konvertatsiya uchun zarur

---

## 🔗 FOYDALI LINKLAR

- **Loyiha**: `/mnt/d/KIro_projectsbot/sphera-main/`
- **README**: `README.md` — to'liq qo'llanma
- **Arxitektura**: `docs/architecture-mvp1.md` — texnik spec
- **TZ**: `docs/loyiha-tushuncha-boshliqqa.md` — Boshliq talablari
- **Frontend**: `frontend/src/`
- **Backend**: `backend/app/`
- **.env namuna**: `.env.example`

---

**✅ Bu hujjat yangi Kiro sessiyasida davom etish uchun to'liq ma'lumot.**
