from django.urls import path
from . import views

# Le namespace de l'application est important pour la fonction {% url %} dans le template
app_name = 'subjects' 

urlpatterns = [
    # 1. Page principale de gestion des matières (GET)
    # Utilisé pour afficher l'interface (subjects/manage_subjects.html)
    path('manage/', views.manage_subjects, name='manage_subjects'),
    
    # 2. Endpoint pour la création et la modification (POST)
    # L'URL 'save_subject' correspond à SAVE_SUBJECT_URL dans le JS
    path('save/', views.create_or_update_subject, name='save_subject'),
    
    # 3. Endpoint pour l'activation/désactivation (POST)
    # L'URL 'toggle_status' correspond à TOGGLE_STATUS_URL dans le JS
    path('toggle-status/', views.toggle_subject_status, name='toggle_subject_status'),

    path('assign/', views.assign_subjects_view, name='assign'),

    # URL pour l'API REST qui gère la liaison/déliaison des matières aux professeurs
    # Cette URL est appelée par le code JavaScript (fetch)
    path('api/toggle-assignment/', views.toggle_teacher_subject_assignment_api, name='toggle_assignment_api'),
]
