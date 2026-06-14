from django.core.management.base import BaseCommand
from telegram_bot.bot import run_bot

class Command(BaseCommand):
    help = 'Telegram OTP botni ishga tushirish'

    def handle(self, *args, **options):
        self.stdout.write('Bot ishga tushmoqda...')
        run_bot()

