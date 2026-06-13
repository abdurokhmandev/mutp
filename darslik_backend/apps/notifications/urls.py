from django.urls import path
from .views import NotificationListView, NotificationMarkReadView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification_list'),
    path('read-all/', NotificationMarkReadView.as_view(), name='notification_read_all'),
    path('<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification_read'),
]
