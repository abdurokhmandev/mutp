from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Asosiy foydalanuvchi modeli.
    O'quvchi va o'qituvchi bitta modelda,
    role maydoni bilan farqlanadi.
    """
    class Role(models.TextChoices):
        STUDENT = 'student', "O'quvchi"
        TEACHER = 'teacher', "O'qituvchi"
        ADMIN   = 'admin',   "Admin"

    email       = models.EmailField(unique=True)
    role        = models.CharField(
                    max_length=10,
                    choices=Role,
                    default=Role.STUDENT
                  )
    avatar      = models.ImageField(
                    upload_to='avatars/%Y/%m/',
                    blank=True, null=True
                  )
    phone       = models.CharField(max_length=15, blank=True)
    bio         = models.TextField(blank=True)
    telegram_id = models.CharField(max_length=50, blank=True)
    is_verified = models.BooleanField(default=False)  # o'qituvchi uchun tasdiqlash
    created_at  = models.DateTimeField(auto_now_add=True)

    # Use email for login instead of username
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        verbose_name = "Foydalanuvchi"
        verbose_name_plural = "Foydalanuvchilar"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"

    @property
    def full_name(self):
        return self.get_full_name() or self.username

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def is_student(self):
        return self.role == self.Role.STUDENT


class TeacherProfile(models.Model):
    """
    O'qituvchi uchun qo'shimcha ma'lumotlar.
    User yaratilganda signal orqali avtomatik yaratiadi.
    """
    user             = models.OneToOneField(
                         User,
                         on_delete=models.CASCADE,
                         related_name='teacher_profile'
                       )
    specialization   = models.CharField(max_length=200, blank=True)
    experience_years = models.PositiveSmallIntegerField(default=0)
    total_earnings   = models.DecimalField(
                         max_digits=14, decimal_places=2, default=0
                       )
    pending_payout   = models.DecimalField(
                         max_digits=14, decimal_places=2, default=0
                       )
    bank_card        = models.CharField(max_length=16, blank=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "O'qituvchi profil"
        verbose_name_plural = "O'qituvchi profillari"

    def __str__(self):
        return f"{self.user.full_name} — o'qituvchi"

    @property
    def average_rating(self):
        from apps.courses.models import Review
        qs = Review.objects.filter(enrollment__course__teacher=self.user)
        if not qs.exists():
            return 0.0
        return round(
            qs.aggregate(avg=models.Avg('rating'))['avg'], 1
        )

    @property
    def total_students(self):
        from apps.courses.models import Enrollment
        return Enrollment.objects.filter(
            course__teacher=self.user
        ).values('student').distinct().count()
