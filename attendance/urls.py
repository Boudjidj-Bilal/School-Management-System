from django.urls import path
from .views import (
    attendance_hub_view, 
    create_attendance_session_view,
    api_save_attendance_session,
    api_get_session_details,
    manage_attendance_view,
    api_justify_attendance,
    student_attendance_dashboard_view
)
app_name = 'attendance'

urlpatterns = [
    # Page 1 : Hub des classes
    path('hub/', attendance_hub_view, name='attendance_hub'),

    # Page 2 : Saisie (Professeur) - À implémenter
    path(
        'session/create/<int:class_id>/', 
        create_attendance_session_view, 
        name='create_attendance_session'
    ),
    # Page 3 : Gestion (CPE/Admin) - À implémenter
    path(
        'manage/<int:class_id>/', 
        manage_attendance_view, 
        name='manage_attendance'
    ),
    
    # Page 4 : Vue Élève - À implémenter
    path('my-attendance/', student_attendance_dashboard_view, name='student_attendance_dashboard'),

    path('api/session/save/', api_save_attendance_session, name='api_save_attendance_session'),
    path('api/session/details/', api_get_session_details, name='api_get_session_details'),
    path('api/justify/', api_justify_attendance, name='api_justify_attendance'),

]