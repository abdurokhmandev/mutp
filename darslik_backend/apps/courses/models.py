from django.db import models
from django.utils.text import slugify
import uuid


class Category(models.Model):
    """Kurs kategoriyalari — daraxt tuzilmasi"""
    name   = models.CharField(max_length=100)
    slug   = models.SlugField(unique=True, blank=True)
    icon   = models.CharField(max_length=10, blank=True)  # emoji
    parent = models.ForeignKey(
               'self', null=True, blank=True,
               on_delete=models.SET_NULL,
               related_name='children'
             )
    order  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Kategoriya"
        verbose_name_plural = "Kategoriyalar"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    @property
    def courses_count(self):
        return self.courses.count()


class Course(models.Model):
    """Asosiy kurs modeli"""

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Qoralama'
        REVIEW    = 'review',    'Tekshiruvda'
        PUBLISHED = 'published', 'Chop etilgan'
        ARCHIVED  = 'archived',  'Arxivlangan'

    class Level(models.TextChoices):
        BEGINNER     = 'beginner',     "Boshlang'ich"
        INTERMEDIATE = 'intermediate', "O'rta daraja"
        ADVANCED     = 'advanced',     "Yuqori daraja"

    class Language(models.TextChoices):
        UZBEK   = 'uz', "O'zbek tili"
        RUSSIAN = 'ru', "Rus tili"
        ENGLISH = 'en', "Ingliz tili"

    teacher     = models.ForeignKey(
                    'users.User',
                    on_delete=models.CASCADE,
                    related_name='courses',
                    limit_choices_to={'role': 'teacher'}
                  )
    category    = models.ForeignKey(
                    Category,
                    on_delete=models.SET_NULL,
                    null=True, related_name='courses'
                  )
    title       = models.CharField(max_length=200)
    slug        = models.SlugField(unique=True, blank=True)
    description = models.TextField()
    thumbnail   = models.ImageField(upload_to='thumbnails/%Y/%m/', blank=True, null=True)
    learning_outcomes = models.JSONField(default=list, blank=True)
    preview_video_url = models.URLField(blank=True, null=True)

    price          = models.DecimalField(
                       max_digits=10, decimal_places=2, default=0
                     )
    discount_price = models.DecimalField(
                       max_digits=10, decimal_places=2,
                       null=True, blank=True
                     )

    language    = models.CharField(
                    max_length=5,
                    choices=Language,
                    default=Language.UZBEK
                  )
    level       = models.CharField(
                    max_length=15,
                    choices=Level,
                    default=Level.BEGINNER
                  )
    status      = models.CharField(
                    max_length=10,
                    choices=Status,
                    default=Status.DRAFT
                  )
    is_featured = models.BooleanField(default=False)
    is_private = models.BooleanField(default=False)
    enrollment_limit = models.PositiveIntegerField(null=True, blank=True)  # None = cheksiz
    require_approval = models.BooleanField(default=False)  # True bo'lsa ustoz tasdiqlaydi

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Kurs"
        verbose_name_plural = "Kurslar"
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)
            # handle non-ascii slugify output (e.g. uzbek o' or g' becomes empty or clean)
            if not base:
                base = "course"
            self.slug = f"{base}-{str(uuid.uuid4())[:6]}"
        super().save(*args, **kwargs)

    @property
    def is_free(self):
        return self.price == 0

    @property
    def effective_price(self):
        return self.discount_price if self.discount_price is not None else self.price

    @property
    def discount_percent(self):
        if self.discount_price and self.price > 0:
            return int((1 - self.discount_price / self.price) * 100)
        return 0

    @property
    def student_count(self):
        return self.enrollments.count()

    @property
    def average_rating(self):
        qs = Review.objects.filter(enrollment__course=self)
        if not qs.exists():
            return 0.0
        from django.db.models import Avg
        return round(qs.aggregate(avg=Avg('rating'))['avg'], 1)

    @property
    def total_duration_seconds(self):
        from django.db.models import Sum
        result = Lesson.objects.filter(
            module__course=self
        ).aggregate(total=Sum('duration_seconds'))
        return result['total'] or 0

    @property
    def lessons_count(self):
        return Lesson.objects.filter(module__course=self).count()


class Module(models.Model):
    """Kurs bo'limlari (chapters)"""
    course = models.ForeignKey(
               Course, on_delete=models.CASCADE, related_name='modules'
             )
    title  = models.CharField(max_length=200)
    order  = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Modul"
        verbose_name_plural = "Modullar"
        ordering = ['order']
        unique_together = ['course', 'order']

    def __str__(self):
        return f"{self.course.title} — {self.title}"

    @property
    def lessons_count(self):
        return self.lessons.count()

    @property
    def duration_seconds(self):
        from django.db.models import Sum
        r = self.lessons.aggregate(total=Sum('duration_seconds'))
        return r['total'] or 0


