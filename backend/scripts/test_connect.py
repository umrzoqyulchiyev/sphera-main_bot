Pyrogram Telegram serverga ulana oladimi va kod yubora oladimi.

Bu skript faqat ULANISH va KOD YUBORISH bosqichini tekshiradi (interaktiv emas).
"""
import asyncio
from pyrogram import Client
from pyrogram.errors import RPCError

API_ID = 34675038
API_HASH = "f2b589b21dee068b50d1b76c398cc9d0"
PHONE = "+998995543373"


async def main():
    app = Client("diag", api_id=API_ID, api_hash=API_HASH, in_memory=True)
    print("1) Telegram serverga ulanmoqda...")
    await app.connect()
    print("   ✅ Ulandi")

    print(f"2) Kod yuborish so'rovi ({PHONE})...")
    try:
        sent = await app.send_code(PHONE)
        print("   ✅ Kod yuborildi!")
        print("   Yetkazish turi:", sent.type)
        print("   (phone_code_hash:", sent.phone_code_hash[:10], "...)")
        print()
        print(">>> Kod qayerga keldi? Yetkazish turiga qarang:")
        print("    - 'SentCodeType.APP'  → Telegram ilovasiga (boshqa qurilma)")
        print("    - 'SentCodeType.SMS'  → SMS bilan")
        print("    - 'SentCodeType.CALL' → qo'ng'iroq bilan")
    except RPCError as e:
        print("   ❌ XATO:", type(e).__name__, "-", e)
    finally:
        await app.disconnect()


asyncio.run(main())
