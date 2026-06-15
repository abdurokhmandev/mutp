from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Telegram botni ishga tushirish'

    def handle(self, *args, **options):
        from apps.bot.bot import run_bot
        self.stdout.write('Bot ishga tushdi...')
        run_bot()
