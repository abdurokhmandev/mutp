from django.utils import timezone
from django.db import models
from django.db.models import Avg, Sum, Count
from django.db.models.functions import TruncMonth
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from django.shortcuts import get_object_or_404
from apps.core.utils import success_response, error_response
from apps.users.models import User, TeacherProfile
from .models import Category, Course, Module, Lesson, Enrollment, LessonProgress, Review, Certificate, Question, AnswerOption, QuizAttempt, SavedCourse, LessonResource, Homework, HomeworkResource, HomeworkSubmission, CourseInviteLink, EnrollmentRequest
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
    HomeworkSubmissionSerializer,
    CourseInviteLinkSerializer,
    EnrollmentRequestSerializer
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

        if not course.is_free and course.price > 0:
            return error_response(message="Bu kurs pullik. Uni sotib olish uchun to'lov tizimidan foydalaning.", status_code=400)

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
        import traceback
        try:
            try:
                course = Course.objects.get(slug=slug, teacher=request.user)
            except Course.DoesNotExist:
                return error_response(message="Kurs topilmadi", status_code=404)

            if not course.title:
                return error_response(message="Kurs nomi kiritilmagan", status_code=400)

            lesson_count = Lesson.objects.filter(module__course=course).count()
            if lesson_count == 0:
                return error_response(message="Nashr etish uchun kamida 1 ta dars qo'shing", status_code=400)

            # Request data
            is_private       = bool(request.data.get('is_private', False))
            require_approval = bool(request.data.get('require_approval', False))
            raw_max          = request.data.get('max_students')
            max_students     = int(raw_max) if raw_max else None

            # Course status update
            course.status = Course.Status.PUBLISHED

            # is_private fields checking
            if hasattr(course, 'is_private'):
                course.is_private = is_private
            if hasattr(course, 'require_approval'):
                course.require_approval = require_approval
            if hasattr(course, 'max_students'):
                course.max_students = max_students
            if hasattr(course, 'enrollment_limit'):
                course.enrollment_limit = max_students

            course.save()

            # Invite creation
            invite_url = ""
            token = ""
            if is_private:
                try:
                    from apps.courses.models import CourseInvite
                    invite, created = CourseInvite.objects.get_or_create(
                        course=course,
                        is_active=True,
                        defaults={
                            'require_approval': require_approval,
                            'max_students': max_students,
                        }
                    )
                    if not created:
                        invite.require_approval = require_approval
                        invite.max_students = max_students
                        invite.save()

                    invite_url = request.build_absolute_uri(
                        f'/invite/{invite.token}/'
                    )
                    token = invite.token
                except Exception as invite_err:
                    invite_url = ""

            return Response({
                'success': True,
                'message': 'Kurs muvaffaqiyatli nashr etildi',
                'invite_url': invite_url,
                'invite_token': token,
                'is_private': is_private,
                'require_approval': require_approval
            }, status=200)

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Server xatosi: {str(e)}',
                'detail': traceback.format_exc()
            }, status=500)


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


class InviteLinkCreateView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher, IsCourseOwner]

    def post(self, request, slug):
        course = get_object_or_404(Course, slug=slug, teacher=request.user)
        max_uses = request.data.get('max_uses')
        expires_days = request.data.get('expires_days')
        expires_at = None
        if expires_days:
            from django.utils import timezone
            from datetime import timedelta
            expires_at = timezone.now() + timedelta(days=int(expires_days))

        if max_uses:
            max_uses = int(max_uses)
        else:
            max_uses = None

        link = CourseInviteLink.objects.create(
            course=course,
            created_by=request.user,
            max_uses=max_uses,
            expires_at=expires_at
        )
        
        payload = {
            'token': str(link.token),
            'url': f"/invite/{link.token}/",
            'max_uses': link.max_uses
        }
        return Response({
            "success": True,
            "message": "Taklif havolasi yaratildi",
            "data": payload,
            **payload
        })


class InviteLinkListView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def get(self, request, slug):
        course = get_object_or_404(Course, slug=slug, teacher=request.user)
        links = CourseInviteLink.objects.filter(course=course).order_by('-created_at')
        serializer = CourseInviteLinkSerializer(links, many=True)
        return success_response(data=serializer.data)


