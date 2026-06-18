import json

from app.services import gemini

PSYCHOTYPE_PROMPT = """Quyidagi xabarni tahlil qil.
FAQAT JSON qaytar, boshqa narsa yozma:
{{
  "focus_of_attention": "vnutrenniy" | "vneshniy",
  "emotional_tone": "optimist" | "melanxolik" | "ratsional",
  "key_topic": "1-3 so'z",
  "priority_score": 1-10
}}
Xabar: "{text}"
"""

_VALID_FOCUS = {"vnutrenniy", "vneshniy"}
_VALID_TONE = {"optimist", "melanxolik", "ratsional"}

# Gemini yo'q bo'lsa — kalit so'zlar bo'yicha taxminiy kayfiyat aniqlash
_OPTIMIST_WORDS = [
    "счаст", "рад", "ура", "отличн", "прекрасн", "класс", "супер", "люблю",
    "здорово", "позитив", "весел", "хорош", "спасибо", "благодар", "круто",
    "восторг", "замечательн", "yaxshi", "zo'r", "rahmat", "ajoyib", "xursand",
]
_MELANXOLIK_WORDS = [
    "груст", "одинок", "тяжел", "плохо", "печал", "устал", "боль", "слёз",
    "слез", "депресс", "страх", "трудно", "обид", "разочаров", "тоск",
    "yomon", "qiyin", "charchadim", "yolg'iz", "g'amgin", "xafa",
]
_INNER_WORDS = [
    "чувству", "думаю", "мне", "себя", "душ", "внутри", "переживаю",
    "ощущаю", "o'zim", "his", "ichim",
]


def _keyword_fallback(text: str) -> dict:
    """Gemini yo'q bo'lganда kalit so'zlar orqali taxminiy psixotip."""
    t = (text or "").lower()

    opt = sum(1 for w in _OPTIMIST_WORDS if w in t)
    mel = sum(1 for w in _MELANXOLIK_WORDS if w in t)

    if mel > opt:
        tone = "melanxolik"
    elif opt > 0:
        tone = "optimist"
    else:
        tone = "ratsional"

    inner = sum(1 for w in _INNER_WORDS if w in t)
    focus = "vnutrenniy" if inner > 0 else "vneshniy"

    # Birinchi mazmunli so'z — mavzu sifatida
    words = [w for w in t.split() if len(w) > 3]
    topic = words[0][:30] if words else "obshchee"

    score = 7 if tone == "melanxolik" else 5

    return {
        "focus_of_attention": focus,
        "emotional_tone": tone,
        "key_topic": topic,
        "priority_score": score,
    }


async def analyze(text: str) -> dict:
    prompt = PSYCHOTYPE_PROMPT.format(text=text.replace('"', "'"))
    used_fallback = False
    try:
        data = await gemini.generate_json(prompt)
    except Exception:
        # Gemini ishlamadi — kalit so'z fallback
        data = _keyword_fallback(text)
        used_fallback = True
    result = _normalize(data)
    result["_source"] = "keywords" if used_fallback else "gemini"
    return result


def _normalize(data: dict) -> dict:
    focus = data.get("focus_of_attention")
    if focus not in _VALID_FOCUS:
        focus = "vneshniy"

    tone = data.get("emotional_tone")
    if tone not in _VALID_TONE:
        tone = "ratsional"

    key_topic = (data.get("key_topic") or "obshchee").strip()[:100]

    try:
        score = int(data.get("priority_score", 5))
    except (TypeError, ValueError):
        score = 5
    score = max(1, min(10, score))

    return {
        "focus_of_attention": focus,
        "emotional_tone": tone,
        "key_topic": key_topic,
        "priority_score": score,
        "raw_json": json.dumps(data, ensure_ascii=False),
    }
