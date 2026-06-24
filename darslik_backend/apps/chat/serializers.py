from rest_framework import serializers
from django.conf import settings
from .models import Channel, ChannelMember, Message, MessageReaction

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
    sender_avatar = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    poll_data = serializers.SerializerMethodField()
    poll_results = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender_id', 'sender_name', 'sender_avatar', 'message_type',
            'text', 'file', 'file_name', 'file_size', 'parent',
            'is_edited', 'edited_at', 'is_deleted', 'created_at', 'reactions',
            'replies_count', 'poll_data', 'poll_results'
        ]
        read_only_fields = ['id', 'sender_id', 'sender_name', 'is_edited', 'edited_at', 'created_at']

    def get_replies_count(self, obj):
        return obj.replies.count()

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        if obj.sender and obj.sender.avatar and request:
            return request.build_absolute_uri(obj.sender.avatar.url)
        return None

    def get_reactions(self, obj):
        # Format reactions as emoji: count and user lists
        reacts = obj.reactions.all()
        result = {}
        for r in reacts:
            if r.emoji not in result:
                result[r.emoji] = []
            result[r.emoji].append({
                'user_id': r.user.id,
                'user_name': r.user.full_name
            })
        return result

    def get_poll_data(self, obj):
        if obj.message_type != Message.MessageType.POLL:
            return None
        import json
        try:
            return json.loads(obj.text)
        except Exception:
            return None

    def get_poll_results(self, obj):
        if obj.message_type != Message.MessageType.POLL:
            return None
        
        request = self.context.get('request')
        user = request.user if request else None

        votes = obj.poll_votes.all()
        counts = {}
        my_vote = None
        for v in votes:
            counts[v.option_id] = counts.get(v.option_id, 0) + 1
            if user and v.user_id == user.id:
                my_vote = v.option_id

        return {
            'total_votes': votes.count(),
            'counts': counts,
            'my_vote': my_vote
        }


class ChannelSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    pinned_message = serializers.SerializerMethodField()
    typing_users = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = [
            'id', 'name', 'channel_type', 'description', 'image', 'other_user', 
            'last_message', 'unread_count', 'members', 'pinned_message', 'typing_users', 'created_at'
        ]

    def get_image(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_members(self, obj):
        request = self.context.get('request')
        members = obj.channelmember_set.all()
        res = []
        for m in members:
            avatar_url = None
            if m.user.avatar and request:
                avatar_url = request.build_absolute_uri(m.user.avatar.url)
            res.append({
                'id': m.user.id,
                'full_name': m.user.full_name,
                'avatar': avatar_url,
                'role': m.role,
            })
        return res

    def get_pinned_message(self, obj):
        if not obj.pinned_message:
            return None
        return {
            'id': obj.pinned_message.id,
            'text': obj.pinned_message.text,
            'sender_name': obj.pinned_message.sender.full_name if obj.pinned_message.sender else "Tizim",
            'message_type': obj.pinned_message.message_type
        }

    def get_typing_users(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(seconds=4)
        typing_members = obj.channelmember_set.filter(last_typing__gt=cutoff)
        
        request = self.context.get('request')
        current_user = request.user if request else None

        res = []
        for m in typing_members:
            if current_user and m.user_id == current_user.id:
                continue
            res.append({
                'id': m.user.id,
                'full_name': m.user.full_name
            })
        return res

    def get_other_user(self, obj):
        if obj.channel_type != Channel.ChannelType.DIRECT:
            return None
        request = self.context.get('request')
        user = request.user if request else None
        if not user:
            return None
        other = obj.members.exclude(id=user.id).first()
        if other:
            avatar_url = None
            if other.avatar and request:
                avatar_url = request.build_absolute_uri(other.avatar.url)
            return {
                'id': other.id,
                'full_name': other.full_name,
                'avatar': avatar_url,
                'role': getattr(other, 'role', ''),
            }
        return None

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {
                'id': msg.id,
                'text': msg.text,
                'sender_name': msg.sender.full_name if msg.sender else "Tizim",
                'created_at': msg.created_at
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or request.user.is_anonymous:
            return 0
        member = obj.channelmember_set.filter(user=request.user).first()
        if not member:
            return 0
        
        qs = obj.messages.all()
        if member.last_read:
            qs = qs.filter(created_at__gt=member.last_read)
        return qs.exclude(sender=request.user).count()
