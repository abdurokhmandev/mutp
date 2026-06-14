import sys
import os
from django.core.management.base import BaseCommand

# Append workspace root directory to python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
sys.path.append(ROOT_DIR)

from telegram_bot.bot import run_bot

class Command(BaseCommand):
    help = 'Telegram OTP botni ishga tushirish'

    def handle(self, *args, **options):
        self.stdout.write('Bot ishga tushmoqda...')
        run_bot()

