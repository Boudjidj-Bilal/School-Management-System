from django.urls import path
from .views import schedul_management_view, manage_weekly_schedule_template_view, manage_course_template_view, create_scheduled_courses_view

app_name = 'scheduling' 

urlpatterns = [
    path(
        'gestion/<int:pk_class>/',
        schedul_management_view,
        name='planning_gestion_view'
    ),

    path(
        'api/weekly-template/manage/',
        manage_weekly_schedule_template_view,
        name='manage_weekly_schedule_template_view'
    ),

    path(
        'api/course-template/manage/',
        manage_course_template_view,
        name='manage_course_template_view'
    ),

    path(
        'api/scheduled-courses/create/',
        create_scheduled_courses_view,
        name='create_scheduled_courses_view'
    ),
]

