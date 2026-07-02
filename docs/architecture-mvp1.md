# MVP Этап 1 — Архитектура Backend

> Контекст: Существующий FastAPI + Icecast бэкенд (Sfera5). ИИ откладывается.
> Задача: 4 модуля бизнес-логики.

---

## 1. Система пользователей (Уровни)

### Модель БД (PostgreSQL)

```sql
-- Уже существует, дополняем/уточняем
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    telegram_id     BIGINT UNIQUE NOT NULL,
    username        VARCHAR(255),
    display_name    VARCHAR(255),
    language        VARCHAR(5) DEFAULT 'ru',     -- ru | en | lt
    level           INTEGER DEFAULT 1,           -- 1=Слушатель, 2=Вещатель, 3=Админ
    role            VARCHAR(20) DEFAULT 'listener', -- listener | broadcaster | admin
    points          NUMERIC(12,4) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    last_seen       TIMESTAMP DEFAULT NOW()
);
```

### Уровни

| Level | Role | Возможности |
|-------|------|-------------|
| 1 | listener | Слушать Voice Chat, читать/писать в чат, отправлять мнение |
| 2 | broadcaster | Всё выше + доступ к микрофону в Voice Chat (вести эфир) |
| 3 | admin | Всё + управление пользователями, модерация, настройки |

### Эндпоинты

```
POST /auth/telegram          — регистрация/логин через Telegram ID → JWT
GET  /users/me               — профиль (id, level, points, language)
PUT  /users/me               — обновить display_name, language
POST /admin/users/set-level  — [admin] изменить уровень пользователя
```

### Pydantic модели

```python
class TelegramAuthRequest(BaseModel):
    telegram_id: int
    username: str | None = None
    full_name: str | None = None

class UserProfile(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    display_name: str | None
    language: str
    level: int
    role: str
    points: Decimal

class SetLevelRequest(BaseModel):
    user_id: int
    level: int  # 1, 2, или 3
```

---

## 2. Экономика (Поинты)

### Модель БД

```sql
-- Уже существует
CREATE TABLE points_transactions (
    id              SERIAL PRIMARY KEY,
    from_user_id    INTEGER REFERENCES users(id),
    to_user_id      INTEGER REFERENCES users(id),
    amount          NUMERIC(12,4) NOT NULL,
    tx_type         VARCHAR(20) NOT NULL,  -- 'transfer' | 'request' | 'purchase'
    status          VARCHAR(20) DEFAULT 'completed', -- 'completed' | 'pending' | 'rejected'
    message         TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE points_requests (
    id              SERIAL PRIMARY KEY,
    from_user_id    INTEGER REFERENCES users(id),  -- кто просит
    to_user_id      INTEGER REFERENCES users(id),  -- у кого просит
    amount          NUMERIC(12,4) NOT NULL,
    message         TEXT DEFAULT '',
    status          VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
    created_at      TIMESTAMP DEFAULT NOW(),
    decided_at      TIMESTAMP
);
```

### Логика транзакций (ACID)

```python
async def send_points(from_user_id: int, to_user_id: int, amount: Decimal) -> dict:
    """
    Атомарный перевод: 
    1. UPDATE users SET points = points - amount WHERE id = from AND points >= amount
    2. Если строк = 0 → недостаточно средств (rollback)
    3. UPDATE users SET points = points + amount WHERE id = to
    4. INSERT INTO points_transactions
    Всё в одной SQL-транзакции (BEGIN...COMMIT).
    """

async def request_points(from_user_id: int, to_user_id: int, amount: Decimal, message: str) -> dict:
    """
    Создаёт запрос (status=pending). 
    Получатель видит "от вас просят X поинтов" → approve/reject.
    При approve → вызывается send_points (от to_user → from_user).
    """
```

### Эндпоинты

```
POST /users/me/points/transfer         — отправить поинты (to_user_id, amount)
POST /users/me/points/request          — запросить поинты (from_user_id, amount, message)
GET  /users/me/points/requests         — мои входящие запросы (pending)
POST /users/me/points/requests/{id}/decide — approve/reject запрос
GET  /users/me/points/history          — история транзакций
```

### Pydantic модели

