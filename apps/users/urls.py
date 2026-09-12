# apps/users/urls.py
from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

app_name = 'users'

urlpatterns = [
    # ============================================
    # صفحات تسجيل الدخول والخروج
    # ============================================
    path('login/', views.login_page, name='login'),
    path('login-view/', views.login_view, name='login_view'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard-redirect/', views.dashboard_redirect, name='dashboard_redirect'),
    # ============================================
    # صفحات العرض
    # ============================================
    path('settings/', views.settings_page, name='settings'),
    path('permissions/', views.user_permissions, name='permissions'),
    path('dashboard/', views.dashboard_page, name='dashboard'),
    path('my-dashboard/', views.dashboard, name='my_dashboard'),
    path('user-accounts/', views.user_accounts_interface, name='user_accounts'),
    path('admin-dashboard/', views.admin_dashboard, name='admin_dashboard'),
    path('admin-dashboard/print/', views.admin_dashboard_print, name='admin_dashboard_print'),
    path('general-registrar-dashboard/', views.general_registrar_dashboard, name='general_registrar_dashboard'),
    path('add-user/', views.add_user, name='add_user'),
    path('change-password/', views.change_password_page, name='change_password_page'),
    
    # ============================================
    # إدارة الحسابات
    # ============================================
    path('accounts/', views.user_accounts, name='accounts'),
    path('accounts/<int:user_id>/', views.user_accounts, name='accounts_detail'),
    path('manage/', views.manage_users, name='manage_users'),
    path('list/', views.user_list, name='user_list'),
    path('edit/<int:user_id>/', views.edit_user_page, name='edit_user'),
    path('group-permissions/', views.group_permissions_view, name='group_permissions'),
    path('groups/create/', views.create_group_page, name='create_group'),
    
    # ============================================
    # APIs
    # ============================================
    path('api/user-details/<int:user_id>/', views.api_get_user_details, name='api_user_details'),
    path('api/update-user/<int:user_id>/', views.api_update_user, name='api_update_user'),
    path('api/update-username/', views.update_username, name='update_username'),
    path('api/change-password/', views.change_password, name='change_password'),
    path('api/update-profile/', views.update_profile, name='update_profile'),
    path('api/create-user/', views.create_user, name='create_user'),
    path('api/delete-user/<int:user_id>/', views.delete_user, name='delete_user'),
    path('api/get-permissions/<int:user_id>/', views.get_user_permissions, name='get_permissions'),
    path('api/update-permissions/<int:user_id>/', views.update_user_permissions, name='update_permissions'),
    path('api/get-user-groups/<int:user_id>/', views.get_user_groups, name='get_user_groups'),
    path('api/update-user-groups/<int:user_id>/', views.update_user_groups, name='update_user_groups'),
    path('api/update-user-role/<int:user_id>/', views.update_user_role, name='update_user_role'),
    path('api/reset-user-password/', views.reset_user_password, name='reset_user_password'),
    path('api/toggle-user-status/<int:user_id>/', views.api_toggle_user_status, name='toggle_user_status'),
    path('api/groups/create/', views.create_group_api, name='create_group_api'),
    path('api/groups/<int:group_id>/', views.get_group_details_api, name='get_group_details_api'),
    path('api/groups/<int:group_id>/update/', views.update_group_api, name='update_group_api'),

    
    # ============================================
    # سجلات التدقيق والأحداث الموحدة
    # ============================================
    path('system-logs/', views.system_logs, name='system_logs'),
    path('audit-log/', views.audit_log, name='audit_log'),
    path('audit-log/filter/', views.filter_audit_log, name='filter_audit_log'),
    path('activity-log/', views.activity_log, name='activity_log'),
    path('activity-log/filter/', views.filter_activity_log, name='filter_activity_log'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('resend-otp/', views.resend_otp, name='resend_otp'),

    # ============================================
    # إعادة تعيين كلمة المرور (Password Reset)
    # ============================================
    path('password-reset/', 
         auth_views.PasswordResetView.as_view(
             template_name='users/password_reset.html',
             email_template_name='users/password_reset_email.html',
             html_email_template_name='users/password_reset_email.html',  # 👈 أضيفي هذا السطر ليقرأ الـ HTML كواجهة وليس كنص!
             subject_template_name='users/password_reset_subject.txt',
             success_url='/users/password-reset/done/'
         ), 
         name='password_reset'),

    path('password-reset/done/', 
         auth_views.PasswordResetDoneView.as_view(
             template_name='users/password_reset_done.html'
         ), 
         name='password_reset_done'),

    path('password-reset-confirm/<uidb64>/<token>/', 
         auth_views.PasswordResetConfirmView.as_view(
             template_name='users/password_reset_confirm.html',
             success_url='/users/password-reset-complete/'
         ), 
         name='password_reset_confirm'),

    path('password-reset-complete/', 
         auth_views.PasswordResetCompleteView.as_view(
             template_name='users/password_reset_complete.html'
         ), 
         name='password_reset_complete'),

    # ============================================================
    # إدارة المسؤولين المعتمدين
    # ============================================================
    path('officials-management/', views.officials_management, name='officials_management'),
    path('api/officials/', views.api_get_officials, name='api_get_officials'),
    path('api/officials/save/', views.api_save_official, name='api_save_official'),
    path('api/officials/toggle/<int:official_id>/', views.api_toggle_official_status, name='api_toggle_official_status'),
]