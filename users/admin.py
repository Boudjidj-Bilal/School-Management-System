from django.contrib import admin
from .models import User, SuperAdministrator, Staff, Student, Parent, Child, StudentLocation

admin.site.register(User)
admin.site.register(SuperAdministrator)
admin.site.register(Staff)
admin.site.register(Student)
admin.site.register(Parent)
admin.site.register(Child)
admin.site.register(StudentLocation)


