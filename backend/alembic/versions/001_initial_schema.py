"""Initial schema — INTRA GROUP v3.0

Revision ID: 001
Revises: None
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        telegram_id     BIGINT UNIQUE NOT NULL,
        username        VARCHAR(255),
        full_name       VARCHAR(255),
        display_name    VARCHAR(255),
        language        VARCHAR(5) DEFAULT 'ru',
        level           INTEGER DEFAULT 1,
        points          NUMERIC(12,4) DEFAULT 5.0000,
        role            VARCHAR(20) DEFAULT 'listener',
        city            VARCHAR(50),
        created_at      TIMESTAMP DEFAULT NOW(),
        last_seen       TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_users_language ON users(language);

    CREATE TABLE IF NOT EXISTS points_transactions (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount          NUMERIC(12,4) NOT NULL,
        event_type      VARCHAR(30) NOT NULL,
        description     TEXT DEFAULT '',
        related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_points_tx_user ON points_transactions(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS points_requests (
        id              SERIAL PRIMARY KEY,
        from_user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        to_user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount          NUMERIC(12,4) NOT NULL,
        status          VARCHAR(20) DEFAULT 'pending',
        message         TEXT DEFAULT '',
        created_at      TIMESTAMP DEFAULT NOW(),
        decided_at      TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_points_requests_to ON points_requests(to_user_id, status);

    CREATE TABLE IF NOT EXISTS news (
        id              SERIAL PRIMARY KEY,
        language        VARCHAR(5) NOT NULL,
        title           VARCHAR(300) NOT NULL,
        body            TEXT NOT NULL,
        image_url       VARCHAR(500) DEFAULT '',
        is_active       BOOLEAN DEFAULT true,
        sort_order      INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_news_lang ON news(language, is_active, sort_order);

    CREATE TABLE IF NOT EXISTS chat_messages (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message         TEXT NOT NULL,
        message_type    VARCHAR(20) DEFAULT 'text',
        audio_file_path VARCHAR(500),
        created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

    CREATE TABLE IF NOT EXISTS broadcasts (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
        script           TEXT,
        language         VARCHAR(5),
        duration_sec     INTEGER,
        broadcaster_type VARCHAR(20),
        created_at       TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS point_packages (
        id              SERIAL PRIMARY KEY,
        points_amount   NUMERIC(12,4) NOT NULL,
        price_eur       NUMERIC(8,2) NOT NULL,
        label           VARCHAR(100) NOT NULL,
        is_active       BOOLEAN DEFAULT true
    );

    INSERT INTO point_packages (points_amount, price_eur, label) VALUES
        (100, 1.00, '100 points'),
        (500, 4.00, '500 points'),
        (1500, 10.00, '1500 points'),
        (5000, 25.00, '5000 points')
    ON CONFLICT DO NOTHING;

    INSERT INTO news (language, title, body, sort_order) VALUES
        ('ru', 'Добро пожаловать в INTRA GROUP!', 'Интерактивная радиоплатформа нового поколения.', 1),
        ('en', 'Welcome to INTRA GROUP!', 'Next-generation interactive radio platform.', 1),
        ('lt', 'Sveiki atvykę į INTRA GROUP!', 'Naujos kartos interaktyvi radijo platforma.', 1)
    ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS point_packages CASCADE;
    DROP TABLE IF EXISTS broadcasts CASCADE;
    DROP TABLE IF EXISTS chat_messages CASCADE;
    DROP TABLE IF EXISTS news CASCADE;
    DROP TABLE IF EXISTS points_requests CASCADE;
    DROP TABLE IF EXISTS points_transactions CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    """)
