-- ============================================================
--  INTRA GROUP — Database Schema v3.0
--  Yangi TZ: til tanlash → yangilik → platforma
-- ============================================================

-- ============ Foydalanuvchilar ============
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    telegram_id     BIGINT UNIQUE NOT NULL,
    username        VARCHAR(255),
    full_name       VARCHAR(255),
    display_name    VARCHAR(255),          -- foydalanuvchi o'zi tahrir qiladi
    language        VARCHAR(5) DEFAULT 'ru', -- tanlangan til: ru | en | lt
    level           INTEGER DEFAULT 1,      -- 1=слушатель, 2=слушатель, 3=слушатель и ведущий
    points          NUMERIC(12,4) DEFAULT 0.0000,  -- kasr son (0 dan boshlanadi)
    role            VARCHAR(20) DEFAULT 'listener', -- listener | broadcaster | admin
    city            VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW(),
    last_seen       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);

-- ============ Point tranzaksiyalari (tarix) ============
CREATE TABLE IF NOT EXISTS points_transactions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount          NUMERIC(12,4) NOT NULL,  -- - yoki + (kasr)
    event_type      VARCHAR(30) NOT NULL,    -- text_message | voice_message | transfer_out | transfer_in | purchase | gift
    description     TEXT DEFAULT '',
    related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- transfer uchun
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_tx_user ON points_transactions(user_id, created_at DESC);

