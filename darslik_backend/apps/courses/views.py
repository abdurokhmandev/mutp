from django.utils import timezone
from django.db import models
from django.db.models import Avg, Sum, Count
from django.db.models.functions import TruncMonth
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from apps.core.utils import success_response, error_response
from apps.users.models import User, TeacherProfile
from .models import Category, Course, Module, Lesson, Enrollment, LessonProgress, Review, Certificate, Question, AnswerOption, QuizAttempt, SavedCourse, LessonResource, Homework, HomeworkResource, HomeworkSubmission
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
    AnswerOptionSerializer,
    LessonResourceSerializer,
    HomeworkSerializer,
    HomeworkResourceSerializer,
    HomeworkSubmissionSerializer
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


class SaveCourseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        try:
            course = Course.objects.get(slug=slug, status=Course.Status.PUBLISHED)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        saved_course = SavedCourse.objects.filter(user=request.user, course=course)
        if saved_course.exists():
            saved_course.delete()
            return success_response(data={"saved": False}, message="Kurs saqlanganlardan olib tashlandi")
        else:
            SavedCourse.objects.create(user=request.user, course=course)
            return success_response(data={"saved": True}, message="Kurs muvaffaqiyatli saqlandi")


class SavedCoursesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        saved_relations = SavedCourse.objects.filter(user=request.user).select_related('course')
        courses = [rel.course for rel in saved_relations]
        
        # Paginate courses
        paginator = CoursePagination()
        paginated_courses = paginator.paginate_queryset(courses, request, view=self)
        
        serializer = CourseListSerializer(paginated_courses, many=True, context={'request': request})
        paginated_data = paginator.get_paginated_response(serializer.data).data
        return success_response(data=paginated_data, message="Saqlangan kurslar ro'yxati")


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
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsVerifiedTeacher()]
        return [IsAuthenticated(), IsEnrolledOrFreePreview()]

    def get(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        self.check_object_permissions(request, lesson)

        questions = Question.objects.filter(lesson=lesson)
        serializer = QuestionSerializer(questions, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Quiz savollari")

    def post(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        if lesson.module.course.teacher != request.user:
            return error_response(message="Ushbu dars sizga tegishli emas", status_code=403)

        # delete old questions and create new ones (full replace)
        lesson.questions.all().delete()
        for q_idx, q_data in enumerate(request.data.get('questions', [])):
            text = q_data.get('text', '').strip()
            if not text:
                continue
            question = Question.objects.create(
                lesson=lesson,
                text=text,
                order=q_data.get('order', q_idx)
            )
            for opt in q_data.get('options', []):
                opt_text = opt.get('text', '').strip()
                if not opt_text:
                    continue
                AnswerOption.objects.create(
                    question=question,
                    text=opt_text,
                    is_correct=bool(opt.get('is_correct', False))
                )
        return success_response(data={'success': True}, message="Test savollari muvaffaqiyatli saqlandi")


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

        raw_answers = request.data.get('answers', {})
        answers = {}
        if isinstance(raw_answers, list):
            for item in raw_answers:
                if isinstance(item, dict) and 'question_id' in item:
                    answers[str(item['question_id'])] = item.get('answer_id')
        elif isinstance(raw_answers, dict):
            answers = raw_answers

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


class LessonResourceCreateView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def post(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        if lesson.module.course.teacher != request.user:
            return error_response(message="Ushbu dars sizga tegishli emas", status_code=403)

        title = request.data.get('title')
        resource_type = request.data.get('resource_type', 'file')

        if not title:
            return error_response(message="Resurs nomi kiritilishi shart", status_code=400)

        file_obj = request.FILES.get('file')
        url = request.data.get('url', '')

        if resource_type == 'file':
            if not file_obj:
                return error_response(message="Fayl yuklanishi shart", status_code=400)
            
            # File validation
            if file_obj.size > 10 * 1024 * 1024:
                return error_response(message="Fayl hajmi 10 MB dan oshmasligi kerak", status_code=400)
            
            ext = file_obj.name.split('.')[-1].lower()
            allowed_extensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'zip', 'jpg', 'png']
            if ext not in allowed_extensions:
                return error_response(
                    message=f"Ruxsat berilmagan fayl turi. Ruxsat etilganlar: {', '.join(allowed_extensions)}",
                    status_code=400
                )
        elif resource_type == 'link':
            if not url:
                return error_response(message="Havola kiritilishi shart", status_code=400)

        # Set order
        max_order = lesson.resources.aggregate(m=models.Max('order'))['m'] or 0
        order = max_order + 1

        resource = LessonResource.objects.create(
            lesson=lesson,
            title=title,
            resource_type=resource_type,
            file=file_obj if resource_type == 'file' else None,
            url=url if resource_type == 'link' else '',
            order=order
        )

        serializer = LessonResourceSerializer(resource, context={'request': request})
        return success_response(data=serializer.data, message="Dars resursi qo'shildi", status_code=201)



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

    def delete(self, request, slug):
        try:
            course = Course.objects.get(slug=slug, teacher=request.user)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        course.delete()
        return success_response(message="Kurs muvaffaqiyatli o'chirildi")



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

        if module.course.teacher != request.user:
            return error_response(message="Ushbu kurs sizga tegishli emas", status_code=403)

        title = request.data.get('title')
        order = request.data.get('order')
        lesson_type = request.data.get('lesson_type', Lesson.LessonType.VIDEO)
        video_url = request.data.get('video_url', '') or ''
        content = request.data.get('content', '')
        text_content = request.data.get('text_content', '')
        live_url = request.data.get('live_url', '') or ''
        live_scheduled = request.data.get('live_scheduled') or None

        homework_description = request.data.get('homework_description', '')
        homework_deadline_days = request.data.get('homework_deadline_days')
        if homework_deadline_days == '' or homework_deadline_days is None:
            homework_deadline_days = None
        else:
            try:
                homework_deadline_days = int(homework_deadline_days)
            except ValueError:
                homework_deadline_days = None

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
        
        # O'zaro tozalash (Backend logic)
        if lesson_type == Lesson.LessonType.VIDEO:
            if video_url:
                video_file = None
            elif video_file:
                video_url = ''
        else:
            video_url = ''
            video_file = None

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
                text_content=text_content,
                live_url=live_url,
                live_scheduled=live_scheduled,
                is_free_preview=is_free_preview,
                homework_description=homework_description,
                homework_deadline_days=homework_deadline_days
            )
        except Exception as e:
            return error_response(message="Dars yaratishda xatolik", errors=str(e), status_code=400)

        serializer = LessonSerializer(lesson, context={'request': request})
        return success_response(data=serializer.data, message="Modulga yangi dars qo'shildi", status_code=201)


class LessonUpdateView(APIView):
    permission_classes = [IsVerifiedTeacher]

    def patch(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        if lesson.module.course.teacher != request.user:
            return error_response(message="Ushbu dars sizga tegishli emas", status_code=403)

        title = request.data.get('title')
        lesson_type = request.data.get('lesson_type')
        video_url = request.data.get('video_url')
        content = request.data.get('content')
        text_content = request.data.get('text_content')
        live_url = request.data.get('live_url')
        live_scheduled = request.data.get('live_scheduled')
        is_free_preview = request.data.get('is_free_preview')
        homework_description = request.data.get('homework_description')
        homework_deadline_days = request.data.get('homework_deadline_days')

        if title is not None:
            lesson.title = title
        if lesson_type is not None:
            lesson.lesson_type = lesson_type
        if content is not None:
            lesson.content = content
        if text_content is not None:
            lesson.text_content = text_content
        if live_url is not None:
            lesson.live_url = live_url
        if live_scheduled is not None:
            lesson.live_scheduled = live_scheduled
        if is_free_preview is not None:
            lesson.is_free_preview = str(is_free_preview).lower() in ('true', '1', 'yes')
        
        if homework_description is not None:
            lesson.homework_description = homework_description
        if homework_deadline_days is not None:
            if homework_deadline_days == '' or homework_deadline_days is None:
                lesson.homework_deadline_days = None
            else:
                try:
                    lesson.homework_deadline_days = int(homework_deadline_days)
                except ValueError:
                    lesson.homework_deadline_days = None

        # O'zaro tozalash va video manba yangilash
        video_file = request.FILES.get('video_file')
        if lesson.lesson_type == Lesson.LessonType.VIDEO:
            if video_file:
                lesson.video_file = video_file
                lesson.video_url = ''
            elif video_url is not None:
                lesson.video_url = video_url
                if video_url != '':
                    lesson.video_file = None
        else:
            lesson.video_url = ''
            lesson.video_file = None

        lesson.save()
        serializer = LessonSerializer(lesson, context={'request': request})
        return success_response(data=serializer.data, message="Dars muvaffaqiyatli yangilandi")

    def delete(self, request, id):
        try:
            lesson = Lesson.objects.get(id=id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        if lesson.module.course.teacher != request.user:
            return error_response(message="Ushbu dars sizga tegishli emas", status_code=403)

        lesson.delete()
        return success_response(message="Dars muvaffaqiyatli o'chirildi")


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


class LessonResourceDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def delete(self, request, id):
        try:
            res = LessonResource.objects.get(id=id)
        except LessonResource.DoesNotExist:
            return error_response(message="Resurs topilmadi", status_code=404)
        
        if res.lesson.module.course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)
            
        res.delete()
        return success_response(message="Resurs o'chirildi")


class StudentCourseHomeworksView(APIView):
    """O'quvchi uchun kurs vazifalari ro'yxati"""
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        # Check enrollment (teacher can also view)
        is_teacher = course.teacher == request.user
        is_enrolled = Enrollment.objects.filter(student=request.user, course=course).exists()

        if not is_teacher and not is_enrolled:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        homeworks = Homework.objects.filter(course=course).order_by('order')
        serializer = HomeworkSerializer(homeworks, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Kurs vazifalari")



class HomeworkListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        homeworks = Homework.objects.filter(course=course).order_by('order')
        serializer = HomeworkSerializer(homeworks, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Kurs vazifalari ro'yxati")

    def post(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return error_response(message="Kurs topilmadi", status_code=404)

        if course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        title = request.data.get('title')
        description = request.data.get('description')
        after_lesson_id = request.data.get('after_lesson')
        deadline_days = request.data.get('deadline_days')

        if not title:
            return error_response(message="Vazifa sarlavhasi kiritilishi shart", status_code=400)

        after_lesson = None
        if after_lesson_id:
            try:
                after_lesson = Lesson.objects.get(id=after_lesson_id)
            except Lesson.DoesNotExist:
                return error_response(message="Tanlangan dars topilmadi", status_code=400)

        if deadline_days == '' or deadline_days is None:
            deadline_days = None
        else:
            try:
                deadline_days = int(deadline_days)
            except ValueError:
                deadline_days = None

        max_order = Homework.objects.filter(course=course).aggregate(m=models.Max('order'))['m'] or 0
        homework = Homework.objects.create(
            course=course,
            title=title,
            description=description or '',
            after_lesson=after_lesson,
            deadline_days=deadline_days,
            order=max_order + 1
        )

        serializer = HomeworkSerializer(homework, context={'request': request})
        return success_response(data=serializer.data, message="Vazifa yaratildi", status_code=201)


class HomeworkDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        try:
            homework = Homework.objects.get(id=id)
        except Homework.DoesNotExist:
            return error_response(message="Vazifa topilmadi", status_code=404)

        if homework.course.teacher != request.user and not Enrollment.objects.filter(student=request.user, course=homework.course).exists():
            return error_response(message="Ruxsat berilmagan", status_code=403)

        serializer = HomeworkSerializer(homework, context={'request': request})
        return success_response(data=serializer.data, message="Vazifa batafsil ma'lumoti")

    def patch(self, request, id):
        try:
            homework = Homework.objects.get(id=id)
        except Homework.DoesNotExist:
            return error_response(message="Vazifa topilmadi", status_code=404)

        if homework.course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        title = request.data.get('title')
        description = request.data.get('description')
        after_lesson_id = request.data.get('after_lesson')
        deadline_days = request.data.get('deadline_days')

        if title is not None:
            homework.title = title
        if description is not None:
            homework.description = description
        if after_lesson_id is not None:
            if after_lesson_id == '' or after_lesson_id is None:
                homework.after_lesson = None
            else:
                try:
                    homework.after_lesson = Lesson.objects.get(id=after_lesson_id)
                except Lesson.DoesNotExist:
                    return error_response(message="Tanlangan dars topilmadi", status_code=400)
        if deadline_days is not None:
            if deadline_days == '' or deadline_days is None:
                homework.deadline_days = None
            else:
                try:
                    homework.deadline_days = int(deadline_days)
                except ValueError:
                    homework.deadline_days = None

        homework.save()
        serializer = HomeworkSerializer(homework, context={'request': request})
        return success_response(data=serializer.data, message="Vazifa yangilandi")

    def delete(self, request, id):
        try:
            homework = Homework.objects.get(id=id)
        except Homework.DoesNotExist:
            return error_response(message="Vazifa topilmadi", status_code=404)

        if homework.course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        homework.delete()
        return success_response(message="Vazifa o'chirildi")


class HomeworkSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        try:
            homework = Homework.objects.get(id=id)
        except Homework.DoesNotExist:
            return error_response(message="Vazifa topilmadi", status_code=404)

        if not Enrollment.objects.filter(student=request.user, course=homework.course).exists():
            return error_response(message="Siz ushbu kursga yozilmagansiz", status_code=403)

        submission, created = HomeworkSubmission.objects.get_or_create(
            homework=homework,
            student=request.user
        )

        if homework.type == 'quiz':
            raw_answers = request.data.get('answers', {})
            answers = {}
            if isinstance(raw_answers, list):
                for item in raw_answers:
                    if isinstance(item, dict) and 'question_id' in item:
                        answers[str(item['question_id'])] = item.get('answer_id')
            elif isinstance(raw_answers, dict):
                answers = raw_answers

            questions = Question.objects.filter(homework=homework)
            total = questions.count()
            if total == 0:
                return error_response(message="Ushbu vazifa uchun test savollari mavjud emas", status_code=400)

            correct_count = 0
            for q in questions:
                selected_option_id = answers.get(str(q.id))
                correct_option = AnswerOption.objects.filter(question=q, is_correct=True).first()
                if selected_option_id and correct_option and int(selected_option_id) == correct_option.id:
                    correct_count += 1

            score = (correct_count / total) * 100.0
            submission.quiz_score = score
            submission.status = 'submitted'
            submission.submitted_at = timezone.now()
            submission.completed_at = timezone.now()
            submission.save()
        else:
            # Written/File homework
            text_answer = request.data.get('text_answer', '')
            file_answer = request.FILES.get('file_answer', None)

            submission.text_answer = text_answer
            if file_answer:
                submission.file_answer = file_answer
            submission.status = 'submitted'
            submission.submitted_at = timezone.now()
            submission.completed_at = timezone.now()
            submission.save()

        # Update lesson progress if appropriate
        if homework.after_lesson:
            enrollment = Enrollment.objects.filter(student=request.user, course=homework.course).first()
            if enrollment:
                progress, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=homework.after_lesson)
                progress.is_completed = True
                progress.save()

        serializer = HomeworkSubmissionSerializer(submission, context={'request': request})
        return success_response(data=serializer.data, message="Vazifa topshirildi")


class HomeworkResourceCreateView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def post(self, request, id):
        try:
            homework = Homework.objects.get(id=id)
        except Homework.DoesNotExist:
            return error_response(message="Vazifa topilmadi", status_code=404)

        if homework.course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        title = request.data.get('title')
        r_type = request.data.get('resource_type', 'file')
        
        if not title:
            return error_response(message="Sarlavha kiritilishi shart", status_code=400)

        file = request.FILES.get('file')
        url = request.data.get('url', '')

        if r_type == 'file' and not file:
            return error_response(message="Fayl tanlanmagan", status_code=400)
        if r_type == 'link' and not url:
            return error_response(message="Havola kiritilmagan", status_code=400)

        res = HomeworkResource.objects.create(
            homework=homework,
            title=title,
            resource_type=r_type,
            file=file if r_type == 'file' else None,
            url=url if r_type == 'link' else ''
        )

        serializer = HomeworkResourceSerializer(res)
        return success_response(data=serializer.data, message="Material qo'shildi", status_code=201)


class HomeworkResourceDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def delete(self, request, id):
        try:
            res = HomeworkResource.objects.get(id=id)
        except HomeworkResource.DoesNotExist:
            return error_response(message="Resurs topilmadi", status_code=404)

        if res.homework.course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        res.delete()
        return success_response(message="Material o'chirildi")


class LessonHomeworksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, lesson_id):
        try:
            lesson = Lesson.objects.get(id=lesson_id)
        except Lesson.DoesNotExist:
            return error_response(message="Dars topilmadi", status_code=404)

        if not Enrollment.objects.filter(student=request.user, course=lesson.module.course).exists() and lesson.module.course.teacher != request.user:
            return error_response(message="Siz ushbu kursga yozilmagansiz", status_code=403)

        homeworks = Homework.objects.filter(after_lesson=lesson).order_by('order')
        serializer = HomeworkSerializer(homeworks, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Dars vazifalari")


class TeacherHomeworksListView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def get(self, request):
        homeworks = Homework.objects.filter(course__teacher=request.user).order_by('-created_at')
        data = []
        for hw in homeworks:
            sub_count = HomeworkSubmission.objects.filter(homework=hw, status='submitted').count()
            data.append({
                'id': hw.id,
                'title': hw.title,
                'course_title': hw.course.title,
                'submission_count': sub_count,
                'type': hw.type,
                'deadline_days': hw.deadline_days
            })
        return success_response(data=data, message="Ustoz vazifalari ro'yxati")


class TeacherHomeworkSubmissionsView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def get(self, request, hw_id):
        from django.shortcuts import get_object_or_404
        homework = get_object_or_404(Homework, id=hw_id)
        if homework.course.teacher != request.user:
            return error_response(message="Ruxsat berilmagan", status_code=403)

        submissions = HomeworkSubmission.objects.filter(homework=homework).order_by('-submitted_at')
        serializer = HomeworkSubmissionSerializer(submissions, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Vazifa topshiriqlari")


class HomeworkReviewView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def post(self, request, sub_id):
        from django.shortcuts import get_object_or_404
        from apps.notifications.models import Notification
        submission = get_object_or_404(HomeworkSubmission, id=sub_id)
        if submission.homework.course.teacher != request.user:
            return error_response(message="Ruxsat yo'q", status_code=403)

        submission.feedback = request.data.get('feedback', '')
        score = request.data.get('score', None)
        if score is not None:
            try:
                submission.teacher_score = int(score)
            except ValueError:
                pass
        submission.status = 'reviewed'
        submission.reviewed_at = timezone.now()
        submission.save()

        # Notification — o'quvchiga "Ustozingiz vazifangizni tekshirdi"
        Notification.objects.create(
            recipient=submission.student,
            type='homework_reviewed',
            title='Vazifa tekshirildi',
            message=f'"{submission.homework.title}" vazifangiz tekshirildi. Ball: {submission.teacher_score}/100',
            link=f'homework.html?id={submission.homework.id}'
        )
        return success_response(message="Vazifa tekshirildi")


class StudentHomeworkListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        enrolled_courses = Enrollment.objects.filter(
            student=request.user
        ).values_list('course_id', flat=True)

        homeworks = Homework.objects.filter(
            course_id__in=enrolled_courses
        ).select_related('course').prefetch_related('submissions')

        data = []
        for hw in homeworks:
            submission = hw.submissions.filter(student=request.user).first()
            data.append({
                'id': hw.id,
                'title': hw.title,
                'type': hw.type,
                'deadline_days': hw.deadline_days,
                'course_id': hw.course.id,
                'course_title': hw.course.title,
                'my_submission': {
                    'status': submission.status if submission else 'pending',
                    'teacher_score': submission.teacher_score if submission else None,
                    'feedback': submission.feedback if submission else None,
                    'submitted_at': submission.submitted_at if submission else None,
                    'reviewed_at': submission.reviewed_at if submission else None,
                } if submission else None
            })
        return success_response(data=data, message="O'quvchi vazifalari ro'yxati")

