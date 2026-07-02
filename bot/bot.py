"""INTRA GROUP — Telegram Bot.

TZ §3: Голосовой чат-бот — strukturali so'rovnoma (ConversationHandler).
Foydalanuvchi studiyaga xabar yuborishdan oldin botdan o'tadi:
  1. Mavzu (muammo/taklif?)
  2. Qisqa ta'rif
  3. Qo'shimcha izoh (ixtiyoriy)
  → Yakuniy xabar backend'ga POST qilinadi.

TZ §1: /profile — real telegram_id ko'rsatiladi.
"""

import os
import logging

import httpx
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
    MenuButtonWebApp,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    KeyboardButton,
    LabeledPrice,
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ConversationHandler,
    CallbackQueryHandler,
    PreCheckoutQueryHandler,
    ContextTypes,
    filters,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("telegram-bot")

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://app.sfera5.world")
INTERNAL_API_URL = os.getenv("INTERNAL_API_URL", "http://radio-api:8001")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")
PAYMENT_CURRENCY = os.getenv("PAYMENT_CURRENCY", "XTR")  # XTR = Telegram Stars
ADMIN_IDS = {
    int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip().isdigit()
}

# ====== ConversationHandler states (so'rovnoma) ======
TOPIC, DESCRIPTION, EXTRA = range(3)

