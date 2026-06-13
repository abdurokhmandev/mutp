from django.contrib import admin
from .models import Category, Course, Module, Lesson, Enrollment, LessonProgress, Review, Certificate, Question, AnswerOption, QuizAttempt


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'icon', 'parent', 'courses_count']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name', 'slug']


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 1


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['title', 'teacher', 'category', 'status', 'student_count', 'average_rating', 'price', 'created_at']
    list_filter = ['status', 'level', 'language', 'category', 'is_featured']
    search_fields = ['title', 'teacher__email', 'teacher__first_name', 'teacher__last_name']
    prepopulated_fields = {'slug': ('title',)}
    inlines = [ModuleInline]
    actions = ['publish_courses', 'archive_courses']

    def publish_courses(self, request, queryset):
        updated = queryset.update(status=Course.Status.PUBLISHED)
        self.message_user(request, f"{updated} kurslar muvaffaqiyatli chop etildi.")
    publish_courses.short_description = "Chop etish"

    def archive_courses(self, request, queryset):
        updated = queryset.update(status=Course.Status.ARCHIVED)
        self.message_user(request, f"{updated} kurslar arxivlandi.")
    archive_courses.short_description = "Arxivlash"


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'order', 'lessons_count', 'duration_seconds']
    list_filter = ['course']
    search_fields = ['title', 'course__title']


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'order', 'lesson_type', 'duration_seconds', 'is_free_preview']
    list_filter = ['lesson_type', 'is_free_preview', 'module__course']
    search_fields = ['title', 'module__title', 'module__course__title']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'course', 'enrolled_at', 'progress_percent', 'is_completed']
    list_filter = ['is_completed', 'enrolled_at', 'course']
    search_fields = ['student__email', 'student__username', 'course__title']


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ['enrollment', 'lesson', 'watched_seconds', 'is_completed', 'last_watched']
    list_filter = ['is_completed', 'last_watched']
    search_fields = ['enrollment__student__email', 'lesson__title']


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['student_name', 'course_title', 'rating', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['enrollment__student__email', 'enrollment__course__title', 'comment']

    def student_name(self, obj):
        return obj.enrollment.student.full_name
    student_name.short_description = "Talaba"

    def course_title(self, obj):
        return obj.enrollment.course.title
    course_title.short_description = "Kurs"


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ['unique_code', 'enrollment', 'issued_at']
    search_fields = ['unique_code', 'enrollment__student__email', 'enrollment__course__title']


class AnswerOptionInline(admin.TabularInline):
    model = AnswerOption
    extra = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['text', 'lesson', 'order']
    list_filter = ['lesson__module__course', 'lesson']
    search_fields = ['text', 'lesson__title']
    inlines = [AnswerOptionInline]


@admin.register(AnswerOption)
class AnswerOptionAdmin(admin.ModelAdmin):
    list_display = ['text', 'question', 'is_correct']
    list_filter = ['is_correct', 'question__lesson']
    search_fields = ['text', 'question__text']


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ['student', 'lesson', 'score', 'completed_at']
    list_filter = ['score', 'completed_at', 'lesson__module__course']
    search_fields = ['student__email', 'lesson__title']

