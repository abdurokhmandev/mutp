import os
import django

# Initialize Django settings inside bot process if it's run standalone
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
try:
    django.setup()
except Exception:
    pass

from django.conf import settings
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from apps.users.models import TelegramUser
from asgiref.sync import sync_to_async

dp = Dispatcher()

def format_phone(phone: str) -> str:
    """998901234567 → +998901234567"""
    phone = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not phone.startswith('+'):
        phone = '+' + phone
    return phone

@sync_to_async
def save_or_update_telegram_user(chat_id, phone, username, first_name):
    tg_user, created = TelegramUser.objects.update_or_create(
        chat_id=chat_id,
        defaults={
            'phone': phone,
            'username': username or '',
            'first_name': first_name or '',
        }
    )
    return tg_user, created

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

    await save_or_update_telegram_user(
        chat_id=chat_id,
        phone=phone,
        username=message.from_user.username or '',
        first_name=message.from_user.first_name or ''
    )

    await message.reply(
        f"✅ Telefon raqam saqlandi: {phone}\n\n"
        "Endi MUTP saytiga o'tib, shu raqam bilan ro'yxatdan o'ting. "
        "OTP kod shu chatga yuboriladi!",
        reply_markup=ReplyKeyboardRemove()
    )

def run_bot():
    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    import asyncio
    asyncio.run(dp.start_polling(bot))
