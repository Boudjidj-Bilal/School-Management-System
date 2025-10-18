from django.urls import path
from .views import classroom_management, level_management, class_management, toggle_class_assignment_api, class_assignment_main_view

app_name = 'classes'

urlpatterns = [
    # Chemin pour la gestion des salles de classe
    path('management/classrooms/', classroom_management, name='classroom_management'),
    path('management/levels/', level_management, name='level_management'),
    path('management/class/', class_management, name='class_management'),
    path('<int:pk>/assignmentClass/', class_assignment_main_view, name='class_assignment_main'),
    path('<int:pk>/assignmentClass/api/toggle/', toggle_class_assignment_api, name='toggle_class_assignment_api'),

]
