from django.urls import path
from .views import schedul_management_view, manage_weekly_schedule_template_view, manage_course_template_view, create_scheduled_courses_view, view_class_schedule_page, api_get_week_schedule_views, api_manage_course_status_views, view_teacher_schedule_page, api_get_teacher_week_schedule_views, api_manage_teacher_course_status_views

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

    path(
        'affichage/<int:pk_class>/',
        view_class_schedule_page,
        name='view_class_schedule_page'
    ),
    path(
        'api/schedule/get-week/',
        api_get_week_schedule_views,
        name='api_get_week_schedule'
    ),
    path(
        'api/schedule/manage-status/',
        api_manage_course_status_views,
        name='api_manage_course_status'
    ),

    path(
        'affichage/professeur/<int:pk_staff>/',
        view_teacher_schedule_page,
        name='view_teacher_schedule'
    ),
    path(
        'api/schedule/professeur/get-week/',
        api_get_teacher_week_schedule_views,
        name='api_get_teacher_week_schedule'
    ),
    path(
        'api/schedule/professeur/manage-status/',
        api_manage_teacher_course_status_views,
        name='api_manage_teacher_course_status'
    ),
]

