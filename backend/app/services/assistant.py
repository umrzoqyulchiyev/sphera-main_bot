"""Bot-ssenarist va murojaatga AI javob (PDF talablari).

- Bot-ssenarist: murojaat yuborishdan oldin foydalanuvchi bilan suhbatlashib,
  uning mavzusini strukturalashtiradi.
- AI javob: yakuniy murojaatga radio uslubida matnli javob qaytaradi.
"""

from app.services import gemini

# Ssenarist: foydalanuvchi xabariga qarab keyingi savol yoki yakun
SCENARIST_PROMPT = """Sen Radio AI uchun ИИ-bot ssenaristisan.
Vazifang — tinglovchi murojaatini efirga tayyorlash uchun qisqa suhbat olib borish.

Suhbat tarixi:
{history}

Tinglovchining oxirgi xabari: "{message}"

Qoidalar:
- Agar mavzu hali aniq bo'lmasa — bitta qisqa aniqlovchi savol ber (rus tilida).
- Agar mavzu yetarlicha tushunarli bo'lsa — suhbatni yakunla.
- Maksimum 2-3 savoldan keyin albatta yakunla.

FAQAT JSON qaytar:
{{
  "done": true yoki false,
  "reply": "tinglovchiga javobing yoki savoling (rus tilida)",
  "summary": "agar done=true bo'lsa — murojaatning qisqa mazmuni, aks holda bo'sh"
}}"""

# Murojaatga radio uslubidagi AI javob (kayfiyatga moslashtirilgan)
ANSWER_PROMPT = """Sen Radio AI ИИ-boshlovchisisan.

Tinglovchining psixologik holati (LLM tahlilidan):
- Emotsional holat (emotional_tone): {tone}
- Diqqat yo'nalishi (focus_of_attention): {focus}
- Asosiy mavzu: {topic}

Tinglovchi quyidagi murojaatni yubordi:
"{text}"

Unga radio boshlovchi sifatida javob ber. MUHIM: javobing tinglovchining
emotsional holatiga MOS bo'lsin:
- "optimist" bo'lsa — quvnoq, energiyali, ruhlantiruvchi javob ber
- "melanxolik" bo'lsa — iliq, qo'llab-quvvatlovchi, hamdard javob ber
- "ratsional" bo'lsa — aniq, mazmunli, hurmatli javob ber

Qisqa (2-3 jumla), rus tilida, jonli radio uslubida. Faqat javob matnini qaytar."""

# Kayfiyatga mos fallback javoblar (Gemini yo'q bo'lsa)
_FALLBACK_BY_TONE = {
    "optimist": (
        "Какой заряд позитива! Спасибо за ваше яркое обращение — "
        "оно обязательно прозвучит в эфире. Оставайтесь на волне Radio AI!"
    ),
    "melanxolik": (
        "Спасибо, что поделились с нами. Мы вас услышали и обязательно "
        "озвучим ваше обращение в эфире. Вы не одни — Radio AI с вами."
    ),
    "ratsional": (
        "Благодарим за чёткое и содержательное обращение. "
        "Мы передадим его в эфир. Оставайтесь на волне Radio AI!"
    ),
}


def _format_history(history: list[dict]) -> str:
    if not history:
        return "(suhbat boshlanmagan)"
    lines = []
    for h in history:
        role = "Tinglovchi" if h.get("role") == "user" else "Bot"
        lines.append(f"{role}: {h.get('text', '')}")
    return "\n".join(lines)


async def scenarist_step(message: str, history: list[dict]) -> dict:
    """Bot-ssenarist: keyingi savol yoki yakun. Gemini yo'q bo'lsa fallback."""
    prompt = SCENARIST_PROMPT.format(
        history=_format_history(history),
        message=message.replace('"', "'"),
    )
    try:
        data = await gemini.generate_json(prompt)
        done = bool(data.get("done"))
        reply = (data.get("reply") or "").strip()
        summary = (data.get("summary") or "").strip()
        if not reply:
            reply = "Спасибо, ваше обращение принято!"
        return {"done": done, "reply": reply, "summary": summary or message}
    except Exception:
        # Fallback: bitta savoldan keyin yakunlaymiz
        turns = len([h for h in history if h.get("role") == "user"])
        if turns >= 1:
            return {
                "done": True,
                "reply": "Спасибо! Ваше обращение принято и скоро прозвучит в эфире.",
                "summary": message,
            }
        return {
            "done": False,
            "reply": "Расскажите подробнее: что именно вы хотите передать в эфир?",
            "summary": "",
        }


async def answer_message(text: str, psychotype: dict | None = None) -> str:
    """Murojaatga radio uslubidagi AI javob — tinglovchi KAYFIYATIGA moslashgan.

    PDF talabi: LLM kayfiyatni (emotional_tone) aniqlaydi va shunga qarab javob beradi.
    """
    pt = psychotype or {}
    tone = pt.get("emotional_tone", "ratsional")
    focus = pt.get("focus_of_attention", "vneshniy")
    topic = pt.get("key_topic", "общее")

    try:
        prompt = ANSWER_PROMPT.format(
            text=text.replace('"', "'"),
            tone=tone,
            focus=focus,
            topic=topic,
        )
        return await gemini.generate_text(prompt)
    except Exception:
        # Gemini yo'q — kayfiyatga mos tayyor javob
        return _FALLBACK_BY_TONE.get(tone, _FALLBACK_BY_TONE["ratsional"])
