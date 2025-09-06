from django.contrib import admin
from .models import Announcement, Recipient, Messaging, Message

admin.site.register(Announcement)
admin.site.register(Recipient)
admin.site.register(Messaging)
admin.site.register(Message)
