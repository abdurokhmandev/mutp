from django.urls import path
from apps.courses.views import (
    TeacherHomeworksListView,
    TeacherHomeworkSubmissionsView,
    HomeworkReviewView,
    EnrollmentRequestListView,
    EnrollmentApproveView,
    EnrollmentRejectView
)

urlpatterns = [
    path('homeworks/', TeacherHomeworksListView.as_view(), name='teacher_homeworks'),
    path('homeworks/<int:hw_id>/submissions/', TeacherHomeworkSubmissionsView.as_view(), name='teacher_homework_submissions'),
    path('homeworks/submissions/<int:sub_id>/review/', HomeworkReviewView.as_view(), name='homework_submission_review'),

    path('enrollment-requests/', EnrollmentRequestListView.as_view(), name='enrollment_requests'),
    path('enrollment-requests/<int:req_id>/approve/', EnrollmentApproveView.as_view(), name='enrollment_approve'),
    path('enrollment-requests/<int:req_id>/reject/', EnrollmentRejectView.as_view(), name='enrollment_reject'),
]
