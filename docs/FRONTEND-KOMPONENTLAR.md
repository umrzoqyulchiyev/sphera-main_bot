# FRONTEND KOMPONENTLAR — To'liq ro'yxat va holat

## 📂 PAGES (Sahifalar)

### 1. Welcome.tsx ✅
**Maqsad**: Til tanlash + yangilik (podcast)  
**Holat**: Tayyor, lekin yangiliklar DB'dan kelmayabdi

**Qismlar**:
- Step 1: Til tanlash (EN → LT → RU)
- Step 2: Yangilik ko'rsatish + "Platformaga kirish" tugmasi

**Muammolar**:
- `/news?lang=ru` endpoint bo'sh array qaytaradi (DB'da yangilik yo'q)

**Yechim**:
```sql
-- backend/app/db/schema.sql ga qo'shish
INSERT INTO news (title, body, language, image_url) VALUES
('UK Tech Innovation', 'Latest developments in AI and technology...', 'en', NULL),
('Lietuvos technologijos', 'Naujienos apie AI ir technologijas...', 'lt', NULL),
('Российские технологии', 'Новости об ИИ и технологиях...', 'ru', NULL);
```

---

### 2. Radio.tsx ✅
**Maqsad**: Asosiy sahifa (layout wrapper)  
**Holat**: Tayyor

**Qismlar**:
- TopBar — point balans
- BottomNav — navigatsiya (5 tab)
- Screen router — AnonsScreen, EfirScreen, ProfileScreen, StatsScreen, FavoritesScreen
- Onboarding modal

**Muammolar**: Yo'q

---

### 3. Admin.tsx ✅
**Maqsad**: Admin panel  
**Holat**: Tayyor, lekin dizayn Stitch'ga to'liq mos emas

**Qismlar**:
- 3 tab: Topics, Drafts, Users
- Topics: mavzu yaratish, fikr yig'ish, AI dialog yaratish
- Drafts: yaratilgan dialoglarni ko'rish, tasdiqlash/rad etish
- Users: level o'zgartirish, point berish

