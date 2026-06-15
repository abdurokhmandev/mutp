import os
import httpx
from telegram import Update
from telegram.ext import Application, CommandHandler

# Get env vars
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN')
BACKEND_API_URL = os.environ.get('BACKEND_API_URL', 'http://127.0.0.1:8000').rstrip('/')
if BACKEND_API_URL and not BACKEND_API_URL.startswith(('http://', 'https://')):
    BACKEND_API_URL = 'https://' + BACKEND_API_URL

def normalize_phone(phone: str) -> str:
    phone = phone.replace('+', '').replace(' ', '').replace('-', '')
    if not phone.startswith('998'):
        phone = '998' + phone.lstrip('0').lstrip('8')
    return phone[:12]

async def save_or_update_telegram_user_api(chat_id, phone, username, first_name):
    url = f"{BACKEND_API_URL}/api/auth/telegram-user/"
    headers = {
        'X-Bot-Token': BOT_TOKEN,
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
                return True
            return False
        except Exception as e:
            print(f"Failed to connect to backend: {e}")
            return False

async def start(update: Update, context):
    args = context.args
    if not args:
        await update.message.reply_text(
            "Salom! Men MUTP botiman.\n"
            "Saytdan kod olish uchun foydalaning."
        )
        return

    phone = normalize_phone(args[0])
    chat_id = update.effective_user.id
    username = update.effective_user.username
    first_name = update.effective_user.first_name

    success = await save_or_update_telegram_user_api(chat_id, phone, username, first_name)
    if success:
        await update.message.reply_text(
            f"✅ Telefon raqamingiz ulandi: +{phone}\n\n"
            "Endi saytga qaytib, raqamingizni kiriting va kod oling. "
            "Tasdiqlash kodi shu chatga yuboriladi!"
        )
    else:
        await update.message.reply_text(
            "❌ Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring."
        )

def run_bot():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.run_polling()

if __name__ == '__main__':
    run_bot()
