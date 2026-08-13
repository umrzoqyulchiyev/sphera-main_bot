# Railway Deploy Qo'llanma — INTRA GROUP

## Arxitektura
Bitta Railway Service → bitta Docker container ichida:
- **FastAPI** backend (uvicorn, port 8001)
- **Icecast2** (USE_ICECAST=true bo'lsa, jonli efir)
- **Telegram Bot** (BOT_TOKEN bo'lsa, backend tayyor bo'lgach ishga tushadi)

---

## 1. GitHub bog'lash

1. Railway dashboard → **New Project** → **Deploy from GitHub repo**
2. `Umrzoq-backend-ai/Intra_group_bot` ni tanlang
3. Branch: `main`
4. Railway o'zi `railway.toml` ni topadi va Docker bilan build qiladi

---

## 2. PostgreSQL qo'shish

1. Project → **+ New** → **Database** → **Add PostgreSQL**
2. `DATABASE_URL` avtomatik o'rnatiladi (environment'ga inject qilinadi)

---

## 3. Redis qo'shish

1. Project → **+ New** → **Database** → **Add Redis**
2. `REDIS_URL` avtomatik o'rnatiladi

---

## 4. Environment Variables

Service'ni bosing → **Variables** → quyidagilarni qo'shing:

### Majburiy (ishlamasligi mumkin)
```
BOT_TOKEN=1234567890:AAG...  (BotFather'dan)
BOT_USERNAME=your_bot_username  (@ belgisiz, masalan: intra_group_bot)
ADMIN_IDS=123456789  (sizning Telegram ID'ingiz)
SECRET_KEY=lorem-ipsum-32-random-characters-here  (kamida 32 belgi)
GEMINI_KEY=AIzaSy...  (Google AI Studio'dan)
```

### Mini App URL (deploy bo'lgach)
```
MINI_APP_URL=https://YOUR-SERVICE.up.railway.app
API_URL=https://YOUR-SERVICE.up.railway.app
INTERNAL_API_URL=https://YOUR-SERVICE.up.railway.app
```
> Birinchi deploy'da URL hali ma'lum emas — deploy tugagach URL'ni ko'rib, qaytib o'rnating va redeploy qiling.

### Icecast (jonli efir)
```
USE_ICECAST=true
ICECAST_PASS=o'zingizning_maxfiy_parolingiz
```

### Ixtiyoriy
```
DEBUG=false
DISABLE_GROUP_CHECK=true
ALLOWED_ORIGINS=*
PAYMENT_CURRENCY=XTR
```

### DATABASE_URL va REDIS_URL
Bularni qo'shmang — Railway o'zi inject qiladi.

---

## 5. Volume (fayl saqlash)

Agar ovozli xabarlar va audio fayllar restart'da yo'qolmasin desangiz:

1. Service → **Volumes** → **+ Add Volume**
2. Mount path: `/app/.audio`
3. Xuddi shunday `/app/.uploads` uchun ham

> Bepul plan'da volume bo'lmasa `/tmp/` ishlatiladi — restart'da yo'qoladi, lekin asosiy funksionallik ishlaydi.

---

## 6. Bot'ni Telegram'da sozlash

Deploy tugagach:

1. **BotFather** → `/setdomain` → botingizni tanlang → Railway URL'ni kiriting
2. **BotFather** → `/setmenubutton` → botingizni tanlang → Web App URL → Railway URL
3. **BotFather** → `/setcommands`:
```
start - Radioni ochish
studio - Studiyaga murojaat
buy - Pointlar xaridi
profile - Profilim
radio - Efir holati
help - Yordam
```

---

## 7. Admin panel'da to'lovni sozlash

Mini App ochilgach:

1. **Admin Panel** → **Оплата** tab
2. To'lov usulini tanlang: `⭐ Stars`, `✉️ Вручную`, yoki `⭐+✉️ Ikkisi`
3. Agar qo'lda to'lov yoqilsa — **Реквизиты** maydonini to'ldiring (bank, IBAN, karta)

---

## 8. Muammolarni tekshirish

### Bot ishlamayapti
- `BOT_TOKEN` to'g'ri kiritilganmi?
- Railway Logs'da `[bot-starter] Backend ready, starting bot` ko'rinayaptimi?

### Mini App ochilmayapti
- `MINI_APP_URL` Railway URL bilan bir xilmi?
- BotFather'da domain/URL o'rnatilganmi?

### Database xatosi
- `DATABASE_URL` Variables'da ko'rinayaptimi? (Railway inject qiladi)
- Railway Logs → `Database migration completed` ko'rinishi kerak

### Audio ishlamayapti
- `USE_ICECAST=true` o'rnatilganmi?
- Railway Logs'da `Icecast2 started` ko'rinayaptimi?

---

## Logs ko'rish

Railway dashboard → Service → **Logs** tab

Asosiy log satrlari:
```
[entrypoint] Icecast2 started        ← Icecast ishga tushdi
[bot-starter] Backend ready, starting bot  ← Bot ishga tushdi
INFO: Application startup complete    ← Backend tayyor
Database migration completed          ← DB jadvallari yaratildi
```