```python
class TransferRequest(BaseModel):
    to_user_id: int
    amount: Decimal

class PointsRequestCreate(BaseModel):
    from_user_id: int   # у кого просишь
    amount: Decimal
    message: str = ""

class DecideRequest(BaseModel):
    approve: bool
```

---

## 3. Icecast → Telegram Voice Chat (Ключевая связка)

### Концепция

```
┌─────────────┐         ┌──────────┐         ┌─────────────────────┐
│  Icecast2   │ ──mp3──▶│ pytgcalls│ ──opus──▶│ Telegram Group      │
│  /live_ru   │  stream  │ (bridge) │  stream  │ Voice Chat          │
│  port 8000  │         │          │         │ (все слушатели тут)  │
└─────────────┘         └──────────┘         └─────────────────────┘
```

### Технология: pytgcalls + Pyrogram

- **pytgcalls** — Python библиотека для программного участия бота в Voice Chat Telegram.
- Бот **программно подключается** к групповому Voice Chat и **стримит** аудио из Icecast.
- Качество: Icecast 128kbps mp3 → pytgcalls конвертирует в Opus (Telegram формат) с максимальным битрейтом.

### Реализация (логика)

```python
# bridge_service.py — Icecast → Telegram Voice Chat мост

from pytgcalls import PyTgCalls, StreamType
from pytgcalls.types.input_stream import AudioStream
import pyrogram

# Pyrogram client (userbot или bot с доступом к voice chat)
app = pyrogram.Client("bridge_account", api_id=..., api_hash=...)
call = PyTgCalls(app)

ICECAST_STREAM_URL = "http://localhost:8000/live_ru"
GROUP_CHAT_ID = -1003883809940  # Telegram группа

async def start_bridge():
    """Подключает бота к Voice Chat группы и стримит Icecast."""
    await call.start()
    await call.join_group_call(
        GROUP_CHAT_ID,
        AudioStream(
            ICECAST_STREAM_URL,
            # pytgcalls сам декодирует mp3 → PCM → Opus
        ),
        stream_type=StreamType().pulse_stream,
    )

async def stop_bridge():
    await call.leave_group_call(GROUP_CHAT_ID)
```

### Что нужно для этого:

| Компонент | Назначение |
|-----------|-----------|
| `pytgcalls` | Программное участие в Voice Chat |
| `pyrogram` | Telegram MTProto клиент (для подключения к группе) |
| Userbot аккаунт | pytgcalls требует **userbot** (не обычный bot) для voice chat — нужен api_id + api_hash от реального Telegram-аккаунта |
| FFmpeg | pytgcalls использует FFmpeg для декодирования аудио |

### Важно (честно):

- **pytgcalls** работает через **userbot** (реальный аккаунт), а не через Bot API — это ограничение Telegram.
- Для продакшна нужен **отдельный Telegram-аккаунт** который будет "сидеть" в Voice Chat и транслировать.
- Качество: Icecast 128kbps → pytgcalls → Telegram opus ≈ 48-64kbps — это **максимум** что поддерживает Telegram Voice Chat.

### Эндпоинты управления

```
POST /admin/bridge/start   — [admin] подключить бот к Voice Chat, начать трансляцию
POST /admin/bridge/stop    — [admin] отключить
GET  /admin/bridge/status  — текущий статус (active/inactive, listeners)
```

---

## 4. Управление эфиром (уровни + микрофон)

### Логика

В Telegram Group Voice Chat управление микрофоном происходит через **права участника**:

```python
# Pyrogram API для управления Voice Chat
from pyrogram.raw.functions.phone import EditGroupCallParticipant

async def mute_user(group_id: int, user_id: int):
    """Замьютить участника (запретить микрофон)."""
    await app.invoke(EditGroupCallParticipant(
        call=...,           # GroupCall peer
        participant=...,    # InputPeer пользователя
        muted=True
    ))

async def unmute_user(group_id: int, user_id: int):
    """Размьютить (разрешить микрофон) — только level >= 2."""
    user = await get_user_by_telegram_id(user_id)
    if user.level < 2:
        raise PermissionError("Только вещатели (уровень 2+) могут говорить")
    await app.invoke(EditGroupCallParticipant(
        call=...,
        participant=...,
        muted=False
    ))
```

### Логика доступа

