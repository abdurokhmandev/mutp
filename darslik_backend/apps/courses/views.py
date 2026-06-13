from django.utils import timezone
from django.db import models
from django.db.models import Avg, Sum, Count
from django.db.models.functions import TruncMonth
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from apps.core.utils import success_response, error_response
from apps.users.models import User, TeacherProfile
from .models import Category, Course, Module, Lesson, Enrollment, LessonProgress, Review, Certificate, Question, AnswerOption, QuizAttempt
from .permissions import IsTeacher, IsVerifiedTeacher, IsCourseOwner, IsEnrolledOrFreePreview
from .serializers import (
    CategorySerializer,
    CourseListSerializer,
    CourseDetailSerializer,
    EnrollmentSerializer,
    LessonDetailSerializer,
    ReviewSerializer,
    CertificateSerializer,
    ModuleSerializer,
    LessonSerializer,
    QuestionSerializer,
    AnswerOptionSerializer
)


class CoursePagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100


class CategoryListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.filter(parent=None).annotate(
            annotated_courses_count=Count('courses')
        )
        serializer = CategorySerializer(categories, many=True, context={'request': request})
        # Add dynamic courses_count representation
        data = serializer.data
        for item in data:
            # Recursive check of child categories courses as well
            parent_cat = Category.objects.get(id=item['id'])
            total_count = Course.objects.filter(category__in=parent_cat.children.all()).count() + parent_cat.courses.count()
            item['courses_count'] = total_count
        return success_response(data=data, message="Kategoriyalar ro'yxati")


class CourseListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        courses = Course.objects.filter(status=Course.Status.PUBLISHED)

        # Filters
        category_slug = request.query_params.get('category')
        if category_slug:
            courses = courses.filter(category__slug=category_slug)

        level = request.query_params.get('level')
        if level:
            courses = courses.filter(level=level)

        language = request.query_params.get('language')
        if language:
            courses = courses.filter(language=language)

        is_free = request.query_params.get('is_free')
        if is_free:
            if is_free.lower() == 'true':
                courses = courses.filter(price=0)
            elif is_free.lower() == 'false':
                courses = courses.filter(price__gt=0)

        search = request.query_params.get('search')
        if search:
            courses = courses.filter(title__icontains=search)

        teacher_id = request.query_params.get('teacher_id')
        if teacher_id:
            courses = courses.filter(teacher_id=teacher_id)

        # Sorting
        sort = request.query_params.get('sort')
        if sort == 'popular':
            courses = courses.annotate(students=Count('enrollments')).order_by('-students')
        elif sort == 'newest':
            courses = courses.order_by('-created_at')
        elif sort == 'rating':
            courses = courses.annotate(avg_r=Avg('enrollments__review__rating')).order_by('-avg_r')
        elif sort == 'price_low':
            courses = courses.order_by('price')
        elif sort == 'price_high':
            courses = courses.order_by('-price')
        else:
            courses = courses.order_by('-created_at')

        # Pagination
        paginator = CoursePagination()
        paginated_courses = paginator.paginate_queryset(courses, request, view=self)
        serializer = CourseListSerializer(paginated_courses, many=True, context={'request': request})
        
        paginated_data = paginator.get_paginated_response(serializer.data).data
        return success_response(data=paginated_data, message="Kurslar ro'yxati")


class CourseDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            course = Course.objects.get(slug=slug, status=Course.Status.PUBLISHED)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        serializer = CourseDetailSerializer(course, context={'request': request})
        return success_response(data=serializer.data, message="Kurs batafsil ma'lumoti")


class EnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        try:
            course = Course.objects.get(slug=slug, status=Course.Status.PUBLISHED)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        # In MVP/testing phase, allow enrolling in paid courses for free
        # if not course.is_free:
        #     return error_response(message="Bu kurs pullik. Uni sotib olish uchun to'lov tizimidan foydalaning.", status_code=400)

        # Check existing enrollment
        existing = Enrollment.objects.filter(student=request.user, course=course).exists()
        if existing:
            return error_response(message="Siz allaqachon ushbu kursga yozilgansiz", status_code=400)

        enrollment = Enrollment.objects.create(student=request.user, course=course)
        serializer = EnrollmentSerializer(enrollment, context={'request': request})
        return success_response(data=serializer.data, message="Kursga muvaffaqiyatli yozildingiz", status_code=201)


class MyEnrollmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        enrollments = Enrollment.objects.filter(student=request.user)

        status_filter = request.query_params.get('status')
        if status_filter == 'completed':
            enrollments = enrollments.filter(is_completed=True)
        elif status_filter == 'in_progress':
            enrollments = enrollments.filter(is_completed=False)

        serializer = EnrollmentSerializer(enrollments, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Mening kurslarim")


class LessonDetailView(APIView):
    permission_classes = [IsAuthenticated, IsEnrolledOrFreePreview]

    def get(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        # Check object level permission explicitly
        self.check_object_permissions(request, lesson)

        serializer = LessonDetailSerializer(lesson, context={'request': request})
        return success_response(data=serializer.data, message="Dars batafsil ma'lumoti")


class LessonProgressUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        try:
            enrollment = Enrollment.objects.get(student=request.user, course=lesson.module.course)
        except Enrollment.DoesNotExist:
            return error_response(message="Siz ushbu kursga yozilmagansiz", status_code=403)

        watched_seconds = request.data.get('watched_seconds', 0)
        try:
            watched_seconds = int(watched_seconds)
        except ValueError:
            return error_response(message="watched_seconds butun son bo'lishi kerak", status_code=400)

        progress, created = LessonProgress.objects.get_or_create(
            enrollment=enrollment,
            lesson=lesson,
            defaults={'watched_seconds': 0}
        )

        is_completed = request.data.get('is_completed', None)
        if is_completed is not None:
            progress.is_completed = bool(is_completed)

        # Cache dynamic addition seconds for analytics logs (e.g. diff seconds)
        diff_seconds = max(0, watched_seconds - progress.watched_seconds)
        if diff_seconds > 0:
            # We will save the updated watched_seconds
            progress.watched_seconds = watched_seconds
            
        progress.save()
        if diff_seconds > 0:
            # Trigger daily study time log via analytics util
            from apps.analytics.utils import log_study_time
            log_study_time(request.user, diff_seconds)

        data = {
            "watched_seconds": progress.watched_seconds,
            "is_completed": progress.is_completed,
            "course_progress": enrollment.progress_percent
        }
        return success_response(data=data, message="Dars progressi yangilandi")


class LessonQuizView(APIView):
    permission_classes = [IsAuthenticated, IsEnrolledOrFreePreview]

    def get(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        self.check_object_permissions(request, lesson)

        questions = Question.objects.filter(lesson=lesson)
        serializer = QuestionSerializer(questions, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Quiz savollari")


class LessonQuizSubmitView(APIView):
    permission_classes = [IsAuthenticated, IsEnrolledOrFreePreview]

    def post(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        self.check_object_permissions(request, lesson)

        try:
            enrollment = Enrollment.objects.get(student=request.user, course=lesson.module.course)
        except Enrollment.DoesNotExist:
            return error_response(message="Siz ushbu kursga yozilmagansiz", status_code=403)

        answers = request.data.get('answers', {})
        questions = Question.objects.filter(lesson=lesson)
        total = questions.count()

        if total == 0:
            return error_response(message="Ushbu dars uchun test savollari mavjud emas", status_code=400)

        correct_count = 0
        results = []

        for q in questions:
            selected_option_id = answers.get(str(q.id))
            correct_option = AnswerOption.objects.filter(question=q, is_correct=True).first()
            is_correct = False
            if selected_option_id and correct_option and int(selected_option_id) == correct_option.id:
                correct_count += 1
                is_correct = True
            
            results.append({
                "question_id": q.id,
                "is_correct": is_correct,
                "correct_option_id": correct_option.id if correct_option else None
            })

        score = (correct_count / total) * 100.0
        is_passed = score >= 70.0

        # Save attempt
        QuizAttempt.objects.create(
            student=request.user,
            lesson=lesson,
            score=score
        )

        # Update progress
        progress, created = LessonProgress.objects.get_or_create(
            enrollment=enrollment,
            lesson=lesson,
            defaults={'watched_seconds': 0}
        )
        if is_passed:
            progress.is_completed = True
            progress.save()

        data = {
            "score": round(score, 1),
            "correct_count": correct_count,
            "total_questions": total,
            "is_passed": is_passed,
            "course_progress": enrollment.progress_percent,
            "results": results
        }

        return success_response(data=data, message="Test natijangiz hisoblandi")



class ReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        try:
            enrollment = Enrollment.objects.get(student=request.user, course=course)
        except Enrollment.DoesNotExist:
            return error_response(message="Siz ushbu kursga yozilmagansiz", status_code=403)

        if not enrollment.is_completed:
            return error_response(message="Reyting qoldirish uchun kursni to'liq tugatgan bo'lishingiz shart", status_code=400)

        # Check existing review
        if hasattr(enrollment, 'review'):
            return error_response(message="Siz allaqachon ushbu kursga reyting bildirgansiz", status_code=400)

        serializer = ReviewSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(enrollment=enrollment)
            return success_response(data=serializer.data, message="Fikringiz uchun rahmat", status_code=201)
        return error_response(message="Xatolik yuz berdi", errors=serializer.errors, status_code=400)


class CertificateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code):
        try:
            certificate = Certificate.objects.get(unique_code=code)
        except Certificate.DoesNotExist:
            return error_response(message="Sertifikat topilmadi yoki yaroqsiz", status_code=404)

        serializer = CertificateSerializer(certificate, context={'request': request})
        return success_response(data=serializer.data, message="Sertifikat ma'lumotlari")


class TeacherCourseListView(APIView):
    permission_classes = [IsVerifiedTeacher]

    def get(self, request):
        courses = Course.objects.filter(teacher=request.user)
        serializer = CourseListSerializer(courses, many=True, context={'request': request})
        
        # Inject detailed stats for teachers
        data = serializer.data
        for idx, course_data in enumerate(data):
            c_obj = courses[idx]
            # Earnings is computed as 70% of course price * total student count
            course_data['students_count'] = c_obj.student_count
            course_data['earnings'] = float(c_obj.price * c_obj.student_count) * 0.7
            course_data['rating'] = c_obj.average_rating
            course_data['status_display'] = c_obj.get_status_display()
            
        return success_response(data=data, message="O'qituvchining kurslari ro'yxati")


class CourseCreateView(APIView):
    permission_classes = [IsVerifiedTeacher]

    def post(self, request):
        # Teacher is set automatically from current user
        data = request.data.copy()
        serializer = CourseDetailSerializer(data=data, context={'request': request})
        
        # We manually validate since teacher field isn't in request data
        if serializer.is_valid():
            pass
            
        # Instead, let's create a custom flow or use model save
        title = request.data.get('title')
        description = request.data.get('description', '')
        category_id = request.data.get('category_id')
        price = request.data.get('price', 0)
        level = request.data.get('level', Course.Level.BEGINNER)
        language = request.data.get('language', Course.Language.UZBEK)

        if not title:
            return error_response(message="Kurs sarlavhasi kiritilishi shart", status_code=400)

        category = None
        if category_id:
            try:
                category = Category.objects.get(id=category_id)
            except Category.DoesNotExist:
                return error_response(message="Kategoriya topilmadi", status_code=400)

        course = Course.objects.create(
            teacher=request.user,
            category=category,
            title=title,
            description=description,
            price=price,
            level=level,
            language=language,
            status=Course.Status.DRAFT
        )

        serializer = CourseDetailSerializer(course, context={'request': request})
        return success_response(data=serializer.data, message="Kurs qoralama rejimida yaratildi", status_code=201)


class CourseUpdateView(APIView):
    permission_classes = [IsVerifiedTeacher, IsCourseOwner]

    def patch(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        self.check_object_permissions(request, course)

        if 'title' in request.data:
            course.title = request.data['title']
        if 'description' in request.data:
            course.description = request.data['description']
        if 'price' in request.data:
            course.price = request.data['price']
        if 'level' in request.data:
            course.level = request.data['level']
        if 'language' in request.data:
            course.language = request.data['language']
        if 'category_id' in request.data:
            cat_id = request.data['category_id']
            if cat_id:
                try:
                    course.category = Category.objects.get(id=cat_id)
                except Category.DoesNotExist:
                    return error_response(message="Kategoriya topilmadi", status_code=400)
            else:
                course.category = None

        thumbnail = request.FILES.get('thumbnail')
        if thumbnail:
            course.thumbnail = thumbnail

        course.save()
        serializer = CourseDetailSerializer(course, context={'request': request})
        return success_response(data=serializer.data, message="Kurs muvaffaqiyatli yangilandi")


class TeacherCourseDetailView(APIView):
    permission_classes = [IsVerifiedTeacher]

    def get(self, request, slug):
        try:
            course = Course.objects.get(slug=slug, teacher=request.user)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        serializer = CourseDetailSerializer(course, context={'request': request})
        return success_response(data=serializer.data, message="Kurs ma'lumotlari")


class CoursePublishView(APIView):
    permission_classes = [IsVerifiedTeacher, IsCourseOwner]

    def post(self, request, slug):
        try:
            course = Course.objects.get(slug=slug, teacher=request.user)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        if not course.title:
            return error_response(message="Kurs nomi kiritilmagan", status_code=400)

        lesson_count = Lesson.objects.filter(module__course=course).count()
        if lesson_count == 0:
            return error_response(message="Nashr etish uchun kamida 1 ta dars qo'shing", status_code=400)

        course.status = Course.Status.PUBLISHED
        course.save()

        serializer = CourseDetailSerializer(course, context={'request': request})
        return success_response(data=serializer.data, message="Kurs muvaffaqiyatli nashr etildi")


class ModuleCreateView(APIView):
    permission_classes = [IsVerifiedTeacher, IsCourseOwner]

    def post(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        self.check_object_permissions(request, course)

        title = request.data.get('title')
        order = request.data.get('order')

        if not title:
            return error_response(message="Modul sarlavhasi kiritilishi shart", status_code=400)

        if order is None:
            # Auto order
            max_order = course.modules.aggregate(m=models.Max('order'))['m'] or 0
            order = max_order + 1

        module = Module.objects.create(
            course=course,
            title=title,
            order=order
        )

        serializer = ModuleSerializer(module, context={'request': request})
        return success_response(data=serializer.data, message="Yangi modul qo'shildi", status_code=201)


class LessonCreateView(APIView):
    permission_classes = [IsVerifiedTeacher]

    def post(self, request, id):
        try:
            module = Module.objects.get(id=id)
        except Module.DoesNotExist:
            return error_response(message="Modul topilmadi", status_code=404)

        # Check course ownership
        if module.course.teacher != request.user:
            return error_response(message="Ushbu kurs sizga tegishli emas", status_code=403)

        title = request.data.get('title')
        order = request.data.get('order')
        lesson_type = request.data.get('lesson_type', Lesson.LessonType.VIDEO)
        video_url = request.data.get('video_url', '') or ''
        content = request.data.get('content', '')
        live_url = request.data.get('live_url', '') or ''
        live_scheduled = request.data.get('live_scheduled') or None

        try:
            duration_seconds = int(request.data.get('duration_seconds') or 0)
        except (TypeError, ValueError):
            duration_seconds = 0

        is_free_preview = str(request.data.get('is_free_preview', 'false')).lower() in ('true', '1', 'yes')

        if not title:
            return error_response(message="Dars sarlavhasi kiritilishi shart", status_code=400)

        if order is None or order == '':
            max_order = module.lessons.aggregate(m=models.Max('order'))['m'] or 0
            order = max_order + 1
        else:
            try:
                order = int(order)
            except (TypeError, ValueError):
                return error_response(message="Tartib raqami butun son bo'lishi kerak", status_code=400)

        video_file = request.FILES.get('video_file')
        if lesson_type == Lesson.LessonType.VIDEO and not video_file and not video_url:
            return error_response(message="Video dars uchun fayl yoki video_url kiriting", status_code=400)

        try:
            lesson = Lesson.objects.create(
                module=module,
                title=title,
                order=order,
                lesson_type=lesson_type,
                video_url=video_url,
                video_file=video_file,
                duration_seconds=duration_seconds,
                content=content,
                live_url=live_url,
                live_scheduled=live_scheduled,
                is_free_preview=is_free_preview
            )
        except Exception as e:
            return error_response(message="Dars yaratishda xatolik", errors=str(e), status_code=400)

        serializer = LessonSerializer(lesson, context={'request': request})
        return success_response(data=serializer.data, message="Modulga yangi dars qo'shildi", status_code=201)


class TeacherDashboardView(APIView):
    permission_classes = [IsVerifiedTeacher]

    def get(self, request):
        teacher_profile = getattr(request.user, 'teacher_profile', None)
        if not teacher_profile:
            return error_response(message="Teacher profile topilmadi", status_code=400)

        # Calculations
        # 1. Total students
        total_students = teacher_profile.total_students

        # 2. Total courses
        total_courses = Course.objects.filter(teacher=request.user).count()

        # 3. Average rating
        average_rating = teacher_profile.average_rating

        # 4. Total earnings & Pending payout
        total_earnings = float(teacher_profile.total_earnings)
        pending_payout = float(teacher_profile.pending_payout)

        # 5. Monthly earnings (last 6 months)
        # Fetch enrollments for teacher courses
        teacher_enrollments = Enrollment.objects.filter(course__teacher=request.user, course__price__gt=0)
        
        monthly_data = (
            teacher_enrollments
            .annotate(month=TruncMonth('enrolled_at'))
            .values('month')
            .annotate(
                count=Count('id'),
                total=Sum('course__price')
            )
            .order_by('-month')[:6]
        )

        monthly_earnings = []
        for item in reversed(monthly_data):
            if item['month']:
                month_str = item['month'].strftime('%Y-%m')
                # 70% goes to the teacher
                amount = float(item['total'] or 0) * 0.70
                monthly_earnings.append({
                    "month": month_str,
                    "amount": amount
                })

        # Fill in with current month if empty
        if not monthly_earnings:
            monthly_earnings.append({
                "month": timezone.now().strftime('%Y-%m'),
                "amount": 0.0
            })

        # 6. Recent enrollments
        recent_qs = Enrollment.objects.filter(course__teacher=request.user).order_by('-enrolled_at')[:10]
        recent_enrollments = []
        for enrollment in recent_qs:
            recent_enrollments.append({
                "id": enrollment.id,
                "student_name": enrollment.student.full_name,
                "course_title": enrollment.course.title,
                "price": float(enrollment.course.price),
                "progress_percent": enrollment.progress_percent,
                "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            })

        data = {
            "total_earnings": total_earnings,
            "pending_payout": pending_payout,
            "total_students": total_students,
            "total_courses": total_courses,
            "average_rating": average_rating,
            "monthly_earnings": monthly_earnings,
            "recent_enrollments": recent_enrollments
        }

        return success_response(data=data, message="Ustoz boshqaruv paneli ma'lumotlari")
