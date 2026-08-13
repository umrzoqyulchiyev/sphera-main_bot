# Implementation Plan

## Overview

Ручная оплата поинтов: заявка от пользователя → уведомление администратору →
подтверждение → автоматическое начисление поинтов. Работа шла снизу вверх: схема
базы, модели, сервисы, эндпоинты, затем интерфейсы. Начисление переиспользует
существующий `points_service.add_points()`, поэтому параллельной логики баланса
не появилось.

## Task Dependency Graph

```
1 (схема БД)
 └─► 2 (модели) ──┬─► 5 (эндпоинты пользователя) ──┐
                  │         ▲                       │
 3 (имя бота) ────┤         │                       ├─► 7 (типы и API) ──┬─► 8 (Mini App)
                  │   4 (уведомления)               │                     │
                  └─► 6 (эндпоинты админа) ────────┘                     └─► 9 (админ-панель)
                                                                                    │
                                                                          10 (проверка) ◄─┘
```

Задачи 3 и 4 независимы друг от друга и могут выполняться параллельно после
задачи 2. Задачи 8 и 9 независимы друг от друга после задачи 7.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["5", "6"] },
    { "wave": 5, "tasks": ["7"] },
    { "wave": 6, "tasks": ["8", "9"] },
    { "wave": 7, "tasks": ["10"] }
  ]
}
```

## Tasks

- [x] 1. Схема базы данных и настройки
  - Добавить таблицу `manual_payments` в `backend/app/db/schema.sql` со снимком
    пакета (`points_amount`, `price_eur`, `package_label`), `package_id` с
    `ON DELETE SET NULL`, статусом и полями решения администратора
  - Добавить индексы `idx_manual_pay_status(status, created_at DESC)` и
    `idx_manual_pay_user(user_id, created_at DESC)`
  - Добавить в `app_settings` записи `manual_payment_details` и
    `manual_payment_enabled` через `INSERT ... ON CONFLICT DO NOTHING`
  - _Requirements: 1.2, 1.4, 3.1, 5.3, 5.4_

- [x] 2. Pydantic-модели
  - Добавить `ManualPaymentCreate`, `ManualPaymentOut`, `ManualPaymentDecision`
    в `backend/app/core/models.py`
  - Расширить `PaymentSettingsOut` и `PaymentSettingsUpdate` полями
    `manual_details`, `manual_enabled`; в `PaymentSettingsOut` добавить
    `bot_username`
  - _Requirements: 1.2, 5.1, 5.3, 6.1_

- [x] 3. Определение имени бота без жёсткого кода
  - Добавить `bot_username` в `backend/app/core/config.py` и `BOT_USERNAME` в
    `.env.example`
  - Реализовать `get_bot_username()` в `backend/app/services/notifications.py`:
    сначала переменная окружения, иначе один запрос `getMe` с кешированием
  - Отдавать имя бота в обоих эндпоинтах настроек оплаты
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Уведомления через бота
  - Реализовать `notify_admins_manual_payment()` — DM всем администраторам
    (`role='admin'` + `ADMIN_IDS`) о новой заявке
  - Реализовать `notify_manual_payment_decided()` — DM пользователю о
    подтверждении или отклонении с причиной
  - Вызывать оба через `asyncio.create_task`, чтобы недоставленное сообщение не
    ломало основной поток
  - _Requirements: 1.5, 4.2, 4.5_

- [x] 5. Эндпоинты пользователя
  - Расширить `GET /users/me/points/payment-method`: режим оплаты, реквизиты,
    флаг приёма заявок, имя бота
  - Реализовать `POST /users/me/points/manual-payment`: проверка флага приёма,
    проверка отсутствия заявки `pending`, проверка активности пакета, вставка со
    снимком, уведомление администраторов
  - Реализовать `GET /users/me/points/manual-payments` — последние 20 заявок
  - Реализовать `DELETE /users/me/points/manual-payment/{id}` — отмена только
    своей заявки в статусе `pending`
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3_

- [x] 6. Эндпоинты администратора
  - Реализовать `GET /admin/manual-payments?status=` с фильтром
    pending/approved/rejected/all и данными пользователя
  - Реализовать `POST /admin/manual-payments/{id}/approve`: атомарная смена
    статуса через `WHERE status='pending'`, начисление через
    `points_service.add_points()` с `event_type='purchase'`, откат в `pending`
    при сбое, WebSocket `points_update`, DM пользователю
  - Реализовать `POST /admin/manual-payments/{id}/reject` с сохранением причины
  - Реализовать `GET /admin/manual-payments/pending-count` для значка
  - Расширить `GET/PUT /admin/settings/payment`: режим `both`, реквизиты, флаг
    приёма заявок; сохранять все четыре настройки одним запросом
  - Все эндпоинты под `require_admin`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.3, 5.4_

- [x] 7. Клиентские типы и API-функции
  - Добавить `ManualPayment`, `ManualPaymentMethod` и расширить
    `PaymentSettings` в `frontend/src/types/index.ts`
  - Добавить в `frontend/src/lib/api.ts`: `createManualPayment`,
    `getMyManualPayments`, `cancelManualPayment`, `adminListManualPayments`,
    `adminApproveManualPayment`, `adminRejectManualPayment`,
    `adminGetManualPaymentsPendingCount`
  - Обновить сигнатуру `adminUpdatePaymentSettings` под четыре настройки
  - Перенести `adminDeleteUser` из `Admin.tsx` в `api.ts` — она была объявлена
    между импортами и дублировала импорт `API_URL`, из-за чего сборка падала
  - _Requirements: 1.2, 2.2, 3.1, 4.1, 4.5, 5.1_

- [x] 8. Интерфейс покупки в Mini App
  - Переписать `BuyModal` в `frontend/src/components/profile/ProfileScreen.tsx`:
    вкладки Stars / Вручную при режиме `both`, одна вкладка при `stars` или
    `manual`
  - Форма ручной оплаты: реквизиты администратора, выбор пакета, выбор способа
    оплаты, комментарий; отправка заблокирована без пакета и комментария
  - Карточка заявки `pending` вместо формы, с кнопкой отмены
  - История решённых заявок
  - Заменить зашитое имя бота на значение из настроек оплаты
  - Добавить переводы на русский, английский и литовский
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.2, 6.1, 6.3_

- [x] 9. Интерфейс администратора
  - Расширить `PaymentTab` в `frontend/src/pages/Admin.tsx`: третий режим
    `both`, поле реквизитов, переключатель приёма заявок
  - Добавить `ManualPaymentsPanel`: фильтры по статусу, карточки заявок с данными
    пользователя и комментарием, поле комментария администратора, кнопки
    подтверждения и отклонения с подтверждающим диалогом, значок счётчика
  - Добавить переводы на три языка
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.5, 5.1, 5.3, 5.4_

- [x] 10. Проверка
  - Применить `schema.sql` к рабочей базе: таблица с 14 колонками и двумя
    индексами создаётся, записи в `app_settings` появляются
  - Проверить идемпотентность подтверждения на реальной базе: повторный
    `UPDATE ... WHERE status='pending'` возвращает 0 строк
  - Убедиться, что `tsc -b` проходит без ошибок и production-сборка фронтенда
    собирается
  - Убедиться, что приложение импортируется и все десять маршрутов оплаты
    зарегистрированы
  - _Requirements: 1.6, 4.1, 4.3_

## Notes

**Что осталось за рамками этой итерации.** Колонка `receipt_path` в схеме есть,
но загрузка скриншота квитанции в интерфейсе не реализована — при необходимости
это отдельная задача. Интеграции CryptoBot и Stripe тоже вынесены отдельно.

**Что нужно настроить перед использованием.** В админ-панели: вкладка «Оплата» →
выбрать режим `manual` или `both` → заполнить реквизиты. Без реквизитов
пользователь увидит подсказку связаться с администратором напрямую.

**Переменная `BOT_USERNAME`.** Указывать не обязательно: если она пустая,
бэкенд определит имя бота через Telegram `getMe`. Указание её экономит один
запрос при старте.

**Что требует проверки в живом Telegram.** Сквозной путь заявки, доставка личных
сообщений и обновление баланса через WebSocket при открытом Mini App — это
проверяется только вручную, локальными тестами не покрывается.
