from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.users.serializers import UserProfileSerializer
from .models import Category, Course, Module, Lesson, Enrollment, LessonProgress, Review, Certificate, Question, AnswerOption, QuizAttempt, SavedCourse

User = get_user_model()



class CategorySerializer(serializers.ModelSerializer):
    courses_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'parent', 'order', 'courses_count']


class LessonSerializer(serializers.ModelSerializer):
    duration_display = serializers.CharField(read_only=True)
    video_url = serializers.SerializerMethodField()
    video_file = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ['id', 'title', 'order', 'lesson_type', 'duration_seconds', 'duration_display', 'is_free_preview', 'video_url', 'video_file', 'is_completed']

    def get_video_url(self, obj):
        # Only show video_url if lesson is free preview or user is enrolled
        request = self.context.get('request')
        if obj.is_free_preview:
            return obj.video_url
        if request and request.user and request.user.is_authenticated:
            if Enrollment.objects.filter(student=request.user, course=obj.module.course).exists():
                return obj.video_url
        return None

    def get_video_file(self, obj):
        request = self.context.get('request')
        if not obj.video_file:
            return None
        show_video = obj.is_free_preview
        if not show_video and request and request.user and request.user.is_authenticated:
            if Enrollment.objects.filter(student=request.user, course=obj.module.course).exists():
                show_video = True
        if show_video:
            if request is not None:
                return request.build_absolute_uri(obj.video_file.url)
            return obj.video_file.url
        return None

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return False
        
        enrollment = Enrollment.objects.filter(student=request.user, course=obj.module.course).first()
        if not enrollment:
            return False
        
        progress = LessonProgress.objects.filter(enrollment=enrollment, lesson=obj).first()
        return progress.is_completed if progress else False



class LessonDetailSerializer(serializers.ModelSerializer):
    duration_display = serializers.CharField(read_only=True)
    current_progress = serializers.SerializerMethodField()
    video_file = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'order', 'lesson_type', 'duration_seconds', 'duration_display',
            'is_free_preview', 'video_url', 'video_file', 'content', 'live_url', 'live_scheduled',
            'current_progress'
        ]

    def get_video_file(self, obj):
        if not obj.video_file:
            return None
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.video_file.url)
        return obj.video_file.url

    def get_current_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return None
        
        enrollment = Enrollment.objects.filter(student=request.user, course=obj.module.course).first()
        if not enrollment:
            return None
            
        progress = LessonProgress.objects.filter(enrollment=enrollment, lesson=obj).first()
        if progress:
            return {
                "watched_seconds": progress.watched_seconds,
                "is_completed": progress.is_completed,
                "last_watched": progress.last_watched
            }
        return {"watched_seconds": 0, "is_completed": False}


class ModuleSerializer(serializers.ModelSerializer):
    lessons_count = serializers.IntegerField(read_only=True)
    duration_seconds = serializers.IntegerField(read_only=True)
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'title', 'order', 'lessons_count', 'duration_seconds', 'lessons']


class CourseListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    teacher_avatar = serializers.SerializerMethodField()
    discount_percent = serializers.IntegerField(read_only=True)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_free = serializers.BooleanField(read_only=True)
    student_count = serializers.IntegerField(read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    lessons_count = serializers.IntegerField(read_only=True)
    thumbnail = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'thumbnail', 'category_name', 'teacher_name', 'teacher_avatar',
            'price', 'discount_price', 'discount_percent', 'effective_price', 'is_free',
            'level', 'language', 'student_count', 'average_rating', 'lessons_count', 'created_at',
            'learning_outcomes', 'preview_video_url'
        ]

    def get_teacher_avatar(self, obj):
        if not obj.teacher.avatar:
            return None
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.teacher.avatar.url)
        return obj.teacher.avatar.url

    def get_thumbnail(self, obj):
        if not obj.thumbnail:
            return None
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.thumbnail.url)
        return obj.thumbnail.url


class InstructorMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    courses_count = serializers.SerializerMethodField()
    bio = serializers.CharField(source='teacherprofile.bio', default='')
    specialization = serializers.CharField(source='teacherprofile.specialization', default='')

    class Meta:
        model = User
        fields = ['id', 'full_name', 'avatar', 'bio', 'specialization',
                  'rating', 'students_count', 'courses_count']

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_rating(self, obj):
        courses = obj.courses.filter(status='published')
        if not courses.exists():
            return 0.0
        from django.db.models import Avg
        from .models import Review
        qs = Review.objects.filter(enrollment__course__in=courses)
        if not qs.exists():
            return 0.0
        return round(qs.aggregate(avg=Avg('rating'))['avg'], 1)

    def get_students_count(self, obj):
        courses = obj.courses.filter(status='published')
        if not courses.exists():
            return 0
        from .models import Enrollment
        return Enrollment.objects.filter(course__in=courses).values('student').distinct().count()

    def get_courses_count(self, obj):
        return obj.courses.filter(status='published').count()


class CourseDetailSerializer(CourseListSerializer):
    description = serializers.CharField()
    total_duration_seconds = serializers.IntegerField(read_only=True)
    modules = ModuleSerializer(many=True, read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    instructor = InstructorMiniSerializer(source='teacher', read_only=True)

    class Meta:
        model = Course
        fields = CourseListSerializer.Meta.fields + ['description', 'total_duration_seconds', 'modules', 'is_enrolled', 'is_saved', 'instructor']

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return False
        return Enrollment.objects.filter(student=request.user, course=obj).exists()

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return False
        from .models import SavedCourse
        return SavedCourse.objects.filter(user=request.user, course=obj).exists()


class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'course', 'enrolled_at', 'progress_percent', 'is_completed']


class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='enrollment.student.full_name', read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'student_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Reyting 1 dan 5 gacha bo'lishi kerak")
        return value


class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='enrollment.course.title', read_only=True)
    student_name = serializers.CharField(source='enrollment.student.full_name', read_only=True)

    class Meta:
        model = Certificate
        fields = ['unique_code', 'course_title', 'issued_at', 'student_name']


class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ['id', 'text']


class QuestionSerializer(serializers.ModelSerializer):
    options = AnswerOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'order', 'options']

