from rest_framework import serializers
from django.conf import settings
from .models import Conversation, Message


class UserBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    avatar = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        request = self.context.get('request')
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender_id', 'sender_name', 'content', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender_id', 'sender_name', 'is_read', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'other_user', 'last_message', 'unread_count', 'updated_at']

    def get_other_user(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        other = obj.participants.exclude(id=user.id).first()
        if other:
            return {
                'id': other.id,
                'full_name': other.full_name,
                'avatar': request.build_absolute_uri(other.avatar.url) if other.avatar and request else None,
                'role': getattr(other, 'role', ''),
            }
        return None

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {'content': msg.content, 'created_at': msg.created_at}
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
