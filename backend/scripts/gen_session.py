"""Pyrogram userbot SESSION STRING generatori — SMS majburlash bilan.

Kod APP (Telegram ilova) orqali kelmasa, SMS ga o'tkazadi.

Ishlatish:
    python backend/scripts/gen_session.py

So'raladi:
    1. Telefon raqam (+998..., +370...)
    2. Kod (APP yoki SMS) — kelmasa "sms" deb yozing, SMS qayta yuboriladi
    3. 2FA bo'lsa — parol

Natija: TG_SESSION_STRING=... → .env ga qo'ying.
"""

import asyncio
import os
import sys

API_ID = int(os.getenv("TG_API_ID", "31410856"))
API_HASH = os.getenv("TG_API_HASH", "aa66d34317e797c7b654fb634dc36ee8")


async def main():
    from pyrogram import Client
    from pyrogram.errors import (
        SessionPasswordNeeded, PhoneCodeInvalid, PhoneCodeExpired, FloodWait,
    )

    print("=" * 60)
    print("  SESSION STRING generatori (SMS majburlash bilan)")
    print("=" * 60)
    print(f"  api_id: {API_ID}  |  api_hash: {API_HASH[:8]}...")
    print("=" * 60)

    phone = input("\nTelefon raqam (+998...): ").strip()

    app = Client("gen", api_id=API_ID, api_hash=API_HASH, in_memory=True)
    await app.connect()

    # 1) Kod yuborish
    try:
        sent = await app.send_code(phone)
    except FloodWait as e:
        print(f"\n⏳ FLOOD WAIT: {e.value} sekund ({e.value//60} daqiqa) kuting.")
        await app.disconnect()
        return

    print(f"\n📨 Kod yuborildi. Tur: {sent.type}")
    print("   Telegram ilovangizdagi 'Telegram' (777000) chatiga qarang.")
    code_hash = sent.phone_code_hash

    while True:
        code = input(
            "\nKodni kiriting (kelmasa 'sms' deb yozing, SMS qayta yuboriladi): "
        ).strip()

        # SMS majburlash
        if code.lower() == "sms":
            try:
                sent = await app.resend_code(phone, code_hash)
                code_hash = sent.phone_code_hash
                print(f"📨 Qayta yuborildi. Tur: {sent.type}")
                continue
            except FloodWait as e:
                print(f"⏳ FLOOD WAIT: {e.value} sekund kuting.")
                continue

        # Kodni tekshirish
        try:
            await app.sign_in(phone, code_hash, code)
            break
        except SessionPasswordNeeded:
            pw = input("🔐 2FA parol: ").strip()
            await app.check_password(pw)
            break
        except PhoneCodeInvalid:
            print("❌ Kod noto'g'ri, qaytadan kiriting.")
            continue
        except PhoneCodeExpired:
            print("❌ Kod eskirdi. 'sms' yozing yoki skriptni qayta ishga tushiring.")
            continue

    session = await app.export_session_string()
    me = await app.get_me()
    await app.disconnect()

    print()
    print("=" * 60)
    print("✅ Muvaffaqiyatli! Akkaunt:", me.first_name,
          f"(@{me.username})" if me.username else "")
    print("=" * 60)
    print("\n── Quyidagi qatorni menga yuboring / .env ga qo'ying ──\n")
    print(f"TG_SESSION_STRING={session}")
    print("\n⚠️  Maxfiy — hech kimga bermang!")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBekor qilindi.")
        sys.exit(0)
