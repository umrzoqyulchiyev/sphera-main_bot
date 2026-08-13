# Design Document

Ручная оплата поинтов (Manual Payment) — INTRA GROUP

## Overview

Функция добавляет отслеживаемый поток ручной оплаты поверх существующей покупки
через Telegram Stars. Ключевое решение: заявка хранится в отдельной таблице
`manual_payments` со снимком пакета, а начисление поинтов идёт через уже
существующий `points_service.add_points()` — то есть баланс, уровень и история
транзакций считаются тем же кодом, что и при оплате через Stars. Никакой
параллельной логики начисления не появляется.

Второе решение: администратор выбирает режим оплаты (`stars` / `manual` / `both`)
в настройках, и Mini App подстраивает интерфейс под него. Реквизиты хранятся в
`app_settings`, а не в коде.

Третье решение: имя бота больше не зашито в код. Бэкенд отдаёт его вместе с
настройками оплаты, определяя из `BOT_USERNAME` или через Telegram `getMe`.

### Goals

- Отслеживаемая ручная оплата с нулевой комиссией
- Начисление поинтов одной кнопкой, без ручного поиска пользователя
- Защита от двойного начисления и от спама заявками
- Совместимость: оплата через Stars продолжает работать без изменений

### Non-Goals

- Загрузка скриншота квитанции — колонка `receipt_path` в схеме есть, но UI
  загрузки в этой итерации не делается
- Интеграция CryptoBot и Stripe — отдельные функции
- Автоматическая сверка с банковской выпиской

## Architecture

```
Mini App (React)                Backend (FastAPI)              Telegram
──────────────────              ─────────────────              ────────
BuyModal
 ├─ вкладка ⭐ Stars ──────────► GET /users/me/points/
 │                                  payment-method
 │                                  (отдаёт bot_username) ────► t.me/<bot>?start=buy_N
 │                                                                    │
 │                                                              send_invoice(XTR)
 │                                                                    │
 │                              POST /users/credit-purchase ◄─────────┘
 │
 └─ вкладка ✉️ Вручную ───────► POST /users/me/points/
                                    manual-payment
                                       │
                                       ├─► manual_payments (pending)
                                       └─► DM всем администраторам ──► бот

Admin.tsx                        Backend
─────────                        ───────
PaymentTab
 └─ ManualPaymentsPanel ───────► GET  /admin/manual-payments?status=
                                POST /admin/manual-payments/{id}/approve
                                       │
                                       ├─► UPDATE ... WHERE status='pending'
                                       ├─► points_service.add_points()
                                       ├─► WebSocket points_update
                                       └─► DM пользователю
```

### Key Design Decisions

**Снимок пакета в заявке.** Заявка хранит `points_amount`, `price_eur`,
`package_label` на момент создания, а `package_id` ссылается на пакет с
`ON DELETE SET NULL`. Иначе изменение цены пакета между отправкой и
подтверждением заявки привело бы к начислению не той суммы, которую пользователь
оплатил.

**Атомарная смена статуса перед начислением.** Подтверждение выполняется как
`UPDATE ... WHERE id = $1 AND status = 'pending' RETURNING ...`. Если запрос
вернул `None` — заявка уже обработана, начисление не выполняется. Это даёт
идемпотентность без блокировок: двойной клик или повторный запрос не начислит
поинты второй раз.

**Откат при сбое начисления.** Если `add_points` вернул ошибку после смены
статуса, заявка возвращается в `pending`. Оплаченные деньги не должны
«зависнуть» в статусе `approved` без начисленных поинтов.

**Одна заявка `pending` на пользователя.** Проверка перед вставкой. Без неё
пользователь мог создать десятки заявок и завалить администратора сообщениями.

**Кеш имени бота.** `getMe` вызывается один раз за время жизни процесса и
кешируется в модуле. Имя бота не меняется, а запрос к Telegram на каждое
открытие «Купить» был бы лишней задержкой.

