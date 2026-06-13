from django.db import models


class DailyStudyLog(models.Model):
    """
    O'quvchining kunlik o'qish logi.
    Streak hisoblash uchun ishlatiladi.
    """
    student        = models.ForeignKey(
                       'users.User',
                       on_delete=models.CASCADE,
                       related_name='study_logs'
                     )
    date           = models.DateField()
    seconds_studied = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Kunlik o'qish"
        verbose_name_plural = "Kunlik o'qishlar"
        unique_together = ['student', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.student.full_name} — {self.date}"