-- ============ Point so'rovlari (bir foydalanuvchidan ikkinchisiga) ============
CREATE TABLE IF NOT EXISTS points_requests (
    id              SERIAL PRIMARY KEY,
    from_user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- so'rov yuborgan
    to_user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- kimdan so'ralyapti
    amount          NUMERIC(12,4) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending | approved | rejected
    message         TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT NOW(),
    decided_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_points_requests_to ON points_requests(to_user_id, status);

-- ============ Yangiliklar (til bo'yicha, onboarding ekranida ko'rsatiladi) ============
CREATE TABLE IF NOT EXISTS news (
    id              SERIAL PRIMARY KEY,
    language        VARCHAR(5) NOT NULL,     -- ru | en | lt
    title           VARCHAR(300) NOT NULL,
    body            TEXT NOT NULL,
    image_url       VARCHAR(500) DEFAULT '',
    is_active       BOOLEAN DEFAULT true,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_lang ON news(language, is_active, sort_order);

-- ============ Chat xabarlari ============
CREATE TABLE IF NOT EXISTS chat_messages (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    message_type    VARCHAR(20) DEFAULT 'text',  -- text | voice | file
    audio_file_path VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- ============ Studiya/efir zayavkalari (AI agregator + moderator uchun) ============
CREATE TABLE IF NOT EXISTS messages (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    city            VARCHAR(64) DEFAULT 'global',
    text            TEXT,
    audio_path      VARCHAR(500),
    status          VARCHAR(20) DEFAULT 'pending',   -- pending | approved | rejected
    is_for_studio   BOOLEAN DEFAULT false,
    lang            VARCHAR(5),                       -- ru | lt | en | null(auto)
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_studio ON messages(is_for_studio, status, created_at DESC);

-- ============ Psixotip tahlili (AI analitika — TZ §4) ============
CREATE TABLE IF NOT EXISTS psychotypes (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    focus_of_attention  VARCHAR(20) NOT NULL,   -- vnutrenniy | vneshniy
    emotional_tone      VARCHAR(20) NOT NULL,   -- optimist | melanxolik | ratsional
    key_topic           VARCHAR(100) DEFAULT '',
    priority_score      INTEGER DEFAULT 5,      -- 1-10
    raw_json            TEXT DEFAULT '',
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psychotypes_user ON psychotypes(user_id, created_at DESC);

-- Foydalanuvchi profiliga oxirgi psixotip qo'shish (tez o'qish uchun)
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_of_attention VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emotional_tone     VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS key_topic          VARCHAR(100) DEFAULT NULL;

-- ============ Efir (broadcast) ============
CREATE TABLE IF NOT EXISTS broadcasts (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    script           TEXT,
    language         VARCHAR(5),
    duration_sec     INTEGER,
    broadcaster_type VARCHAR(20),  -- ai | live
    created_at       TIMESTAMP DEFAULT NOW()
);

-- ============ Point sotib olish paketlari ============
CREATE TABLE IF NOT EXISTS point_packages (
    id              SERIAL PRIMARY KEY,
    points_amount   NUMERIC(12,4) NOT NULL,
    price_eur       NUMERIC(8,2) NOT NULL,
    label           VARCHAR(100) NOT NULL,   -- "500 points"
    is_active       BOOLEAN DEFAULT true
);

INSERT INTO point_packages (points_amount, price_eur, label) VALUES
    (100, 1.00, '100 points'),
    (500, 4.00, '500 points'),
    (1500, 10.00, '1500 points'),
    (5000, 25.00, '5000 points')
ON CONFLICT DO NOTHING;

-- ============ Seed data (har til = o'sha davlat haqida yangilik) ============
INSERT INTO news (language, title, body, sort_order) VALUES
    ('ru', 'Россия сегодня', 'Москва — сердце России. Кремль, Красная площадь и Большой театр встречают гостей со всего мира. Сегодня в стране проходят культурные фестивали и спортивные события.', 1),
    ('ru', 'Культура и наука России', 'Россия — родина Пушкина, Чайковского и Гагарина. Российские учёные продолжают вносить вклад в космос и технологии.', 2),
    ('en', 'United Kingdom Today', 'London — the heart of the UK. Big Ben, Buckingham Palace and the Thames welcome visitors worldwide. Cultural festivals and football matches fill the calendar today.', 1),
    ('en', 'British Culture & Science', 'The UK gave the world Shakespeare, The Beatles and Newton. British universities remain among the best in the world.', 2),
    ('lt', 'Lietuva šiandien', 'Vilnius — Lietuvos širdis. Senamiestis, Gedimino pilis ir Trakų ežerai laukia svečių iš viso pasaulio. Šiandien šalyje vyksta kultūros festivaliai.', 1),
    ('lt', 'Lietuvos kultūra ir mokslas', 'Lietuva — krepšinio šalis ir Čiurlionio tėvynė. Lietuvių mokslininkai garsėja lazerių technologijomis visame pasaulyje.', 2)
ON CONFLICT DO NOTHING;


-- ============ Efir mavzulari (admin yaratadi) ============
CREATE TABLE IF NOT EXISTS topics (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      VARCHAR(20) DEFAULT 'active',  -- active | closed | aired
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============ Mneniyalar (foydalanuvchi fikrlari) ============
CREATE TABLE IF NOT EXISTS opinions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id),
    topic_id      INTEGER REFERENCES topics(id),
    kind          VARCHAR(10) NOT NULL,            -- text | voice
    text          TEXT,
    tg_file_id    VARCHAR(255),                    -- ovoz: Telegram file_id (fayl serverda emas)
    tg_message_id BIGINT,
    points_spent  NUMERIC(12,4) DEFAULT 0,
    status        VARCHAR(20) DEFAULT 'pending',   -- pending | processed
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opinions_topic ON opinions(topic_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opinions_user ON opinions(user_id, created_at DESC);

-- ============ Musiqa nomzodlari (foydalanuvchi taklif qiladi) ============
CREATE TABLE IF NOT EXISTS music_nominations (
    id          SERIAL PRIMARY KEY,
    topic_id    INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title       VARCHAR(300) NOT NULL,    -- "Qo'shiq nomi — Artist"
    artist      VARCHAR(200) DEFAULT '',
    vote_count  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_music_nom_topic ON music_nominations(topic_id, vote_count DESC);

-- ============ Musiqa ovoz berish ============
CREATE TABLE IF NOT EXISTS music_votes (
    id              SERIAL PRIMARY KEY,
    nomination_id   INTEGER REFERENCES music_nominations(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    topic_id        INTEGER REFERENCES topics(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, topic_id)   -- har mavzu uchun bitta ovoz
);
CREATE INDEX IF NOT EXISTS idx_music_votes_nom ON music_votes(nomination_id);

-- ============ Efir jadvali (broadcast slots) ============
-- Admin ведущийga vaqt beradi, u shu vaqtda efirga chiqadi
CREATE TABLE IF NOT EXISTS broadcast_slots (
    id              SERIAL PRIMARY KEY,
    host_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(300) NOT NULL,         -- "Kechki efir: Sport"
    description     TEXT DEFAULT '',
    scheduled_at    TIMESTAMP NOT NULL,            -- efir boshlanadigan vaqt
    duration_min    INTEGER DEFAULT 60,            -- daqiqalarda
    status          VARCHAR(20) DEFAULT 'scheduled', -- scheduled | live | done | cancelled
    share_url       VARCHAR(500) DEFAULT '',       -- bot orqali ulashish linki
    cost_points     NUMERIC(12,4) DEFAULT 0,       -- ведущийdan olinadigan to'lov (keyingi bosqich)
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_slots_scheduled ON broadcast_slots(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_slots_host ON broadcast_slots(host_user_id, status);

-- ============ Кастинг (отбор ведущих) ============
-- Foydalanuvchi ariza + audio-audishen topshiradi, admin ko'rib chiqib
-- tasdiqlasa — role 'doverenniy' bo'ladi (efirga chiqish huquqi).
CREATE TABLE IF NOT EXISTS casting_applications (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    audio_path      VARCHAR(500) NOT NULL,
    note            TEXT DEFAULT '',                -- foydalanuvchi o'zi haqida qisqa matn
    status          VARCHAR(20) DEFAULT 'pending',   -- pending | approved | rejected
    admin_note      TEXT DEFAULT '',                 -- admin izohi (masalan rad etish sababi)
    created_at      TIMESTAMP DEFAULT NOW(),
    decided_at      TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_casting_status ON casting_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_casting_user ON casting_applications(user_id, created_at DESC);
