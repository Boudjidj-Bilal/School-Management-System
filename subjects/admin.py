from django.contrib import admin
from .models import TeacherSubject, Subject

admin.site.register(Subject)
admin.site.register(TeacherSubject)