| Level | Voice Chat | Микрофон |
|-------|-----------|----------|
| 1 (Слушатель) | Может слушать | ❌ Замьючен (программно) |
| 2 (Вещатель) | Может слушать | ✅ Может говорить (по расписанию/разрешению) |
| 3 (Админ) | Может слушать | ✅ Всегда может говорить + управлять другими |

### Эндпоинты

```
POST /admin/voice/grant-mic    — [admin] дать микрофон конкретному user_id (level 2+)
POST /admin/voice/revoke-mic   — [admin] забрать микрофон
GET  /admin/voice/participants — [admin] список участников Voice Chat + их статус
```

---

## 5. Итоговая архитектура (как это интегрируется в текущий FastAPI)

```
FastAPI Backend (port 8001)
├── routers/
│   ├── auth.py           ← [ЕСТЬ] Telegram auth + JWT
│   ├── users.py          ← [ЕСТЬ] Профиль, level, points
│   ├── points.py         ← [ЕСТЬ] Transfer, request, decide
│   ├── bridge.py         ← [НОВЫЙ] Icecast → Telegram Voice Chat мост
│   └── voice_admin.py    ← [НОВЫЙ] Управление микрофоном в Voice Chat
├── services/
│   ├── points.py         ← [ЕСТЬ] ACID транзакции поинтов
│   ├── bridge.py         ← [НОВЫЙ] pytgcalls + pyrogram клиент
│   └── voice_control.py  ← [НОВЫЙ] Mute/unmute по уровню
├── core/
│   ├── database.py       ← [ЕСТЬ] asyncpg pool
│   ├── dependencies.py   ← [ЕСТЬ] JWT + level check
│   └── config.py         ← [ЕСТЬ] + новые env (API_ID, API_HASH, GROUP_ID)
└── main.py               ← [ЕСТЬ] lifespan: + bridge auto-start
```

### Новые зависимости (requirements.txt)

```
pytgcalls>=0.9.7
pyrogram>=2.0.0
```

### Новые ENV переменные

```env
# Telegram MTProto (для pytgcalls/pyrogram userbot)
TG_API_ID=12345678
TG_API_HASH=abcdef1234567890abcdef1234567890
TG_SESSION_STRING=...   # Pyrogram session (userbot аккаунт)
VOICE_CHAT_GROUP_ID=-1003883809940
```

---

## 6. Языки (Lt, En, Ru)

Icecast уже имеет 3 mount'а: `/live_ru`, `/live_lt`, `/live_en`.
pytgcalls bridge может подключаться к **одному** из них (по настройке):

```python
# Текущий язык эфира определяется конфигом или API-вызовом
CURRENT_STREAM_LANG = "ru"  # или "lt" / "en"
stream_url = f"http://localhost:8000/live_{CURRENT_STREAM_LANG}"
```

Переключение языка эфира:
```
POST /admin/bridge/set-language  — body: {"lang": "en"} → перезапуск bridge с новым mount
```

---

## 7. Что уже готово vs что нужно добавить

| Модуль | Статус | Действие |
|--------|--------|----------|
| Auth (Telegram ID → JWT) | ✅ Готов | — |
| Профиль (ID, level, points) | ✅ Готов | — |
| Points transfer | ✅ Готов | — |
| Points request | ✅ Готов | — |
| Icecast (3 mount'а) | ✅ Готов | — |
| pytgcalls bridge | ❌ Нет | **СОЗДАТЬ** |
| Voice Chat управление (mute/unmute) | ❌ Нет | **СОЗДАТЬ** |
| Userbot аккаунт | ❌ Нет | **Нужен Telegram аккаунт + api_id/hash** |

---

## 8. Открытые вопросы (нужно решение)

1. **Userbot аккаунт** — pytgcalls требует реальный Telegram-аккаунт (не Bot API). Чей аккаунт будет? Или создаём отдельный?
2. **Voice Chat уже создан в группе?** — Нужна группа с включённым Voice Chat.
3. **Когда вещатель (level 2) выходит в эфир** — он говорит через Telegram Voice Chat напрямую (как обычный участник), или его аудио тоже идёт через Icecast?
4. **Покупка поинтов за реальные деньги** — входит в MVP1 или позже?
