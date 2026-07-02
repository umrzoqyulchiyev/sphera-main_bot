.PHONY: dev stop db-init db-reset test build logs tunnel frontend-build frontend-dev session

VENV := .venv/bin
LOGS := .logs
PG_BIN ?= /usr/lib/postgresql/16/bin
PGDATA := .pgdata

# ── Dev ──────────────────────────────────────────────────────
dev:
	bash infra/scripts/run-dev.sh

stop:
	bash infra/scripts/stop-dev.sh

# ── Frontend ─────────────────────────────────────────────────
frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

# ── Tunnel ───────────────────────────────────────────────────
tunnel:
	@echo "Starting Cloudflare Tunnel on port 8001..."
	cloudflared tunnel --url http://localhost:8001

# ── Voice Chat session (userbot) ─────────────────────────────
# Telegram Voice Chat (jonli efir) uchun userbot session string yaratadi.
# Telefon raqam + Telegram kodi so'raydi. Natija .env ga qo'yiladi.
session:
	@echo "Voice Chat userbot session yaratish..."
	@echo "Telefon raqam va Telegram kodini tayyorlang."
	$(VENV)/python backend/scripts/gen_session.py

# ── Database ─────────────────────────────────────────────────
db-init:
	$(PG_BIN)/psql -h /tmp -p 5433 -U postgres -d radio_db \
		-f backend/app/db/schema.sql

db-reset:
	$(PG_BIN)/psql -h /tmp -p 5433 -U postgres -c "DROP DATABASE IF EXISTS radio_db"
	$(PG_BIN)/psql -h /tmp -p 5433 -U postgres -c "CREATE DATABASE radio_db"
	$(MAKE) db-init

# ── Tests ─────────────────────────────────────────────────────
test:
	cd backend && $(VENV)/pytest tests/ -v

# ── Docker ────────────────────────────────────────────────────
build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f backend

# ── Install ───────────────────────────────────────────────────
install:
	python3 -m venv .venv
	$(VENV)/pip install -e backend/[dev]
