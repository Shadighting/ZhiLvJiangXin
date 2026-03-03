from django.urls import path
from django.contrib.auth.views import LoginView, LogoutView
from .views import api_login


urlpatterns = [
    path('login/', LoginView.as_view(template_name='accounts/login.html'), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('api/login/', api_login, name='api_login'),
]

