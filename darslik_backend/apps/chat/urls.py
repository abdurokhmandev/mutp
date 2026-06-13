from django.urls import path
from .views import ConversationListView, MessageListCreateView

urlpatterns = [
    path('', ConversationListView.as_view(), name='conversation_list'),
    path('<int:conv_id>/messages/', MessageListCreateView.as_view(), name='message_list_create'),
]
