from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    TokenRefreshView,
    ProfileView,
    UserProfileDetailView,
    ChangePasswordView,
    TeacherListView,
    TeacherDetailView,
    SendOTPView,
    VerifyOTPView
)

urlpatterns = [
    path('register/',        RegisterView.as_view(), name='register'),
    path('login/',           LoginView.as_view(), name='login'),
    path('logout/',          LogoutView.as_view(), name='logout'),
    path('token/refresh/',   TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/',         ProfileView.as_view(), name='profile'),
    path('profile/<int:id>/', UserProfileDetailView.as_view(), name='profile_detail'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('teachers/',        TeacherListView.as_view(), name='teacher_list'),
    path('teachers/<int:id>/', TeacherDetailView.as_view(), name='teacher_detail'),
    path('send-otp/',        SendOTPView.as_view(), name='send_otp'),
    path('verify-otp/',      VerifyOTPView.as_view(), name='verify_otp'),
]

