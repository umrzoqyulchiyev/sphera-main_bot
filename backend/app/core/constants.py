"""INTRA GROUP — konstantlar (single source of truth).

TZ §1 ROL MODELI:
  Level 1 — Слушатель  (slusatel):  faqat radio tinglash, chat read-only
  Level 2 — Активный   (aktivniy):  points bor → chat yoza oladi, studiyaga xabar yubora oladi
  Level 3 — Доверенный (doverenniy): admin tomonidan verifikatsiya → efirga chiqish huquqi

role maydoni:
  'listener'    → level 1 (hali points yo'q yoki kam)
  'aktivniy'    → level 2 (pointlar mavjud: >= AKTIVNIY_MIN_POINTS)
  'doverenniy'  → level 3 (admin qo'lda beradi, efirga chiqish huquqi)
  'admin'       → barcha huquqlar (ADMIN_IDS da)
"""

# ====== Level nomlari (TZ §1) ======
LEVELS: dict[int, str] = {
    1: "Слушатель",       # faqat tinglash
    2: "Активный",        # points bor → chat + studiya
    3: "Доверенный",      # admin verifikatsiya → efirga chiqish
}

# Role → level xaritasi (nechta huquq)
ROLE_LEVELS: dict[str, int] = {
    "listener":   1,
    "aktivniy":   2,
    "doverenniy": 3,
    "admin":      99,   # hammaga ruxsat
}

# ====== Level avtomatik ko'tarilish chegaralari ======
# Level 1→2: AKTIVNIY_MIN_POINTS dan ko'p point bo'lsa avtomatik
# Level 2→3: FAQAT admin beradi (doverenniy = trusted user)
AKTIVNIY_MIN_POINTS = 0.0001   # birinchi xabar yuborganda level 2 bo'ladi (points sarflaydi)
# (aslida: points > 0 bo'lsa aktivniy, admin bersa doverenniy)


def level_for_points(points_val) -> int:
    """Points miqdoriga qarab level hisoblaydi.

    Faqat 1 ↔ 2 o'tish avtomatik:
    - 0 points         → level 1 (Слушатель)
    - points > 0       → level 2 (Активный) — xabar yuborgan ≥ 1 ta transaktsiya bor
    Level 3 (Доверенный) faqat admin tomonidan beriladi, bu funksiya 3 ni qaytarmaydi.
    """
    p = float(points_val)
    if p > 0:
        return 2
    return 1


# ====== Tillar ======
SUPPORTED_LANGUAGES = {"ru", "en", "lt"}

# ====== Point narxlari (kasr) ======
COST_TEXT_MESSAGE  = 0.001    # 1 ta matn xabar studiyaga
COST_VOICE_MESSAGE = 0.005    # 1 ta ovozli xabar

# ====== Boshlang'ich point (ro'yxatdan o'tganda) ======
# TZ: birinchi odam uchun 0 bo'lishi kerak
INITIAL_POINTS = 0.0

# ====== Cost xaritasi (messages router uchun) ======
COST: dict[str, float] = {
    "chat":         0.001,   # chatga matn
    "chat_voice":   0.005,   # chatga ovoz
    "studio":       0.001,   # studiyaga matn
    "studio_voice": 0.005,   # studiyaga ovoz
}
