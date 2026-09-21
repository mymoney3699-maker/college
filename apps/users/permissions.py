# apps/users/permissions.py
import functools
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib.auth.mixins import AccessMixin
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import redirect, resolve_url
from django.utils.http import url_has_allowed_host_and_scheme


def is_ajax_or_api(request):
    """التحقق مما إذا كان الطلب استدعاء API أو AJAX"""
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return True
    if request.path.startswith('/api/') or '/api/' in request.path:
        return True
    if 'application/json' in request.headers.get('Accept', '') or request.content_type == 'application/json':
        return True
    return False


def get_user_roles(user):
    """استخراج جميع الأدوار والمجموعات التي ينتمي إليها المستخدم"""
    if not user or not user.is_authenticated:
        return set()
    
    roles = set()
    if hasattr(user, 'role') and user.role:
        roles.add(user.role.lower().strip())
    
    # دعم المجموعات (Groups) المنسوبة للمستخدم
    for group in user.groups.all():
        roles.add(group.name.lower().strip())
        
    return roles


def role_required(*allowed_roles, redirect_url='users:dashboard_redirect', message="❌ عذراً، ليس لديك صلاحية الوصول إلى هذه الصفحة."):
    """
    ديكوريتور التحقق من الدور والصلاحية للمستخدمين.
    - يتحقق من تسجيل الدخول أولاً ويحوّل لصفحة تسجيل الدخول مع رابط العودة ?next= في حال عدم التسجيل.
    - يتحقق من مطابقة دور المستخدم مع أحد الأدوار المصرحة (مع استثناء المشرفين is_superuser).
    - إذا كان غير مصرح، يعيد رسالة 403 للـ APIs أو يعيد التوجيه مع رسالة تنبيه للواجهات العادية.
    """
    # تنظيف الأدوار وتحويلها لأحرف صغيرة
    normalized_allowed = {r.lower().strip() for r in allowed_roles}
    
    def decorator(view_func):
        @functools.wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # 1. التحقق من المصادقة (Authentication Check)
            if not request.user.is_authenticated:
                if is_ajax_or_api(request):
                    return JsonResponse({
                        'success': False,
                        'authenticated': False,
                        'error': 'يرجى تسجيل الدخول أولاً للمتابعة.'
                    }, status=401)
                
                login_url = resolve_url(settings.LOGIN_URL)
                path = request.get_full_path()
                return redirect(f"{login_url}?{REDIRECT_FIELD_NAME}={path}")
            
            # 2. السماح للمشرفين بكامل الصلاحيات
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # 3. فحص الأدوار المصرحة
            user_roles = get_user_roles(request.user)
            if any(role in normalized_allowed for role in user_roles):
                return view_func(request, *args, **kwargs)
            
            # 4. معالجة الرفض (Access Denied)
            if is_ajax_or_api(request):
                return JsonResponse({
                    'success': False,
                    'forbidden': True,
                    'error': message
                }, status=403)
            
            messages.error(request, message)
            return redirect(redirect_url)
            
        return _wrapped_view
    return decorator


class RoleRequiredMixin(AccessMixin):
    """
    Class-Based View Mixin للتحقق من الأدوار والصلاحيات
    """
    allowed_roles = ()
    permission_denied_message = "❌ عذراً، ليس لديك صلاحية الوصول إلى هذه الصفحة."
    redirect_url = 'users:dashboard_redirect'

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()

        if request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)

        normalized_allowed = {r.lower().strip() for r in self.allowed_roles}
        user_roles = get_user_roles(request.user)

        if not any(role in normalized_allowed for role in user_roles):
            if is_ajax_or_api(request):
                return JsonResponse({
                    'success': False,
                    'forbidden': True,
                    'error': self.permission_denied_message
                }, status=403)
            
            messages.error(request, self.permission_denied_message)
            return redirect(self.redirect_url)

        return super().dispatch(request, *args, **kwargs)


# ============================================================
# دوال الحماية المحددة للأدوار المختلفة (Pre-configured Role Guards)
# ============================================================

def admin_required(view_func):
    """حماية مخصصة لمدراء النظام فقط"""
    return role_required('admin', message="❌ هذه الصفحة مخصصة لمدراء النظام فقط.")(view_func)


