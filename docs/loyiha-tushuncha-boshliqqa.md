# Loyihani qanday tushundim va qanday instrumentlar kerak

---

## 1. Loyihani qanday ko'rayapman (mantiq)

Bu — **yangi turdagi interaktiv radio**. Oddiy radiodan farqi: tinglovchilar passiv emas, ular **faol ishtirokchi**. Mantiq quyidagicha:

### Asosiy tsikl:
```
Mavzu e'lon qilinadi
        ↓
Minglab odam fikr yuboradi (ovoz yoki matn) — har biridan point yechiladi
        ↓
AI hamma fikrlarni tahlil qiladi → 3 ta asosiy pozitsiyani ajratadi:
  1-pozitsiya (ko'pchilik)
  2-pozitsiya
  3-pozitsiya
        ↓
AI shu 3 pozitsiya asosida 2 ta AI-ведущий o'rtasida 
tabiiy DIALOG yaratadi (8-15 daqiqa)
        ↓
Moderator (siz) o'qiydi/eshitadi → tasdiqlaydi
        ↓
Efirga chiqadi → hamma tinglaydi
        ↓
Musiqa (ko'pchilik tanlagan)
```

### Iqtisodiyot:
- **Point** — yagona ichki valyuta.
- Fikr yuborish uchun point sarflanadi (matn = arzon, ovoz = qimmatroq).
- Point **sotib olish** mumkin (real pul → point).
- Point **yuborish** mumkin (ID bo'yicha).
- Point **so'rash** mumkin (do'stdan — "SMS kabi").
- Hamma operatsiyalar faqat pointda.

### Jonli boshlovchilar (3-daraja):
- Tanlangan odamlarga mikrofon beriladi.
- Jadval bo'yicha efir olib borishadi (1 soat slot = $3-5).
- Kasting → 3 tur → ovoz berish (faqat point sotib olganlar ovoz beradi).
- Bu biz uchun **asosiy daromad manbayi**.

### Kengayish modeli (kelajak):
- Har shaharga tayyor model beriladi (franchise kabi).
- AI modullari alohida sotiladi (matn tahlil, dialog yaratish, analitika).

---

## 2. Backend mantiqining asosiy modullari

| Modul | Vazifasi | Nima qiladi |
|-------|----------|-------------|
| **Auth** | Identifikatsiya | Telegram ID → JWT token → profil (ID, level, point) |
| **Murojaatlar** | Fikr qabul qilish | Matn/ovoz qabul, point yechish, navbatga qo'shish |
| **STT** | Ovozni matnga | Ovozli murojaat → matn (AI tahlili uchun) |
| **AI Agregator** | Tahlil | Hamma fikrlarni o'qib → 3 pozitsiya ajratish |
| **AI Dialog Generator** | Kontent yaratish | 3 pozitsiya → 2 personaj dialogi (8-15 min ssenariy) |
| **TTS** | Matnni ovozga | Dialog matni → tabiiy ovoz (2 xil ovoz — 2 personaj) |
| **Moderatsiya** | Nazorat | Tayyor dialog → admin ko'radi → tasdiqlaydi/rad etadi |
| **Efir (Streaming)** | Uzatish | Tasdiqlangan audio → barcha tinglovchilarga stream |
| **Points** | Iqtisodiyot | Balans, sarflash, sotib olish, yuborish, so'rash |
| **Live Broadcast** | Jonli efir | 3-daraja ведущий mikrofon → stream (jadval bilan) |
| **Musiqa** | Kontentni boyitish | Ko'pchilik tanlagan musiqa → efirga |

---

## 3. Kerak bo'ladigan texnologiyalar/instrumentlar

### Backend (asosiy):
| Texnologiya | Nima uchun |
|-------------|------------|
| **Python + FastAPI** | API server — tez, async, WebSocket qo'llaydi |
| **PostgreSQL** | Ma'lumotlar bazasi — foydalanuvchilar, murojaatlar, tranzaksiyalar |
| **Redis** | Tez cache, pub/sub (real-time xabarlar, sessiyalar) |
| **Google Gemini AI** | Fikrlarni tahlil qilish + dialog yaratish (NLP/generatsiya) |
| **faster-whisper (STT)** | Ovozni matnga aylantirish (lokal, tez) |
| **Edge TTS / ElevenLabs** | Matnni ovozga aylantirish (2 xil ovoz — 2 personaj) |
| **FFmpeg** | Audio konvertatsiya, stream tayyorlash |
| **Icecast2** | Audio stream uzatish (radio sifatida) — minglab tinglovchiga |

### Frontend:
| Texnologiya | Nima uchun |
|-------------|------------|
| **React + TypeScript** | Telegram Mini App ichida UI |
| **Telegram Mini App SDK** | Telegram bilan integratsiya (auth, to'lov) |
| **WebSocket** | Real-time chat va efir holati |
| **Audio API** | Icecast stream tinglash, ovoz yozish |

### Infra:
| Texnologiya | Nima uchun |
|-------------|------------|
| **Google Cloud (GCP) / VPS** | Production server (24/7, doimiy IP) |
| **Cloudflare** | HTTPS, domen himoyasi |
| **Docker** | Barqaror deployment |
| **systemd** | Auto-restart, 24/7 ishlash |

### To'lov (keyingi bosqich):
| Texnologiya | Nima uchun |
|-------------|------------|
| **Telegram Payments** yoki **Click/Payme** | Point sotib olish (real pul → point) |

---

## 4. Yondashuv: Backend birinchi

Backend to'g'ri qurilsa — frontend shunchaki "tugmalar" bo'ladi. Mening yondashuvim:

1. **Avval mantiq** — AI agragatsiya, dialog yaratish, moderatsiya, point logikasi.
2. **Keyin stream** — yaratilgan dialog efirga chiqishi.
3. **Oxirda frontend** — tugmalar, dizayn, UX.

Frontend o'zgarishi oson (bir kunda qayta chiziladi). Backend mantiqi noto'g'ri bo'lsa — hamma narsani qayta yozish kerak. Shuning uchun backend **birinchi va asosiy** e'tibor.

---

## 5. Hozirgi loyiha holati (qancha tayyor)

Bazada ~60-65% tayyor:
- ✅ Auth, profil, ID, level, point tizimi
- ✅ Ovoz/matn yuborish, point sarflash
- ✅ STT (ovoz → matn), AI (Gemini), TTS
- ✅ Efir (Icecast stream), 3 til oqimi
- ✅ Point transfer, so'rash
- ✅ Jonli efir (mikrofon → stream)
- ✅ Telegram bot + Mini App

Qo'shish/o'zgartirish kerak:
- ❌ AI dialog IKKI personaj o'rtasida (hozir bir AI monolog)
- ❌ "Ko'pchilik" logikasi (1/2/3 pozitsiya)
- ❌ Moderatsiya sahifasi (admin tasdiqlashi)
- ❌ Point sotib olish (real to'lov)
- ❌ Efir jadvali (ведущийlar uchun)
- ❌ Musiqa ovoz berish
- ❌ Mavzu tizimi (efir mavzusi)
- ❌ Kasting/ovoz berish (keyingi bosqich)
