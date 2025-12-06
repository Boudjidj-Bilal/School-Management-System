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
    path('toggle-user-status/', views.toggle_user_status_view, name='toggle-user-status'),
    path('assign-children/', views.assign_children_view, name='assign_children'),
    path('toggle-child-assignment/', views.toggle_child_assignment_api, name='toggle_child_assignment_api'),
    path('select-child/', views.select_child_view, name='select_child'),
    path('profile/', views.profile_view, name='user_profile'),
    path('api/change-password/', views.api_change_password, name='api_change_password'),


    re_path(r'^reset/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,32}-[0-9A-Za-z]{1,32})/$', 
            views.password_reset_confirm, name='password_reset_confirm'),
]
