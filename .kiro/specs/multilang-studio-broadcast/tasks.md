# Implementation Plan: multilang-studio-broadcast

## Overview

Рефакторинг существующего проекта в мультиязычную студию-вещание. Все изменения аддитивные, архитектура (WebSocket-комнаты, JWT-auth, asyncpg) сохраняется. Порядок реализации соответствует 4 шагам ТЗ: сначала Frontend/UI + фикс Android (Шаг 1), затем БД и логика поинтов (Шаг 2), затем ИИ-конвейер и мультипоток Icecast (Шаг 3), затем модераторская панель (Шаг 4). Задачи с `*` — опциональные (тесты).

## Tasks

### ШАГ 1 — Frontend, UI и фикс Android

- [ ] 1. Миграция БД: аддитивные колонки (фундамент для всех шагов)
  - В `radio-api/db/schema.sql` добавить: `messages.is_for_studio BOOLEAN DEFAULT false`, `messages.lang VARCHAR(5)`, индекс `idx_messages_studio`; `users.broadcast_lang VARCHAR(5) DEFAULT 'ru'`; `broadcast_drafts.script_lt/script_en TEXT`, `audio_ru/audio_lt/audio_en VARCHAR(500)`
  - Применить миграцию к dev-базе (idempotent `ADD COLUMN IF NOT EXISTS`)
  - _Requirements: 6.2, 1.3, 9.2, 10.2, 15.1_

- [ ] 2. i18n: убрать PL, добавить EN, ребрендинг
  - В `miniapp/i18n.js` удалить блок `pl`, добавить полный блок `en`
  - Заменить «Sfera5»/«Сфера5» на «Radio AI» во всех строках (onboarding, приветствия, бренд)
  - Добавить ключи: `send_to_chat`, `send_to_studio`, `toast_sent_chat`, `toast_sent_studio`, `toast_limit`, `studio_denied_role`, `broadcast_lang_hint`
  - _Requirements: 1.6, 13.1, 13.3_

- [ ] 3. UI: выбор языка RU/LT/EN + удаление городов
  - В `miniapp/radio.html` заменить языковые пилюли на RU/LT/EN (`data-lang="ru|lt|en"`)
  - Убедиться, что нет экранов/логики выбора города (slug фиксирован `global`)
  - В `miniapp/app.js`: `setLanguage(lang)` обновляет интерфейс И `broadcast_lang` (PUT), переключает `audio.src` на `/live_{lang}`
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.3, 2.4_

- [ ] 4. UI: две кнопки отправки в чате
  - В `miniapp/radio.html`: строка ввода (input + микрофон) + две кнопки «Отправить в чат» / «Отправить в студию»
  - В `miniapp/app.js`: `sendMessage("chat")` → `type=chat`; `sendMessage("studio")` → `type=studio` (с полем `lang`)
  - Пустой ввод → подсказка, не отправлять
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5. UI: профиль и баланс поинтов (возврат вчерашнего вида)
  - В `miniapp/radio.html`/`app.js` отобразить Профиль с балансом поинтов на видном месте
  - Обновлять баланс при `studio_ack`/`limit_exceeded` (data.points)
  - _Requirements: 5.4_

- [ ] 6. Фикс Android-стабильности
  - В `miniapp/config.js` проверить `Telegram.WebApp.ready/expand/disableVerticalSwipes/enableClosingConfirmation` и пересчёт `--app-vh` на `viewportChanged`
  - В `miniapp/style.css` — `overscroll-behavior:none`, адаптивная высота через `--app-vh`
  - _Requirements: 14.1, 14.2, 14.3_

### ШАГ 2 — Логика чата и лимиты (Поинты)

- [ ] 7. points.spend(): инверсия reward→cost
  - В `radio-api/services/points.py` добавить `COST = {studio:1, studio_voice:2}` (env) и `async def spend(user_id, event_type, cost)` — атомарный `UPDATE ... WHERE points >= cost`, запись в `points_history` с отрицательным amount
  - Отключить авто-повышение роли (`_maybe_promote` не вызывать в новых путях)
  - _Requirements: 5.2, 5.3, 5.5, 5.6, 12.3_

