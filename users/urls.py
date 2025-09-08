from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('dashboard/', views.dashboard_page, name='dashboard'),
    path('password-reset/', views.password_reset, name='password_reset'),
    re_path(r'^reset/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,32}-[0-9A-Za-z]{1,32})/$', 
            views.password_reset_confirm, name='password_reset_confirm'),
]