# ====== Ko'p tilli xabarlar ======
TEXTS = {
    "ru": {
        "welcome": (
            "🎙 *INTRA GROUP — Интерактивная платформа*\n\n"
            "Отправляйте своё мнение по теме эфира — текстом или голосом.\n"
            "ИИ соберёт все мнения и создаст живой эфир!\n\n"
            "💎 Поинты, профиль и текущая тема — в приложении 👇"
        ),
        "studio_start":   "🎤 Отправить обращение в студию",
        "ask_topic":      "📌 Шаг 1/3 — Выберите тему обращения:",
        "topic_problem":  "🔴 Проблема / Вопрос",
        "topic_idea":     "💡 Идея / Предложение",
        "topic_story":    "📖 История / Опыт",
        "topic_other":    "💬 Другое",
        "ask_desc":       "✍️ Шаг 2/3 — Кратко опишите суть (1-2 предложения):",
        "ask_extra":      "➕ Шаг 3/3 — Дополнительная информация (или /skip):",
        "confirm":        "✅ Ваше обращение сформировано:\n\n{summary}\n\nОтправить в студию?",
        "send_yes":       "✅ Отправить",
        "send_no":        "❌ Отменить",
        "sent_ok":        "🎉 Обращение отправлено в студию! Баллы: {points:.4f}",
        "sent_fail":      "⚠️ Не удалось отправить. Проверьте баланс баллов.",
        "cancelled":      "❌ Отменено.",
        "no_points":      "❌ Недостаточно баллов. Баланс: {points:.4f}",
        "profile_text":   "👤 *Профиль*\n\nID: `{tg_id}`\nРоль: {role}\nБаллы: {points}\nУровень: {level}",
        "psycho":         "\n\n🧠 Психотип:\n• Фокус: {focus}\n• Тон: {tone}",
        "radio_live":     "🎵 *Прямой эфир* — В ЭФИРЕ\n\nВедущий: {who}\nСлушателей: {cnt}",
        "radio_off":      "📻 Эфир сейчас не активен. Заходите в приложение!",
        "help_text": (
            "*Команды INTRA GROUP:*\n\n"
            "/start — Открыть радио\n"
            "/studio — Отправить обращение в студию\n"
            "/radio — Текущий статус эфира\n"
            "/profile — Ваш профиль и баллы\n"
            "/admin — Админ-панель\n"
            "/efir — Управление Voice Chat (админ)\n"
            "/mic <id> — Дать микрофон · /mute <id> — Забрать\n"
            "/help — Список команд"
        ),
    },
    "en": {
        "welcome": (
            "🎙 *INTRA GROUP — Interactive Radio*\n\n"
            "Listen to live broadcasts in your language and chat in real time.\n"
            "AI collects studio requests and creates a multilingual broadcast!\n\n"
            "Tap the button below to open the app 👇"
        ),
        "studio_start":   "🎤 Send a message to the studio",
        "ask_topic":      "📌 Step 1/3 — Choose your topic:",
        "topic_problem":  "🔴 Problem / Question",
        "topic_idea":     "💡 Idea / Suggestion",
        "topic_story":    "📖 Story / Experience",
        "topic_other":    "💬 Other",
        "ask_desc":       "✍️ Step 2/3 — Briefly describe (1-2 sentences):",
        "ask_extra":      "➕ Step 3/3 — Extra info (or /skip):",
        "confirm":        "✅ Your message:\n\n{summary}\n\nSend to studio?",
        "send_yes":       "✅ Send",
        "send_no":        "❌ Cancel",
        "sent_ok":        "🎉 Sent to studio! Points: {points:.4f}",
        "sent_fail":      "⚠️ Could not send. Check your points balance.",
        "cancelled":      "❌ Cancelled.",
        "no_points":      "❌ Not enough points. Balance: {points:.4f}",
        "profile_text":   "👤 *Profile*\n\nID: `{tg_id}`\nRole: {role}\nPoints: {points}\nLevel: {level}",
        "psycho":         "\n\n🧠 Psychotype:\n• Focus: {focus}\n• Tone: {tone}",
        "radio_live":     "🎵 *On Air*\n\nHost: {who}\nListeners: {cnt}",
        "radio_off":      "📻 Not on air. Open the app!",
        "help_text": (
            "*Commands:*\n\n"
            "/start — Open radio\n"
            "/studio — Send studio message\n"
            "/radio — Current broadcast status\n"
            "/profile — Your profile & points\n"
            "/admin — Admin panel\n"
            "/efir — Voice Chat control (admin)\n"
            "/mic <id> — Grant mic · /mute <id> — Revoke\n"
            "/help — Commands list"
        ),
    },
    "lt": {
        "welcome": (
            "🎙 *INTRA GROUP — Interaktyvus radijas*\n\n"
            "Klausykitės tiesioginio eterio savo kalba ir bendraukite realiuoju laiku.\n"
            "DI renka studijos užklausas ir kuria daugiakalbį eterį!\n\n"
            "Spustelėkite mygtuką žemiau, kad atidarytumėte programėlę 👇"
        ),
        "studio_start":   "🎤 Siųsti pranešimą į studiją",
        "ask_topic":      "📌 Žingsnis 1/3 — Pasirinkite temą:",
        "topic_problem":  "🔴 Problema / Klausimas",
        "topic_idea":     "💡 Idėja / Pasiūlymas",
        "topic_story":    "📖 Istorija / Patirtis",
        "topic_other":    "💬 Kita",
        "ask_desc":       "✍️ Žingsnis 2/3 — Trumpai aprašykite (1-2 sakiniais):",
        "ask_extra":      "➕ Žingsnis 3/3 — Papildoma informacija (arba /skip):",
        "confirm":        "✅ Jūsų pranešimas:\n\n{summary}\n\nSiųsti į studiją?",
        "send_yes":       "✅ Siųsti",
        "send_no":        "❌ Atšaukti",
        "sent_ok":        "🎉 Išsiųsta į studiją! Taškai: {points:.4f}",
        "sent_fail":      "⚠️ Nepavyko išsiųsti. Patikrinkite taškų likutį.",
        "cancelled":      "❌ Atšaukta.",
        "no_points":      "❌ Nepakanka taškų. Likutis: {points:.4f}",
        "profile_text":   "👤 *Profilis*\n\nID: `{tg_id}`\nVaidmuo: {role}\nTaškai: {points}\nLygis: {level}",
        "psycho":         "\n\n🧠 Psichotipas:\n• Fokusas: {focus}\n• Tonas: {tone}",
        "radio_live":     "🎵 *Tiesioginis eteris*\n\nVedėjas: {who}\nKlausytojų: {cnt}",
        "radio_off":      "📻 Eteris neaktyvus. Atidarykite programėlę!",
        "help_text": (
            "*Komandos:*\n\n"
            "/start — Atidaryti radiją\n"
            "/studio — Siųsti studijai\n"
            "/radio — Eterio statusas\n"
            "/profile — Profilis ir taškai\n"
            "/admin — Administravimas\n"
            "/efir — Voice Chat valdymas (admin)\n"
            "/mic <id> — Duoti mikrofoną · /mute <id> — Atimti\n"
            "/help — Komandų sąrašas"
        ),
    },
}


