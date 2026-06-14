from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.courses.models import Enrollment, Course
from .models import Channel, ChannelMember, Message


@receiver(post_save, sender=Course)
def create_course_channel(sender, instance, **kwargs):
    """Kurs nashr etilganda avtomatik guruh kanal yaratiladi"""
    if instance.status == 'published':
        channel, created = Channel.objects.get_or_create(
            course=instance,
            channel_type='course',
            defaults={
                'name': f"#{instance.title}",
                'creator': instance.teacher,
            }
        )
        if created:
            ChannelMember.objects.get_or_create(
                channel=channel, user=instance.teacher,
                defaults={'role': 'admin'}
            )
            Message.objects.create(
                channel=channel,
                message_type='system',
                text=f"'{instance.title}' kursi guruhi yaratildi! 🎉"
            )


@receiver(post_save, sender=Enrollment)
def add_student_to_course_channel(sender, instance, created, **kwargs):
    """O'quvchi kursga yozilganda guruhga avtomatik qo'shiladi"""
    if created:
        channel = Channel.objects.filter(
            course=instance.course, channel_type='course'
        ).first()
        if channel:
            ChannelMember.objects.get_or_create(
                channel=channel, user=instance.student,
                defaults={'role': 'member'}
            )
            Message.objects.create(
                channel=channel,
                message_type='system',
                text=f"{instance.student.full_name} guruhga qo'shildi 👋"
            )
