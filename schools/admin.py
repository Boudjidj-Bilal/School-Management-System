from django.contrib import admin
from .models import School, Year, ExceptionDay, ExceptionTime, TermYearLevel

admin.site.register(School)
admin.site.register(Year)
admin.site.register(ExceptionDay)
admin.site.register(ExceptionTime)
admin.site.register(TermYearLevel)

