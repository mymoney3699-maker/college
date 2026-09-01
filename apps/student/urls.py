# apps/student/urls.py

from django.urls import path
from . import views

app_name = 'student'

urlpatterns = [
    # مسارات الطالب
    path('dashboard/', views.student_dashboard, name='dashboard'),
    path('my-courses/', views.my_courses, name='my_courses'),
    path('my-grades/', views.my_grades, name='my_grades'),
    path('my-warnings/', views.my_warnings, name='my_warnings'),
    path('my-notifications/', views.my_notifications, name='my_notifications'),
    path('notifications/', views.notifications, name='notifications'),
    path('my-profile/', views.my_profile, name='my_profile'),
    path('subject-inquiry/', views.subject_inquiry, name='subject_inquiry'),
    
    # APIs
    path('api/change-password/', views.change_password_api, name='change_password_api'),
    path('api/get-qr-code/', views.get_qr_code_api, name='get_qr_code_api'),
    path('api/notifications/mark-read/', views.mark_notifications_read, name='mark_notifications_read'),
    path('term-result/', views.term_result, name='term_result'),
    path('personal-info/', views.personal_info, name='personal_info'),
    path('verify/<str:student_id>/', views.verify_student, name='verify_student'),
    path('qr/<str:qr_key>/', views.public_qr_student_view, name='public_qr_student'),
    # API تحديث البيانات الشخصية
    path('api/update-profile/', views.update_profile_api, name='update_profile_api'),
    path('debug-student/', views.debug_student_data, name='debug_student'),

    # REST APIs لتطبيق الطالب (PostgreSQL Integration)
    path('api/profile/', views.api_student_profile, name='api_student_profile'),
    path('api/courses/', views.api_student_courses, name='api_student_courses'),
    path('api/grades/', views.api_student_grades, name='api_student_grades'),
    path('api/summary/', views.api_student_summary, name='api_student_summary'),
    path('api/semesters/', views.api_student_semesters, name='api_student_semesters'),
]