from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from apps.core.utils import success_response, error_response
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

User = get_user_model()


class ConversationListView(APIView):
    """Foydalanuvchi suhbatlari ro'yxati"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        convs = Conversation.objects.filter(participants=request.user)
        serializer = ConversationSerializer(convs, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Suhbatlar")

    def post(self, request):
        """Yangi suhbat boshlash (boshqa foydalanuvchi ID bilan)"""
        other_id = request.data.get('user_id')
        if not other_id:
            return error_response(message="user_id kiritilishi shart", status_code=400)

        try:
            other = User.objects.get(pk=other_id)
        except User.DoesNotExist:
            return error_response(message="Foydalanuvchi topilmadi", status_code=404)

        if other == request.user:
            return error_response(message="O'zingiz bilan suhbat boshlash mumkin emas", status_code=400)

        # Mavjud suhbatni qidirish
        conv = (
            Conversation.objects
            .filter(participants=request.user)
            .filter(participants=other)
            .first()
        )
        if not conv:
            conv = Conversation.objects.create()
            conv.participants.add(request.user, other)

        serializer = ConversationSerializer(conv, context={'request': request})
        return success_response(data=serializer.data, message="Suhbat")


class MessageListCreateView(APIView):
    """Suhbat xabarlari ro'yxati va yangi xabar yuborish"""
    permission_classes = [IsAuthenticated]

    def get(self, request, conv_id):
        try:
            conv = Conversation.objects.get(pk=conv_id, participants=request.user)
        except Conversation.DoesNotExist:
            return error_response(message="Suhbat topilmadi", status_code=404)

        # Mark messages as read
        conv.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

        before_id = request.query_params.get('before')
        qs = conv.messages.all()
        if before_id:
            qs = qs.filter(pk__lt=before_id)
        messages = qs.order_by('-created_at')[:50]
        serializer = MessageSerializer(reversed(list(messages)), many=True)
        return success_response(data=serializer.data, message="Xabarlar")

    def post(self, request, conv_id):
        try:
            conv = Conversation.objects.get(pk=conv_id, participants=request.user)
        except Conversation.DoesNotExist:
            return error_response(message="Suhbat topilmadi", status_code=404)

        content = request.data.get('content', '').strip()
        if not content:
            return error_response(message="Xabar matni bo'sh bo'lishi mumkin emas", status_code=400)

        msg = Message.objects.create(conversation=conv, sender=request.user, content=content)
        conv.save()  # update updated_at

        # Create notification for recipient
        try:
            from apps.notifications.models import Notification
            other = conv.participants.exclude(pk=request.user.pk).first()
            if other:
                Notification.objects.create(
                    recipient=other,
                    type=Notification.Type.NEW_MESSAGE,
                    message=f"{request.user.full_name} sizga xabar yubordi"
                )
        except Exception:
            pass

        serializer = MessageSerializer(msg)
        return success_response(data=serializer.data, message="Xabar yuborildi")
