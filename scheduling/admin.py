from django.contrib import admin
from .models import WeeklyScheduleTemplate, ScheduledCourse, CourseTemplate

admin.site.register(WeeklyScheduleTemplate)
admin.site.register(ScheduledCourse)
admin.site.register(CourseTemplate)


