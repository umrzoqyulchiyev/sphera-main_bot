"""Alembic migration environment — asyncpg + raw SQL.

Biz SQLAlchemy ORM ishlatmaymiz (asyncpg raw), shuning uchun
migratsiyalar raw SQL sifatida yoziladi. Alembic faqat versiya
boshqaruvi va migration ordering uchun ishlatiladi.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DB URL ni env dan olamiz (alembic.ini'dagi placeholder o'rniga)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME", "radio_db")

if DB_PASS:
    url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    url = f"postgresql://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

config.set_main_option("sqlalchemy.url", url)

target_metadata = None


def run_migrations_offline() -> None:
    """Offline mode — SQL script generatsiya qiladi."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online mode — real DB ga ulanib migratsiya qiladi."""
    from sqlalchemy import create_engine

    connectable = create_engine(config.get_main_option("sqlalchemy.url"))

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
