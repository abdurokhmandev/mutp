from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.core.utils import success_response, error_response
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    """O'quvchi yoki ustoz uchun bildirishnomalar ro'yxati"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)[:50]
        serializer = NotificationSerializer(qs, many=True)
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return success_response(data={
            'results': serializer.data,
            'unread_count': unread_count,
        }, message="Bildirishnomalar")


class NotificationMarkReadView(APIView):
    """Bildirishnomani o'qilgan deb belgilash"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        if pk:
            Notification.objects.filter(recipient=request.user, pk=pk).update(is_read=True)
        else:
            # Mark all as read
            Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return success_response(message="Belgilandi")


class NotificationUnreadCountView(APIView):
    """O'qilmagan bildirishnomalar sonini qaytarish"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return success_response(data={'count': count})