**Настройки оплаты сохраняются целиком.** Админ-панель отправляет все четыре
поля в одном `PUT`, потому что бэкенд перезаписывает их все. Отправка только
изменённого поля стёрла бы остальные.

## Components and Interfaces

### Backend

#### `app/db/schema.sql`

Таблица `manual_payments`:

| Колонка | Тип | Назначение |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INTEGER FK users ON DELETE CASCADE | автор заявки |
| `package_id` | INTEGER FK point_packages ON DELETE SET NULL | ссылка на пакет |
| `points_amount` | NUMERIC(12,4) | снимок: сколько начислить |
| `price_eur` | NUMERIC(8,2) | снимок: сколько оплачено |
| `package_label` | VARCHAR(100) | снимок: название пакета |
| `payment_method` | VARCHAR(30) | bank / card / cash / crypto / other |
| `payment_note` | TEXT | комментарий пользователя |
| `receipt_path` | VARCHAR(500) | зарезервировано под квитанцию |
| `status` | VARCHAR(20) | pending / approved / rejected |
| `admin_note` | TEXT | комментарий администратора |
| `decided_by` | INTEGER FK users ON DELETE SET NULL | кто решил |
| `created_at` / `decided_at` | TIMESTAMP | |

Индексы: `idx_manual_pay_status(status, created_at DESC)` для списка админа,
`idx_manual_pay_user(user_id, created_at DESC)` для истории пользователя.

Записи в `app_settings`: `manual_payment_details`, `manual_payment_enabled`.

#### `app/core/models.py`

- `ManualPaymentCreate` — `package_id`, `payment_method` (Literal из пяти
  значений), `payment_note`
- `ManualPaymentOut` — заявка с данными пользователя для админ-панели
- `ManualPaymentDecision` — `admin_note`
- `PaymentSettingsOut` / `PaymentSettingsUpdate` — добавлены `manual_details`,
  `manual_enabled`; `PaymentSettingsOut` также отдаёт `bot_username`

#### `app/api/routers/users.py`

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/users/me/points/payment-method` | режим оплаты, реквизиты, имя бота |
| POST | `/users/me/points/manual-payment` | создать заявку |
| GET | `/users/me/points/manual-payments` | свои заявки, последние 20 |
| DELETE | `/users/me/points/manual-payment/{id}` | отменить свою `pending` |

#### `app/api/routers/admin.py`

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/admin/manual-payments?status=` | список с фильтром |
| POST | `/admin/manual-payments/{id}/approve` | подтвердить и начислить |
| POST | `/admin/manual-payments/{id}/reject` | отклонить с причиной |
| GET | `/admin/manual-payments/pending-count` | счётчик для значка |
| GET/PUT | `/admin/settings/payment` | настройки оплаты |

Все — под `require_admin`, модератор доступа не имеет.

#### `app/services/notifications.py`

- `get_bot_username()` — `BOT_USERNAME` или `getMe`, с кешем
- `notify_admins_manual_payment()` — DM администраторам о новой заявке
- `notify_manual_payment_decided()` — DM пользователю о решении

### Frontend

#### `components/profile/ProfileScreen.tsx` — `BuyModal`

Режим определяется настройками: при `both` показываются две вкладки, при
`stars` или `manual` — только соответствующая. Если есть заявка `pending`,
вместо формы выводится её карточка с кнопкой отмены. Ниже — история решённых
заявок.

Форма ручной оплаты: реквизиты администратора → выбор пакета → выбор способа
оплаты → комментарий → отправка. Кнопка отправки заблокирована, пока не выбран
пакет и не введён комментарий.

#### `pages/Admin.tsx` — `PaymentTab` + `ManualPaymentsPanel`

`PaymentTab` получил третий режим `both`, поле реквизитов и переключатель приёма
заявок. `ManualPaymentsPanel` — фильтры по статусу, карточки заявок, поле
комментария и кнопки подтверждения / отклонения с подтверждающим диалогом.

#### `lib/api.ts`, `types/index.ts`

