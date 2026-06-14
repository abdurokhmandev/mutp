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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', static_serve, {'document_root': settings.MEDIA_ROOT}),
        re_path(r'^static/(?P<path>.*)$', static_serve, {'document_root': settings.STATIC_ROOT}),
    ]

    FRONTEND_ROOT = Path(settings.BASE_DIR).parent / 'templates'

    FRONTEND_PAGES = [
        'index.html',
        'auth.html',
        'courses.html',
        'course-detail.html',
        'dashboard-student.html',
        'dashboard-teacher.html',
        'lesson.html',
        'profile.html',
        'create-course.html',
        'chat.html',
        'homework.html',
        'invite.html',
    ]

    def serve_frontend(request, filename='index.html'):
        response = static_serve(request, filename, document_root=FRONTEND_ROOT)
        if filename.endswith('.html'):
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
        return response

    def serve_frontend_assets(request, path):
        return static_serve(request, path, document_root=FRONTEND_ROOT / 'assets')

    # Bosh sahifa
    urlpatterns += [
        path('', serve_frontend, {'filename': 'index.html'}, name='frontend-index'),
        path('index.html', serve_frontend, {'filename': 'index.html'}),
    ]

    # Har bir HTML sahifa uchun aniq yo'l
    for page in FRONTEND_PAGES:
        if page == 'index.html':
            continue
        urlpatterns += [
            path(page, serve_frontend, {'filename': page}, name=f'frontend-{page.replace(".html", "")}'),
        ]

    # Course detail route for frontend
    urlpatterns += [
        path('courses/<slug:slug>/', serve_frontend, {'filename': 'course-detail.html'}, name='frontend-course-detail-slug'),
    ]

    # Invite detail route for frontend
    urlpatterns += [
        path('invite/<str:token>/', serve_frontend, {'filename': 'invite.html'}, name='frontend-invite-detail'),
    ]

    # CSS/JS fayllar
    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', serve_frontend_assets, name='frontend-assets'),
    ]