**Muammolar**:
- Dizayn eski (glassmorphism to'liq emas)
- Ba'zi tugmalar kichik (responsive)

---

## 📂 COMPONENTS

### Layout

#### TopBar.tsx ✅
**Maqsad**: Logo + point balans  
**Holat**: Tayyor

**Props**: `{ points: number }`

---

#### BottomNav.tsx ✅
**Maqsad**: 5 ta tab navigatsiya  
**Holat**: Tayyor

**Tabs**:
1. Anons (bell icon)
2. Efir (radio icon) — asosiy
3. Stats (bar chart)
4. Favorites (heart)
5. Profile (user)

---

### Radio (Efir ekrani)

#### EfirScreen.tsx ✅
**Maqsad**: Radio pleyer + chat + GO LIVE  
**Holat**: Tayyor

**Qismlar**:
- AudioPlayer — Icecast stream
- ChatMessages — xabarlar ro'yxati
- ChatInput — xabar yuborish
- GoLiveButton — mikrofon (level 3)

**Muammolar**:
- Chat scroll ba'zan qiyin
- Ovozli xabar ba'zan ijro bo'lmaydi (URL muammosi)

---

#### AudioPlayer.tsx ✅
**Maqsad**: Radio pleyer (Icecast stream)  
**Holat**: Tayyor

**Funksiyalar**:
- Play/pause
- Waveform animatsiya
- Stream URL: `/radio/live/{lang}`

**Muammolar**:
- Ba'zan stream yuklanmaydi (Icecast ishlamasa)

---

#### ChatMessages.tsx ⚠️
**Maqsad**: Xabarlar ro'yxati  
**Holat**: Ishlaydi, lekin scroll muammosi

**Muammolar**:
1. Yangi xabar kelganda auto-scroll ishlamaydi
2. Ovozli xabar player ba'zan render bo'lmaydi

**Yechim**:
```typescript
// ChatMessages.tsx
useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }
}, [messages]);
```

---

#### ChatInput.tsx ⚠️
**Maqsad**: Xabar yuborish (matn + ovoz)  
**Holat**: Ishlaydi, lekin ovoz yozish mobilda muammoli

**Funksiyalar**:
- Matn input (0.001 point)
- Ovoz yozish (0.005 point)
- Emoji picker

**Muammolar**:
1. iOS Safari'da ovoz yozish permission so'ramaydi
2. Android'da ba'zan mikrofon ochilmaydi

**Yechim**:
```typescript
// navigator.mediaDevices.getUserMedia qo'llash
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

---

#### GoLiveButton.tsx ⚠️
**Maqsad**: Mikrofon bilan jonli efirga chiqish  
**Holat**: Kod tayyor, lekin faqat level 3 uchun

**Muammolar**:
- Level 1-2 foydalanuvchilar uchun ham ko'rinadi (noto'g'ri!)

**Yechim**:
```typescript
// EfirScreen.tsx ichida
{user?.level >= 3 && <GoLiveButton />}
```

---

### Profile

#### ProfileScreen.tsx ⚠️
**Maqsad**: Foydalanuvchi profili  
**Holat**: Tayyor, lekin level matnli ko'rinmaydi

**Qismlar**:
- Display name tahrirlash
- ID, username, level, til
- Point balans
- Point transfer/request

**Muammolar**:
- Level `1`, `2`, `3` deb raqam ko'rsatiladi (matnli bo'lishi kerak: "Слушатель", "Активный", "Ведущий")

**Yechim**:
```typescript
const levelLabels: Record<string, Record<number, string>> = {
  ru: { 1: 'Слушатель', 2: 'Активный', 3: 'Ведущий' },
  en: { 1: 'Listener', 2: 'Active', 3: 'Host' },
  lt: { 1: 'Klausytojas', 2: 'Aktyvus', 3: 'Vedėjas' }
};
// Ko'rsatish
<span>{levelLabels[lang][user.level]}</span>
```

---

### Admin

#### Admin panel komponentlari
- TopicsTab — mavzu yaratish, yopish
- DraftsTab — dialoglarni ko'rish, tasdiqlash
- UsersTab — foydalanuvchilarni boshqarish
- DraftModal — dialog to'liq ko'rinishi

**Holat**: Barcha tayyor, lekin dizayn yangilanishi kerak

---

### UI (Yordamchi komponentlar)

#### OnboardingModal.tsx ✅
**Maqsad**: Birinchi kirish uchun yo'riqnoma  
**Holat**: Tayyor

---

#### Toast.tsx ✅ (useToast hook)
**Maqsad**: Xabarlar (muvaffaqiyat/xato)  
**Holat**: Tayyor

---

## 📂 HOOKS

### useAudioPlayer.ts ✅
**Maqsad**: Icecast stream player  
**Holat**: Tayyor

**Funksiyalar**:
- `play(url)` — stream boshlash
- `pause()` — to'xtatish
- `isPlaying` — holat

---

### useWebSocket.ts ✅
**Maqsad**: Real-time chat WebSocket  
**Holat**: Tayyor

**Funksiyalar**:
- `connect(url, token)` — ulanish
- `disconnect()` — uzish
- `sendMessage(msg)` — xabar yuborish
- `onMessage(callback)` — xabar qabul qilish

---

### useTranslation.ts ✅
**Maqsad**: i18n (ko'p til)  
**Holat**: Tayyor

**Funksiyalar**:
- `tx(key)` — tarjima olish
- `getLang()` — joriy til

---

### useToast.ts ✅
**Maqsad**: Toast notification  
**Holat**: Tayyor

---

## 📂 LIB

### api.ts ✅
**Maqsad**: Backend API chaqiruvlar  
**Holat**: Tayyor

**Asosiy funksiyalar**:
- `authenticate()` — Telegram auth
- `getMe()` — profil
- `updateLanguage(lang)` — til o'zgartirish
- `getNews(lang)` — yangiliklar
- `sendMessage(text)` — chat xabar
- `sendVoiceMessage(blob)` — ovozli xabar
- `transferPoints(toUserId, amount)` — point yuborish
- `requestPoints(fromUserId, amount)` — point so'rash
- Admin API: `adminCreateTopic()`, `adminGetDrafts()`, va h.k.

---

### auth.ts ✅
**Maqsad**: JWT token storage  
**Holat**: Tayyor

**Funksiyalar**:
- `getToken()` — token olish
- `setToken(token)` — saqlash
- `clearToken()` — o'chirish
- `authHeaders()` — Authorization header

---

### config.ts ✅
**Maqsad**: Konfiguratsiya  
**Holat**: Tayyor

**O'zgaruvchilar**:
```typescript
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8001';
export const RADIO_URL = import.meta.env.VITE_RADIO_URL || 'http://localhost:8001';
export const DEFAULT_CITY = 'global';
```

---

### i18n.ts ✅
**Maqsad**: Tarjimalar (ru/en/lt)  
**Holat**: Tayyor

**Fayllar**:
- `locales/ru/index.ts` — rus tilida
- `locales/en/index.ts` — ingliz tilida
- `locales/lt/index.ts` — litva tilida

---

### telegram.ts ✅
**Maqsad**: Telegram Mini App SDK  
**Holat**: Tayyor

**Funksiyalar**:
- `initTelegram()` — SDK init
- `getUserData()` — foydalanuvchi ma'lumotlari
- `closeMiniApp()` — yopish

---

## 🔥 ENG MUHIM FRONTEND MUAMMOLAR

### 1. **ChatMessages scroll** ⚠️
**Muammo**: Yangi xabar kelganda auto-scroll ishlamaydi  
**Joylanish**: `frontend/src/components/radio/ChatMessages.tsx`  
**Yechim**: `useEffect` + `scrollTo`

---

### 2. **Ovozli xabar ijro** ⚠️
**Muammo**: Ba'zan audio player render bo'lmaydi yoki ovoz ijro etilmaydi  
**Joylanish**: `frontend/src/components/radio/ChatMessage.tsx`  
**Sabab**: `/uploads/voice_xxx.mp3` URL noto'g'ri yoki CORS

**Yechim**:
```typescript
// api.ts da URL to'g'ri qurish
const voiceUrl = msg.voice_path?.startsWith('http')
  ? msg.voice_path
  : `${API_URL}${msg.voice_path}`;
```

---

### 3. **GoLiveButton har doim ko'rinadi** ⚠️
**Muammo**: Level 1-2 foydalanuvchilar uchun ham ko'rinadi  
**Joylanish**: `frontend/src/components/radio/EfirScreen.tsx`  
**Yechim**: `{user?.level >= 3 && <GoLiveButton />}`

---

### 4. **Level matnli emas** ⚠️
**Muammo**: Profilda level raqam ko'rsatiladi (1, 2, 3)  
**Joylanish**: `frontend/src/components/profile/ProfileScreen.tsx`  
**Yechim**: Tarjima map qo'llash

---

### 5. **Responsive — kichik ekranlarda muammo** ⚠️
**Muammo**: Ba'zi tugmalar va inputlar 360px ekranda sig'maydi  
**Joylanish**: Barcha komponentlar  
**Yechim**: TailwindCSS `sm:` breakpoint'lar qo'llash

---

## ✅ TAYYOR KOMPONENTLAR (o'zgartirishsiz ishlatish mumkin)

1. ✅ Welcome.tsx (faqat yangilik DB kerak)
2. ✅ Radio.tsx
3. ✅ TopBar.tsx
4. ✅ BottomNav.tsx
5. ✅ AudioPlayer.tsx
6. ✅ OnboardingModal.tsx
7. ✅ useAudioPlayer.ts
8. ✅ useWebSocket.ts
9. ✅ useTranslation.ts
10. ✅ auth.ts
11. ✅ config.ts
12. ✅ i18n.ts
13. ✅ telegram.ts

---

## ⚠️ O'ZGARTIRILISHI KERAK

1. ⚠️ ChatMessages.tsx — scroll tuzatish
2. ⚠️ ChatInput.tsx — mobil mikrofon
3. ⚠️ ChatMessage.tsx — ovoz URL tuzatish
4. ⚠️ GoLiveButton.tsx — faqat level 3
5. ⚠️ ProfileScreen.tsx — level matnli
6. ⚠️ Admin.tsx — Stitch design
7. ⚠️ EfirScreen.tsx — responsive
8. ⚠️ api.ts — ovoz URL tuzatish

---

## 🎨 STITCH DESIGN QOIDALARI

### Ranglar
```css
--bg-primary: #060a14;
--bg-glass: rgba(19,24,36,0.6);
--border-glass: rgba(56,225,255,0.2);
--text-primary: #dbe9ff;
--text-secondary: #bbc9cd;
--text-muted: #6b7c9e;
--accent-cyan: #38e1ff;
--accent-purple: #7c5cff;
```

### Glassmorphism card
```css
.glass {
  background: rgba(19,24,36,0.6);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(56,225,255,0.2);
  border-radius: 16px;
}
```

### Logo gradient
```css
.logo-gradient {
  background: linear-gradient(90deg, #fff 0%, #38e1ff 50%, #7c5cff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Button primary
```css
.btn-primary {
  background: linear-gradient(135deg, #2ea8ff, #38e1ff);
  color: #02101f;
  font-weight: bold;
  border-radius: 12px;
  padding: 12px 24px;
}
```

---

**✅ Bu frontend to'liq tahlili. Yangi sessiyada davom etishda kerak bo'ladi.**
