from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.users.views import dashboard_redirect

urlpatterns = [
    # الصفحة الرئيسية -> التوجيه الذكي الموحد حسب الدور
    path('', dashboard_redirect, name='home'),
    path('admin/', admin.site.urls),
    path('renewal/', include('apps.renewal.urls')),
    
    # Grades (الدرجات)
    path('grades/', include('apps.grades.urls')),
    
    # Users (الادمن)
    path('users/', include('apps.users.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)