def _admin_url() -> str:
    base = MINI_APP_URL
    for suffix in ("/index.html", "/radio.html"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    return base.rstrip("/") + "/admin"


def webapp_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("📻 Открыть радио", web_app=WebAppInfo(url=MINI_APP_URL))]]
    )


async def _get_user_lang(telegram_id: int) -> str:
    """Foydalanuvchi tilini backenddan oladi (default: ru)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERNAL_API_URL}/auth/telegram",
                json={"telegram_id": telegram_id},
                timeout=8,
            )
            if resp.status_code == 200:
                return resp.json().get("language") or "ru"
    except Exception:
        pass
    return "ru"


async def _get_user_token(telegram_id: int, username: str | None, full_name: str | None) -> str | None:
    """Auth token olish."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERNAL_API_URL}/auth/telegram",
                json={
                    "telegram_id": telegram_id,
                    "username": username,
                    "full_name": full_name,
                },
                timeout=8,
            )
            if resp.status_code == 200:
                return resp.json().get("token")
    except Exception:
        pass
    return None


async def _auth_full(telegram_id: int, username: str | None, full_name: str | None) -> dict:
    """Bitta so'rovда til + token + balans + level qaytaradi (start uchun)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERNAL_API_URL}/auth/telegram",
                json={
                    "telegram_id": telegram_id,
                    "username": username,
                    "full_name": full_name,
                },
                timeout=8,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {}


def tx(lang: str, key: str) -> str:
    return TEXTS.get(lang, TEXTS["ru"]).get(key, TEXTS["ru"].get(key, key))


# ============================================================
# POINT SOTIB OLISH — Telegram Payments (haqiqiy pul)
# ============================================================
POINT_PACKAGES = [
    {"id": 1, "points": 100,  "price": 100,  "label": "100 поинтов"},
    {"id": 2, "points": 500,  "price": 400,  "label": "500 поинтов"},
    {"id": 3, "points": 1500, "price": 1000, "label": "1500 поинтов"},
    {"id": 4, "points": 5000, "price": 2500, "label": "5000 поинтов"},
]
# price — Telegram Stars (XTR) miqdori (XTR uchun provider token kerak emas).


async def buy_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/buy — point paketlarini ko'rsatadi."""
    lang = await _get_user_lang(update.effective_user.id)
    title = {"ru": "💎 Купить поинты:", "en": "💎 Buy points:", "lt": "💎 Pirkti taškus:"}
    rows = [[InlineKeyboardButton(f"{p['label']} — ⭐{p['price']}", callback_data=f"buy_{p['id']}")]
            for p in POINT_PACKAGES]
    await update.message.reply_text(title.get(lang, title["ru"]), reply_markup=InlineKeyboardMarkup(rows))


async def buy_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Paket tanlandi — invoice yuboradi."""
    query = update.callback_query
    await query.answer()
    pkg_id = int(query.data.split("_")[1])
    pkg = next((p for p in POINT_PACKAGES if p["id"] == pkg_id), None)
    if not pkg:
        return
    prices = [LabeledPrice(label=pkg["label"], amount=pkg["price"])]
    try:
        await context.bot.send_invoice(
            chat_id=query.message.chat_id,
            title=f"Radio AI — {pkg['label']}",
            description=f"Пополнение баланса на {pkg['points']} поинтов",
            payload=f"pkg_{pkg['id']}",
            provider_token=PAYMENT_PROVIDER_TOKEN,
            currency=PAYMENT_CURRENCY,
            prices=prices,
        )
    except Exception as exc:
        log.error("send_invoice failed: %s", exc)
        await query.message.reply_text("⚠️ To'lov tizimi hozircha sozlanmagan.")


async def precheckout_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """To'lovdan oldin tasdiqlash."""
    query = update.pre_checkout_query
    if query.invoice_payload.startswith("pkg_"):
        await query.answer(ok=True)
    else:
        await query.answer(ok=False, error_message="Invalid payment")


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """To'lov muvaffaqiyatli — backend point qo'shadi (idempotent)."""
    payment = update.message.successful_payment
    user = update.effective_user
    pkg_id = int(payment.invoice_payload.split("_")[1])
    charge_id = payment.telegram_payment_charge_id

    credited = False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERNAL_API_URL}/users/credit-purchase",
                json={"telegram_id": user.id, "package_id": pkg_id, "charge_id": charge_id},
                timeout=10,
            )
            credited = resp.status_code == 200
    except Exception as exc:
        log.error("credit-purchase failed: %s", exc)

    lang = await _get_user_lang(user.id)
    ok_msg = {"ru": "🎉 Оплата прошла! Поинты зачислены.",
              "en": "🎉 Payment successful! Points added.",
              "lt": "🎉 Apmokėta! Taškai pridėti."}
    fail_msg = {"ru": "⚠️ Оплата прошла, зачисление задерживается.",
                "en": "⚠️ Paid, crediting delayed.",
                "lt": "⚠️ Apmokėta, įskaitymas vėluoja."}
    msg = ok_msg.get(lang, ok_msg["ru"]) if credited else fail_msg.get(lang, fail_msg["ru"])
    await update.message.reply_text(msg, reply_markup=webapp_keyboard())


