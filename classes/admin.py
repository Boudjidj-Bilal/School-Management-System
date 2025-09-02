from django.contrib import admin
from .models import Level, Classroom, Class, ClassStudentYear, ClassTeacherYear

admin.site.register(Level)
admin.site.register(Classroom)
admin.site.register(Class)
admin.site.register(ClassStudentYear)
admin.site.register(ClassTeacherYear)
