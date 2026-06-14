from django.urls import path
from apps.courses.views import TeacherHomeworksListView, TeacherHomeworkSubmissionsView, HomeworkReviewView

urlpatterns = [
    path('homeworks/', TeacherHomeworksListView.as_view(), name='teacher_homeworks'),
    path('homeworks/<int:hw_id>/submissions/', TeacherHomeworkSubmissionsView.as_view(), name='teacher_homework_submissions'),
    path('homeworks/submissions/<int:sub_id>/review/', HomeworkReviewView.as_view(), name='homework_submission_review'),
]
