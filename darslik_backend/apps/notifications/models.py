from django.db import models
from django.conf import settings

class Notification(models.Model):
    class Type(models.TextChoices):
        NEW_ENROLLMENT = 'new_enrollment', 'New Enrollment'
        QUIZ_COMPLETED = 'quiz_completed', 'Quiz Completed'
        HOMEWORK_SUBMITTED = 'homework_submitted', 'Homework Submitted'
        NEW_MESSAGE = 'new_message', 'New Message'
        # new_comment reserved for future use

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=30, choices=Type.choices)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['recipient', 'is_read'])]

    def __str__(self):
        return f"{self.get_type_display()} for {self.recipient}"