Клиентские функции для всех эндпоинтов выше; типы `ManualPayment`,
`ManualPaymentMethod`, расширенный `PaymentSettings`. Функция `adminDeleteUser`
перенесена сюда из `Admin.tsx`, где она была объявлена между импортами и
дублировала импорт `API_URL`.

## Data Models

```
users ──1:N──► manual_payments ──N:1──► point_packages
                     │                   (ON DELETE SET NULL)
                     │
                     └── decided_by ──► users (ON DELETE SET NULL)

manual_payments (approved) ──► points_transactions (event_type='purchase')
                                через points_service.add_points()
```

Состояния заявки:

```
        создана
           │
           ▼
      ┌─ pending ─┐
      │     │     │
 отмена│     │     │администратор
 польз.│     │     │
      ▼     ▼     ▼
   удалена approved rejected
              │
              └─► поинты начислены + DM
```

## Error Handling

| Ситуация | Код | Поведение |
|---|---|---|
| Ручная оплата выключена | 403 | заявка не создаётся |
| Уже есть заявка `pending` | 409 | сообщение с просьбой дождаться решения |
| Пакет не найден или неактивен | 404 | заявка не создаётся |
| Отмена обработанной заявки | 404 | отмена невозможна |
| Повторное подтверждение | 404 | поинты не начисляются второй раз |
| Сбой начисления | 500 | заявка возвращается в `pending` |
| Модератор в эндпоинтах оплаты | 403 | `require_admin` |
| Имя бота неизвестно | — | Mini App показывает ошибку, ссылка не открывается |

Отправка DM выполняется через `asyncio.create_task` — недоставленное сообщение
(пользователь заблокировал бота) не должно ломать основной поток.

## Correctness Properties

Свойства, которые должны выполняться всегда, независимо от порядка действий.

### Property 1: Начисление не более одного раза

Для любой заявки сумма начисленных по ней поинтов равна либо `points_amount`,
либо нулю. Повторные подтверждения, параллельные запросы и двойные клики не
увеличивают начисление.

**Validates: Requirements 4.1, 4.3**

### Property 2: Согласованность статуса и начисления

Заявка в статусе `approved` всегда имеет соответствующую запись в
`points_transactions`. Заявка в `pending` или `rejected` — не имеет.

**Validates: Requirements 4.1, 4.4**

### Property 3: Неизменность суммы после создания

Начисленное количество поинтов равно снимку в заявке, а не текущему состоянию
пакета. Изменение или удаление пакета после создания заявки не меняет сумму.

**Validates: Requirements 1.4, 4.1**

### Property 4: Не более одной активной заявки

Для любого пользователя количество заявок в статусе `pending` не превышает
единицы.

**Validates: Requirements 1.6, 2.2**

### Property 5: Только необратимые переходы

Из `approved` и `rejected` заявка не возвращается в `pending` — кроме
единственного случая: откат при сбое начисления, когда транзакция поинтов не
была записана.

**Validates: Requirements 2.3, 4.3, 4.4**

### Property 6: Изоляция роли модератора

Ни один эндпоинт оплаты не выполняется для пользователя с ролью `moderator`.

**Validates: Requirements 3.4**

## Testing Strategy

### Проверено

- Применение `schema.sql` к рабочей базе: таблица создаётся с 14 колонками и
  двумя индексами, записи в `app_settings` появляются
- Идемпотентность подтверждения на реальной базе: второй `UPDATE ... WHERE
  status='pending'` возвращает 0 строк
- `tsc -b` без ошибок; production-сборка фронтенда проходит
- Импорт FastAPI-приложения и регистрация всех десяти маршрутов оплаты

### Требует проверки вручную

- Полный сквозной путь в Telegram: отправка заявки → DM администратору →
  подтверждение → начисление → DM пользователю
- Обновление баланса через WebSocket при открытом Mini App
- Переключение режимов `stars` / `manual` / `both` и отражение в Mini App
