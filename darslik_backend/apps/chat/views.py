from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from apps.core.utils import success_response, error_response
from .models import Channel, ChannelMember, Message, MessageReaction
from .serializers import ChannelSerializer, MessageSerializer

User = get_user_model()


class ChannelListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        channels = Channel.objects.filter(members=request.user, is_archived=False)
        serializer = ChannelSerializer(channels, many=True, context={'request': request})
        return success_response(data=serializer.data, message="Kanallar ro'yxati")

    def post(self, request):
        """Yangi guruh ochish (Ustozlar/Adminlar uchun)"""
        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        if not name:
            return error_response(message="Guruh nomi kiritilishi shart", status_code=400)

        channel = Channel.objects.create(
            name=name,
            description=description,
            channel_type=Channel.ChannelType.CUSTOM,
            creator=request.user
        )
        ChannelMember.objects.create(channel=channel, user=request.user, role=ChannelMember.Role.ADMIN)

        serializer = ChannelSerializer(channel, context={'request': request})
        return success_response(data=serializer.data, message="Guruh yaratildi", status_code=201)


class DirectChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if str(request.user.id) == str(user_id):
            return error_response(message="O'zingizga xabar yoza olmaysiz", status_code=400)

        other_user = get_object_or_404(User, id=user_id)

        # Qidirish
        existing = Channel.objects.filter(
            channel_type=Channel.ChannelType.DIRECT,
            members=request.user
        ).filter(members=other_user).first()

        if existing:
            return success_response(data={'channel_id': existing.id, 'is_new': False})

        # Yangi yaratish
        channel = Channel.objects.create(
            channel_type=Channel.ChannelType.DIRECT,
            name=f"{request.user.full_name} & {other_user.full_name}",
            creator=request.user,
        )
        ChannelMember.objects.bulk_create([
            ChannelMember(channel=channel, user=request.user, role=ChannelMember.Role.MEMBER),
            ChannelMember(channel=channel, user=other_user, role=ChannelMember.Role.MEMBER),
        ])

        return success_response(data={
            'channel_id': channel.id,
            'is_new': True,
            'other_user': {
                'id': other_user.id,
                'name': other_user.full_name,
                'role': getattr(other_user, 'role', ''),
            }
        }, status_code=201)


class MessageListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, channel_id):
        channel = get_object_or_404(Channel, id=channel_id, members=request.user)
        after_id = request.query_params.get('after')
        before_id = request.query_params.get('before')

        parent_id = request.query_params.get('parent')

        qs = channel.messages.filter(is_deleted=False)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        else:
            qs = qs.filter(parent__isnull=True)

        if after_id:
            qs = qs.filter(id__gt=after_id)
        if before_id:
            qs = qs.filter(id__lt=before_id)

        messages = qs.order_by('-created_at')[:50]
        # O'qilgan vaqtni yangilash
        ChannelMember.objects.filter(channel=channel, user=request.user).update(last_read=timezone.now())

        serializer = MessageSerializer(reversed(list(messages)), many=True, context={'request': request})
        return success_response(data=serializer.data, message="Xabarlar")

    def post(self, request, channel_id):
        channel = get_object_or_404(Channel, id=channel_id, members=request.user)
        text = request.data.get('text', '').strip()
        msg_type = request.data.get('message_type', Message.MessageType.TEXT)
        parent_id = request.data.get('parent')

        file_obj = request.FILES.get('file')
        file_name = ""
        file_size = None
        if file_obj:
            file_name = file_obj.name
            file_size = file_obj.size
            if not text:
                text = file_name

        if not text and not file_obj:
            return error_response(message="Xabar matni yoki fayl bo'sh bo'lishi mumkin emas", status_code=400)

        parent = None
        if parent_id:
            parent = get_object_or_404(Message, id=parent_id, channel=channel)

        msg = Message.objects.create(
            channel=channel,
            sender=request.user,
            message_type=msg_type,
            text=text,
            file=file_obj,
            file_name=file_name,
            file_size=file_size,
            parent=parent
        )
        ChannelMember.objects.filter(channel=channel, user=request.user).update(last_read=timezone.now())

        serializer = MessageSerializer(msg, context={'request': request})
        return success_response(data=serializer.data, message="Xabar yuborildi", status_code=201)


class MessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        msg = get_object_or_404(Message, id=id, sender=request.user)
        text = request.data.get('text', '').strip()
        if not text:
            return error_response(message="Matn bo'sh bo'lishi mumkin emas", status_code=400)

        msg.text = text
        msg.is_edited = True
        msg.edited_at = timezone.now()
        msg.save()

        serializer = MessageSerializer(msg, context={'request': request})
        return success_response(data=serializer.data, message="Xabar tahrirlandi")

    def delete(self, request, id):
        msg = get_object_or_404(Message, id=id, sender=request.user)
        msg.is_deleted = True
        msg.save()
        return success_response(message="Xabar o'chirildi")


class MessageReactView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        msg = get_object_or_404(Message, id=id)
        emoji = request.data.get('emoji', '').strip()
        if not emoji:
            return error_response(message="Emoji tanlanishi kerak", status_code=400)

        react, created = MessageReaction.objects.get_or_create(
            message=msg,
            user=request.user,
            emoji=emoji
        )
        if not created:
            react.delete()
            return success_response(message="Reaksiya olib tashlandi")

        return success_response(message="Reaksiya qo'shildi")


class ChannelReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        channel = get_object_or_404(Channel, id=id, members=request.user)
        ChannelMember.objects.filter(channel=channel, user=request.user).update(last_read=timezone.now())
        return success_response(message="O'qilgan deb belgilandi")


class ChannelUnreadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        channel = get_object_or_404(Channel, id=id, members=request.user)
        member = channel.channelmember_set.filter(user=request.user).first()
        if not member:
            return success_response(data={'unread_count': 0})

        qs = channel.messages.all()
        if member.last_read:
            qs = qs.filter(created_at__gt=member.last_read)
        unread = qs.exclude(sender=request.user).count()
        return success_response(data={'unread_count': unread})


class ChannelMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        channel = get_object_or_404(Channel, id=id)
        # Faqat admin a'zo qo'sha oladi
        get_object_or_404(ChannelMember, channel=channel, user=request.user, role=ChannelMember.Role.ADMIN)

        user_id = request.data.get('user_id')
        user = get_object_or_404(User, id=user_id)

        member, created = ChannelMember.objects.get_or_create(
            channel=channel,
            user=user,
            defaults={'role': ChannelMember.Role.MEMBER}
        )
        if not created:
            return error_response(message="Foydalanuvchi allaqachon a'zo", status_code=400)

        return success_response(message="A'zo muvaffaqiyatli qo'shildi")

    def delete(self, request, id, user_id):
        channel = get_object_or_404(Channel, id=id)
        # Faqat admin a'zoni chiqarib yubora oladi
        get_object_or_404(ChannelMember, channel=channel, user=request.user, role=ChannelMember.Role.ADMIN)

        member = get_object_or_404(ChannelMember, channel=channel, user_id=user_id)
        member.delete()
        return success_response(message="A'zo muvaffaqiyatli chiqarildi")
