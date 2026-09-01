# apps/users/middleware.py
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import redirect, resolve_url


def is_ajax_or_api_request(request):
    """فحص ما إذا كان الطلب استدعاء API أو AJAX"""
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return True
    if request.path.startswith('/api/') or '/api/' in request.path:
        return True
    accept_header = request.headers.get('Accept', '')
    if 'application/json' in accept_header or request.content_type == 'application/json':
        return True
    return False


class StudentAccessControlMiddleware:
    """
    Middleware شامل ومحكم لتأمين النظام وفرض تسجيل الدخول وعزل الصلاحيات:
    1. فرض تسجيل الدخول الصارم (Authentication Enforcement):
       - يمنع أي زائر غير مسجل الدخول من فتح أي صفحة إدارية أو لوحة تحكم أو بوابة طلاب.
       - يحول الزائر فوراً وبشكل تلقائي إلى صفحة تسجيل الدخول (/users/login/?next=...) مع حفظ الرابط للعودة إليه بعد الدخول.
       - يستثني فقط المسارات العامة المصرح بها (تسجيل الدخول، تسجيل الخروج، فحص QR العام، والملفات الثابتة).
       
    2. عزل وحماية المسارات الإدارية من حسابات الطلاب (Student Isolation):
       - يمنع حسابات الطلاب نهائياً من الوصول إلى الكنترول (/grades/)، التسجيل الإداري (/renewal/)، شؤون التدريس (/faculty/)، إدارة المستخدمين (/users/manage/...)، ولوحة تحكم جانغو (/admin/).
       - يحول الطالب تلقائياً إلى بوابته الأكاديمية (/student/dashboard/) مع إظهار رسالة تنبيه واضحة.
    """

    # المسارات العامة المسموحة للزوار غير المسجلين (مثل فحص الـ QR العام وتسجيل الدخول)
    PUBLIC_URL_PREFIXES = (
        '/users/login',
        '/users/login-view',
        '/users/verify-otp',
        '/users/resend-otp',
        '/users/logout',
        '/users/reset-password',
        '/users/password-reset',
        '/student/verify',
        '/student/qr',
        '/qr/',
        '/favicon.ico',
        '/static/',
        '/media/',
    )

    # المسارات الإدارية المحظورة قطعاً على الطلاب
    FORBIDDEN_STUDENT_PREFIXES = (
        '/admin/',
        '/grades/',
        '/renewal/',
        '/faculty/',
        '/users/manage',
        '/users/add-user',
        '/users/edit-user',
        '/users/delete-user',
        '/users/toggle-status',
        '/users/officials',
        '/users/groups',
        '/users/activity-logs',
        '/users/audit-logs',
        '/users/export',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        user = getattr(request, 'user', None)

        # -------------------------------------------------------------
        # 1. فحص المسارات العامة المستثناة من تسجيل الدخول
        # -------------------------------------------------------------
        is_public = any(path.startswith(prefix) for prefix in self.PUBLIC_URL_PREFIXES)

        # -------------------------------------------------------------
        # 2. حماية المستخدمين غير المسجلين (Unauthenticated Access Guard)
        # -------------------------------------------------------------
        if not user or not user.is_authenticated:
            if not is_public:
                # إذا كان المسار الرئيسي /
                if path in ['/', '/users/dashboard/', '/users/dashboard']:
                    login_url = resolve_url(settings.LOGIN_URL)
                    return redirect(login_url)

                if is_ajax_or_api_request(request):
                    return JsonResponse({
                        'success': False,
                        'authenticated': False,
                        'forbidden': True,
                        'error': 'يرجى تسجيل الدخول أولاً للوصول إلى هذه الوظيفة.'
                    }, status=401)

                login_url = resolve_url(settings.LOGIN_URL)
                full_path = request.get_full_path()
                return redirect(f"{login_url}?{REDIRECT_FIELD_NAME}={full_path}")

        # -------------------------------------------------------------
        # 3. حماية المسارات الإدارية من الطلاب (Student Access Guard)
        # -------------------------------------------------------------
        else:
            is_student_user = getattr(user, 'is_student', False) or user.role in ['student', 'طالب']
            is_staff_or_superuser = user.is_superuser or user.is_staff

            if is_student_user and not is_staff_or_superuser:
                # إذا طلب الطالب الصفحة الرئيسية أو التوجيه العام
                if path in ['/users/dashboard/', '/users/dashboard', '/']:
                    return redirect('student:dashboard')

                # التحقق مما إذا كان المسار إدارياً محظوراً على الطلاب
                is_admin_path = any(path.startswith(prefix) for prefix in self.FORBIDDEN_STUDENT_PREFIXES)
                if is_admin_path:
                    if is_ajax_or_api_request(request):
                        return JsonResponse({
                            'success': False,
                            'forbidden': True,
                            'error': '⛔ غير مصرح للطلاب بالوصول إلى هذه الوظيفة أو الصفحة الإدارية.'
                        }, status=403)

                    messages.error(
                        request,
                        '⛔ عذراً، ليس لديك صلاحية الوصول إلى الصفحات الإدارية. تم توجيهك إلى بوابتك الأكاديمية.'
                    )
                    return redirect('student:dashboard')

        response = self.get_response(request)
        return response
