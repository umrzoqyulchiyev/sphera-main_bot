import os
import json
import re
import asyncio

GEMINI_KEY = os.getenv("GEMINI_KEY", "")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_configured = False
_genai = None


def _ensure_configured():
    """google-generativeai ni lazy import qiladi (paket bo'lmasa xato bermaydi)."""
    global _configured, _genai
    if _genai is None:
        import google.generativeai as genai  # lazy
        _genai = genai
    if not _configured and GEMINI_KEY:
        _genai.configure(api_key=GEMINI_KEY)
        _configured = True
    return _genai


async def generate_text(prompt: str) -> str:
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_KEY is not set")
    genai = _ensure_configured()
    model = genai.GenerativeModel(MODEL_NAME)

    def _call() -> str:
        resp = model.generate_content(prompt)
        return (resp.text or "").strip()

    return await asyncio.to_thread(_call)


async def generate_json(prompt: str) -> dict:
    raw = await generate_text(prompt)
    cleaned = _strip_code_fence(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


# ============ Перевод сценария (multilang-studio-broadcast) ============
_LANG_NAMES = {"ru": "русский", "lt": "литовский", "en": "английский"}

TRANSLATE_PROMPT = """Переведи следующий радио-сценарий на {lang_name} язык.
Сохрани смысл, тон и стиль живого радио-эфира. Не добавляй пояснений,
комментариев или кавычек — верни ТОЛЬКО переведённый текст.

Текст:
{text}"""


async def translate(text: str, target_lang: str) -> str:
    """Переводит текст на target_lang (lt|en) через Gemini.

    Бросает исключение при сбое — вызывающая сторона использует фолбэк (RU-текст).
    """
    if target_lang == "ru" or not text.strip():
        return text
    lang_name = _LANG_NAMES.get(target_lang, target_lang)
    prompt = TRANSLATE_PROMPT.format(lang_name=lang_name, text=text)
    result = await generate_text(prompt)
    return _strip_code_fence(result).strip() or text