- [ ]* 7.1 Property-based тесты для spend()
  - Hypothesis: неотрицательность баланса, неизменность при нехватке, идемпотентность
  - _Requirements: 5.5, 5.6_

- [ ] 8. WebSocket: type=chat (бесплатно) и type=studio (платно)
  - В `radio-api/routers/chat.py`: `type=chat` — сохранить+broadcast без spend (все роли)
  - `type=studio` — проверка роли `aktivniy`+, `spend("studio")`, дубль в чат + запись `messages(is_for_studio=true, lang)`, ответ `studio_ack`/`limit_exceeded`/`studio_denied`
  - Маппинг устаревшего `server_message` → `studio` (обратная совместимость)
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 6.1, 6.2, 15.3_

- [ ] 9. Голосовая заявка в студию (cost=2 + STT в фоне + авто-удаление)
  - В `radio-api/routers/messages.py`: для голоса в студию — `spend("studio_voice", 2)`, показать плеер в чате, в фоне STT → `messages(is_for_studio=true)`, удалить аудиофайл сразу после транскрипции
  - _Requirements: 5.3, 6.3_

### ШАГ 3 — AI-агрегация и мультиязычный эфир

- [ ] 10. Агрегатор «сливок» из студийных заявок
  - В `radio-api/services/aggregator.py`: `aggregate_studio()` читает `messages(is_for_studio=true, status=pending)`, промпт «сливки» (вход RU/LT/EN → один RU-сценарий), создаёт `broadcast_drafts`, помечает заявки `approved`, WS `new_draft`; фолбэк без Gemini
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 11. Перевод сценария (Gemini)
  - В `radio-api/services/gemini.py`: `async def translate(text, target_lang)` — перевод RU→LT, RU→EN, сохранение тона, фолбэк на RU при сбое
  - _Requirements: 9.1, 9.3, 9.4_

- [ ] 12. ElevenLabs TTS + edge-tts фолбэк (3 языка)
  - В `radio-api/services/tts.py`: абстракция `synthesize(text, out_path, lang)` (ElevenLabs primary, edge-tts fallback), `synthesize_multilang(scripts) -> {lang: path}`, голоса из env
  - Добавить env-переменные в `.env` и `run-dev.sh`
  - _Requirements: 10.1, 10.3, 10.4, 10.5_

- [ ] 13. Мультипоток Icecast (3 mount)
  - В `radio-api/services/broadcast.py`: `mount_for(lang)`, `push_files_multilang(paths) -> {lang: returncode}`, имена mount только из белого списка
  - В `radio-api/state.py`: `stream_url(lang)` → `/live_{lang}`; обновить `to_dict`
  - Обновить `icecast.xml` — 3 mountpoint `/live_ru`, `/live_lt`, `/live_en`
  - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6_

- [ ]* 13.1 Тесты мультипотока
  - example-based: ≤3 потока, каждый язык однократно, изоляция сбоев
  - _Requirements: 11.1, 11.4_

### ШАГ 4 — Модераторская панель

- [ ] 14. approve_draft: мультиязычный конвейер
  - В `radio-api/routers/admin.py`: `approve_draft` → `translate(LT,EN)` (фолбэк RU) → `synthesize_multilang` → сохранить `script_lt/en`, `audio_ru/lt/en` → `push_files_multilang` (если Icecast) → WS `new_segment` с per-lang URL
  - `reject_draft` без генерации
  - _Requirements: 8.3, 8.4, 9.1, 9.2, 10.1, 10.2, 11.2_

