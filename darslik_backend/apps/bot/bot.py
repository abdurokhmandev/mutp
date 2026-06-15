import os
import django

# Setup Django before importing models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from telegram import Update
from telegram.ext import Application, CommandHandler
from django.conf import settings
from apps.users.models import PhoneOTP, User


async def start(update: Update, context):
    args = context.args
    if not args:
        await update.message.reply_text(
            "Salom! Men EduUz botiman.\n"
            "Saytdan kod olish uchun foydalaning."
        )
        return

    phone = normalize_phone(args[0])
    otp = PhoneOTP.objects.filter(
        phone=phone, is_used=False
    ).order_by('-created_at').first()

    if otp and otp.is_valid:
        # telegram_id ni saqlash (notification uchun)
        telegram_id = str(update.effective_user.id)
        User.objects.filter(phone=phone).update(telegram_id=telegram_id)

        await update.message.reply_text(
            f"EduUz — Kirish kodi\n\n"
            f"{otp.code}\n\n"
            f"Kod 5 daqiqa amal qiladi.\n"
            f"Bu kodni hech kimga bermang!"
        )
    else:
        await update.message.reply_text(
            "Kod topilmadi yoki muddati o'tgan.\n"
            "Saytga qaytib, yangi kod so'rang."
        )


def normalize_phone(phone: str) -> str:
    phone = phone.replace('+', '').replace(' ', '').replace('-', '')
    if not phone.startswith('998'):
        phone = '998' + phone.lstrip('0').lstrip('8')
    return phone[:12]


def run_bot():
    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.run_polling()
