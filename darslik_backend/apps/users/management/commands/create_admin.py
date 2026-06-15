from django.core.management.base import BaseCommand
from apps.users.models import User

class Command(BaseCommand):
    help = 'Creates or resets the admin superuser'

    def handle(self, *args, **options):
        username = 'admin'
        email = 'admin@gmail.com'
        password = 'admin'
        first_name = 'admin'
        role = 'admin'

        User.objects.filter(username=username).delete()
        User.objects.filter(email=email).delete()

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            role=role
        )
        self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' created successfully!"))
