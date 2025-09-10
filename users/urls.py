from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('dashboard/', views.dashboard_page, name='dashboard'),
    path('password-reset/', views.password_reset, name='password_reset'),
    path('create-user/', views.create_user_view, name='create_user'),
    path('manage-users/', views.manage_users_view, name='manage_users'),
    path('select-school/', views.select_school_view, name='select_school'),

    re_path(r'^reset/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,32}-[0-9A-Za-z]{1,32})/$', 
            views.password_reset_confirm, name='password_reset_confirm'),
]
