from django.urls import path
from .views import (
    messaging_dashboard_view,
    api_get_conversations,
    api_get_messages,
    api_send_message,
    api_get_contacts,
    api_create_conversation
)

app_name = 'communications'

urlpatterns = [
    # Vue principale (HTML)
    path('', messaging_dashboard_view, name='dashboard'),

    # APIs JSON
    path('api/conversations/', api_get_conversations, name='api_get_conversations'),
    path('api/contacts/', api_get_contacts, name='api_get_contacts'),
    path('api/create/', api_create_conversation, name='api_create_conversation'),
    
    path('api/messages/<int:conversation_id>/', api_get_messages, name='api_get_messages'),
    path('api/send/', api_send_message, name='api_send_message'),
]