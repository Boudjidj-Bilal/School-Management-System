from django.contrib import admin
from .models import TypeSchool, School, Year, ExceptionDay, ExceptionTime, TermType, TermYear

admin.site.register(TypeSchool)
admin.site.register(School)
admin.site.register(Year)
admin.site.register(ExceptionDay)
admin.site.register(ExceptionTime)
admin.site.register(TermType)
admin.site.register(TermYear)

