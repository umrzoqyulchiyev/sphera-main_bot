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
