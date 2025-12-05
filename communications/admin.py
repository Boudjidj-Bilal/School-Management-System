from django.contrib import admin
from .models import Announcement, Attachment, AnnouncementRecipient, Messaging, Message

admin.site.register(Announcement)
admin.site.register(Attachment)
admin.site.register(AnnouncementRecipient)
admin.site.register(Messaging)
admin.site.register(Message)