- [ ] 15. Админ-панель: студийные заявки + модерация (mobile)
  - В `miniapp/admin.html`/`admin.js`: список `pending`-драфтов, редактирование текста, кнопки «Одобрить»/«Отклонить»
  - Эндпоинты `POST /admin/points/add`, `POST /admin/users/{id}/role` доступны (ручное управление)
  - _Requirements: 8.1, 8.2, 8.5, 12.1, 12.2, 12.5_

- [ ] 16. Ребрендинг Telegram-бота
  - В `telegram-bot/bot.py`: убрать «Sfera5» из `/start`, `/help`, `/radio`, `/profile`, `/admin`, заменить на «Radio AI»
  - _Requirements: 13.2_

- [ ] 17. Интеграционная проверка end-to-end
  - Прогнать: выбор языка → studio-заявка (списание поинта) → дубль в чат + флаг → агрегатор создаёт драфт → approve → 3 аудио (мок Icecast в dev) → плеер слушает свой язык
  - Проверить отсутствие диагностических ошибок и работоспособность существующих эндпоинтов
  - _Requirements: 6.1, 7.1, 8.3, 11.3, 15.4_

## Task Dependency Graph

```
Task 1 (миграция БД)
  ├─→ Task 7 (points.spend) ──→ Task 8 (chat/studio WS) ──→ Task 9 (голос студия)
  ├─→ Task 10 (агрегатор) ──→ Task 14 (approve конвейер)
  ├─→ Task 11 (translate) ──→ Task 14
  ├─→ Task 12 (ElevenLabs TTS) ──→ Task 14
  └─→ Task 13 (Icecast мультипоток) ──→ Task 14

Task 2 (i18n) ──→ Task 3 (язык RU/LT/EN) ──→ Task 4 (две кнопки) ──→ Task 5 (профиль/баланс)
Task 6 (Android фикс) — независимая (UI)
Task 7 ──→ Task 7.1* (тесты spend)
Task 13 ──→ Task 13.1* (тесты мультипотока)
Task 14 ──→ Task 15 (админ-панель)
Task 16 (ребрендинг бота) — независимая
Task 14 + Task 8 + Task 13 ──→ Task 17 (e2e проверка)
```

Критический путь ядра: **1 → (10, 11, 12, 13) → 14 → 17**.
Frontend-ветка (Шаг 1): **1 → 2 → 3 → 4 → 5**, плюс независимые 6 и 16.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "6", "16"], "description": "Фундамент: миграция БД + i18n/ребрендинг + независимый Android-фикс и бот" },
    { "wave": 2, "tasks": ["3", "7", "11", "12", "13"], "description": "UI язык, points.spend, перевод, TTS, мультипоток Icecast" },
    { "wave": 3, "tasks": ["4", "7.1", "8", "10", "13.1"], "description": "Две кнопки UI, тесты spend, WS chat/studio, агрегатор, тесты мультипотока" },
    { "wave": 4, "tasks": ["5", "9", "14"], "description": "Профиль/баланс, голос студия, мультиязычный approve-конвейер" },
    { "wave": 5, "tasks": ["15"], "description": "Админ-панель модерации" },
    { "wave": 6, "tasks": ["17"], "description": "End-to-end проверка" }
  ]
}
```

## Notes

- Все миграции БД — `ADD COLUMN IF NOT EXISTS` (Req 15.1), существующие данные сохраняются.
- WebSocket-комнаты, JWT-auth, проверка членства (`membership`) не ослабляются (Req 15.2).
- Старый контракт `server_message` маппится в `studio` на переходный период (Req 15.3).
- ElevenLabs — новая зависимость; при сбое/отсутствии ключа работает edge-tts фолбэк.
- В dev (`USE_ICECAST=false`) мультипоток деградирует в режим плейлиста по языку — не падает (Req 11.6).
- Задачи `*` (7.1, 13.1) — опциональные тесты, можно пропустить при ограниченном времени.
- ⚠️ Безопасность: реальные секреты в `.env` (BOT_TOKEN, GEMINI_KEY, ICECAST_PASS, SECRET_KEY) рекомендуется ротировать и добавить файл в `.gitignore`.
