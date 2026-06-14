from django.urls import path
from .views import (
    ChannelListView, DirectChatView, MessageListCreateView,
    MessageDetailView, MessageReactView, ChannelReadView,
    ChannelUnreadView, ChannelMembersView
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
]
