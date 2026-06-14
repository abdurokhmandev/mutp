import os
import sys
import django
import httpx

# Append darslik_backend to python path to resolve config and apps imports
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
try:
    django.setup()
except Exception as e:
    print("Django setup failed:", e)

from django.conf import settings
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove

dp = Dispatcher()

def format_phone(phone: str) -> str:
    """998901234567 → +998901234567"""
    phone = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not phone.startswith('+'):
        phone = '+' + phone
    return phone

async def save_or_update_telegram_user_api(chat_id, phone, username, first_name):
    # Try to get backend URL from env, else fallback to local/internal URLs
    backend_url = os.environ.get('BACKEND_API_URL', 'http://127.0.0.1:8000').rstrip('/')
    url = f"{backend_url}/api/auth/telegram-user/"
    
    headers = {
        'X-Bot-Token': settings.TELEGRAM_BOT_TOKEN,
        'Content-Type': 'application/json'
    }
    payload = {
        'chat_id': chat_id,
        'phone': phone,
        'username': username or '',
        'first_name': first_name or ''
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code == 200:
                print("Successfully updated user on backend API.")
                return True
            else:
                print(f"Backend API returned error {response.status_code}: {response.text}")
                return False
        except Exception as e:
            print(f"Connection to backend API failed at {url}: {e}")
            return False

@dp.message(Command("start"))
async def start_handler(message: types.Message):
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Telefon raqamimni ulashish", request_contact=True)]
        ],
        one_time_keyboard=True,
        resize_keyboard=True
    )
    await message.reply(
        "👋 Assalomu alaykum!\n\n"
        "MUTP platformasiga kirish uchun telefon raqamingizni ulashing.\n"
        "Shundan so'ng OTP kodlar shu chatga yuboriladi.",
        reply_markup=keyboard
    )

@dp.message(F.contact)
async def contact_handler(message: types.Message):
    contact = message.contact
    phone = format_phone(contact.phone_number)
    chat_id = message.chat.id

    success = await save_or_update_telegram_user_api(
        chat_id=chat_id,
        phone=phone,
        username=message.from_user.username or '',
        first_name=message.from_user.first_name or ''
    )

    if success:
        await message.reply(
            f"✅ Telefon raqam saqlandi: {phone}\n\n"
            "Endi MUTP saytiga o'tib, shu raqam bilan ro'yxatdan o'ting. "
            "OTP kod shu chatga yuboriladi!",
            reply_markup=ReplyKeyboardRemove()
        )
    else:
        await message.reply(
            "❌ Tizimda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.",
            reply_markup=ReplyKeyboardRemove()
        )

def run_bot():
    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    import asyncio
    asyncio.run(dp.start_polling(bot))
