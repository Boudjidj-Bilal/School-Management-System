from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_school_view, name='create_school'),
    path('edit/<int:school_id>/', views.edit_school_view, name='edit_school'),
    path('api/update/<int:school_id>/', views.api_update_school, name='api_update_school'),
    path('manage_years/', views.manage_years_view, name='manage_years'),
    path('api/years/', views.create_or_update_year_api, name='create_or_update_year_api'),
    path('api/years/<int:year_id>/change_status/', views.change_year_status_api, name='change_year_status_api'),
    path('exceptions/', views.exception_management, name='exception_management'),
    path('manage-terms/', views.manage_term, name='manage_terms'),
    path('parametres/', views.update_school_settings, name='settings'),
]