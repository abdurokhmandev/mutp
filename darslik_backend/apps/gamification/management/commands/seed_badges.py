from django.core.management.base import BaseCommand
from apps.gamification.models import Badge


class Command(BaseCommand):
    help = "Boshlang'ich yutuqlarni (badges) yaratish"

    def handle(self, *args, **options):
        self.stdout.write("Boshlang'ich yutuqlar yaratilmoqda...")

        INITIAL_BADGES = [
            {
                'name': 'Birinchi qadam',
                'slug': 'first-step',
                'description': "Birinchi kursni muvaffaqiyatli tugatdi",
                'category': Badge.Category.PROGRESS,
                'trigger_type': 'first_course_completed',
                'icon': '🌱'
            },
            {
                'name': '7 kunlik izchillik',
                'slug': 'week-streak',
                'description': "7 kun ketma-ket o'qidi",
                'category': Badge.Category.STREAK,
                'trigger_type': 'streak_7',
                'icon': '🔥'
            },
            {
                'name': '30 kunlik sodiqlik',
                'slug': 'month-streak',
                'description': "30 kun ketma-ket o'qidi",
                'category': Badge.Category.STREAK,
                'trigger_type': 'streak_30',
                'icon': '👑'
            },
            {
                'name': "Bilim ishqibozi",
                'slug': 'knowledge-seeker',
                'description': "5 ta kursni muvaffaqiyatli tugatdi",
                'category': Badge.Category.PROGRESS,
                'trigger_type': 'courses_completed_5',
                'icon': '📚'
            },
            {
                'name': "Mukammal natija",
                'slug': 'perfect-score',
                'description': "Testdan 100% natija oldi",
                'category': Badge.Category.QUALITY,
                'trigger_type': 'quiz_perfect_score',
                'icon': '💯'
            },
        ]

        created_count = 0
        for b_data in INITIAL_BADGES:
            badge, created = Badge.objects.get_or_create(
                slug=b_data['slug'],
                defaults=b_data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Badge yaratildi: {badge.name}"))
            else:
                # Update defaults if changed
                badge.name = b_data['name']
                badge.description = b_data['description']
                badge.trigger_type = b_data['trigger_type']
                badge.icon = b_data['icon']
                badge.category = b_data['category']
                badge.save()
                self.stdout.write(f"Badge yangilandi: {badge.name}")

        self.stdout.write(self.style.SUCCESS(f"Muvaffaqiyatli yakunlandi! {created_count} ta yangi yutuq yaratildi."))