def exam_director_required(view_func):
    """حماية مخصصة لإدارة ومنسقي وموظفي الدراسة والامتحانات"""
    return role_required(
        'admin', 'exam_director', 'exam_officer', 'دراسة وامتحانات', 'منسق دراسة وامتحانات',
        message="❌ هذه الصفحة تقع ضمن اختصاص قسم الدراسة والامتحانات."
    )(view_func)


def registrar_required(view_func):
    """حماية مخصصة للمسجل العام وموظفي القبول والتسجيل"""
    return role_required(
        'admin', 'general_registrar', 'registrar', 'مسجل عام', 'تسجيل', 'قبول وتسجيل',
        message="❌ هذه الصفحة تقع ضمن اختصاص مكتب المسجل العام وقسم القبول والتسجيل."
    )(view_func)


def graduate_officer_required(view_func):
    """حماية مخصصة لقسم الخريجين والمسجل العام"""
    return role_required(
        'admin', 'graduate_officer', 'graduates', 'general_registrar', 'خريجين', 'قسم الخريجين',
        message="❌ هذه الصفحة تقع ضمن اختصاص قسم الخريجين ومكتب المسجل العام."
    )(view_func)


def academic_dept_required(view_func):
    """حماية مخصصة لرؤساء الأقسام العلمية والمسجل العام وإدارة الكلية"""
    return role_required(
        'admin', 'academic_dept', 'general_registrar', 'exam_director', 'قسم علمي', 'رئيس قسم',
        message="❌ هذه الصفحة تقع ضمن اختصاص رؤساء الأقسام العلمية وإدارة الكلية."
    )(view_func)


def student_required(view_func):
    """حماية مخصصة لبوابة الطلاب الذاتية"""
    return role_required('admin', 'student', 'طالب', message="❌ هذه البوابة مخصصة للطلاب فقط.")(view_func)


def has_execution_perm(user, *perm_codenames):
    """
    التحقق مما إذا كان المستخدم يمتلك صلاحية التنفيذ (إضافة/تعديل/حذف) لعملية معينة.
    - المشرف العام (superuser) أو مدير النظام (admin) أو المسجل العام (general_registrar) يمتلكون كافة الصلاحيات التنفيذية تلقائياً.
    - الكوادر الإدارية والأكاديمية تمتلك صلاحيات التنفيذ بحسب اختصاص أدوارها الوظيفية.
    - يتحقق من الصلاحيات المباشرة المسندة لحساب المستخدم (User Permissions).
    - يتحقق من الصلاحيات المكتسبة عبر المجموعات المسندة للمستخدم (Group Permissions).
    """
    if not user or not user.is_authenticated:
        return False
    
    if user.is_superuser:
        return True
        
    user_role = (getattr(user, 'role', '') or '').lower().strip()
    
    # 1. مدير النظام والمسجل العام يمتلكان الصلاحيات التنفيذية الكاملة
    if user_role in ['admin', 'general_registrar', 'مسجل عام']:
        return True

    # تنظيف وتجهيز أسماء الصلاحيات المطلوبة
    normalized_perms = set()
    for p in perm_codenames:
        if not p:
            continue
        p_clean = str(p).lower().strip()
        normalized_perms.add(p_clean)
        if '.' in p_clean:
            normalized_perms.add(p_clean.split('.', 1)[1])

    # 2. مصفوفة الصلاحيات حسب الأدوار الوظيفية التخصصية
    # أ) قسم الدراسة والامتحانات (الدرجات، نشر النتائج، الطعون، المعادلات)
    if user_role in ['exam_director', 'exam_officer', 'دراسة وامتحانات', 'منسق دراسة وامتحانات']:
        exam_prefixes = ('grade', 'publish', 'appeal', 'courseequivalence', 'course', 'group', 'department')
        if any(any(prefix in perm for prefix in exam_prefixes) for perm in normalized_perms):
            return True

    # ب) قسم القبول والتسجيل (تجديد القيد، تسجيل وتنزيل المواد، حالات وقيد الطلاب، الأقسام، الأماكن، المؤهلات)
    if user_role in ['registrar', 'قبول وتسجيل', 'تسجيل']:
        reg_prefixes = ('enrollmentrenewal', 'courseregistration', 'studystatus', 'student', 'renewal', 'download', 'department', 'place', 'qualification', 'nationality')
        if any(any(prefix in perm for prefix in reg_prefixes) for perm in normalized_perms):
            return True

    # ج) قسم الخريجين (إخلاء الطرف، إفادات التخرج، شؤون الخريجين)
    if user_role in ['graduate_officer', 'خريجين', 'قسم الخريجين']:
        grad_prefixes = ('graduation', 'clearance', 'certificate', 'studystatus', 'student')
        if any(any(prefix in perm for prefix in grad_prefixes) for perm in normalized_perms):
            return True

    # د) الأقسام العلمية (المواد والمقررات، المجموعات، تسجيل المواد، الأقسام والتخصصات)
    if user_role in ['academic_dept', 'قسم علمي', 'رئيس قسم', 'منسق قسم']:
        dept_prefixes = ('course', 'group', 'courseregistration', 'grade', 'department')
        if any(any(prefix in perm for prefix in dept_prefixes) for perm in normalized_perms):
            return True

    # 3. التحقق من الصلاحيات المسندة عبر Django Auth (المباشرة أو المجموعات)
    for perm in perm_codenames:
        if not perm:
            continue
        codename = str(perm).split('.', 1)[1] if '.' in str(perm) else str(perm)
        has_direct = user.user_permissions.filter(codename=codename).exists()
        has_group = user.groups.filter(permissions__codename=codename).exists()
        if has_direct or has_group:
            return True
        if '.' in str(perm) and user.has_perm(perm):
            return True
        elif user.has_perm(f"renewal.{codename}") or user.has_perm(f"users.{codename}") or user.has_perm(f"grades.{codename}") or user.has_perm(f"faculty.{codename}"):
            return True

    return False


