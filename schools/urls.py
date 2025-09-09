from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_school_view, name='create_school'),
]