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
    LessonResourceCreateView,
    LessonResourceDeleteView,
    ReviewCreateView,
    CertificateView,
    TeacherCourseListView,
    TeacherCourseDetailView,
    CourseCreateView,
    CourseUpdateView,
    CoursePublishView,
    CourseInviteLinkView,
    ModuleCreateView,
    LessonCreateView,
    LessonUpdateView,
    TeacherDashboardView,
    SaveCourseView,
    SavedCoursesListView,
    HomeworkListCreateView,
    HomeworkDetailView,
    HomeworkSubmitView,
    HomeworkResourceCreateView,
    HomeworkResourceDeleteView,
    StudentCourseHomeworksView,
    LessonHomeworksView,
    StudentHomeworkListView,
    InviteLinkCreateView,
    InviteLinkListView,
    InviteLinkToggleView,
    InviteLinkDetailView,
    InviteDetailView,
    InviteJoinView,
    EnrollmentRequestListView,
    EnrollmentApproveView,
    EnrollmentRejectView,
    EnrolledStudentsListView
)

def from_views_import(class_name):
    from . import views
    return getattr(views, class_name).as_view()


urlpatterns = [
    # Ommaviy
    path('categories/',                  CategoryListView.as_view(), name='category_list'),
    path('',                             CourseListView.as_view(), name='course_list'),
    path('<slug:slug>/',                 CourseDetailView.as_view(), name='course_detail'),
    path('<slug:slug>/enroll/',          EnrollView.as_view(), name='enroll'),
    path('<slug:slug>/save/',            SaveCourseView.as_view(), name='save_course'),
    path('<slug:slug>/review/',          ReviewCreateView.as_view(), name='review_create'),

    # Darslar
    path('lessons/<int:id>/',            LessonDetailView.as_view(), name='lesson_detail'),
    path('lessons/<int:id>/progress/',   LessonProgressUpdateView.as_view(), name='lesson_progress'),
    path('lessons/<int:id>/update/',     LessonUpdateView.as_view(), name='lesson_update'),
    path('lessons/<int:id>/quiz/',       LessonQuizView.as_view(), name='lesson_quiz'),
    path('lessons/<int:id>/quiz/submit/', LessonQuizSubmitView.as_view(), name='lesson_quiz_submit'),
    path('lessons/<int:id>/resources/',  LessonResourceCreateView.as_view(), name='lesson_resources'),
    path('lessons/resources/<int:id>/', LessonResourceDeleteView.as_view(), name='resource_delete'),
    path('lessons/<int:lesson_id>/homeworks/', LessonHomeworksView.as_view(), name='lesson_homeworks'),

    # Sertifikat
    path('certificates/<str:code>/',     CertificateView.as_view(), name='certificate_view'),

    # O'quvchi
    path('student/enrollments/',         MyEnrollmentsView.as_view(), name='my_enrollments'),
    path('student/saved/',               SavedCoursesListView.as_view(), name='saved_courses'),
    path('student/homeworks/',           StudentHomeworkListView.as_view(), name='student_homeworks'),

    # O'qituvchi
    path('teacher/dashboard/',           TeacherDashboardView.as_view(), name='teacher_dashboard'),
    path('teacher/courses/',             TeacherCourseListView.as_view(), name='teacher_courses'),
    path('teacher/courses/create/',      CourseCreateView.as_view(), name='course_create'),
    path('teacher/courses/<slug:slug>/', TeacherCourseDetailView.as_view(), name='teacher_course_detail'),
    path('teacher/courses/<slug:slug>/update/', CourseUpdateView.as_view(), name='course_update'),
    path('teacher/courses/<slug:slug>/publish/', CoursePublishView.as_view(), name='course_publish'),
    path('teacher/courses/<slug:slug>/invite/', CourseInviteLinkView.as_view(), name='course-invite'),
    path('teacher/courses/<slug:slug>/modules/', ModuleCreateView.as_view(), name='module_create'),
    path('teacher/modules/<int:id>/lessons/',    LessonCreateView.as_view(), name='lesson_create'),
    
    # Homework / Vazifalar
    path('teacher/courses/<slug:slug>/homeworks/', HomeworkListCreateView.as_view(), name='homework_list_create'),
    path('teacher/courses/homeworks/<int:id>/', HomeworkDetailView.as_view(), name='homework_detail'),
    path('homeworks/<int:id>/', HomeworkDetailView.as_view(), name='homework_detail_student'),
    path('homeworks/<int:id>/submit/', HomeworkSubmitView.as_view(), name='homework_submit'),
    path('homeworks/<int:id>/resources/', HomeworkResourceCreateView.as_view(), name='homework_resource_create'),
    path('homeworks/resources/<int:id>/', HomeworkResourceDeleteView.as_view(), name='homework_resource_delete'),
    path('<slug:slug>/homeworks/', StudentCourseHomeworksView.as_view(), name='student_course_homeworks'),

    # Invite links
    path('<slug:slug>/invite/create/',   InviteLinkCreateView.as_view(), name='invite_create'),
    path('<slug:slug>/invite/links/',    InviteLinkListView.as_view(), name='invite_links'),
    path('<slug:slug>/invite/<str:token>/toggle/', InviteLinkToggleView.as_view(), name='invite_toggle'),
    path('<slug:slug>/invite/<str:token>/', InviteLinkDetailView.as_view(), name='invite_detail_teacher'),
    path('<slug:slug>/enrolled-students/', EnrolledStudentsListView.as_view(), name='enrolled_students'),

    # Discussion / Muhokama
    path('lessons/<int:id>/discussions/', from_views_import('LessonDiscussionView'), name='lesson_discussions'),
    path('<slug:slug>/discussions/', from_views_import('CourseDiscussionView'), name='course_discussions'),
    path('discussions/<int:id>/replies/', from_views_import('DiscussionReplyView'), name='discussion_replies'),
    path('discussions/<int:id>/pin/', from_views_import('DiscussionPinView'), name='discussion_pin'),
    path('discussions/<int:id>/resolve/', from_views_import('DiscussionResolveView'), name='discussion_resolve'),
    path('discussions/replies/<int:id>/accept/', from_views_import('DiscussionReplyAcceptView'), name='reply_accept'),
    path('discussions/<int:id>/react/', from_views_import('DiscussionReactView'), name='discussion_react'),
]
