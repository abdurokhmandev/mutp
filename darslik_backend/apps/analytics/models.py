from django.db import models
from django.utils import timezone
from datetime import timedelta


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


class UserStreak(models.Model):
    """
    Foydalanuvchining streak holatini keshlash uchun.
    Har safar hisoblashdan ko'ra, saqlab qo'yiladi va
    yangilanadi — tezroq ishlaydi.
    """
    user            = models.OneToOneField(
                        'users.User', on_delete=models.CASCADE,
                        related_name='streak'
                      )
    current_streak  = models.PositiveIntegerField(default=0)
    longest_streak  = models.PositiveIntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)
    freeze_count    = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Streak"
        verbose_name_plural = "Streaklar"

    def update_on_activity(self):
        """Foydalanuvchi faollik ko'rsatganda chaqiriladi"""
        today = timezone.now().date()

        if self.last_active_date == today:
            return  # Bugun allaqachon hisoblangan

        if self.last_active_date == today - timedelta(days=1):
            # Kecha faol bo'lgan — streak davom etadi
            self.current_streak += 1
        elif self.last_active_date and self.freeze_count > 0:
            # 1 kun o'tkazib yuborgan, lekin freeze bor
            gap = (today - self.last_active_date).days
            if gap == 2:
                self.freeze_count -= 1
                self.current_streak += 1
            else:
                self.current_streak = 1
        else:
            # Streak uzilgan, qaytadan boshlanadi
            self.current_streak = 1

        self.longest_streak = max(self.longest_streak, self.current_streak)
        self.last_active_date = today
        self.save()

