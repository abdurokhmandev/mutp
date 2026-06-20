from pathlib import Path

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from apps.courses.views import InviteDetailView, InviteJoinView

from django.contrib.admin.views.decorators import staff_member_required

urlpatterns = [
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/courses/', include('apps.courses.urls')),
    path('api/v1/student/', include('apps.analytics.urls')),

    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/chat/', include('apps.chat.urls')),
    path('api/v1/teacher/', include('apps.teacher.urls')),

    # Invite endpoints
    path('api/v1/invite/<str:token>/', InviteDetailView.as_view(), name='api_invite_detail'),
    path('api/v1/invite/<str:token>/join/', InviteJoinView.as_view(), name='api_invite_join'),

    # API Documentation (drf-spectacular)
    path('api/schema/', staff_member_required(SpectacularAPIView.as_view()), name='schema'),
    path('api/docs/', staff_member_required(SpectacularSwaggerView.as_view(url_name='schema')), name='swagger-ui'),
    path('api/redoc/', staff_member_required(SpectacularRedocView.as_view(url_name='schema')), name='redoc'),
]

from django.views.generic import TemplateView

# HTML Templates serving (only in DEBUG mode)
if settings.DEBUG:
    frontend_patterns = [
        path('', TemplateView.as_view(template_name='index.html'), name='frontend-index'),
        path('index.html', TemplateView.as_view(template_name='index.html')),
        path('auth.html', TemplateView.as_view(template_name='auth.html'), name='frontend-auth'),
        path('courses.html', TemplateView.as_view(template_name='courses.html'), name='frontend-courses'),
        path('course-detail.html', TemplateView.as_view(template_name='course-detail.html'), name='frontend-course-detail'),
        path('courses/<slug:slug>/', TemplateView.as_view(template_name='course-detail.html'), name='frontend-course-detail-slug'),
        path('lesson.html', TemplateView.as_view(template_name='lesson.html'), name='frontend-lesson'),
        path('dashboard-student.html', TemplateView.as_view(template_name='dashboard-student.html'), name='frontend-dashboard-student'),
        path('dashboard-teacher.html', TemplateView.as_view(template_name='dashboard-teacher.html'), name='frontend-dashboard-teacher'),
        path('create-course.html', TemplateView.as_view(template_name='create-course.html'), name='frontend-create-course'),
        path('profile.html', TemplateView.as_view(template_name='profile.html'), name='frontend-profile'),
        path('chat.html', TemplateView.as_view(template_name='chat.html'), name='frontend-chat'),
        path('homework.html', TemplateView.as_view(template_name='homework.html'), name='frontend-homework'),
        path('invite.html', TemplateView.as_view(template_name='invite.html'), name='frontend-invite'),
        path('invite/<str:token>/', TemplateView.as_view(template_name='invite.html'), name='frontend-invite-detail'),
        path('onboarding.html', TemplateView.as_view(template_name='onboarding.html'), name='frontend-onboarding'),
        path('404.html', TemplateView.as_view(template_name='404.html'), name='frontend-404'),
    ]
    urlpatterns += frontend_patterns

# Media and Django static files
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', static_serve, {'document_root': settings.MEDIA_ROOT}),
        re_path(r'^static/(?P<path>.*)$', static_serve, {'document_root': settings.STATIC_ROOT}),
    ]

# Assets (CSS/JS/images in templates/assets) serving (only in DEBUG mode)
if settings.DEBUG:
    FRONTEND_ROOT = Path(settings.BASE_DIR) / 'templates'

    def serve_frontend_assets(request, path):
        return static_serve(request, path, document_root=FRONTEND_ROOT / 'assets')

    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', serve_frontend_assets, name='frontend-assets'),
    ]

handler404 = 'config.views.custom_404'
