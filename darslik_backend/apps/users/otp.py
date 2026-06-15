import random
import string
import asyncio
from django.core.cache import cache
from django.conf import settings
from aiogram import Bot

def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=settings.OTP_LENGTH))

def save_otp(phone: str, otp: str):
    key = f"otp:{phone}"
    cache.set(key, otp, timeout=settings.OTP_EXPIRE_SECONDS)

def verify_otp(phone: str, otp: str) -> bool:
    key = f"otp:{phone}"
    saved = cache.get(key)
    if saved and str(saved).strip() == str(otp).strip():
        cache.delete(key)  # Single use
        return True
    return False

def format_phone(phone: str) -> str:
    """998901234567 → +998901234567"""
    phone = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not phone.startswith('+'):
        phone = '+' + phone
    return phone

async def send_otp_telegram_async(chat_id: int, otp: str):
    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    try:
        message = (
            f"🔐 MUTP tasdiqlash kodi\n\n"
            f"Sizning kodingiz: <b>{otp}</b>\n\n"
            f"⏱ Kod 5 daqiqa ichida amal qiladi.\n"
            f"Kodni hech kimga bermang!"
        )
        await bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='HTML'
        )
        await bot.session.close()
        return True
    except Exception as e:
        print("Telegram sending error:", e)
        await bot.session.close()
        return False

def send_otp(phone: str, otp: str) -> bool:
    from apps.users.models import TelegramUser
    from django.db.models import Q
    formatted = format_phone(phone)
    tg_user = TelegramUser.objects.filter(Q(phone=phone) | Q(phone=formatted)).first()
    if not tg_user:
        return False
    try:
        return asyncio.run(send_otp_telegram_async(tg_user.chat_id, otp))
    except Exception as e:
        print("Failed to run send_otp_telegram_async:", e)
        return False
