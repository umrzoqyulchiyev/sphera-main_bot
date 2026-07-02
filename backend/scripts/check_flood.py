"""Flood wait tekshiruvi — Telegram kod so'rovini bloklaganmi."""
import asyncio
from pyrogram import Client
from pyrogram.errors import RPCError, FloodWait

API_ID = 34675038
API_HASH = "f2b589b21dee068b50d1b76c398cc9d0"
PHONE = "+998995543373"


async def main():
    app = Client("flood_check", api_id=API_ID, api_hash=API_HASH, in_memory=True)
    await app.connect()
    try:
        sent = await app.send_code(PHONE)
        print("✅ Kod yuborildi. Tur:", sent.type)
        print("Endi gen_session ishlatmang — shu hash bilan kodni kiriting.")
    except FloodWait as e:
        print(f"⏳ FLOOD WAIT: {e.value} sekund kutish kerak ({e.value//60} daqiqa)")
    except RPCError as e:
        print("❌ XATO:", type(e).__name__, "-", e)
    finally:
        await app.disconnect()


asyncio.run(main())
