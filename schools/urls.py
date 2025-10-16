from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_school_view, name='create_school'),
    path('manage_years/', views.manage_years_view, name='manage_years'),
    path('api/years/', views.create_or_update_year_api, name='create_or_update_year_api'),
    path('api/years/<int:year_id>/change_status/', views.change_year_status_api, name='change_year_status_api'),
    path('exceptions/', views.exception_management, name='exception_management'),
    path('manage-terms/', views.manage_term, name='manage_terms'),
]