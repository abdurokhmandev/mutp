from pathlib import Path

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/courses/', include('apps.courses.urls')),
    path('api/v1/student/', include('apps.analytics.urls')),

    # API Documentation (drf-spectacular)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

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

    # CSS/JS fayllar
    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', serve_frontend_assets, name='frontend-assets'),
    ]
