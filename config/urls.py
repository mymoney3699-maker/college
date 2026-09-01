from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

from apps.student.views import public_qr_student_view
from apps.users.views import dashboard_redirect

urlpatterns = [
    # الصفحة الرئيسية → التوجيه الذكي الموحد حسب الدور
    path('', dashboard_redirect, name='home'),
    path('favicon.ico', RedirectView.as_view(url='/static/images/شعار الكلية.jpeg', permanent=True)),
    
    path('admin/', admin.site.urls),
    
    # Faculty (الاستاذ)
    path('faculty/', include('apps.faculty.urls')),
    
    # Student (الطالب)
    path('student/', include('apps.student.urls')),
    
    # Renewal (التجديد)
    path('renewal/', include('apps.renewal.urls')),
    
    # Grades (الدرجات)
    path('grades/', include('apps.grades.urls')),
    
    # Users (الادمن)
    path('users/', include('apps.users.urls')),
    
    # مسار مباشر لـ QR الطالب
    path('qr/<str:qr_key>/', public_qr_student_view, name='public_qr_student_direct'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)