# ============================================================
# /start
# ============================================================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Deep-link: /start buy → to'lov paketlarini ko'rsatamiz
    if context.args and context.args[0] == "buy":
        await buy_cmd(update, context)
        return
    lang = await _get_user_lang(update.effective_user.id)
    await update.message.reply_text(
        tx(lang, "welcome"),
        reply_markup=webapp_keyboard(),
        parse_mode="Markdown",
    )


# ============================================================
# /studio — Strukturali so'rovnoma (TZ §3)
# ConversationHandler: TOPIC → DESCRIPTION → EXTRA → confirm → send
# ============================================================
async def studio_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """So'rovnomani boshlaydi — mavzu tanlash."""
    user = update.effective_user
    lang = await _get_user_lang(user.id)
    context.user_data["lang"] = lang

    topic_kb = ReplyKeyboardMarkup(
        [
            [tx(lang, "topic_problem"), tx(lang, "topic_idea")],
            [tx(lang, "topic_story"), tx(lang, "topic_other")],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        tx(lang, "ask_topic"),
        reply_markup=topic_kb,
    )
    return TOPIC


async def received_topic(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Mavzu tanlandi — ta'rif so'rash."""
    context.user_data["topic"] = update.message.text
    lang = context.user_data.get("lang", "ru")
    await update.message.reply_text(
        tx(lang, "ask_desc"),
        reply_markup=ReplyKeyboardRemove(),
    )
    return DESCRIPTION


async def received_description(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Ta'rif olindi — qo'shimcha so'rash."""
    context.user_data["description"] = update.message.text
    lang = context.user_data.get("lang", "ru")
    await update.message.reply_text(tx(lang, "ask_extra"))
    return EXTRA


async def received_extra(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Qo'shimcha olindi — tasdiqlash so'rash."""
    context.user_data["extra"] = update.message.text
    return await _show_confirmation(update, context)


async def skip_extra(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """/skip buyrug'i — qo'shimcha yo'q, tasdiqlash."""
    context.user_data["extra"] = ""
    return await _show_confirmation(update, context)


async def _show_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Yakuniy xabarni ko'rsatadi va tasdiqlash so'raydi."""
    lang = context.user_data.get("lang", "ru")
    topic = context.user_data.get("topic", "")
    desc = context.user_data.get("description", "")
    extra = context.user_data.get("extra", "")

    summary = f"📌 *{topic}*\n{desc}"
    if extra:
        summary += f"\n\n{extra}"
    context.user_data["summary"] = summary

    kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton(tx(lang, "send_yes"), callback_data="studio_confirm"),
            InlineKeyboardButton(tx(lang, "send_no"), callback_data="studio_cancel"),
        ]
    ])
    await update.message.reply_text(
        tx(lang, "confirm").format(summary=summary),
        reply_markup=kb,
        parse_mode="Markdown",
    )
    return ConversationHandler.END


async def studio_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Tasdiqlash yoki bekor qilish tugmasi."""
    query = update.callback_query
    await query.answer()
    lang = context.user_data.get("lang", "ru")

    if query.data == "studio_cancel":
        await query.edit_message_text(tx(lang, "cancelled"))
        context.user_data.clear()
        return

    # Tasdiqlandi — backendga yuborish
    user = update.effective_user
    topic = context.user_data.get("topic", "")
    desc = context.user_data.get("description", "")
    extra = context.user_data.get("extra", "")
    full_text = f"[{topic}] {desc}"
    if extra:
        full_text += f" | {extra}"

    token = await _get_user_token(user.id, user.username, user.full_name)
    if not token:
        await query.edit_message_text(tx(lang, "sent_fail"))
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERNAL_API_URL}/messages/text",
                json={"city": "global", "text": full_text, "lang": lang},
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
        if resp.status_code == 200:
            pts = resp.json().get("points", 0)
            await query.edit_message_text(
                tx(lang, "sent_ok").format(points=float(pts)),
                parse_mode="Markdown",
            )
        elif resp.status_code == 402:
            pts = resp.json().get("detail", {}).get("points", 0)
            await query.edit_message_text(
                tx(lang, "no_points").format(points=float(pts))
            )
        else:
            await query.edit_message_text(tx(lang, "sent_fail"))
    except Exception as exc:
        log.warning("studio send failed: %s", exc)
        await query.edit_message_text(tx(lang, "sent_fail"))

    context.user_data.clear()


async def cancel_studio(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """/cancel — so'rovnomani to'xtatish."""
    lang = context.user_data.get("lang", "ru")
    await update.message.reply_text(
        tx(lang, "cancelled"),
        reply_markup=ReplyKeyboardRemove(),
    )
    context.user_data.clear()
    return ConversationHandler.END


# ============================================================
# /radio — efir holati
# ============================================================
async def radio(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    lang = await _get_user_lang(update.effective_user.id)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{INTERNAL_API_URL}/radio/status",
                params={"city": "global"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            log.warning("status failed: %s", exc)
            await update.message.reply_text("⚠️ Efir holati aniqlanmadi.")
            return

    if data.get("is_live"):
        btype = data.get("broadcaster_type")
        who = "🤖 AI" if btype == "ai" else f"🔴 {data.get('broadcaster_name', 'LIVE')}"
        text = tx(lang, "radio_live").format(who=who, cnt=data.get("listeners_count", 0))
    else:
        text = tx(lang, "radio_off")

    await update.message.reply_text(text, parse_mode="Markdown")


# ============================================================
# /profile — foydalanuvchi profili (TZ §1: real telegram_id)
# ============================================================
ROLE_DISPLAY = {
    "listener":   {"ru": "Слушатель", "en": "Listener", "lt": "Klausytojas"},
    "aktivniy":   {"ru": "Активный",  "en": "Active",   "lt": "Aktyvus"},
    "doverenniy": {"ru": "Доверенный","en": "Trusted",   "lt": "Patikimas"},
    "admin":      {"ru": "Администратор","en": "Admin",  "lt": "Administratorius"},
}

FOCUS_DISPLAY = {
    "vnutrenniy": {"ru": "Внутренний", "en": "Internal",  "lt": "Vidinis"},
    "vneshniy":   {"ru": "Внешний",    "en": "External",  "lt": "Išorinis"},
}

TONE_DISPLAY = {
    "optimist":   {"ru": "Оптимист",   "en": "Optimist",  "lt": "Optimistas"},
    "melanxolik": {"ru": "Меланхолик", "en": "Melancholic","lt": "Melancholikas"},
    "ratsional":  {"ru": "Рационал",   "en": "Rational",  "lt": "Racionalistas"},
}


async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    lang = await _get_user_lang(user.id)
    token = await _get_user_token(user.id, user.username, user.full_name)

    if not token:
        await update.message.reply_text("⚠️ Profil yuklanmadi.")
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{INTERNAL_API_URL}/users/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            resp.raise_for_status()
            d = resp.json()
    except Exception as exc:
        log.warning("profile fetch failed: %s", exc)
        await update.message.reply_text("⚠️ Profil yuklanmadi.")
        return

    role_key = d.get("role", "listener")
    role_name = ROLE_DISPLAY.get(role_key, {}).get(lang, role_key)

    text = tx(lang, "profile_text").format(
        tg_id=user.id,          # TZ §1: real Telegram ID
        role=role_name,
        points=f"{float(d.get('points', 0)):.4f}",
        level=d.get("level", 1),
    )

    # TZ §4: psixotip mavjud bo'lsa ko'rsatish
    focus = d.get("focus_of_attention")
    tone = d.get("emotional_tone")
    if focus and tone:
        focus_name = FOCUS_DISPLAY.get(focus, {}).get(lang, focus)
        tone_name = TONE_DISPLAY.get(tone, {}).get(lang, tone)
        text += tx(lang, "psycho").format(focus=focus_name, tone=tone_name)

    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=webapp_keyboard())


# ============================================================
# /admin
# ============================================================
async def admin_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("🔒 Faqat adminlar uchun.")
        return
    kb = InlineKeyboardMarkup(
        [[InlineKeyboardButton("🛠 Admin panel", web_app=WebAppInfo(url=_admin_url()))]]
    )
    await update.message.reply_text(
        "🛠 *Admin panel*\n\nModerasiya va efir boshqaruvi.",
        reply_markup=kb,
        parse_mode="Markdown",
    )


# ============================================================
# /help
# ============================================================
async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    lang = await _get_user_lang(update.effective_user.id)
    await update.message.reply_text(tx(lang, "help_text"), parse_mode="Markdown")


# ============================================================
# MNENIYA (fikr) qabul qilish — guruhda matn/ovoz (Boss talabi)
# Bot guruhda kelgan xabarlarni ushlab, point yechib, saqlaydi.
# Telegram resursi ishlatiladi (fayl serverga yuklanmaydi).
# ============================================================

# Narxlar (point)
OPINION_COST_TEXT = 0.001
OPINION_COST_VOICE = 0.005


async def topic_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/topic — joriy efir mavzusini ko'rsatadi."""
    user = update.effective_user
    lang = await _get_user_lang(user.id)
    token = await _get_user_token(user.id, user.username, user.full_name)
    if not token:
        await update.message.reply_text("⚠️ Xatolik. /start bosing.")
        return
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{INTERNAL_API_URL}/opinions/current-topic",
                headers={"Authorization": f"Bearer {token}"},
                timeout=8,
            )
            data = resp.json() if resp.status_code == 200 else {}
    except Exception:
        data = {}

    topic = (data or {}).get("topic")
    no_topic = {
        "ru": "📭 Сейчас нет активной темы. Скоро откроется новая!",
        "en": "📭 No active topic now. A new one is coming soon!",
        "lt": "📭 Šiuo metu nėra aktyvios temos.",
    }
    head = {"ru": "🎙 Тема эфира", "en": "🎙 Broadcast topic", "lt": "🎙 Eterio tema"}
    cnt = {"ru": "мнений собрано", "en": "opinions", "lt": "nuomonių"}
    hint = {
        "ru": "Отправьте своё мнение в группу — текстом или голосом.",
        "en": "Send your opinion to the group — text or voice.",
        "lt": "Siųskite nuomonę į grupę — tekstu ar balsu.",
    }
    if not topic:
        await update.message.reply_text(no_topic.get(lang, no_topic["ru"]))
        return
    text = (
        f"*{head.get(lang, head['ru'])}*\n\n"
        f"📌 *{topic['title']}*\n"
        f"{topic.get('description', '')}\n\n"
        f"👥 {topic.get('opinion_count', 0)} {cnt.get(lang, cnt['ru'])}\n\n"
        f"_{hint.get(lang, hint['ru'])}_"
    )
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=webapp_keyboard())


async def _save_opinion(user_id: int, telegram_id: int, kind: str,
                        text: str | None, tg_file_id: str | None,
                        tg_message_id: int, cost: float) -> dict | None:
    """Backend API orqali opinion saqlaydi va point yechadi."""
    token = await _get_user_token(telegram_id, None, None)
    if not token:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERNAL_API_URL}/opinions/save",
                json={
                    "kind": kind,
                    "text": text,
                    "tg_file_id": tg_file_id,
                    "tg_message_id": tg_message_id,
                    "cost": cost,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 402:
                return {"error": "insufficient_points"}
    except Exception as exc:
        log.warning("opinion save failed: %s", exc)
    return None


async def opinion_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Guruhda kelgan MATN xabarni 'mneniya' sifatida saqlaydi."""
    msg = update.message
    if not msg or not msg.text:
        return
    user = update.effective_user
    result = await _save_opinion(
        user_id=0,  # backend o'zi aniqlaydi (token orqali)
        telegram_id=user.id,
        kind="text",
        text=msg.text,
        tg_file_id=None,
        tg_message_id=msg.message_id,
        cost=OPINION_COST_TEXT,
    )
    if result and result.get("error") == "insufficient_points":
        # Point yetmasa — jim qolasiz (guruhda spam bo'lmasin)
        pass


async def opinion_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Guruhda kelgan OVOZLI xabarni 'mneniya' sifatida saqlaydi."""
    msg = update.message
    if not msg:
        return
    voice = msg.voice or msg.audio
    if not voice:
        return
    user = update.effective_user
    result = await _save_opinion(
        user_id=0,
        telegram_id=user.id,
        kind="voice",
        text=None,
        tg_file_id=voice.file_id,
        tg_message_id=msg.message_id,
        cost=OPINION_COST_VOICE,
    )
    if result and result.get("error") == "insufficient_points":
        pass


# ============================================================
# VOICE CHAT boshqaruvi (modarator) — Boss talabi
# Telegram guruh Voice Chat: efirni boshlash, mikrofon berish/olish.
# Faqat adminlar uchun. Backend /voice/* endpointlariga ulanadi.
# ============================================================

async def _voice_api(method: str, path: str, telegram_id: int,
                     username: str | None, full_name: str | None,
                     json_body: dict | None = None) -> tuple[int, dict]:
    """Admin JWT bilan /voice/* endpointiga so'rov yuboradi."""
    token = await _get_user_token(telegram_id, username, full_name)
    if not token:
        return 0, {"detail": "auth failed"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                method,
                f"{INTERNAL_API_URL}{path}",
                json=json_body,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            try:
                data = resp.json()
            except Exception:
                data = {}
            return resp.status_code, data
    except Exception as exc:
        log.warning("voice_api %s %s failed: %s", method, path, exc)
        return 0, {"detail": str(exc)}


async def efir_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/efir — Voice Chat efir holatini ko'rsatadi (admin uchun boshqaruv)."""
    user = update.effective_user
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("🔒 Faqat adminlar uchun.")
        return

    code, data = await _voice_api("GET", "/voice/status", user.id, user.username, user.full_name)
    if code != 200:
        await update.message.reply_text("⚠️ Voice Chat holati aniqlanmadi.")
        return

    configured = data.get("configured")
    in_call = data.get("in_call")

    if not configured:
        await update.message.reply_text(
            "🎙 *Voice Chat — Sozlanmagan*\n\n"
            "Userbot session yo'q (`TG_SESSION_STRING`).\n"
            "Efir uchun avval session yaratish kerak:\n"
            "`python backend/scripts/gen_session.py`\n\n"
            "Session olingach `.env` ga qo'shing va backendni qayta ishga tushiring.",
            parse_mode="Markdown",
        )
        return

    status_txt = "🔴 EFIRDA" if in_call else "⚪️ To'xtagan"
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("▶️ Efirni boshlash", callback_data="efir_join"),
         InlineKeyboardButton("⏹ To'xtatish", callback_data="efir_leave")],
    ])
    await update.message.reply_text(
        f"🎙 *Voice Chat boshqaruvi*\n\nHolat: {status_txt}\n\n"
        "Mikrofon berish: `/mic <user_id>`\n"
        "Mikrofon olish: `/mute <user_id>`",
        reply_markup=kb,
        parse_mode="Markdown",
    )


