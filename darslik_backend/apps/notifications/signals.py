from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.courses.models import Enrollment, QuizAttempt, HomeworkSubmission
from .models import Notification

@receiver(post_save, sender=Enrollment)
def notify_teacher_new_enrollment(sender, instance, created, **kwargs):
    if created and instance.course.teacher:
        Notification.objects.create(
            recipient=instance.course.teacher,
            type='new_enrollment',
            title='Yangi o\'quvchi',
            message=f'{instance.student.full_name} "{instance.course.title}" kursiga yozildi',
            link=f'dashboard-teacher.html#students-section'
        )

@receiver(post_save, sender=QuizAttempt)
def notify_teacher_quiz(sender, instance, created, **kwargs):
    if created and instance.lesson.module.course.teacher:
        Notification.objects.create(
            recipient=instance.lesson.module.course.teacher,
            type='quiz_completed',
            title='Test yakunlandi',
            message=f'{instance.student.full_name} "{instance.lesson.title}" testini {instance.score:.0f}% bilan tugatdi',
            link=f'dashboard-teacher.html#students-section'
        )

@receiver(post_save, sender=HomeworkSubmission)
def notify_teacher_homework(sender, instance, created, **kwargs):
    if created and instance.status == 'submitted' and instance.homework.course.teacher:
        Notification.objects.create(
            recipient=instance.homework.course.teacher,
            type='homework_submitted',
            title='Yangi vazifa topshirildi',
            message=f'{instance.student.full_name} "{instance.homework.title}" vazifasini topshirdi',
            link=f'dashboard-teacher.html#homeworks-section'
        )
