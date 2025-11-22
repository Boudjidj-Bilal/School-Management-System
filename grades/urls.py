from django.urls import path
from .views import (
    view_my_grades_dashboard,    
    view_teacher_grades_as_admin,  
    api_get_grades_for_term_views,
    api_manage_evaluation_views,
    view_my_grades_student
)

app_name = 'grades'

urlpatterns = [

    # Parcours 1: Le professeur consulte son propre tableau de bord
    path(
        'dashboard/',
        view_my_grades_dashboard,
        name='grades_dashboard' # C'est le lien que tu as mis dans le sidemenu
    ),

    # Parcours 2: Un admin/proviseur consulte le tableau de bord d'un prof
    path(
        'dashboard/professeur/<int:pk_staff>/',
        view_teacher_grades_as_admin,
        name='view_teacher_grades_as_admin'
    ),
    # Parcours 3: L'élève consulte ses propres notes
    path(
        'student/',
        view_my_grades_student,
        name='student_grades_dashboard'
    ),
    
    # --- APIs ---
    
    # API pour la navigation (changer de trimestre)
    path(
        'api/get_term_data/',
        api_get_grades_for_term_views,
        name='api_get_grades_for_term'
    ),
    
    # API pour C/U/D une évaluation (verrouillée au prof)
    path(
        'api/manage_evaluation/',
        api_manage_evaluation_views,
        name='api_manage_evaluation'
    ),
]