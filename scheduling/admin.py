from django.contrib import admin
from .models import WeeklyScheduleTemplate, Course, WeeklyScheduleInstance

admin.site.register(WeeklyScheduleTemplate)
admin.site.register(WeeklyScheduleInstance)
admin.site.register(Course)

