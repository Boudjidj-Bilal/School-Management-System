from django.urls import path
from .views import classroom_management, level_management

app_name = 'classes'

urlpatterns = [
    # Chemin pour la gestion des salles de classe
    path('management/classrooms/', classroom_management, name='classroom_management'),
    path('management/levels/', level_management, name='level_management'),
]
