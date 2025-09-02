from django.contrib import admin
from .models import Announcement, StaffRecipient, StudentRecipient, Messaging, Message

admin.site.register(Announcement)
admin.site.register(StaffRecipient)
admin.site.register(StudentRecipient)
admin.site.register(Messaging)
admin.site.register(Message)
