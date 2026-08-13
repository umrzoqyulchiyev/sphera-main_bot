# 🚂 Railway.com ga Deploy qilish — To'liq Ko'rsatma

## Qisqa tushuntirish

Railway.com — GitHub repo'ni ulab, Docker bilan avtomatik deploy qiladigan servis.
Loyihada Dockerfile allaqachon tayyor — faqat env variable'larni sozlash kerak.

---

## 1-qadam: GitHub'ga push qilish

```bash
cd "/home/umrzoq/Telegram Desktop/sphera-main/sphera-main"

# Agar git remote yo'q bo'lsa (yangi repo):
git init
git add .
git commit -m "Initial commit — INTRA GROUP platform"

# GitHub'da yangi repo yarating (github.com → New repository)
# Keyin:
git remote add origin https://github.com/SIZNING_USERNAME/intra-group.git
git push -u origin main
```

**MUHIM:** `.gitignore` faylida quyidagilar bo'lishi SHART (secret'lar GitHub'ga tushmaydi):
```
.env
.venv/
.venv_mac/
.audio/
.uploads/
.logs/
*.mp3
node_modules/
```

---

## 2-qadam: Railway'da project ochish

1. [railway.com](https://railway.com) → **Login with GitHub**
2. **New Project** → **Deploy from GitHub repo** → `intra-group` ni tanlang
3. Railway avtomatik Dockerfile'ni topadi

---

## 3-qadam: Railway'da xizmatlar qo'shish

Railway'da bir project ichida bir nechta **Service** bo'ladi:

### Service 1: Backend + Frontend (bitta)
- **Source**: GitHub repo, root `/backend`
- **Dockerfile**: `backend/Dockerfile` (allaqachon tayyor)
- **Port**: `8001` → Railway avtomatik PUBLIC URL beradi

### Service 2: Bot
- **Source**: GitHub repo, root `/bot`  
- **Dockerfile**: `bot/Dockerfile`
- Port kerak emas (webhook/polling)

### Service 3: PostgreSQL (Railway plugin)
- **New** → **Database** → **Add PostgreSQL**
- Railway avtomatik `DATABASE_URL` variable beradi

### Service 4: Redis (Railway plugin)
- **New** → **Database** → **Add Redis**
- Railway avtomatik `REDIS_URL` variable beradi

---

## 4-qadam: Environment Variables sozlash

Backend Service → **Variables** tab → quyidagilarni qo'shing:

```
# === MAJBURIY ===
BOT_TOKEN=7993413019:AAG...          # @BotFather dan
ADMIN_IDS=7993413019                 # Sizning Telegram ID
SECRET_KEY=random_32_chars_minimum_here_change_this

# === DATABASE (Railway PostgreSQL dan avtomatik keladi) ===
DATABASE_URL=${{Postgres.DATABASE_URL}}   # Railway template syntax
# Yoki alohida:
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USER=${{Postgres.PGUSER}}
DB_PASS=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}

# === REDIS (Railway Redis dan avtomatik) ===
REDIS_URL=${{Redis.REDIS_URL}}

# === MINI APP ===
MINI_APP_URL=https://SIZNING-RAILWAY-URL.up.railway.app
MINIAPP_DIR=/app/static

# === STORAGE ===
AUDIO_DIR=/tmp/sphera_audio
UPLOAD_DIR=/tmp/sphera_uploads

# === AI ===
GEMINI_KEY=AIza...                   # aistudio.google.com

# === RADIO ===
USE_ICECAST=true
ICECAST_PASS=SecretIcecastPass2025

# === TO'LOV ===
PAYMENT_CURRENCY=XTR                 # Telegram Stars
PAYMENT_PROVIDER_TOKEN=              # Stars uchun bo'sh qoldiring

# === DEBUG ===
DEBUG=false
DISABLE_GROUP_CHECK=true
```

Bot Service → **Variables** tab:
```
BOT_TOKEN=...                        # Backend bilan bir xil
MINI_APP_URL=https://...             # Backend Railway URL
INTERNAL_API_URL=https://...         # Backend Railway URL
ADMIN_IDS=...
PAYMENT_CURRENCY=XTR
```

---

## 5-qadam: Frontend build qo'shish

Frontend React SPA'ni backend ichida serve qilish uchun Dockerfile'ga build qo'shilgan.
Lekin avval lokal build qilish kerak va `backend/static/` ga nusxa olish:

```bash
# Lokal:
cd frontend
VITE_API_URL= VITE_WS_URL= VITE_RADIO_URL= npm run build

# Build natijasini backend/static/ ga ko'chirish:
cp -r dist/* ../backend/static/
```

Yoki `backend/Dockerfile`'ni frontend build bilan yangilash (keyingi bo'lim).

---

## 6-qadam: Avtomatik frontend build (Dockerfile'ga qo'shish)

`backend/Dockerfile`'ni boshiga qo'shing:

```dockerfile
# ---- Frontend build stage ----
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY ../frontend/package*.json ./
RUN npm ci --silent
COPY ../frontend .
RUN VITE_API_URL= VITE_WS_URL= VITE_RADIO_URL= npm run build

# ---- Backend ----
FROM python:3.12-slim
# ... qolgan kod o'sha ...
COPY --from=frontend-builder /frontend/dist ./static
```

---

## 7-qadam: Railway URL'ni botga berish

Deploy bo'lgandan keyin:
1. Railway → Backend Service → **Settings** → **Public Networking** → URL nusxa oling
   (masalan: `https://intra-group-production-xxxx.up.railway.app`)
2. Bu URL'ni:
   - Backend Service Variables: `MINI_APP_URL=https://...`
   - Bot Service Variables: `MINI_APP_URL=https://...`, `INTERNAL_API_URL=https://...`
3. Botni Railway'da restart qiling

---

## 8-qadam: Telegram Bot Web App URL sozlash

```
BotFather'ga yozing:
/setmenubutton → @SIZNING_BOT → Web App → https://RAILWAY_URL
```

---

## Muhim eslatmalar

- **Railway bepul plani**: 500 soat/oy = taxminan 21 kun. Doimiy uchun **Hobby plan** $5/oy
- **Fayl saqlash**: Railway'da `/tmp` faqat RAM — restart bo'lganda yo'qoladi!
  Production uchun **Railway Volume** (5GB bepul) yoki **AWS S3** / **Cloudflare R2** kerak
- **Icecast**: Railway'da 8000 port ochiq emas. Icecast'ni backend ichida (`USE_ICECAST=true`) ishlatish kerak (allaqachon Dockerfile'da)
- **MediaMTX**: Alohida Railway Service sifatida deploy qiling (`bluenviron/mediamtx:latest`)

---

## Tezkor test

Deploy bo'lgandan keyin:
```bash
curl https://SIZNING-RAILWAY-URL.up.railway.app/health
# {"status":"ok"} bo'lishi kerak
```
