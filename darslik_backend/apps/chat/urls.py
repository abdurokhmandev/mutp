from django.urls import path
from .views import (
    ChannelListView, DirectChatView, MessageListCreateView,
    MessageDetailView, MessageReactView, ChannelReadView,
    ChannelUnreadView, ChannelMembersView, ChannelDetailView,
    UserSearchView, ChannelPinView, ChannelTypingView,
    ChannelSharedMediaView, PollVoteView
)

urlpatterns = [
    path('channels/', ChannelListView.as_view(), name='channel_list'),
    path('direct/<int:user_id>/', DirectChatView.as_view(), name='direct_chat'),
    path('channels/<int:channel_id>/messages/', MessageListCreateView.as_view(), name='message_list_create'),
    path('messages/<int:id>/', MessageDetailView.as_view(), name='message_detail'),
    path('messages/<int:id>/react/', MessageReactView.as_view(), name='message_react'),
    path('channels/<int:id>/read/', ChannelReadView.as_view(), name='channel_read'),
    path('channels/<int:id>/unread/', ChannelUnreadView.as_view(), name='channel_unread'),
    path('channels/<int:id>/members/', ChannelMembersView.as_view(), name='channel_members'),
    path('channels/<int:id>/members/<int:user_id>/', ChannelMembersView.as_view(), name='channel_member_delete'),
    path('channels/<int:id>/detail/', ChannelDetailView.as_view(), name='channel_detail'),
    path('users/search/', UserSearchView.as_view(), name='user_search'),
    path('channels/<int:id>/pin/', ChannelPinView.as_view(), name='channel_pin'),
    path('channels/<int:id>/typing/', ChannelTypingView.as_view(), name='channel_typing'),
    path('channels/<int:id>/media/', ChannelSharedMediaView.as_view(), name='channel_media'),
    path('messages/<int:id>/vote/', PollVoteView.as_view(), name='poll_vote'),
]
