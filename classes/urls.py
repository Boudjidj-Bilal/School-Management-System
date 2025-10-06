from django.urls import path
from .views import classroom_management

app_name = 'classes'

urlpatterns = [
    # Chemin pour la gestion des salles de classe
    path('management/classrooms/', classroom_management, name='classroom_management'),
    # Note : Le contexte d'école (school_filter) est géré dans la vue via la session.
]