class InviteLinkToggleView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def patch(self, request, slug, token):
        link = get_object_or_404(CourseInviteLink, token=token, course__slug=slug, course__teacher=request.user)
        link.is_active = not link.is_active
        link.save()
        return success_response(data={'is_active': link.is_active}, message="Havola holati o'zgartirildi")


class InviteLinkDetailView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def delete(self, request, slug, token):
        link = get_object_or_404(CourseInviteLink, token=token, course__slug=slug, course__teacher=request.user)
        link.delete()
        return success_response(message="Havola o'chirildi")


class InviteDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        from .models import CourseInvite, CourseInviteLink
        
        # Try CourseInvite first
        invite = CourseInvite.objects.filter(token=token).first()
        link = None
        if invite:
            course = invite.course
            is_valid = invite.is_active
            reason = None
            if not invite.is_active:
                reason = 'inactive'
            elif invite.max_students and invite.used_count >= invite.max_students:
                is_valid = False
                reason = 'full'
            
            use_count = invite.used_count
            max_uses = invite.max_students
        else:
            # Fallback to CourseInviteLink
            link = get_object_or_404(CourseInviteLink, token=token)
            course = link.course
            is_valid = link.is_valid
            reason = None
            if not link.is_active:
                reason = 'inactive'
            elif link.max_uses and link.use_count >= link.max_uses:
                is_valid = False
                reason = 'full'
            elif link.expires_at and timezone.now() > link.expires_at:
                is_valid = False
                reason = 'expired'
            
            use_count = link.use_count
            max_uses = link.max_uses

        # Enrollment limit check
        if is_valid and (course.enrollment_limit or course.max_students):
            limit = course.max_students or course.enrollment_limit
            current_count = Enrollment.objects.filter(course=course).count()
            if current_count >= limit:
                is_valid = False
                reason = 'full'

        already_enrolled = False
        if request.user.is_authenticated:
            already_enrolled = Enrollment.objects.filter(course=course, student=request.user).exists()

        # Build course data
        course_data = {
            'id': course.id,
            'title': course.title,
            'slug': course.slug,
            'instructor_name': course.teacher.full_name,
            'total_lessons': Lesson.objects.filter(module__course=course).count(),
            'level': course.get_level_display(),
            'price': float(course.price),
            'is_free': course.is_free,
            'thumbnail': request.build_absolute_uri(course.thumbnail.url) if course.thumbnail else None,
            'enrollment_limit': course.max_students or course.enrollment_limit,
            'require_approval': course.require_approval,
        }

        link_info = {
            'is_valid': is_valid,
            'use_count': use_count,
            'max_uses': max_uses,
            'already_enrolled': already_enrolled,
            'reason': reason
        }

        return success_response(data={
            'course': course_data,
            'link_info': link_info
        })


class InviteJoinView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        from .models import CourseInvite, CourseInviteLink
        
        invite = CourseInvite.objects.filter(token=token).first()
        link = None
        
        if invite:
            course = invite.course
            is_valid = invite.is_active
            if invite.max_students and invite.used_count >= invite.max_students:
                is_valid = False
        else:
            link = get_object_or_404(CourseInviteLink, token=token)
            course = link.course
            is_valid = link.is_valid

        if not is_valid:
            return error_response(message="Havola muddati o'tgan yoki noto'g'ri")

        # Limit tekshiruvi
        limit = course.max_students or course.enrollment_limit
        current_count = Enrollment.objects.filter(course=course).count()
        if limit and current_count >= limit:
            return error_response(message=f"Kursga maksimal o'quvchilar ({limit} ta) yozilgan")

        # Allaqachon yozilganmi?
        if Enrollment.objects.filter(course=course, student=request.user).exists():
            return error_response(message="Siz allaqachon bu kursga yozilgangiz")

        from apps.notifications.models import Notification

        if course.require_approval:
            # So'rov yaratish
            req, created = EnrollmentRequest.objects.get_or_create(
                course=course, student=request.user,
                defaults={'invite_link': link, 'message': request.data.get('message', '')}
            )
            if not created:
                return error_response(message="So'rovingiz allaqachon yuborilgan")
            
            # Ustozga notification
            Notification.objects.create(
                recipient=course.teacher,
                type='enrollment_request',
                title='Yangi yozilish so\'rovi',
                message=f'{request.user.full_name} "{course.title}" kursiga kirishni so\'radi',
                link='dashboard-teacher.html#requests-section'
            )
            return success_response(data={'status': 'pending', 'message': "So'rovingiz ustozga yuborildi"})
        else:
            # Darhol yozilish
            Enrollment.objects.create(course=course, student=request.user)
            if invite:
                invite.used_count += 1
                invite.save()
            elif link:
                link.use_count += 1
                link.save()
                
            Notification.objects.create(
                recipient=course.teacher,
                type='new_enrollment',
                title='Yangi o\'quvchi',
                message=f'{request.user.full_name} "{course.title}" kursiga yozildi',
                link='dashboard-teacher.html#students-section'
            )
            return success_response(data={'status': 'enrolled', 'course_slug': course.slug, 'message': "Muvaffaqiyatli yozildingiz!"})