class Lesson(models.Model):
    """Kurs darslari"""

    class LessonType(models.TextChoices):
        VIDEO = 'video', 'Video dars'
        TEXT  = 'text',  'Matn dars'
        QUIZ  = 'quiz',  'Test'
        LIVE  = 'live',  'Live dars'
        HOMEWORK = 'homework', 'Vazifa'

    module           = models.ForeignKey(
                         Module, on_delete=models.CASCADE, related_name='lessons'
                       )
    title            = models.CharField(max_length=200)
    order            = models.PositiveSmallIntegerField(default=0)
    lesson_type      = models.CharField(
                         max_length=10,
                         choices=LessonType,
                         default=LessonType.VIDEO
                       )
    video_url        = models.URLField(blank=True)
    video_file       = models.FileField(
                         upload_to='lessons/videos/%Y/%m/', blank=True, null=True
                       )
    duration_seconds = models.PositiveIntegerField(default=0)

    content          = models.TextField(blank=True)
    text_content     = models.TextField(blank=True)

    live_url         = models.URLField(blank=True)
    live_scheduled   = models.DateTimeField(null=True, blank=True)

    is_free_preview  = models.BooleanField(default=False)

    # Homework specifics
    homework_description = models.TextField(blank=True)
    homework_deadline_days = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Dars"
        verbose_name_plural = "Darslar"
        ordering = ['order']
        unique_together = ['module', 'order']

    def __str__(self):
        return f"{self.module.course.title} / {self.module.title} / {self.title}"

    @property
    def duration_display(self):
        total = int(self.duration_seconds or 0)
        m, s = divmod(total, 60)
        h, m = divmod(m, 60)
        if h:
            return f"{h}:{m:02d}:{s:02d}"
        return f"{m}:{s:02d}"


class Enrollment(models.Model):
    """O'quvchi kursga yozilishi"""
    student          = models.ForeignKey(
                         'users.User',
                         on_delete=models.CASCADE,
                         related_name='enrollments',
                         limit_choices_to={'role': 'student'}
                       )
    course           = models.ForeignKey(
                         Course, on_delete=models.CASCADE,
                         related_name='enrollments'
                       )
    enrolled_at      = models.DateTimeField(auto_now_add=True)
    completed_at     = models.DateTimeField(null=True, blank=True)
    progress_percent = models.FloatField(default=0.0)
    is_completed     = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Yozilish"
        verbose_name_plural = "Yozilishlar"
        unique_together = ['student', 'course']
        ordering = ['-enrolled_at']

    def __str__(self):
        return f"{self.student.full_name} → {self.course.title}"

    def recalculate_progress(self):
        total = Lesson.objects.filter(
            module__course=self.course
        ).count()
        if total == 0:
            return
        done = LessonProgress.objects.filter(
            enrollment=self, is_completed=True
        ).count()
        self.progress_percent = round((done / total) * 100, 1)
        if self.progress_percent >= 100 and not self.is_completed:
            from django.utils import timezone
            self.is_completed = True
            self.completed_at = timezone.now()
            Certificate.objects.get_or_create(enrollment=self)
        self.save(update_fields=['progress_percent', 'is_completed', 'completed_at'])


class LessonProgress(models.Model):
    """O'quvchi dars progressi"""
    enrollment      = models.ForeignKey(
                        Enrollment, on_delete=models.CASCADE,
                        related_name='lesson_progresses'
                      )
    lesson          = models.ForeignKey(
                        Lesson, on_delete=models.CASCADE
                      )
    watched_seconds = models.PositiveIntegerField(default=0)
    is_completed    = models.BooleanField(default=False)
    last_watched    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Dars progressi"
        verbose_name_plural = "Dars progresslari"
        unique_together = ['enrollment', 'lesson']

    def __str__(self):
        return f"{self.enrollment.student.full_name} — {self.lesson.title}"

    def save(self, *args, **kwargs):
        if (self.lesson.duration_seconds > 0 and
            self.watched_seconds >= self.lesson.duration_seconds * 0.80):
            self.is_completed = True
        super().save(*args, **kwargs)
        self.enrollment.recalculate_progress()


class Review(models.Model):
    """Kurs reytingi va izohi"""
    enrollment = models.OneToOneField(
                   Enrollment, on_delete=models.CASCADE,
                   related_name='review'
                 )
    rating     = models.PositiveSmallIntegerField()  # 1-5
    comment    = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Reyting"
        verbose_name_plural = "Reytinglar"

    def __str__(self):
        return f"{self.enrollment.student.full_name} — {self.rating}★"

    def clean(self):
        from django.core.exceptions import ValidationError
        if not 1 <= self.rating <= 5:
            raise ValidationError("Reyting 1 dan 5 gacha bo'lishi kerak")


class Certificate(models.Model):
    """Kurs sertifikati"""
    enrollment  = models.OneToOneField(
                    Enrollment, on_delete=models.CASCADE,
                    related_name='certificate'
                  )
    unique_code = models.CharField(
                    max_length=20, unique=True, blank=True
                  )
    issued_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Sertifikat"
        verbose_name_plural = "Sertifikatlar"

    def save(self, *args, **kwargs):
        if not self.unique_code:
            self.unique_code = str(uuid.uuid4()).upper()[:16].replace('-', '')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Sertifikat: {self.unique_code}"


