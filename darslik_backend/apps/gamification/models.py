from django.db import models


class Badge(models.Model):
    """
    Yutuq turi — admin panel orqali yaratiladi,
    moslashuvchan bo'lishi uchun shartlar kod orqali
    emas, bazada saqlanadi.
    """
    class Category(models.TextChoices):
        PROGRESS = 'progress', 'Progress'
        STREAK   = 'streak',   'Streak'
        SOCIAL   = 'social',   'Ijtimoiy'
        QUALITY  = 'quality',  'Sifat'

    name        = models.CharField(max_length=100)
    slug        = models.SlugField(unique=True)
    description = models.CharField(max_length=200)
    icon        = models.CharField(max_length=10, blank=True)  # emoji yoki icon nomi
    category    = models.CharField(max_length=10, choices=Category)

    # Avtomatik berish sharti (kod orqali tekshiriladi)
    trigger_type  = models.CharField(max_length=50)
    trigger_value = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Yutuq"
        verbose_name_plural = "Yutuqlar"

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    """Foydalanuvchiga berilgan yutuq"""
    user       = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='badges')
    badge      = models.ForeignKey(Badge, on_delete=models.CASCADE)
    earned_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'badge']
        ordering = ['-earned_at']
        verbose_name = "Foydalanuvchi yutug'i"
        verbose_name_plural = "Foydalanuvchi yutuqlari"

    def __str__(self):
        return f"{self.user.username} — {self.badge.name}"
