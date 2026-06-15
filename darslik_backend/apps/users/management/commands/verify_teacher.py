from django.core.management.base import BaseCommand
from apps.users.models import User

class Command(BaseCommand):
    help = 'Verifies a teacher account by email or username'

    def add_arguments(self, parser):
        parser.add_argument('identifier', type=str, help='Email or Username of the teacher')

    def handle(self, *args, **options):
        identifier = options['identifier']
        user = User.objects.filter(email=identifier).first() or User.objects.filter(username=identifier).first()
        
        if not user:
            self.stdout.write(self.style.ERROR(f"User '{identifier}' not found."))
            return
            
        user.is_verified = True
        user.save(update_fields=['is_verified'])
        self.stdout.write(self.style.SUCCESS(f"Teacher '{user.email}' has been verified successfully!"))
