# apps/bot/bot.py
import os
import httpx
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes
)

# Get environment variables
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN')
BACKEND_API_URL = os.environ.get('BACKEND_API_URL', 'http://127.0.0.1:8000').rstrip('/')
if BACKEND_API_URL and not BACKEND_API_URL.startswith(('http://', 'https://')):
    BACKEND_API_URL = 'https://' + BACKEND_API_URL

def normalize_phone(phone: str) -> str:
    """Format phone number to standard format"""
    phone = str(phone).replace('+', '').replace(' ', '').replace('-', '')
    if phone.startswith('0'):
        phone = '998' + phone[1:]
    if not phone.startswith('998'):
        phone = '998' + phone
    return phone[:12]


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /start command handler
    """
    args = context.args

    if args:
        # Referred from site with phone argument
        phone = normalize_phone(args[0])
        await send_otp_to_user(update, context, phone)
    else:
        # Normal entry, ask for phone
        await ask_for_phone(update)


async def ask_for_phone(update: Update):
    """
    Request contact sharing from user
    """
    button = KeyboardButton(
        text="📱 Raqamimni yuborish",
        request_contact=True
    )
    keyboard = ReplyKeyboardMarkup(
        [[button]],
        resize_keyboard=True,
        one_time_keyboard=True
    )
    await update.message.reply_text(
        "Salom! 👋\n\n"
        "EduUz ga kirish uchun telefon raqamingizni yuboring.\n\n"
        "Quyidagi tugmani bosing:",
        reply_markup=keyboard
    )


async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle Telegram contact object
    """
    contact = update.message.contact
    phone = normalize_phone(contact.phone_number)
    await send_otp_to_user(update, context, phone)


async def send_otp_to_user(update: Update, context, phone: str):
    """
    Request OTP from Backend API and display it
    """
    telegram_id = str(update.effective_user.id)
    username = update.effective_user.username or ''
    first_name = update.effective_user.first_name or ''

    # Call Backend API
    url = f"{BACKEND_API_URL}/api/v1/auth/bot/get-otp/"
    headers = {
        'X-Bot-Token': BOT_TOKEN,
        'Content-Type': 'application/json'
    }
    payload = {
        'phone': phone,
        'telegram_id': telegram_id,
        'username': username,
        'first_name': first_name
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            if response.status_code == 200:
                res_data = response.json()
                if res_data.get('success'):
                    code = res_data['data']['code']
                    code_display = ' '.join(list(code))
                    await update.message.reply_text(
                        f"✅ EduUz kirish kodi:\n\n"
                        f"<b>{code_display}</b>\n\n"
                        f"⏱ Kod 5 daqiqa amal qiladi.\n"
                        f"🔒 Bu kodni hech kimga bermang!\n\n"
                        f"Saytga qaytib kodni kiriting.",
                        parse_mode='HTML'
                    )
                    return
            
            # If failed or not found
            await update.message.reply_text(
                "❌ Bu raqam uchun faol kod topilmadi.\n\n"
                "Saytga qaytib, <b>\"Kod olish\"</b> "
                "tugmasini qayta bosing.",
                parse_mode='HTML'
            )
        except Exception as e:
            print(f"Failed to connect to backend: {e}")
            await update.message.reply_text(
                "❌ Server bilan ulanishda xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring."
            )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle raw text inputs
    """
    text = update.message.text.strip()
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
    """Start polling"""
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(MessageHandler(filters.CONTACT, handle_contact))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    print("Bot ishga tushdi...")
    app.run_polling()


if __name__ == '__main__':
    run_bot()
