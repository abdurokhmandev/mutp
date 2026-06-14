from django.urls import path
from .views import NotificationListView, NotificationMarkReadView, NotificationUnreadCountView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification_list'),
    path('unread-count/', NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('read-all/', NotificationMarkReadView.as_view(), name='notification_read_all'),
    path('<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification_read'),
]
