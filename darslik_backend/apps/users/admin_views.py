from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.shortcuts import get_object_or_404
from apps.users.models import User, TeacherProfile
from apps.courses.models import Course, Category, Enrollment
from django.db import models

# Render custom CRM HTML
class AdminCRMPageView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return render(request, 'admin-crm.html')


# 1. Stats View
class AdminCRMStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        total_students = User.objects.filter(role=User.Role.STUDENT).count()
        total_teachers = User.objects.filter(role=User.Role.TEACHER).count()
        unverified_teachers = User.objects.filter(role=User.Role.TEACHER, is_verified=False).count()
        total_courses = Course.objects.count()
        review_courses = Course.objects.filter(status=Course.Status.REVIEW).count()
        total_enrollments = Enrollment.objects.count()
        
        # Calculate simulated platform volume (sum of all course prices enrolled)
        # For simplicity, sum of prices of enrolled courses
        total_volume = sum([e.course.price for e in Enrollment.objects.all() if e.course])

        return Response({
            'success': True,
            'data': {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'unverified_teachers': unverified_teachers,
                'total_courses': total_courses,
                'review_courses': review_courses,
                'total_enrollments': total_enrollments,
                'total_volume': float(total_volume)
            }
        })


# 2. Teachers View
class AdminCRMTeachersView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        teachers = User.objects.filter(role=User.Role.TEACHER).order_by('-created_at')
        data = []
        for t in teachers:
            profile = getattr(t, 'teacher_profile', None)
            data.append({
                'id': t.id,
                'full_name': t.get_full_name() or t.username,
                'phone': t.phone or 'Kiritilmagan',
                'email': t.email,
                'is_verified': t.is_verified,
                'specialization': profile.specialization if profile else '',
                'created_at': t.created_at.strftime('%Y-%m-%d %H:%M')
            })
        return Response({'success': True, 'data': data})

    def post(self, request, pk):
        # Toggle verification status
        teacher = get_object_or_404(User, id=pk, role=User.Role.TEACHER)
        teacher.is_verified = not teacher.is_verified
        teacher.save(update_fields=['is_verified'])
        
        status_text = "tasdiqlandi" if teacher.is_verified else "tasdiq bekor qilindi"
        return Response({
            'success': True,
            'message': f"O'qituvchi muvaffaqiyatli {status_text}.",
            'is_verified': teacher.is_verified
        })


# 3. Courses View
class AdminCRMCoursesView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        courses = Course.objects.all().order_by('-id')
        data = []
        for c in courses:
            data.append({
                'id': c.id,
                'title': c.title,
                'teacher': c.teacher.get_full_name() or c.teacher.username,
                'category': c.category.name if c.category else 'Kategoriya yo\'q',
                'price': float(c.price),
                'status': c.status,
                'status_display': c.get_status_display(),
                'slug': c.slug
            })
        return Response({'success': True, 'data': data})

    def post(self, request, pk):
        course = get_object_or_404(Course, id=pk)
        new_status = request.data.get('status')
        if new_status in [choice[0] for choice in Course.Status.choices]:
            course.status = new_status
            course.save(update_fields=['status'])
            return Response({
                'success': True,
                'message': f"Kurs holati '{course.get_status_display()}' ga o'zgartirildi.",
                'status': course.status
            })
        return Response({'success': False, 'message': "Noto'g'ri status kiritildi."}, status=400)


# 4. Users View
class AdminCRMUsersView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = User.objects.all().order_by('-created_at')[:100]  # Limit to last 100 for safety
        data = []
        for u in users:
            data.append({
                'id': u.id,
                'full_name': u.get_full_name() or u.username,
                'phone': u.phone or 'Kiritilmagan',
                'email': u.email or 'Kiritilmagan',
                'role': u.role,
                'role_display': u.get_role_display() if hasattr(u, 'get_role_display') else u.role,
                'is_active': u.is_active,
                'created_at': u.created_at.strftime('%Y-%m-%d %H:%M')
            })
        return Response({'success': True, 'data': data})

    def post(self, request, pk):
        user = get_object_or_404(User, id=pk)
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        status_text = "faollashtirildi" if user.is_active else "faolsizlantirildi"
        return Response({
            'success': True,
            'message': f"Foydalanuvchi muvaffaqiyatli {status_text}.",
            'is_active': user.is_active
        })