class EnrollmentRequestListView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def get(self, request):
        status = request.query_params.get('status', 'pending')
        course_slug = request.query_params.get('course')

        qs = EnrollmentRequest.objects.filter(course__teacher=request.user)
        if status:
            qs = qs.filter(status=status)
        if course_slug:
            qs = qs.filter(course__slug=course_slug)

        serializer = EnrollmentRequestSerializer(qs, many=True)
        return success_response(data=serializer.data)


class EnrollmentApproveView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def post(self, request, req_id):
        req = get_object_or_404(EnrollmentRequest, id=req_id, course__teacher=request.user)
        req.status = 'approved'
        req.reviewed_at = timezone.now()
        req.save()
        # Enrollment yaratish
        Enrollment.objects.get_or_create(course=req.course, student=req.student)
        if req.invite_link:
            req.invite_link.use_count += 1
            req.invite_link.save()
        # O'quvchiga notification
        from apps.notifications.models import Notification
        Notification.objects.create(
            recipient=req.student,
            type='enrollment_approved',
            title='Kursga qabul qilindingiz! 🎉',
            message=f'"{req.course.title}" kursiga kirishingiz tasdiqlandi',
            link=f'course-detail.html?slug={req.course.slug}'
        )
        return success_response(message="Muvaffaqiyatli tasdiqlandi")


class EnrollmentRejectView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def post(self, request, req_id):
        req = get_object_or_404(EnrollmentRequest, id=req_id, course__teacher=request.user)
        req.status = 'rejected'
        req.reviewed_at = timezone.now()
        req.save()
        # O'quvchiga notification
        from apps.notifications.models import Notification
        reason = request.data.get('reason', '')
        Notification.objects.create(
            recipient=req.student,
            type='enrollment_rejected',
            title='Kursga kirish rad etildi',
            message=f'"{req.course.title}" kursiga kirishingiz rad etildi. Sabab: {reason}',
            link='courses.html'
        )
        return success_response(message="Rad etildi")


class EnrolledStudentsListView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedTeacher]

    def get(self, request, slug):
        course = get_object_or_404(Course, slug=slug, teacher=request.user)
        enrollments = Enrollment.objects.filter(course=course).select_related('student').order_by('-enrolled_at')
        
        data = []
        for e in enrollments:
            data.append({
                'id': e.id,
                'student_id': e.student.id,
                'student_name': e.student.full_name,
                'avatar': request.build_absolute_uri(e.student.avatar.url) if e.student.avatar else None,
                'enrolled_at': e.enrolled_at,
                'progress_percent': e.progress_percent,
                'is_completed': e.is_completed
            })
        return success_response(data=data)

    def delete(self, request, slug):
        course = get_object_or_404(Course, slug=slug, teacher=request.user)
        student_id = request.data.get('student_id') or request.query_params.get('student_id')
        if not student_id:
            return error_response(message="Student ID berilmagan")
        enrollment = get_object_or_404(Enrollment, course=course, student_id=student_id)
        enrollment.delete()
        return success_response(message="O'quvchi kursdan chiqarildi")

    def post(self, request, slug):
        course = get_object_or_404(Course, slug=slug, teacher=request.user)
        email = request.data.get('email')
        if not email:
            return error_response(message="Email manzili kiritilmagan")
        try:
            student = User.objects.get(email=email, role='student')
        except User.DoesNotExist:
            return error_response(message="Bunday o'quvchi topilmadi")
            
        enrollment, created = Enrollment.objects.get_or_create(course=course, student=student)
        if not created:
            return error_response(message="O'quvchi allaqachon kursga qo'shilgan")
            
        return success_response(message="O'quvchi muvaffaqiyatli qo'shildi")


