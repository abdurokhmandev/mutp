from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsTeacher(BasePermission):
    """Faqat o'qituvchilar"""
    message = "Bu amalni faqat o'qituvchilar bajarishi mumkin."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'teacher'
        )


class IsVerifiedTeacher(BasePermission):
    """Faqat tasdiqlangan o'qituvchilar"""
    message = "Sizning o'qituvchi akkauntingiz hali tasdiqlanmagan."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'teacher' and
            request.user.is_verified
        )


class IsCourseOwner(BasePermission):
    """Faqat kurs egasi o'zgartira oladi"""
    message = "Bu kurs sizga tegishli emas."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        # If obj is Course
        if hasattr(obj, 'teacher'):
            return obj.teacher == request.user
        # If obj is Module
        if hasattr(obj, 'course'):
            return obj.course.teacher == request.user
        return False


class IsEnrolledStudent(BasePermission):
    """Faqat yozilgan o'quvchilar kirishi mumkin"""
    message = "Bu kursga yozilmagan foydalanuvchi kirisha olmaydi."

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Allow staff and superusers
        if request.user.is_staff or request.user.is_superuser:
            return True

        # obj can be a Lesson or Course
        # If Lesson
        if hasattr(obj, 'is_free_preview') and obj.is_free_preview:
            return True
            
        course = obj
        if hasattr(obj, 'module'):  # Lesson
            course = obj.module.course
        elif hasattr(obj, 'course'):  # Module
            course = obj.course
            
        # Allow course author (teacher)
        if course.teacher == request.user:
            return True

        from apps.courses.models import Enrollment
        return Enrollment.objects.filter(
            student=request.user,
            course=course
        ).exists()


# Alias class to maintain compatibility with Prompt 3 specifications
class IsEnrolledOrFreePreview(IsEnrolledStudent):
    pass