def require_execution_permission(*perm_codenames, message="❌ عذراً، لا تمتلك صلاحية تنفيذ هذه العملية (إضافة/تعديل/حذف). يرجى مراجعة مدير النظام."):
    """
    ديكوريتور مخصص لحماية دوال التنفيذ، الإضافة، التعديل، والحذف (Mutation Actions).
    - إذا كان الطلب AJAX أو API: يرجع خطأ 403 بصيغة JSON مع رسالة واضحة.
    - إذا كان الطلب عادياً: يرسل رسالة خطأ ويعيد التوجيه إلى الصفحة السابقة أو لوحة التحكم.
    """
    def decorator(view_func):
        @functools.wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                if is_ajax_or_api(request):
                    return JsonResponse({
                        'success': False,
                        'authenticated': False,
                        'error': 'يرجى تسجيل الدخول أولاً للمتابعة.'
                    }, status=401)
                login_url = resolve_url(settings.LOGIN_URL)
                path = request.get_full_path()
                return redirect(f"{login_url}?{REDIRECT_FIELD_NAME}={path}")

            if has_execution_perm(request.user, *perm_codenames):
                return view_func(request, *args, **kwargs)

            # معالجة الرفض
            if is_ajax_or_api(request):
                return JsonResponse({
                    'success': False,
                    'forbidden': True,
                    'error': message
                }, status=403)

            messages.error(request, message)
            referer = request.META.get('HTTP_REFERER')
            if referer and url_has_allowed_host_and_scheme(referer, allowed_hosts={request.get_host()}):
                return redirect(referer)
            return redirect('users:dashboard_redirect')

        return _wrapped_view
    return decorator


class ExecutionPermissionRequiredMixin(AccessMixin):
    """
    Mixin للـ Class-Based Views للتحقق من صلاحيات التنفيذ
    """
    required_permissions = ()
    permission_denied_message = "❌ عذراً، لا تمتلك صلاحية تنفيذ هذه العملية."

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()

        if not has_execution_perm(request.user, *self.required_permissions):
            if is_ajax_or_api(request):
                return JsonResponse({
                    'success': False,
                    'forbidden': True,
                    'error': self.permission_denied_message
                }, status=403)
            messages.error(request, self.permission_denied_message)
            return redirect('users:dashboard_redirect')

        return super().dispatch(request, *args, **kwargs)


def staff_required(view_func):
    """حماية عامة لجميع أعضاء الكادر الإداري والأكاديمي (استبعاد الطلاب غير المصرحين)"""
    return role_required(
        'admin', 'general_registrar', 'registrar', 'exam_director', 'exam_officer',
        'graduate_officer', 'academic_dept', 'موظف', 'أستاذ',
        message="❌ هذه الصفحة مخصصة لأعضاء الكادر الإداري والأكاديمي فقط."
    )(view_func)


