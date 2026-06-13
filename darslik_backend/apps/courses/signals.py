from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import LessonProgress


@receiver(post_save, sender=LessonProgress)
def update_study_log(sender, instance, created, **kwargs):
    # Skip if it is a new creation but watched_seconds is 0
    if instance.watched_seconds > 0:
        from apps.analytics.utils import log_study_time
        # For simplicity in MVP, each progress update adds 5 seconds to daily log
        log_study_time(instance.enrollment.student, 5)
