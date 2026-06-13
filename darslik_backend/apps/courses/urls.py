from django.urls import path
from .views import (
    CategoryListView,
    CourseListView,
    CourseDetailView,
    EnrollView,
    MyEnrollmentsView,
    LessonDetailView,
    LessonProgressUpdateView,
    LessonQuizView,
    LessonQuizSubmitView,
    ReviewCreateView,
    CertificateView,
    TeacherCourseListView,
    TeacherCourseDetailView,
    CourseCreateView,
    CourseUpdateView,
    CoursePublishView,
    ModuleCreateView,
    LessonCreateView,
    TeacherDashboardView
)

urlpatterns = [
    # Ommaviy
    path('categories/',                  CategoryListView.as_view(), name='category_list'),
    path('',                             CourseListView.as_view(), name='course_list'),
    path('<slug:slug>/',                 CourseDetailView.as_view(), name='course_detail'),
    path('<slug:slug>/enroll/',          EnrollView.as_view(), name='enroll'),
    path('<slug:slug>/review/',          ReviewCreateView.as_view(), name='review_create'),

    # Darslar
    path('lessons/<int:id>/',            LessonDetailView.as_view(), name='lesson_detail'),
    path('lessons/<int:id>/progress/',   LessonProgressUpdateView.as_view(), name='lesson_progress'),
    path('lessons/<int:id>/quiz/',       LessonQuizView.as_view(), name='lesson_quiz'),
    path('lessons/<int:id>/quiz/submit/', LessonQuizSubmitView.as_view(), name='lesson_quiz_submit'),

    # Sertifikat
    path('certificates/<str:code>/',     CertificateView.as_view(), name='certificate_view'),

    # O'quvchi
    path('student/enrollments/',         MyEnrollmentsView.as_view(), name='my_enrollments'),

    # O'qituvchi
    path('teacher/dashboard/',           TeacherDashboardView.as_view(), name='teacher_dashboard'),
    path('teacher/courses/',             TeacherCourseListView.as_view(), name='teacher_courses'),
    path('teacher/courses/create/',      CourseCreateView.as_view(), name='course_create'),
    path('teacher/courses/<slug:slug>/', TeacherCourseDetailView.as_view(), name='teacher_course_detail'),
    path('teacher/courses/<slug:slug>/update/', CourseUpdateView.as_view(), name='course_update'),
    path('teacher/courses/<slug:slug>/publish/', CoursePublishView.as_view(), name='course_publish'),
    path('teacher/courses/<slug:slug>/modules/', ModuleCreateView.as_view(), name='module_create'),
    path('teacher/modules/<int:id>/lessons/',    LessonCreateView.as_view(), name='lesson_create'),
]

