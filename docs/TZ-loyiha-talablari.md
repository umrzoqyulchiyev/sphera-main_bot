# INTRA GROUP — Loyiha Texnik Topshirig'i (TZ)

> Bu hujjat boshliq (Varl Blask / Umrzoq) bergan barcha talablarni o'z ichiga oladi.
> Sana: 2026-06-25. Versiya: 1.0

---

## 0. Loyiha mohiyati

**INTRA GROUP** — yangi turdagi interaktiv platforma (radio EMAS).
Odamlar fikr (mneniya) yuboradi → point sarflaydi → AI hamma fikrlarni yig'ib
**ko'pchilik** pozitsiyasini aniqlaydi → 2 ta AI personaj dialogi → moderator tasdiqlaydi
→ Telegram **Voice Chat** orqali efirga chiqadi.

**MUHIM:** Icecast/radio modeli RAD ETILGAN (yuridik litsenziya muammosi + data ishlatilmaydi).
Telegram **Group Voice Chat** ishlatiladi. AI qismi keyingi bosqich.

---

## 1. BOSHLIQ (VARL) AYTGAN ASOSIY TALABLAR

### 1.1. Voice Chat (Telegram guruh)
- Efir Telegram Voice Chat orqali (radio emas — litsenziya kerak emas).
- Guruhda muzika bemalol ulashish mumkin (yuridik muammo yo'q).
- Ishtirokchilar **faqat moderator ruxsati bilan** ulanadi.
- Moderator mikrofon beradi/oladi: "men tasdiqlayman kim gapiradi".
- 2-3-5 akkaunt guruhga ulanib, voice chat sinab ko'riladi.

### 1.2. Fikr yuborish (mneniya)
- Foydalanuvchi **matn yoki ovoz** yuboradi (video YO'Q).
- Hech qanday forma cheklovi yo'q — odam xohlagandek yozadi/gapiradi.
- **MUHIM:** Fikrlar Telegram resursida saqlanadi (oddiy guruh kabi), serverga emas —
  ortiqcha xarajat va sozlamadan qochish uchun.

### 1.3. AI (fon rejimida — keyingi bosqich)
- AI fonda ishlaydi: fikrlarni yig'adi, tahlil qiladi, dialog yaratadi.
- Foydalanuvchi buni ko'rmaydi — faqat tayyor natijani eshitadi.
- Muzika ham: ko'pchilik tanlagan musiqa qo'yiladi.

### 1.4. Yondashuv
- **Backend birinchi, frontend ikkinchi.** Backend mantiqi to'g'ri bo'lsa, frontend oson.

---

## 2. MINI-APP KIRISH OQIMI (TZ — aniq tartib)

### 2.1. Birinchi kirish (`/start` → mini-app)
1. **Til tanlash** — 3 til chiqadi: **EN, LT, RU** (shu tartibda).
2. Logotip: **INTRA GROUP** (radio emas), **3 rangda**:
   - "IN" + "TRA" — oq/ko'k (cyan)
   - "GROUP" — binafsha (purple)
3. Til tanlagandan keyin → **"Dobro pojalovat" (Welcome)** + osha davlat haqida
   **yangilik / podkast** (reklama hisobida, chiroyli).
4. Yangilikni ko'rib → tugma bosadi → **asosiy platformaga** kiradi.

### 2.2. Kirishda animatsiya
- Mini-app ochilganda **dumaloq radio belgisi** tebranib/aylanib turadi
  (gradient, "Jarvis" uslubida jonli animatsiya).

---

## 3. PROFIL BO'LIMI (TZ — aniq tartib)

O'ng tomonda til bo'limi SHART EMAS. Uning o'rniga quyidagilar:

### 3.1. Profil tartibi (aniq)
1. **1-o'rin: Уровень (Level)**
   - Level 1 → Слушатель (listener)
   - Level 2 → Слушатель (aktiv listener)
   - Level 3 → Слушатель и ведущий (listener + boshlovchi)
2. **2-o'rin: Язык (Til)** — qaysi tilni tanlagani
3. **3-o'rin: ID** — Telegram ID

### 3.2. Profil tahrirlash
- Foydalanuvchi **ismini (display_name)** va **username** ni tahrirlay oladi.

### 3.3. Point operatsiyalari (profil ichida)
- **So'rash (Request):** ID bo'yicha boshqa odamdan point so'rash.
  "Mendan shuncha point so'rabdi" — o'sha odamga ID bo'yicha xabar boradi → tasdiqlaydi/rad etadi.
- **Berish (Send):** ID bo'yicha point yuborish. "Mendan shuncha point ketdi".
- **Sotib olish (Buy):** Profil → "point sotib olish" → real pulga (masalan 5 euro = N point).
  Narxlar paketlarda ko'rsatiladi.

---

## 4. POINT TIZIMI (TZ — aniq)

- Point **kasr son** ko'rinishida (masalan 5699.900).
- 1 ta **matn** xabar = **0.001** point.
- 1 ta **ovozli** xabar = **0.005** point.
- Gapirgan/yozgan paytda point real vaqtda kamayib boradi.
- Point yagona ichki valyuta.

---

## 5. ASOSIY PLATFORMA (mini-app tablari)

Pastki navigatsiya (5 tab):
1. **Anons** (antenna) — til, features, Voice Chat holati, yangiliklar/bannerlar.
2. **Stats** (to'lqin) — daraja, statistika, psixotip.
3. **Efir** (markaziy dumaloq orb — animatsiyali) — joriy mavzu + fikr yuborish (matn/ovoz).
4. **Favorites** (yulduz) — saqlangan efirlar/xabarlar.
5. **Profil** (odam) — Level/Til/ID, tahrirlash, point operatsiyalari.

---

## 6. 3 DARAJA (Level)

| Level | Rol | Imkoniyatlar |
|-------|-----|--------------|
| 1 | Слушатель | Voice Chat tinglash, chat, fikr yuborish |
| 2 | Слушатель (aktiv) | + ko'proq imkoniyat |
| 3 | Слушатель и ведущий | + Voice Chat'da mikrofon (efir olib borish) |

Daraja faqat **admin** tomonidan beriladi (level 3 = ведущий).

---

## 7. TEXNOLOGIYALAR

### Backend
- Python + FastAPI (async, WebSocket)
- PostgreSQL (ma'lumotlar bazasi)
- Redis (cache, pub/sub)
- Telegram Bot API (python-telegram-bot)
- Pyrogram + py-tgcalls (Voice Chat userbot — session string kerak)

### Frontend
- React + TypeScript + Vite
- Telegram Mini App SDK
- TailwindCSS

### AI (keyingi bosqich)
- Google Gemini (fikr tahlili, dialog)
- faster-whisper (STT — ovoz→matn)
- Edge TTS / ElevenLabs (TTS — matn→ovoz)

### Infra
- systemd user services (24/7, auto-restart)
- Cloudflare tunnel (HTTPS)

### To'lov
- Telegram Payments (Telegram Stars / provider token)

---

## 8. HOZIRGI HOLAT (2026-06-25)

### Tayyor ✅
- Auth (Telegram ID → JWT), profil (Level/Til/ID)
- Point tizimi: kasr son, yuborish, so'rash, sotib olish (bot orqali)
- 3 daraja (admin boshqaradi)
- Til tanlash → yangilik → platforma oqimi (Welcome)
- INTRA GROUP logotipi (3 rangda)
- Mavzu (topic) + fikr yig'ish (matn/ovoz)
- Statistika (haqiqiy), Favorites (haqiqiy)
- Admin panel (mavzu ochish/yopish, user boshqarish)
- Bot: /start, /buy, /topic, /profile, /admin
- Guruhda mneniya qabul qilish (Telegram resursida)

### Kutilmoqda ⏳
- Voice Chat avtomatikasi — **session string kerak** (boshliq raqami bilan)
- AI dialog (2 personaj) — keyingi bosqich
- Musiqa ovoz berish — keyingi bosqich

---

## 9. OCHIQ MASALALAR

1. **Userbot session string** — Voice Chat uchun real Telegram akkaunt kerak
   (pytgcalls Bot API bilan ishlamaydi — Telegram cheklovi). Boshliq raqami: +370 682 11510.
2. **To'lov provayder** — Telegram Stars (XTR) yoki provider token (BotFather → Payments).
3. **Voice Chat guruhi** — guruhda Voice Chat yoqilgan bo'lishi kerak.
