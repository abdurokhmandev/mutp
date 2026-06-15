# apps/notifications/utils.py
import httpx
from django.conf import settings

def send_telegram_notification(chat_id: str, message: str):
    """
    Sends a direct message using Telegram Bot API.
    Runs synchronously to fit within signals.
    """
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'HTML'
    }
    try:
        response = httpx.post(url, json=payload, timeout=5.0)
        return response.status_code == 200
    except Exception as e:
        print(f"Failed to send Telegram notification: {e}")
        return False