async def efir_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Efir boshlash/to'xtatish tugmalari."""
    query = update.callback_query
    await query.answer()
    user = update.effective_user
    if user.id not in ADMIN_IDS:
        return

    if query.data == "efir_join":
        code, data = await _voice_api("POST", "/voice/join", user.id, user.username, user.full_name, {"audio_url": None})
        if code == 200:
            await query.edit_message_text("🔴 Efir boshlandi! Voice Chat'ga ulandi.")
        elif code == 503:
            await query.edit_message_text("⚠️ Voice Chat sozlanmagan (session yo'q).")
        else:
            await query.edit_message_text(f"⚠️ Ulanib bo'lmadi: {data.get('detail', 'xato')}")
    elif query.data == "efir_leave":
        code, data = await _voice_api("POST", "/voice/leave", user.id, user.username, user.full_name)
        if code == 200:
            await query.edit_message_text("⏹ Efir to'xtatildi.")
        else:
            await query.edit_message_text(f"⚠️ Xato: {data.get('detail', 'xato')}")


async def mic_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/mic <user_id> — ishtirokchiga mikrofon beradi (faqat level 2+)."""
    user = update.effective_user
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("🔒 Faqat adminlar uchun.")
        return
    if not context.args or not context.args[0].lstrip("-").isdigit():
        await update.message.reply_text("Foydalanish: `/mic <user_id>`", parse_mode="Markdown")
        return
    target_id = int(context.args[0])
    code, data = await _voice_api("POST", "/voice/grant-mic", user.id, user.username, user.full_name,
                                  {"user_telegram_id": target_id})
    if code == 200:
        await update.message.reply_text(f"🎤 Mikrofon berildi: `{target_id}`", parse_mode="Markdown")
    elif code == 403:
        await update.message.reply_text("❌ Bu foydalanuvchi level 2+ emas (efir huquqi yo'q).")
    else:
        await update.message.reply_text(f"⚠️ Xato: {data.get('detail', 'xato')}")


async def mute_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/mute <user_id> — ishtirokchidan mikrofonni oladi."""
    user = update.effective_user
    if user.id not in ADMIN_IDS:
        await update.message.reply_text("🔒 Faqat adminlar uchun.")
        return
    if not context.args or not context.args[0].lstrip("-").isdigit():
        await update.message.reply_text("Foydalanish: `/mute <user_id>`", parse_mode="Markdown")
        return
    target_id = int(context.args[0])
    code, data = await _voice_api("POST", "/voice/revoke-mic", user.id, user.username, user.full_name,
                                  {"user_telegram_id": target_id})
    if code == 200:
        await update.message.reply_text(f"🔇 Mikrofon olindi: `{target_id}`", parse_mode="Markdown")
    else:
        await update.message.reply_text(f"⚠️ Xato: {data.get('detail', 'xato')}")


