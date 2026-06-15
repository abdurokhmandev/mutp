# apps/bot/bot.py
# MUHIM: Django ni avval yuklash kerak
import django
import os
import sys

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(PROJECT_ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from telegram import Update, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes
)
from django.conf import settings
from apps.users.models import PhoneOTP, User, TelegramUser
from apps.users.utils import normalize_phone


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /start buyrug'i ikki holda keladi:

    1. Saytdan yo'naltirilganda:
       /start 998901234567
       → Raqam argument sifatida keladi
       → Bazadan kodni topib yuboradi

    2. Oddiy /start (foydalanuvchi o'zi kirganda):
       /start
       → Raqam so'raydi (contact button bilan)
    """
    args = context.args

    if args:
        # Saytdan yo'naltirilgan holat
        phone = normalize_phone(args[0])
        await send_otp_to_user(update, context, phone)
    else:
        # Oddiy kirish — raqam so'rash
        await ask_for_phone(update)


async def ask_for_phone(update: Update):
    """
    Foydalanuvchidan raqam so'raydi.
    "📱 Raqamimni yuborish" tugmasi — Telegram contact_button.
    Bosiganda raqam avtomatik bot ga ketadi.
    """
    button = KeyboardButton(
        text="📱 Raqamimni yuborish",
        request_contact=True  # ← shu qator contact yuborishni so'raydi
    )
    keyboard = ReplyKeyboardMarkup(
        [[button]],
        resize_keyboard=True,
        one_time_keyboard=True  # Yuborilgandan keyin tugma yo'qoladi
    )
    await update.message.reply_text(
        "Salom! 👋\n\n"
        "EduUz ga kirish uchun telefon raqamingizni yuboring.\n\n"
        "Quyidagi tugmani bosing:",
        reply_markup=keyboard
    )


async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Foydalanuvchi "📱 Raqamimni yuborish" bosganida.
    Telegram contact obyektini qabul qiladi.
    """
    contact = update.message.contact
    phone = normalize_phone(contact.phone_number)
    await send_otp_to_user(update, context, phone)


from asgiref.sync import sync_to_async


@sync_to_async
def get_active_otp(phone):
    try:
        return PhoneOTP.objects.filter(
            phone=phone,
            is_used=False
        ).order_by('-created_at').first()
    except Exception as e:
        print("Error getting active OTP:", e)
        return None


@sync_to_async
def update_or_create_tg_user(chat_id, phone, username, first_name):
    try:
        return TelegramUser.objects.update_or_create(
            chat_id=chat_id,
            defaults={
                'phone': phone,
                'username': username,
                'first_name': first_name,
            }
        )
    except Exception as e:
        print("Error updating or creating telegram user:", e)
        return None


@sync_to_async
def link_telegram_id(phone, telegram_id):
    try:
        return User.objects.filter(phone=phone).update(
            telegram_id=telegram_id
        )
    except Exception as e:
        print("Error linking telegram id:", e)
        return 0


async def send_otp_to_user(update: Update, context, phone: str):
    """
    Berilgan raqam uchun OTP topib yuboradi.
    """
    telegram_id = str(update.effective_user.id)
    username = update.effective_user.username or ''
    first_name = update.effective_user.first_name or ''

    # Bazadan faol OTP topish
    otp = await get_active_otp(phone)

    # Avval TelegramUser jadvaliga saqlab qo'yamiz/yangilaymiz kelajakda link qilish uchun
    await update_or_create_tg_user(
        chat_id=update.effective_user.id,
        phone=phone,
        username=username,
        first_name=first_name
    )

    if otp and otp.is_valid:
        # Telegram ID ni saqlash (kelajakda notification uchun)
        await link_telegram_id(phone, telegram_id)

        # Kodni chiroyli formatda yuborish
        code_display = ' '.join(list(otp.code))
        # "482931" → "4 8 2 9 3 1" (o'qish oson bo'lsin)

        await update.message.reply_text(
            f"✅ EduUz kirish kodi:\n\n"
            f"<b>{code_display}</b>\n\n"
            f"⏱ Kod 5 daqiqa amal qiladi.\n"
            f"🔒 Bu kodni hech kimga bermang!\n\n"
            f"Saytga qaytib kodni kiriting.",
            parse_mode='HTML'
        )
    else:
        # OTP yo'q yoki muddati o'tgan
        await update.message.reply_text(
            "❌ Bu raqam uchun faol kod topilmadi.\n\n"
            "Saytga qaytib, <b>\"Kod olish\"</b> "
            "tugmasini qayta bosing.",
            parse_mode='HTML'
        )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Foydalanuvchi matn yuborganda (raqam yozsa ham ishlaydi).
    """
    text = update.message.text.strip()

    # Raqam yuborganmi?
    cleaned = text.replace('+', '').replace(' ', '').replace('-', '')
    if cleaned.isdigit() and len(cleaned) >= 9:
        phone = normalize_phone(cleaned)
        await send_otp_to_user(update, context, phone)
    else:
        await update.message.reply_text(
            "Telefon raqamingizni yuboring yoki\n"
            "quyidagi tugmani bosing:",
        )
        await ask_for_phone(update)


def run_bot():
    """Botni ishga tushirish (to'xtamaydigan jarayon)"""
    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()

    # /start buyrug'i
    app.add_handler(CommandHandler('start', start))

    # Contact (raqam) yuborilganda
    app.add_handler(MessageHandler(filters.CONTACT, handle_contact))

    # Matn yuborilganda
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        handle_text
    ))

    print("Bot ishga tushdi...")
    app.run_polling()


if __name__ == '__main__':
    run_bot()