class Question(models.Model):
    """Test savoli"""
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='questions', null=True, blank=True)
    homework = models.ForeignKey('Homework', on_delete=models.CASCADE, related_name='questions', null=True, blank=True)
    text = models.TextField()
    order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = "Savol"
        verbose_name_plural = "Savollar"
        ordering = ['order']

    def __str__(self):
        return f"{self.lesson.title if self.lesson else self.homework.title} — {self.text[:30]}"


class AnswerOption(models.Model):
    """Savol javob varianti"""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=300)
    is_correct = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Javob varianti"
        verbose_name_plural = "Javob variantlari"

    def __str__(self):
        return self.text


class QuizAttempt(models.Model):
    """Talabaning test topshirish urinishi"""
    student = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='quiz_attempts')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='quiz_attempts')
    score = models.FloatField()  # foizda, masalan 80.0
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Test urinishi"
        verbose_name_plural = "Test urinishlari"

    def __str__(self):
        return f"{self.student.full_name} — {self.lesson.title}: {self.score}%"


class SavedCourse(models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='saved_courses')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='saved_by')
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Saqlangan kurs"
        verbose_name_plural = "Saqlangan kurslar"
        unique_together = ['user', 'course']

    def __str__(self):
        return f"{self.user.full_name} — {self.course.title}"


class LessonResource(models.Model):
    RESOURCE_TYPES = [
        ('file', 'Fayl (PDF, DOCX va h.k.)'),
        ('link', 'Tashqi havola'),
    ]
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='resources')
    title = models.CharField(max_length=200)
    resource_type = models.CharField(max_length=10, choices=RESOURCE_TYPES, default='file')
    file = models.FileField(upload_to='lesson_resources/', blank=True, null=True)
    url = models.URLField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name = "Dars resursi"
        verbose_name_plural = "Dars resurslari"

    def __str__(self):
        return f"{self.lesson.title} — {self.title}"


class Homework(models.Model):
    TYPE_CHOICES = [
        ('quiz', 'Test'),
        ('written', 'Yozma')
    ]
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='homeworks')
    title = models.CharField(max_length=200)
    description = models.TextField()
    type = models.CharField(max_length=15, choices=TYPE_CHOICES, default='written')
    after_lesson = models.ForeignKey(
        'Lesson', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='homeworks', help_text="Qaysi darsdan keyin ko'rsatiladi"
    )
    deadline_days = models.PositiveIntegerField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        verbose_name = "Vazifa"
        verbose_name_plural = "Vazifalar"

    def __str__(self):
        return f"{self.course.title} — {self.title}"


class HomeworkResource(models.Model):
    RESOURCE_TYPES = [('file', 'Fayl'), ('link', 'Havola')]
    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name='resources')
    title = models.CharField(max_length=200)
    resource_type = models.CharField(max_length=10, choices=RESOURCE_TYPES, default='file')
    file = models.FileField(upload_to='homework_resources/', blank=True, null=True)
    url = models.URLField(blank=True)

    class Meta:
        verbose_name = "Vazifa resursi"
        verbose_name_plural = "Vazifa resurslari"

    def __str__(self):
        return f"{self.homework.title} — {self.title}"


class HomeworkSubmission(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Kutilmoqda'),
        ('submitted', 'Topshirilgan'),
        ('reviewed', 'Ko\'rib chiqilgan')
    ]
    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey('users.User', on_delete=models.CASCADE)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    
    # Yozma javob
    text_answer = models.TextField(blank=True)
    file_answer = models.FileField(upload_to='hw_submissions/', blank=True, null=True)
    # Test natija
    quiz_score = models.FloatField(null=True, blank=True)
    # Ustoz izohi
    feedback = models.TextField(blank=True)
    teacher_score = models.PositiveIntegerField(null=True, blank=True)  # 0-100
    
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['homework', 'student']
        verbose_name = "Topshirilgan vazifa"
        verbose_name_plural = "Topshirilgan vazifalar"

    def __str__(self):
        return f"{self.student.full_name} — {self.homework.title}: {self.status}"


class CourseInviteLink(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='invite_links')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    max_uses = models.PositiveIntegerField(null=True, blank=True)  # None = cheksiz
    use_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('users.User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)  # None = muddatsiz

    @property
    def url(self):
        return f"/invite/{self.token}/"

    @property
    def is_valid(self):
        from django.utils import timezone
        if not self.is_active:
            return False
        if self.max_uses and self.use_count >= self.max_uses:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True

    def __str__(self):
        return f"{self.course.title} — {self.token}"


class EnrollmentRequest(models.Model):
    STATUS = [
        ('pending',  'Kutilmoqda'),
        ('approved', 'Tasdiqlandi'),
        ('rejected', 'Rad etildi'),
    ]
    course   = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollment_requests')
    student  = models.ForeignKey('users.User', on_delete=models.CASCADE)
    invite_link = models.ForeignKey(CourseInviteLink, on_delete=models.SET_NULL, null=True, blank=True)
    status   = models.CharField(max_length=10, choices=STATUS, default='pending')
    message  = models.TextField(blank=True)  # o'quvchi qoldirgan izoh (ixtiyoriy)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['course', 'student']