# ============================================================
# Bot ishga tushirish
# ============================================================
async def _post_init(application: Application) -> None:
    try:
        await application.bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="📻 Radio", web_app=WebAppInfo(url=MINI_APP_URL)
            )
        )
        log.info("Menu button WebApp: %s", MINI_APP_URL)
    except Exception as exc:
        log.warning("menu button failed: %s", exc)


def main() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is not set")

    from telegram.request import HTTPXRequest

    request = HTTPXRequest(
        connect_timeout=30.0,
        read_timeout=30.0,
        write_timeout=30.0,
        pool_timeout=30.0,
    )
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .request(request)
        .get_updates_request(HTTPXRequest(connect_timeout=30.0, read_timeout=30.0))
        .post_init(_post_init)
        .build()
    )

    # TZ §3: Strukturali so'rovnoma uchun ConversationHandler
    studio_conv = ConversationHandler(
        entry_points=[CommandHandler("studio", studio_start)],
        states={
            TOPIC: [MessageHandler(filters.TEXT & ~filters.COMMAND, received_topic)],
            DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, received_description)],
            EXTRA: [
                CommandHandler("skip", skip_extra),
                MessageHandler(filters.TEXT & ~filters.COMMAND, received_extra),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel_studio)],
        per_user=True,
        per_chat=True,
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(studio_conv)
    app.add_handler(CallbackQueryHandler(studio_callback, pattern="^studio_"))
    app.add_handler(CommandHandler("radio", radio))
    app.add_handler(CommandHandler("topic", topic_cmd))
    app.add_handler(CommandHandler("buy", buy_cmd))
    app.add_handler(CommandHandler("profile", profile))
    app.add_handler(CommandHandler("admin", admin_cmd))
    app.add_handler(CommandHandler("help", help_cmd))

    # ── Voice Chat boshqaruvi (modarator/admin) — Boss talabi ──
    app.add_handler(CommandHandler("efir", efir_cmd))
    app.add_handler(CommandHandler("mic", mic_cmd))
    app.add_handler(CommandHandler("mute", mute_cmd))
    app.add_handler(CallbackQueryHandler(efir_callback, pattern="^efir_"))

    # ── Telegram Payments (point sotib olish) ──
    app.add_handler(CallbackQueryHandler(buy_callback, pattern="^buy_"))
    app.add_handler(PreCheckoutQueryHandler(precheckout_callback))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))

    # ── Guruhda mneniya (fikr) qabul qilish — matn va ovoz ──
    app.add_handler(MessageHandler(
        filters.ChatType.SUPERGROUP & filters.TEXT & ~filters.COMMAND,
        opinion_text,
    ))
    app.add_handler(MessageHandler(
        filters.ChatType.SUPERGROUP & (filters.VOICE | filters.AUDIO),
        opinion_voice,
    ))

    log.info("INTRA GROUP bot ishga tushdi. URL=%s", MINI_APP_URL)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
