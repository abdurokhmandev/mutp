from django.urls import path
from .views import StudentDashboardView

urlpatterns = [
    path('dashboard/', StudentDashboardView.as_view(), name='student_dashboard'),
]
