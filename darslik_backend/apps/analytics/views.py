from datetime import timedelta
from django.db.models import Sum, Count
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.core.utils import success_response, error_response
from apps.courses.models import Enrollment, LessonProgress, Lesson, Certificate
from .models import DailyStudyLog
from .utils import get_streak, get_weekly_activity


class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return error_response(message="Ushbu sahifa faqat talabalar uchun ochiq", status_code=403)

        user = request.user

        # Profile details
        avatar_url = None
        if user.avatar:
            avatar_url = request.build_absolute_uri(user.avatar.url)

        user_data = {
            "id": user.id,
            "full_name": user.full_name,
            "avatar": avatar_url
        }

        # Calculations
        # 1. Streaks & Logs
        current_streak = get_streak(user)
        longest_streak = self.get_longest_streak(user)
        
        total_seconds = DailyStudyLog.objects.filter(student=user).aggregate(total=Sum('seconds_studied'))['total'] or 0
        total_hours_studied = round(total_seconds / 3600.0, 1)

        # 2. Enrollment Counts
        total_enrolled = Enrollment.objects.filter(student=user).count()
        completed_courses = Enrollment.objects.filter(student=user, is_completed=True).count()
        certificates_count = Certificate.objects.filter(enrollment__student=user).count()

        stats = {
            "total_enrolled": total_enrolled,
            "completed_courses": completed_courses,
            "certificates_count": certificates_count,
            "total_hours_studied": total_hours_studied,
            "current_streak": current_streak,
            "longest_streak": longest_streak
        }

        # 3. Weekly activity
        weekly_activity = get_weekly_activity(user)

        # 4. In progress courses
        in_progress_qs = Enrollment.objects.filter(student=user, is_completed=False)
        in_progress_courses = []
        for enrollment in in_progress_qs:
            course = enrollment.course
            
            # Find last watched lesson
            last_progress = LessonProgress.objects.filter(
                enrollment=enrollment
            ).order_by('-last_watched').first()
            
            last_lesson_id = None
            last_lesson_title = None
            if last_progress:
                last_lesson_id = last_progress.lesson.id
                last_lesson_title = last_progress.lesson.title
            else:
                # Fallback to first lesson
                first_lesson = Lesson.objects.filter(
                    module__course=course
                ).order_by('module__order', 'order').first()
                if first_lesson:
                    last_lesson_id = first_lesson.id
                    last_lesson_title = first_lesson.title

            thumb_url = None
            if course.thumbnail:
                thumb_url = request.build_absolute_uri(course.thumbnail.url)

            in_progress_courses.append({
                "enrollment_id": enrollment.id,
                "course_title": course.title,
                "course_slug": course.slug,
                "thumbnail": thumb_url,
                "progress_percent": enrollment.progress_percent,
                "last_lesson_id": last_lesson_id,
                "last_lesson_title": last_lesson_title
            })

        # 5. Recent certificates
        cert_qs = Certificate.objects.filter(enrollment__student=user).order_by('-issued_at')[:5]
        recent_certificates = []
        for cert in cert_qs:
            recent_certificates.append({
                "unique_code": cert.unique_code,
                "course_title": cert.enrollment.course.title,
                "issued_at": cert.issued_at
            })

        data = {
            "user": user_data,
            "stats": stats,
            "weekly_activity": weekly_activity,
            "in_progress_courses": in_progress_courses,
            "recent_certificates": recent_certificates
        }

        return success_response(data=data, message="Talaba boshqaruv paneli ma'lumotlari")

    def get_longest_streak(self, user):
        logs = DailyStudyLog.objects.filter(student=user).order_by('date')
        if not logs.exists():
            return 0
        
        max_streak = 0
        current_streak = 0
        prev_date = None
        
        for log in logs:
            if prev_date is None:
                current_streak = 1
            elif log.date == prev_date + timedelta(days=1):
                current_streak += 1
            elif log.date == prev_date:
                pass
            else:
                max_streak = max(max_streak, current_streak)
                current_streak = 1
            prev_date = log.date
            
        max_streak = max(max_streak, current_streak)
        return max_streak
