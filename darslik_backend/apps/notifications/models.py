from django.db import models
from django.conf import settings

class Notification(models.Model):
    class Type(models.TextChoices):
        NEW_ENROLLMENT = 'new_enrollment', 'New Enrollment'
        QUIZ_COMPLETED = 'quiz_completed', 'Quiz Completed'
        HOMEWORK_SUBMITTED = 'homework_submitted', 'Homework Submitted'
        NEW_MESSAGE = 'new_message', 'New Message'
        HOMEWORK_REVIEWED = 'homework_reviewed', 'Homework Reviewed'
        ENROLLMENT_REQUEST = 'enrollment_request', "Yozilish so'rovi"
        ENROLLMENT_APPROVED = 'enrollment_approved', 'Yozilish tasdiqlandi'
        ENROLLMENT_REJECTED = 'enrollment_rejected', 'Yozilish rad etildi'

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=30, choices=Type.choices)
    title = models.CharField(max_length=100, blank=True)
    message = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['recipient', 'is_read'])]

    def __str__(self):
        return f"{self.get_type_display()} for {self.recipient}"
