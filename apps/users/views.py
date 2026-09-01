from django.shortcuts import render, redirect, get_object_or_404
from django.db import models, IntegrityError
from django.db.models import Q
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash, get_user_model
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.contrib.auth.models import Group
import json
from django.urls import reverse
from functools import wraps
from .utils import log_create, log_activity, extract_changed_fields
from .models import ActivityLog, AuditLog
from django.contrib.auth.models import Group, Permission
from .permissions import (
    role_required, admin_required, exam_director_required,
    registrar_required, graduate_officer_required,
    academic_dept_required, student_required, staff_required
)


MODEL_TRANSLATIONS = {
    'user': 'المستخدمين والحسابات',
    'group': 'المجموعات والأدوار',
    'permission': 'الصلاحيات الإدارية',
    'logentry': 'سجل التدقيق والإدخالات',
    'contenttype': 'أنواع المحتوى',
    'session': 'الجلسات والاتصالات',
    'address': 'العناوين السكنية',
    'bloodtype': 'فصائل الدم',
    'deletedstudent': 'الطلاب المحذوفين',
    'gender': 'الجنس والنوع',
    'maritalstatus': 'الحالة الاجتماعية',
    'nationality': 'الجنسيات',
    'placeofbirth': 'أماكن الميلاد',
    'qualification': 'المؤهلات العلمية',
    'student': 'بيانات الطلاب',
    'studenteditlog': 'سجل تعديلات الطلاب',
    'studentstatus': 'حالات الطلاب الأكاديمية',
    'studenttype': 'أنواع الطلاب',
    'guardian': 'أولياء الأمور',
    'department': 'الأقسام الأكاديمية',
    'level': 'المستويات الدراسية',
    'studyplan': 'الخطط الدراسية',
    'studyplancourse': 'مواد الخطة الدراسية',
    'course': 'المواد والمناهج الدراسية',
    'courseprerequisite': 'المتطلبات السابقة للمواد',
    'courseequivalencerule': 'معادلات ومكافئات المواد',
    'semester': 'الفصول الدراسية',
    'enrollmentrenewal': 'تجديد القيد',
    'courseregistration': 'تنزيل وتسجيل المواد',
    'grade': 'الدرجات والنتائج',
    'gradeconfiguration': 'إعدادات الكنترول والدرجات',
    'academicrecord': 'السجلات الأكاديمية',
    'gradehistory': 'تاريخ تعديل الدرجات',
    'gradenotification': 'إشعارات الكنترول',
    'job': 'الوظائف والخدمات',
    'activitylog': 'سجل الأحداث العامة',
    'auditlog': 'سجل التغييرات والتدقيق',
    'courseassignment': 'إسناد وتوزيع المواد',
    'professor': 'أعضاء هيئة التدريس',
    'departmentstaff': 'موظفي الأقسام',
    'attendancerecord': 'سجلات الحضور والغياب',
    'official': 'المسؤولين المعتمدين',
    'specialization': 'التخصصات الدراسية',
    'filewithdrawal': 'سحب الملفات',
    'filewithdrawalarchive': 'أرشيف سحب الملفات',
    'graduationarchive': 'أرشيف الخريجين',
    'hold': 'الحجب والقيود الأكاديمية',
    'studentedithistory': 'أرشيف تعديلات الطلاب',
    'semesterrecord': 'السجلات الفصلية',
    'notification': 'التنبيهات والإشعارات',
}

PERMISSION_TRANSLATIONS = {
    # المستخدمين
    'add_user': 'إضافة مستخدم جديد',
    'change_user': 'تعديل بيانات مستخدم',
    'delete_user': 'حذف حساب مستخدم',
    'view_user': 'عرض قائمة وتفاصيل المستخدمين',
    'Can add user': 'إضافة مستخدم جديد',
    'Can change user': 'تعديل بيانات مستخدم',
    'Can delete user': 'حذف حساب مستخدم',
    'Can view user': 'عرض قائمة وتفاصيل المستخدمين',

    # المجموعات
    'add_group': 'إضافة مجموعة صلاحيات جديدة',
    'change_group': 'تعديل مجموعة صلاحيات',
    'delete_group': 'حذف مجموعة صلاحيات',
    'view_group': 'عرض المجموعات والأدوار',
    'Can add group': 'إضافة مجموعة صلاحيات جديدة',
    'Can change group': 'تعديل مجموعة صلاحيات',
    'Can delete group': 'حذف مجموعة صلاحيات',
    'Can view group': 'عرض المجموعات والأدوار',

    # الصلاحيات
    'add_permission': 'إضافة صلاحية جديدة',
    'change_permission': 'تعديل صلاحية في النظام',
    'delete_permission': 'حذف صلاحية من النظام',
    'view_permission': 'عرض قائمة الصلاحيات',
    'Can add permission': 'إضافة صلاحية جديدة',
    'Can change permission': 'تعديل صلاحية في النظام',
    'Can delete permission': 'حذف صلاحية من النظام',
    'Can view permission': 'عرض قائمة الصلاحيات',

    # الطلاب
    'add_student': 'إضافة طالب جديد',
    'change_student': 'تعديل ملف طالب',
    'delete_student': 'حذف سجل طالب',
    'view_student': 'عرض شاشة وبيانات الطلاب',
    'Can add student': 'إضافة طالب جديد',
    'Can change student': 'تعديل ملف طالب',
    'Can delete student': 'حذف سجل طالب',
    'Can view student': 'عرض شاشة وبيانات الطلاب',

    # المواد
    'add_course': 'إضافة مادة دراسية',
    'change_course': 'تعديل بيانات مادة',
    'delete_course': 'حذف مادة دراسية',
    'view_course': 'عرض دليل المواد الدراسية',
    'Can add course': 'إضافة مادة دراسية',
    'Can change course': 'تعديل بيانات مادة',
    'Can delete course': 'حذف مادة دراسية',
    'Can view course': 'عرض دليل المواد الدراسية',

    # إسناد المواد للأساتذة (Course Assignment)
    'add_courseassignment': 'إضافة إسناد مادة لأستاذ',
    'change_courseassignment': 'تعديل إسناد مادة لأستاذ',
    'delete_courseassignment': 'حذف إسناد مادة لأستاذ',
    'view_courseassignment': 'عرض إسنادات المواد للأساتذة',
    'Can add إسناد مادة لأستاذ': 'إضافة إسناد مادة لأستاذ',
    'Can change إسناد مادة لأستاذ': 'تعديل إسناد مادة لأستاذ',
    'Can delete إسناد مادة لأستاذ': 'حذف إسناد مادة لأستاذ',
    'Can view إسناد مادة لأستاذ': 'عرض إسنادات المواد للأساتذة',
    'Can add course assignment': 'إضافة إسناد مادة لأستاذ',
    'Can change course assignment': 'تعديل إسناد مادة لأستاذ',
    'Can delete course assignment': 'حذف إسناد مادة لأستاذ',
    'Can view course assignment': 'عرض إسنادات المواد للأساتذة',

    # الأساتذة وأعضاء هيئة التدريس
    'add_professor': 'إضافة عضو هيئة تدريس',
    'change_professor': 'تعديل بيانات عضو هيئة تدريس',
    'delete_professor': 'حذف عضو هيئة تدريس',
    'view_professor': 'عرض أعضاء هيئة التدريس',
    'Can add professor': 'إضافة عضو هيئة تدريس',
    'Can change professor': 'تعديل بيانات عضو هيئة تدريس',
    'Can delete professor': 'حذف عضو هيئة تدريس',
    'Can view professor': 'عرض أعضاء هيئة التدريس',

    # المسؤولين المعتمدين
    'add_official': 'إضافة مسؤول معتمد',
    'change_official': 'تعديل بيانات مسؤول معتمد',
    'delete_official': 'حذف مسؤول معتمد',
    'view_official': 'عرض المسؤولين المعتمدين',
    'Can add official': 'إضافة مسؤول معتمد',
    'Can change official': 'تعديل بيانات مسؤول معتمد',
    'Can delete official': 'حذف مسؤول معتمد',
    'Can view official': 'عرض المسؤولين المعتمدين',

    # الحجب والقيود
    'add_hold': 'إضافة حجب أكاديمي / مالي',
    'change_hold': 'تعديل حالة الحجب',
    'delete_hold': 'فك وإلغاء الحجب',
    'view_hold': 'عرض قائمة المحجوبين',

    # أرشيف الخريجين
    'add_graduationarchive': 'إضافة سجل تخرج للأرشيف',
    'change_graduationarchive': 'تعديل سجل خريج',
    'delete_graduationarchive': 'حذف سجل خريج من الأرشيف',
    'view_graduationarchive': 'عرض أرشيف الخريجين',

    # سحب الملفات
    'add_filewithdrawal': 'إجراء سحب ملف طالب',
    'change_filewithdrawal': 'تعديل سحب ملف',
    'delete_filewithdrawal': 'إلغاء سحب ملف',
    'view_filewithdrawal': 'عرض سجلات سحب الملفات',

    # تجديد القيد وتنزيل المواد
    'add_enrollmentrenewal': 'إجراء تجديد قيد',
    'change_enrollmentrenewal': 'تعديل تجديد قيد',
    'delete_enrollmentrenewal': 'إلغاء تجديد قيد',
    'view_enrollmentrenewal': 'عرض سجلات تجديد القيد',
    'Can add enrollment renewal': 'إجراء تجديد قيد',
    'Can change enrollment renewal': 'تعديل تجديد قيد',
    'Can delete enrollment renewal': 'إلغاء تجديد قيد',
    'Can view enrollment renewal': 'عرض سجلات تجديد القيد',

    'add_courseregistration': 'تنزيل مادة لطالب',
    'change_courseregistration': 'تعديل تنزيل المواد',
    'delete_courseregistration': 'حذف تنزيل مادة',
    'view_courseregistration': 'عرض قائمة المواد المنزلة',
    'Can add course registration': 'تنزيل مادة لطالب',
    'Can change course registration': 'تعديل تنزيل المواد',
    'Can delete course registration': 'حذف تنزيل مادة',
    'Can view course registration': 'عرض قائمة المواد المنزلة',

    # الدرجات والكنترول
    'add_grade': 'رصد/إدخال درجة جديدة',
    'change_grade': 'تعديل درجة طالب',
    'delete_grade': 'حذف درجة طالب',
    'view_grade': 'عرض نتائج ودرجات الطلاب',
    'Can add grade': 'رصد/إدخال درجة جديدة',
    'Can change grade': 'تعديل درجة طالب',
    'Can delete grade': 'حذف درجة طالب',
    'Can view grade': 'عرض نتائج ودرجات الطلاب',

    # الأقسام والمستويات
    'add_department': 'إضافة قسم أكاديمي',
    'change_department': 'تعديل بيانات قسم',
    'delete_department': 'حذف قسم أكاديمي',
    'view_department': 'عرض الأقسام الكلية',
    'Can add department': 'إضافة قسم أكاديمي',
    'Can change department': 'تعديل بيانات قسم',
    'Can delete department': 'حذف قسم أكاديمي',
    'Can view department': 'عرض الأقسام الكلية',
}

def translate_permission_name(perm_name, codename=None):
    """ترجمة اسم الصلاحية إلى العربية بشكل كامل ودقيق"""
    if perm_name in PERMISSION_TRANSLATIONS:
        return PERMISSION_TRANSLATIONS[perm_name]
    if codename and codename in PERMISSION_TRANSLATIONS:
        return PERMISSION_TRANSLATIONS[codename]
    
    # التفكيك التلقائي للأسماء بالإنجليزية (Can add / Can change / Can delete / Can view)
    name_str = str(perm_name or '').strip()
    if name_str.startswith('Can add '):
        target = name_str[8:].strip().lower().replace(' ', '')
        target_ar = MODEL_TRANSLATIONS.get(target, name_str[8:].strip())
        return f"إضافة في {target_ar}"
    elif name_str.startswith('Can change '):
        target = name_str[11:].strip().lower().replace(' ', '')
        target_ar = MODEL_TRANSLATIONS.get(target, name_str[11:].strip())
        return f"تعديل في {target_ar}"
    elif name_str.startswith('Can delete '):
        target = name_str[11:].strip().lower().replace(' ', '')
        target_ar = MODEL_TRANSLATIONS.get(target, name_str[11:].strip())
        return f"حذف من {target_ar}"
    elif name_str.startswith('Can view '):
        target = name_str[9:].strip().lower().replace(' ', '')
        target_ar = MODEL_TRANSLATIONS.get(target, name_str[9:].strip())
        return f"عرض {target_ar}"

    # التفكيك التلقائي للكود نيم (add_ / change_ / delete_ / view_)
    code_str = str(codename or '').strip()
    if code_str.startswith('add_'):
        target = code_str[4:].strip().lower()
        target_ar = MODEL_TRANSLATIONS.get(target, target)
        return f"إضافة في {target_ar}"
    elif code_str.startswith('change_'):
        target = code_str[7:].strip().lower()
        target_ar = MODEL_TRANSLATIONS.get(target, target)
        return f"تعديل في {target_ar}"
    elif code_str.startswith('delete_'):
        target = code_str[7:].strip().lower()
        target_ar = MODEL_TRANSLATIONS.get(target, target)
        return f"حذف من {target_ar}"
    elif code_str.startswith('view_'):
        target = code_str[5:].strip().lower()
        target_ar = MODEL_TRANSLATIONS.get(target, target)
        return f"عرض {target_ar}"

    return name_str

User = get_user_model()


def login_page(request):
    if request.GET.get('force') == '1' or request.GET.get('relogin') == '1':
        if request.user.is_authenticated:
            logout(request)
        return render(request, 'users/login.html')

    if request.user.is_authenticated:
        return redirect('users:dashboard_redirect')
    return render(request, 'users/login.html')

@login_required
def settings_page(request):
    return render(request, 'users/settings.html')

@admin_required
def user_permissions(request):
    # 🔥 جلب المستخدمين الذين ليسوا طلاباً أو أساتذة
    users_list = User.objects.exclude(role__in=['student', 'teacher']).order_by('id')
    context = {'users': users_list}
    return render(request, 'users/permissions.html', context)

@login_required
def dashboard_page(request):
    return render(request, 'users/dashboard.html')


# ============================================
# تسجيل الدخول والخروج
# ============================================

import random
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from django.core.mail import send_mail
from django.conf import settings
from django.contrib import messages

from django.contrib.auth import login

import time

def generate_and_send_otp(request, user):
    """دالة مساعدة لتوليد رمز التحقق وتخزين بيانات الأمان في الجلسة وإرساله بالبريد"""
    otp_code = str(random.randint(100000, 999999))
    
    request.session['otp_user_id'] = user.id
    request.session['otp_code'] = otp_code
    request.session['otp_created_at'] = time.time()
    request.session['otp_attempts'] = 0
    
    subject = 'رمز التحقق لتسجيل الدخول - نظام الكلية'
    message = f'مرحباً {user.username}،\n\nرمز التحقق الخاص بك لتسجيل الدخول هو: {otp_code}\nصلاحية هذا الرمز هي 5 دقائق فقط.\nإذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.'
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
    except Exception as e:
        print(f"⚠️ فشل إرسال بريد الـ OTP: {e}")
    return otp_code


def login_view(request):
    if request.method == 'POST':
        login_input = (request.POST.get('username') or '').strip()
        password = request.POST.get('password') or ''
        
        user = None
        if login_input:
            # 1. محاولة المصادقة المباشرة باسم المستخدم
            user = authenticate(request, username=login_input, password=password)
            
            # 2. محاولة بالبريد الإلكتروني
            if user is None:
                User = get_user_model()
                matched_user = User.objects.filter(email__iexact=login_input).first()
                if matched_user:
                    user = authenticate(request, username=matched_user.username, password=password)
                    
            # 3. محاولة برقم القيد الجامعي
            if user is None:
                try:
                    from apps.student.models import Student
                    student_obj = Student.objects.filter(student_id__iexact=login_input).select_related('user').first()
                    if student_obj and student_obj.user:
                        user = authenticate(request, username=student_obj.user.username, password=password)
                except Exception:
                    pass
        
        if user is not None:
            # 🟢 إذا لم يكن طالباً (أدمن، رئيس قسم علمي، موظف)، يتم تسجيل دخوله مباشرة وتوجيهه للوحته بدون OTP
            if getattr(user, 'role', '') != 'student' and not (hasattr(user, 'student') and user.student):
                login(request, user)
                next_url = request.GET.get('next') or request.POST.get('next')
                if next_url and not next_url.startswith('/users/login'):
                    return redirect(next_url)
                return redirect_user_to_dashboard(user)
            
            # 🔵 إذا كان طالباً، يتم تطبيق التحقق بخطوتين (OTP) مع مهلة 5 دقائق وحد للمحاولات
            generate_and_send_otp(request, user)
            return redirect('users:verify_otp')
        else:
            messages.error(request, 'اسم المستخدم أو كلمة المرور غير صحيحة')
            
    return render(request, 'users/login.html')


def resend_otp(request):
    """إعادة إرسال رمز OTP جديد للطالب"""
    user_id = request.session.get('otp_user_id')
    if not user_id:
        messages.error(request, 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.')
        return redirect('users:login')
    
    User = get_user_model()
    user = User.objects.filter(id=user_id).first()
    if not user:
        messages.error(request, 'المستخدم غير موجود، يرجى إعادة تسجيل الدخول.')
        return redirect('users:login')
    
    generate_and_send_otp(request, user)
    messages.success(request, '✅ تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني (صالح لمدة 5 دقائق).')
    return redirect('users:verify_otp')


def verify_otp(request):
    """
    التحقق من رمز OTP وتوجيه المستخدم حسب دوره
    مع تطبيق:
    1. مهلة صلاحية الرمز (5 دقائق = 300 ثانية).
    2. الحد الأقصى للمحاولات الفاشلة (3 محاولات).
    """
    user_id = request.session.get('otp_user_id')
    saved_otp = request.session.get('otp_code')
    created_at = request.session.get('otp_created_at')
    attempts = request.session.get('otp_attempts', 0)
    
    if not user_id or not saved_otp:
        messages.error(request, 'يرجى تسجيل الدخول أولاً')
        return redirect('users:login')
        
    if request.method == 'POST':
        # 1. التحقق من مهلة الصلاحية (Timeout: 5 دقائق)
        OTP_TIMEOUT_SECONDS = 300  # 5 دقائق
        current_time = time.time()
        
        if created_at and (current_time - created_at > OTP_TIMEOUT_SECONDS):
            # إلغاء الرمز المنتهي وحذفه من الجلسة
            for key in ['otp_code', 'otp_created_at', 'otp_attempts']:
                request.session.pop(key, None)
            messages.error(request, '⏳ انتهت صلاحية رمز التحقق (أكثر من 5 دقائق). يرجى طلب رمز جديد.')
            return redirect('users:verify_otp')
        
        entered_otp = request.POST.get('otp', '').strip()
        
        # 2. مطابقة الرمز المدخل مع الرمز المحفوظ
        if entered_otp == saved_otp:
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
            # تسجيل الدخول الفعلي في النظام
            login(request, user)
            
            # 🔥 تنظيف الـ Session من بيانات الـ OTP
            for key in ['otp_user_id', 'otp_code', 'otp_created_at', 'otp_attempts']:
                request.session.pop(key, None)
            
            messages.success(request, f'مرحباً {user.username}! تم تسجيل الدخول بنجاح.')
            return redirect_user_to_dashboard(user)
        else:
            # 3. احتساب المحاولات الفاشلة وقفل الرمز عند الوصول لـ 3 محاولات
            attempts += 1
            request.session['otp_attempts'] = attempts
            MAX_ATTEMPTS = 3
            
            if attempts >= MAX_ATTEMPTS:
                for key in ['otp_code', 'otp_created_at', 'otp_attempts']:
                    request.session.pop(key, None)
                messages.error(request, f'🛑 استنفدت الحد الأقصى للمحاولات ({MAX_ATTEMPTS} محاولات خاطئة). تم إلغاء الرمز، يرجى طلب رمز جديد.')
            else:
                remaining = MAX_ATTEMPTS - attempts
                messages.error(request, f'رمز التحقق غير صحيح. متبقي لديك {remaining} محاولة.')
            
    return render(request, 'users/verify_otp.html')


@login_required
def logout_view(request):
    # تسجيل حدث تسجيل الخروج
    log_activity(request.user, 'logout', details=f'تسجيل خروج المستخدم {request.user.username}', request=request)
    logout(request)
    messages.success(request, 'تم تسجيل الخروج بنجاح')
    return redirect('users:login')


@login_required
def dashboard(request):
    """
    لوحة التحكم العامة - يتم توجيه المستخدم تلقائياً للوحة المناسبة
    """
    user = request.user
    
    # إذا كان المستخدم له دور محدد، نوجهه للوحة المناسبة
    if user.is_authenticated:
        try:
            redirect_url = get_redirect_url_based_on_role(user)
            if redirect_url != '/':
                return redirect(redirect_url)
        except:
            pass
    
    context = {'user': user}
    return render(request, 'users/dashboard.html', context)


@login_required
def user_accounts(request, user_id=None):
    if user_id and request.user.role == 'admin':
        target_user = get_object_or_404(User, id=user_id)
    else:
        target_user = request.user
    context = {'target_user': target_user}
    return render(request, 'users/user_accounts.html', context)


@login_required
def user_accounts_interface(request):
    if request.user.role != 'admin':
        return redirect('users:dashboard')
    # 🔥 استثناء الطلاب والأساتذة
    users_list = User.objects.exclude(role__in=['student', 'teacher']).order_by('id')
    context = {'users': users_list}
    return render(request, 'users/user_accounts.html', context)


# ============================================
# APIs
# ============================================

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def update_username(request):
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            user_id = data.get('user_id')
            new_username = data.get('username')
        else:
            user_id = request.POST.get('user_id')
            new_username = request.POST.get('username')
        
        if not user_id:
            return JsonResponse({'success': False, 'error': 'رقم المستخدم مطلوب'}, status=400)
        
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': f'رقم المستخدم غير صحيح: {user_id}'}, status=400)
        
        if request.user.role != 'admin' and request.user.id != user_id:
            return JsonResponse({'success': False, 'error': 'غير مصرح لك'}, status=403)
        
        user = get_object_or_404(User, id=user_id)
        old_username = user.username
        
        if not new_username or new_username.strip() == '':
            return JsonResponse({'success': False, 'error': 'اسم المستخدم لا يمكن أن يكون فارغاً'})
        
        if User.objects.filter(username=new_username).exclude(id=user_id).exists():
            return JsonResponse({'success': False, 'error': 'اسم المستخدم موجود بالفعل'})
        
        user.username = new_username
        user.save()
        
        # تسجيل حدث التعديل
        log_activity(request.user, 'update', model_name='User', object_name=user.username,
                     details=f'تغيير اسم المستخدم من {old_username} إلى {new_username}', request=request)
        
        return JsonResponse({'success': True, 'message': '✅ تم تحديث اسم المستخدم بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def change_password(request):
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            user_id = data.get('user_id')
            old_password = data.get('old_password')
            new_password = data.get('new_password')
            confirm_password = data.get('confirm_password')
        else:
            user_id = request.POST.get('user_id')
            old_password = request.POST.get('old_password')
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')
        
        if not user_id:
            user = request.user
            if not user.check_password(old_password):
                return JsonResponse({'success': False, 'error': 'كلمة المرور القديمة غير صحيحة'})
        else:
            user_id = int(user_id)
            if request.user.role != 'admin':
                return JsonResponse({'success': False, 'error': 'غير مصرح لك'}, status=403)
            user = get_object_or_404(User, id=user_id)
        
        if new_password != confirm_password:
            return JsonResponse({'success': False, 'error': 'كلمة المرور الجديدة غير متطابقة'})
        
        if len(new_password) < 6:
            return JsonResponse({'success': False, 'error': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'})
        
        user.set_password(new_password)
        user.save()
        
        # تسجيل حدث تغيير كلمة المرور
        log_activity(request.user, 'update', model_name='User', object_name=user.username,
                     details=f'تغيير كلمة المرور للمستخدم {user.username}', request=request)
        
        if request.user.id == user.id:
            update_session_auth_hash(request, user)
        
        return JsonResponse({'success': True, 'message': '✅ تم تغيير كلمة المرور بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def update_profile(request):
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        
        if user_id and request.user.role == 'admin':
            user = get_object_or_404(User, id=user_id)
        else:
            user = request.user
        
        from .utils import get_model_snapshot, log_update
        old_data = get_model_snapshot(user)
        
        # تحديث البيانات
        if 'username' in data:
            if User.objects.filter(username=data['username']).exclude(id=user.id).exists():
                return JsonResponse({'success': False, 'error': 'اسم المستخدم موجود بالفعل'})
            user.username = data['username']
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']
        if 'phone' in data:
            user.phone = data['phone']
        
        user.save()
        
        # 🔥 حفظ البيانات الجديدة بعد التعديل لقطة حقيقية
        new_data = get_model_snapshot(user)
        
        # 🔥 تسجيل التعديل في AuditLog
        log_update(request.user, user, old_data, new_data, request)
        
        # تسجيل حدث تعديل الملف الشخصي في ActivityLog
        log_activity(request.user, 'update', model_name='User', object_name=user.username,
                     details=f'تعديل بيانات المستخدم {user.username}', request=request)
        
        return JsonResponse({'success': True, 'message': '✅ تم تحديث البيانات بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.role == 'admin')
def manage_users(request):
    """عرض صفحة إدارة المستخدمين مع البحث والفلترة المتقدمة واستبعاد حسابات الطلاب بالكامل"""
    search_query = request.GET.get('search', '').strip()
    role_filter = request.GET.get('role', '').strip()
    group_filter = request.GET.get('group', '').strip()
    
    users_list = User.objects.exclude(role='student').prefetch_related('groups')
    
    # 1. فلترة بالاسم، اسم المستخدم، البريد الإلكتروني، أو رقم الهاتف
    if search_query:
        users_list = users_list.filter(
            Q(username__icontains=search_query) |
            Q(email__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(phone__icontains=search_query)
        )
    
    # 2. فلترة بالدور الوظيفي
    if role_filter:
        users_list = users_list.filter(role=role_filter)
        
    # 3. فلترة بالمجموعة / الصلاحية
    if group_filter:
        if group_filter.isdigit():
            users_list = users_list.filter(groups__id=int(group_filter))
        else:
            users_list = users_list.filter(groups__name=group_filter)
            
    users_list = users_list.distinct().order_by('-date_joined')
    
    total_users_count = User.objects.exclude(role='student').count()
    filtered_users_count = users_list.count()
    
    paginator = Paginator(users_list, 20)
    page_number = request.GET.get('page')
    users = paginator.get_page(page_number)
    
    all_groups = Group.objects.all().order_by('name')
    all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
    
    # 🔥 ترجمة الصلاحيات باستخدام الدالة translate_permission_name
    translated_permissions = []
    for perm in all_permissions:
        translated_permissions.append({
            'id': perm.id,
            'codename': perm.codename,
            'name': translate_permission_name(perm.name),
            'content_type': perm.content_type,
        })
    
    # تصفية قائمة الأدوار لاستبعاد دور الطالب
    available_roles = [r for r in User.ROLE_CHOICES if r[0] != 'student']
    
    # الاحتفاظ بباراميترات الفلترة عند التنقل بين الصفحات
    query_params = request.GET.copy()
    if 'page' in query_params:
        del query_params['page']
    query_string = query_params.urlencode()
    
    context = {
        'users': users,
        'all_groups': all_groups,
        'all_permissions': translated_permissions,
        'role_choices': available_roles,
        'search_query': search_query,
        'selected_role': role_filter,
        'selected_group': group_filter,
        'query_string': query_string,
        'total_users_count': total_users_count,
        'filtered_users_count': filtered_users_count,
        'is_filtered': bool(search_query or role_filter or group_filter),
    }
    return render(request, 'users/manage_users.html', context)


@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.is_superuser or u.role in ['admin', 'general_registrar', 'registrar', 'exam_officer', 'graduate_officer', 'academic_dept'] or u.is_staff)
def user_list(request):
    """عرض قائمة المستخدمين (للعرض والبحث فقط - Read-Only) دون أي إجراءات تعديل أو حذف"""
    search_query = request.GET.get('search', '').strip()
    role_filter = request.GET.get('role', '').strip()
    group_filter = request.GET.get('group', '').strip()
    
    users_list = User.objects.exclude(role='student').prefetch_related('groups')
    
    # 1. فلترة بالاسم، اسم المستخدم، البريد الإلكتروني، أو رقم الهاتف
    if search_query:
        users_list = users_list.filter(
            Q(username__icontains=search_query) |
            Q(email__icontains=search_query) |
            Q(first_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(phone__icontains=search_query)
        )
    
    # 2. فلترة بالدور الوظيفي
    if role_filter:
        users_list = users_list.filter(role=role_filter)
        
    # 3. فلترة بالمجموعة / الصلاحية
    if group_filter:
        if group_filter.isdigit():
            users_list = users_list.filter(groups__id=int(group_filter))
        else:
            users_list = users_list.filter(groups__name=group_filter)
            
    users_list = users_list.distinct().order_by('-date_joined')
    
    total_users_count = User.objects.exclude(role='student').count()
    filtered_users_count = users_list.count()
    
    paginator = Paginator(users_list, 20)
    page_number = request.GET.get('page')
    users = paginator.get_page(page_number)
    
    all_groups = Group.objects.all().order_by('name')
    available_roles = [r for r in User.ROLE_CHOICES if r[0] != 'student']
    
    # الاحتفاظ بباراميترات الفلترة عند التنقل بين الصفحات
    query_params = request.GET.copy()
    if 'page' in query_params:
        del query_params['page']
    query_string = query_params.urlencode()
    
    context = {
        'users': users,
        'all_groups': all_groups,
        'role_choices': available_roles,
        'search_query': search_query,
        'selected_role': role_filter,
        'selected_group': group_filter,
        'query_string': query_string,
        'total_users_count': total_users_count,
        'filtered_users_count': filtered_users_count,
        'is_filtered': bool(search_query or role_filter or group_filter),
    }
    return render(request, 'users/user_list.html', context)



@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def create_user(request):
    try:
        data = json.loads(request.body)
        
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip()
        password = data.get('password')
        role = data.get('role')
        phone = (data.get('phone') or '').strip()
        
        # 1. التحقق من الحقول الإجبارية
        if not username:
            return JsonResponse({'success': False, 'error': 'يرجى إدخال اسم المستخدم (Username).'}, status=400)
            
        if not password or len(password) < 6:
            return JsonResponse({'success': False, 'error': 'يرجى إدخال كلمة مرور صالحة (6 خانات على الأقل).'}, status=400)

        # 2. التحقق من عدم تكرار اسم المستخدم
        if User.objects.filter(username__iexact=username).exists():
            return JsonResponse({
                'success': False, 
                'error': f'اسم المستخدم "{username}" مسجل مسبقاً في النظام، يرجى اختيار اسم مستخدم آخر.'
            }, status=400)

        # 3. التحقق من عدم تكرار البريد الإلكتروني (إن وجد)
        if email and User.objects.filter(email__iexact=email).exists():
            return JsonResponse({
                'success': False, 
                'error': f'البريد الإلكتروني "{email}" مسجل مسبقاً لحساب آخر، يرجى استخدام بريد مختلف.'
            }, status=400)

        dept_id = data.get('department_id') or data.get('department')
        department = None
        if dept_id:
            from apps.renewal.models import Department
            department = Department.objects.filter(id=dept_id).first()

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            phone=phone,
            department=department
        )
        
        # 🔥 إضافة المجموعات (Groups)
        groups = data.get('groups', [])
        if groups:
            from django.contrib.auth.models import Group
            for group_name in groups:
                group, created = Group.objects.get_or_create(name=group_name)
                user.groups.add(group)
        
        # 🔥 إضافة الصلاحيات المباشرة (Permissions)
        permissions = data.get('permissions', [])
        if permissions:
            from django.contrib.auth.models import Permission
            for perm_codename in permissions:
                try:
                    perm = Permission.objects.get(codename=perm_codename)
                    user.user_permissions.add(perm)
                except Permission.DoesNotExist:
                    pass
        
        # تسجيل عملية الإضافة في AuditLog
        from .utils import log_create
        log_create(request.user, user, request)
        
        # تسجيل في ActivityLog
        log_activity(request.user, 'create', model_name='User', object_name=user.username,
                     details=f'إنشاء مستخدم جديد: {user.username} مع مجموعات وصلاحيات', request=request)
        
        return JsonResponse({
            'success': True, 
            'message': '✅ تم إنشاء المستخدم مع المجموعات والصلاحيات بنجاح',
            'user_id': user.id
        })
        
    except IntegrityError as ie:
        err_msg = str(ie).lower()
        if 'username' in err_msg or 'unique' in err_msg:
            return JsonResponse({'success': False, 'error': 'اسم المستخدم موجود مسبقاً، يرجى اختيار اسم مستخدم آخر.'}, status=400)
        elif 'email' in err_msg:
            return JsonResponse({'success': False, 'error': 'البريد الإلكتروني مسجل مسبقاً لحساب آخر، يرجى استخدام بريد مختلف.'}, status=400)
        return JsonResponse({'success': False, 'error': 'حدث تعارض في البيانات بقاعدة البيانات، يرجى التأكد من عدم تكرار البيانات.'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def delete_user(request, user_id):
    try:
        user = get_object_or_404(User, id=user_id)
        if user.id == request.user.id:
            return JsonResponse({'success': False, 'error': 'لا يمكن حذف حسابك الحالي'}, status=400)
        
        username = user.username
        
        # 🔥 تسجيل الحذف في AuditLog
        from .utils import log_delete
        log_delete(request.user, user, request)
        
        # تسجيل حدث حذف المستخدم في ActivityLog
        log_activity(request.user, 'delete', model_name='User', object_name=username,
                     details=f'حذف المستخدم {username}', request=request)
        
        user.delete()
        return JsonResponse({'success': True, 'message': 'تم حذف المستخدم بنجاح'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.is_superuser or u.role == 'admin')
def api_get_user_details(request, user_id):
    """API: جلب تفاصيل مستخدم فردي كاملة (للمودال التفاعلي وصفحة التعديل)"""
    try:
        target_user = get_object_or_404(User, id=user_id)
        from apps.renewal.models import Department
        departments = list(Department.objects.filter(is_active=True).values('id', 'name'))
        all_groups = list(Group.objects.all().values('id', 'name'))
        user_groups = list(target_user.groups.values_list('id', flat=True))
        roles = [{'code': r[0], 'name': r[1]} for r in User.ROLE_CHOICES if r[0] != 'student']
        
        return JsonResponse({
            'success': True,
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'first_name': target_user.first_name or '',
                'last_name': target_user.last_name or '',
                'email': target_user.email or '',
                'phone': target_user.phone or '',
                'role': target_user.role,
                'role_display': target_user.get_role_display(),
                'department_id': target_user.department_id if target_user.department else '',
                'department_name': target_user.department.name if target_user.department else '',
                'is_active': target_user.is_active,
                'groups': user_groups,
            },
            'all_roles': roles,
            'all_departments': departments,
            'all_groups': all_groups
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.is_superuser or u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def api_update_user(request, user_id):
    """API: تعديل وتحديث بيانات مستخدم فردي ودوره وقسمه ومجموعاته دون إعادة تحميل الصفحة"""
    try:
        target_user = get_object_or_404(User, id=user_id)
        if request.content_type == 'application/json':
            data = json.loads(request.body)
        else:
            data = request.POST.dict()
            if 'groups' in request.POST:
                data['groups'] = request.POST.getlist('groups')

        from .utils import get_model_snapshot, log_update
        old_data = get_model_snapshot(target_user)

        username = (data.get('username') or '').strip()
        first_name = (data.get('first_name') or '').strip()
        last_name = (data.get('last_name') or '').strip()
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip()
        role = data.get('role')
        department_id = data.get('department_id') or data.get('department')
        is_active = data.get('is_active')
        group_ids = data.get('groups', [])

        # التحقق من اسم المستخدم
        if not username:
            return JsonResponse({'success': False, 'error': 'اسم المستخدم مطلوب'}, status=400)
        if User.objects.filter(username__iexact=username).exclude(id=target_user.id).exists():
            return JsonResponse({'success': False, 'error': f'اسم المستخدم "{username}" مستخدم مسبقاً بحساب آخر.'}, status=400)

        # التحقق من البريد
        if email and User.objects.filter(email__iexact=email).exclude(id=target_user.id).exists():
            return JsonResponse({'success': False, 'error': f'البريد الإلكتروني "{email}" مسجل مسبقاً لحساب آخر.'}, status=400)

        target_user.username = username
        target_user.first_name = first_name
        target_user.last_name = last_name
        target_user.email = email
        target_user.phone = phone

        if role and role in [r[0] for r in User.ROLE_CHOICES]:
            target_user.role = role

        if department_id and str(department_id).isdigit():
            from apps.renewal.models import Department
            target_user.department = Department.objects.filter(id=int(department_id)).first()
        else:
            target_user.department = None

        if is_active is not None:
            if isinstance(is_active, str):
                target_user.is_active = (is_active.lower() in ['true', '1', 'on'])
            else:
                target_user.is_active = bool(is_active)

        target_user.save()

        # تحديث مجموعات المستخدم
        if group_ids is not None:
            if isinstance(group_ids, list):
                groups = Group.objects.filter(id__in=[int(g) for g in group_ids if str(g).isdigit()])
                target_user.groups.set(groups)

        new_data = get_model_snapshot(target_user)
        log_update(request.user, target_user, old_data, new_data, request)
        log_activity(request.user, 'update', model_name='User', object_name=target_user.username,
                     details=f'تعديل بيانات المستخدم {target_user.username} ودوره ومجموعاته', request=request)

        return JsonResponse({
            'success': True,
            'message': f'✅ تم تحديث بيانات المستخدم ({target_user.username}) بنجاح.',
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'full_name': target_user.get_full_name() or target_user.username,
                'email': target_user.email or '',
                'phone': target_user.phone or '',
                'role': target_user.role,
                'role_display': target_user.get_role_display(),
                'department_name': target_user.department.name if target_user.department else '',
                'is_active': target_user.is_active,
                'groups': list(target_user.groups.values('id', 'name'))
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.is_superuser or u.role == 'admin')
def edit_user_page(request, user_id):
    """صفحة مستقلة لتعديل بيانات مستخدم فردي ودوره الوظيفي ومجموعاته وحالته (بدون كلمة المرور)"""
    target_user = get_object_or_404(User, id=user_id)
    from apps.renewal.models import Department
    departments = Department.objects.filter(is_active=True).order_by('name')
    all_groups = Group.objects.all().order_by('name')
    roles = [r for r in User.ROLE_CHOICES if r[0] != 'student']
    
    all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
    grouped_permissions = {}
    for perm in all_permissions:
        model_name = perm.content_type.model.lower() if perm.content_type else 'عام'
        model_ar = MODEL_TRANSLATIONS.get(model_name, model_name)
        if model_ar not in grouped_permissions:
            grouped_permissions[model_ar] = []
        grouped_permissions[model_ar].append({
            'id': perm.id,
            'codename': perm.codename,
            'name': translate_permission_name(perm.name, perm.codename),
        })

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        email = request.POST.get('email', '').strip()
        phone = request.POST.get('phone', '').strip()
        role = request.POST.get('role')
        department_id = request.POST.get('department')
        is_active = request.POST.get('is_active') == 'on'
        selected_group_ids = request.POST.getlist('groups')
        selected_permission_ids = request.POST.getlist('user_permissions')

        if not username:
            messages.error(request, 'اسم المستخدم مطلوب.')
        elif User.objects.filter(username__iexact=username).exclude(id=target_user.id).exists():
            messages.error(request, f'اسم المستخدم "{username}" مستخدم مسبقاً.')
        elif email and User.objects.filter(email__iexact=email).exclude(id=target_user.id).exists():
            messages.error(request, f'البريد الإلكتروني "{email}" مستخدم مسبقاً.')
        else:
            from .utils import get_model_snapshot, log_update
            old_data = get_model_snapshot(target_user)
            target_user.username = username
            target_user.first_name = first_name
            target_user.last_name = last_name
            target_user.email = email
            target_user.phone = phone
            if role in [r[0] for r in User.ROLE_CHOICES]:
                target_user.role = role
            if department_id and str(department_id).isdigit():
                target_user.department = Department.objects.filter(id=int(department_id)).first()
            else:
                target_user.department = None
            target_user.is_active = is_active
            target_user.save()
            
            groups = Group.objects.filter(id__in=[int(g) for g in selected_group_ids if str(g).isdigit()])
            target_user.groups.set(groups)
            
            # حفظ الصلاحيات المباشرة المحددة للمستخدم
            perms = Permission.objects.filter(id__in=[int(p) for p in selected_permission_ids if str(p).isdigit()])
            target_user.user_permissions.set(perms)
            
            new_data = get_model_snapshot(target_user)
            log_update(request.user, target_user, old_data, new_data, request)
            log_activity(request.user, 'update', model_name='User', object_name=target_user.username,
                         details=f'تعديل بيانات المستخدم {target_user.username}', request=request)
            messages.success(request, f'✅ تم تحديث بيانات وصلاحيات المستخدم ({target_user.username}) بنجاح.')
            return redirect('users:manage_users')

    context = {
        'target_user': target_user,
        'departments': departments,
        'all_groups': all_groups,
        'roles': roles,
        'user_group_ids': list(target_user.groups.values_list('id', flat=True)),
        'user_permission_ids': list(target_user.user_permissions.values_list('id', flat=True)),
        'grouped_permissions': grouped_permissions,
    }
    return render(request, 'users/edit_user.html', context)


@login_required
@user_passes_test(lambda u: u.is_superuser or u.role == 'admin')
def create_group_page(request):
    """صفحة مستقلة وكاملة لإنشاء مجموعة صلاحيات جديدة (RBAC) دون نوافذ منبثقة"""
    all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
    
    grouped_permissions = {}
    for perm in all_permissions:
        model_name = perm.content_type.model.lower() if perm.content_type else 'عام'
        model_ar = MODEL_TRANSLATIONS.get(model_name, model_name)
        if model_ar not in grouped_permissions:
            grouped_permissions[model_ar] = []
        grouped_permissions[model_ar].append({
            'id': perm.id,
            'codename': perm.codename,
            'name': translate_permission_name(perm.name, perm.codename),
        })
        
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        selected_permission_ids = request.POST.getlist('permissions')
        
        if not name:
            messages.error(request, 'يرجى إدخال اسم المجموعة.')
        elif Group.objects.filter(name__iexact=name).exists():
            messages.error(request, f'المجموعة "{name}" موجودة مسبقاً في النظام.')
        else:
            group = Group.objects.create(name=name)
            if selected_permission_ids:
                perms = Permission.objects.filter(id__in=[int(p) for p in selected_permission_ids if str(p).isdigit()])
                group.permissions.set(perms)
                
            log_activity(
                request.user,
                'create',
                model_name='Group',
                object_name=group.name,
                details=f'إنشاء مجموعة صلاحيات جديدة: {group.name}',
                request=request
            )
            messages.success(request, f'✅ تم إنشاء مجموعة الصلاحيات "{group.name}" بنجاح.')
            return redirect('users:group_permissions')

    context = {
        'grouped_permissions': grouped_permissions,
        'total_permissions_count': all_permissions.count(),
    }
    return render(request, 'users/create_group.html', context)


@login_required
@user_passes_test(lambda u: u.is_superuser or u.role == 'admin')
def group_permissions_view(request):
    """صفحة مستقلة مخصصة لإدارة صلاحيات المجموعات والأدوار العامة وفصلها عن المستخدم الفردي"""
    all_groups = Group.objects.all().prefetch_related('permissions').order_by('name')
    all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
    
    grouped_permissions = {}
    for perm in all_permissions:
        model_name = perm.content_type.model.lower() if perm.content_type else 'عام'
        model_ar = MODEL_TRANSLATIONS.get(model_name, model_name)
        if model_ar not in grouped_permissions:
            grouped_permissions[model_ar] = []
        grouped_permissions[model_ar].append({
            'id': perm.id,
            'codename': perm.codename,
            'name': translate_permission_name(perm.name, perm.codename),
        })
        
    context = {
        'all_groups': all_groups,
        'grouped_permissions': grouped_permissions,
        'total_groups_count': all_groups.count(),
        'total_permissions_count': all_permissions.count(),
    }
    return render(request, 'users/group_permissions.html', context)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
def get_user_permissions(request, user_id):
    try:
        user = get_object_or_404(User, id=user_id)
        user_permissions = list(user.user_permissions.values_list('codename', flat=True))
        from django.contrib.auth.models import Permission
        all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
        
        # 🔥 ترجمة أسماء الصلاحيات باستخدام الدالة
        translated_permissions = []
        for perm in all_permissions:
            model_name = perm.content_type.model.lower() if perm.content_type else ''
            model_ar = MODEL_TRANSLATIONS.get(model_name, model_name)
            translated_permissions.append({
                'id': perm.id,
                'codename': perm.codename,
                'name': translate_permission_name(perm.name, perm.codename),
                'model_name': model_name,
                'model_ar': model_ar,
            })
        
        groups = list(user.groups.values_list('name', flat=True))
        all_groups = list(user.groups.values('id', 'name'))
        
        return JsonResponse({
            'success': True,
            'user_permissions': user_permissions,
            'all_permissions': translated_permissions,
            'groups': groups,
            'all_groups': all_groups
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def create_group_api(request):
    """
    إنشاء مجموعة جديدة (Django Group) وتعيين الصلاحيات المختارة لها عبر AJAX.
    """
    try:
        data = json.loads(request.body)
        group_name = data.get('name', '').strip()
        permission_ids = data.get('permissions', [])

        if not group_name:
            return JsonResponse({'success': False, 'error': 'اسم المجموعة مطلوب'}, status=400)

        group, created = Group.objects.get_or_create(name=group_name)

        if permission_ids and isinstance(permission_ids, list):
            perms = Permission.objects.filter(id__in=permission_ids)
            group.permissions.set(perms)

        # تسجيل الحدث في ActivityLog
        log_activity(
            request.user,
            'create',
            model_name='Group',
            object_name=group.name,
            details=f'إنشاء مجموعة جديدة: {group.name}',
            request=request
        )

        return JsonResponse({
            'success': True,
            'message': f'تمت إضافة المجموعة "{group.name}" بنجاح',
            'group': {
                'id': group.id,
                'name': group.name
            }
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
def get_group_details_api(request, group_id):
    """
    جلب تفاصيل مجموعة محددة وصلاحياتها.
    """
    try:
        group = get_object_or_404(Group, id=group_id)
        permission_ids = list(group.permissions.values_list('id', flat=True))
        return JsonResponse({
            'success': True,
            'group': {
                'id': group.id,
                'name': group.name,
                'permissions': permission_ids
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def update_group_api(request, group_id):
    """
    تعديل اسم المجموعة وصلاحياتها مباشرة (Inline).
    """
    try:
        group = get_object_or_404(Group, id=group_id)
        data = json.loads(request.body)
        new_name = data.get('name', '').strip()
        permission_ids = data.get('permissions', [])

        if not new_name:
            return JsonResponse({'success': False, 'error': 'اسم المجموعة مطلوب'}, status=400)

        # التحقق من تكرار الاسم مع مجموعة أخرى
        if Group.objects.filter(name=new_name).exclude(id=group.id).exists():
            return JsonResponse({'success': False, 'error': 'يوجد مجموعة أخرى بنفس هذا الاسم بالفعل'}, status=400)

        old_name = group.name
        group.name = new_name
        group.save()

        if isinstance(permission_ids, list):
            perms = Permission.objects.filter(id__in=permission_ids)
            group.permissions.set(perms)

        log_activity(
            request.user,
            'update',
            model_name='Group',
            object_name=group.name,
            details=f'تعديل المجموعة من "{old_name}" إلى "{group.name}" وتحديث صلاحياتها',
            request=request
        )

        return JsonResponse({
            'success': True,
            'message': f'تم تحديث المجموعة "{group.name}" بنجاح',
            'group': {
                'id': group.id,
                'name': group.name,
                'old_name': old_name
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def update_user_permissions(request, user_id):
    try:
        data = json.loads(request.body)
        user = get_object_or_404(User, id=user_id)
        
        if 'permissions' in data:
            from django.contrib.auth.models import Permission
            permissions = Permission.objects.filter(codename__in=data['permissions'])
            user.user_permissions.set(permissions)
        
        if 'groups' in data:
            groups = Group.objects.filter(name__in=data['groups'])
            user.groups.set(groups)
        
        if 'role' in data and data['role'] in [r[0] for r in User.ROLE_CHOICES]:
            user.role = data['role']
        
        if 'department_id' in data:
            dept_id = data['department_id']
            if dept_id:
                from apps.renewal.models import Department
                user.department = Department.objects.filter(id=dept_id).first()
            else:
                user.department = None
        user.save()
        
        # تسجيل حدث تعديل الصلاحيات
        log_activity(request.user, 'update', model_name='User', object_name=user.username,
                     details=f'تعديل صلاحيات المستخدم {user.username}', request=request)
        
        return JsonResponse({'success': True, 'message': 'تم تحديث الصلاحيات بنجاح'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
def get_user_groups(request, user_id):
    try:
        user = get_object_or_404(User, id=user_id)
        groups = list(user.groups.values_list('id', flat=True))
        all_groups = list(Group.objects.all().values('id', 'name'))
        return JsonResponse({'success': True, 'groups': groups, 'all_groups': all_groups})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def update_user_groups(request, user_id):
    try:
        data = json.loads(request.body)
        user = get_object_or_404(User, id=user_id)
        groups = Group.objects.filter(id__in=data.get('groups', []))
        user.groups.set(groups)
        
        # تسجيل حدث تعديل المجموعات
        log_activity(request.user, 'update', model_name='User', object_name=user.username,
                     details=f'تعديل مجموعات المستخدم {user.username}', request=request)
        
        return JsonResponse({'success': True, 'message': 'تم تحديث المجموعات بنجاح'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def update_user_role(request, user_id):
    try:
        data = json.loads(request.body)
        user = get_object_or_404(User, id=user_id)
        new_role = data.get('role')
        valid_roles = [r[0] for r in User.ROLE_CHOICES] + ['teacher']
        if new_role in valid_roles:
            old_role = user.role
            user.role = new_role
            user.save()
            
            # تسجيل حدث تغيير الدور
            log_activity(request.user, 'update', model_name='User', object_name=user.username,
                         details=f'تغيير دور المستخدم {user.username} من {old_role} إلى {new_role}', request=request)
            
            return JsonResponse({'success': True, 'message': 'تم تحديث الدور بنجاح'})
        return JsonResponse({'success': False, 'error': 'دور غير صحيح'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
def api_toggle_user_status(request, user_id):
    """تفعيل أو تعطيل حالة حساب المستخدم وحفظها فوراً"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'}, status=405)
    
    try:
        if request.user.id == user_id:
            return JsonResponse({'success': False, 'error': 'لا يمكنك تعطيل حسابك الشخصي النشط حالياً.'}, status=400)
            
        target_user = get_object_or_404(User, id=user_id)
        target_user.is_active = not target_user.is_active
        target_user.save(update_fields=['is_active'])
        
        # توثيق في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            action_str = "تفعيل" if target_user.is_active else "تعطيل"
            log_activity(
                user=request.user,
                action='update',
                model_name='User',
                object_name=f"{action_str} حساب {target_user.username}",
                details=f"قام المسؤول بتغيير حالة حساب المستخدم ({target_user.username}) إلى ({action_str})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'is_active': target_user.is_active,
            'message': 'تم تحديث حالة الحساب بنجاح'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ============================================
# إعادة ضبط كلمة المرور (بدون الحاجة للقديمة)
# ============================================

@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def reset_user_password(request):
    """إعادة ضبط كلمة مرور المستخدم (بدون الحاجة للقديمة)"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        new_password = data.get('new_password')
        
        if not user_id:
            return JsonResponse({'success': False, 'error': 'رقم المستخدم مطلوب'})
        
        if not new_password or len(new_password) < 6:
            return JsonResponse({'success': False, 'error': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'})
        
        user = get_object_or_404(User, id=user_id)
        
        if user.is_superuser and request.user.id != user.id:
            return JsonResponse({'success': False, 'error': 'لا يمكن تغيير كلمة مرور مستخدم فائق آخر'})
        
        user.set_password(new_password)
        user.save()
        
        # تسجيل الحدث
        from .utils import log_activity
        log_activity(request.user, 'update', model_name='User', object_name=user.username,
                     details=f'إعادة ضبط كلمة المرور للمستخدم {user.username}', request=request)
        
        return JsonResponse({'success': True, 'message': '✅ تم تغيير كلمة المرور بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

# ============================================
# سجل الأحداث والتدقيق الموحد (Single Unified Table View)
# ============================================

# ============================================
# سجل الأحداث والتدقيق الموحد (Single Unified Table View)
# ============================================

@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.is_superuser or u.role in ['admin', 'general_registrar'])
def activity_log(request):
    """
    واجهة موحدة شاملة تعتمد جدولاً رئيسياً واحداً لسجلات النظام والتدقيق بدون تبويبات
    مع استبعاد سجلات مدراء النظام تلقائياً عندما يكون المستخدم مسجلاً عاماً
    """
    from datetime import timedelta
    from django.db.models import Q

    # 1. استخراج فلاتر البحث الموحدة
    act_action = request.GET.get('act_action', '') or request.GET.get('action', '')
    model_name = request.GET.get('model_name', '')
    act_user = request.GET.get('act_user', '') or request.GET.get('user', '')
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')

    # 2. بناء استعلام سجلات الأحداث المترتبة زمنياً من الأحدث للأقدم (مع استبعاد حركات التصفح والعرض view_*)
    activity_qs = ActivityLog.objects.select_related('user').exclude(action__startswith='view_').order_by('-created_at')

    # 🔥 إذا كان المستخدم الحالي 'مسجل عام' (general_registrar) أو موظف عادي (وليس مدير النظام admin / superuser):
    # 1. استبعاد السجلات مجهولة الفاعل (user is NULL / "غير معروف")
    # 2. استبعاد جميع السجلات والعمليات التي تمت بواسطة مدير النظام (admin أو superuser)
    if not request.user.is_superuser and getattr(request.user, 'role', '') != 'admin':
        activity_qs = activity_qs.filter(user__isnull=False)\
                                 .exclude(user__role='admin')\
                                 .exclude(user__is_superuser=True)

    if act_action:
        if act_action == 'course_reg':
            activity_qs = activity_qs.filter(Q(action__in=['course_reg', 'download']) | Q(details__icontains='تنزيل') | Q(details__icontains='مادة'))
        elif act_action == 'withdraw':
            activity_qs = activity_qs.filter(Q(action='withdraw') | Q(details__icontains='سحب'))
        elif act_action == 'clearance':
            activity_qs = activity_qs.filter(Q(action='clearance') | Q(details__icontains='إخلاء'))
        elif act_action == 'grades':
            activity_qs = activity_qs.filter(Q(action__in=['grades', 'grade']) | Q(details__icontains='درجة') | Q(details__icontains='رصد'))
        elif act_action == 'block_result':
            activity_qs = activity_qs.filter(Q(action='block_result') | Q(details__icontains='حجب'))
        elif act_action == 'unblock_result':
            activity_qs = activity_qs.filter(Q(action='unblock_result') | Q(details__icontains='فك حجب'))
        elif act_action == 'approve':
            activity_qs = activity_qs.filter(Q(action='approve') | Q(details__icontains='اعتماد'))
        elif act_action == 'renew':
            activity_qs = activity_qs.filter(Q(action='renew') | Q(details__icontains='تجديد'))
        else:
            activity_qs = activity_qs.filter(action=act_action)

    if model_name:
        activity_qs = activity_qs.filter(model_name__icontains=model_name)
    if act_user:
        activity_qs = activity_qs.filter(user__username__icontains=act_user)
    if date_from:
        activity_qs = activity_qs.filter(created_at__date__gte=date_from)
    if date_to:
        activity_qs = activity_qs.filter(created_at__date__lte=date_to)

    # 3. الترقيم الموحد للجدول الرئيسي
    paginator = Paginator(activity_qs, 35)
    page_number = request.GET.get('page') or request.GET.get('act_page')
    logs_page = paginator.get_page(page_number)

    # 4. ربط السجلات في الصفحة الحالية بسجلات AuditLog واستخراج بيانات الطالب ورقم القيد بدقة
    import re
    from apps.student.models import Student
    from apps.renewal.models import EnrollmentRenewal, CourseRegistration
    from apps.grades.models import Grade

    page_logs = list(logs_page.object_list)
    if page_logs:
        min_date = min(log.created_at for log in page_logs) - timedelta(seconds=10)
        max_date = max(log.created_at for log in page_logs) + timedelta(seconds=10)
        audit_qs = AuditLog.objects.filter(created_at__range=(min_date, max_date)).select_related('user')
        if not request.user.is_superuser and getattr(request.user, 'role', '') != 'admin':
            audit_qs = audit_qs.filter(user__isnull=False)\
                               .exclude(user__role='admin')\
                               .exclude(user__is_superuser=True)
        audit_list = list(audit_qs)
        
        # تجميع المعرفات للنماذج الطلابية للبحث الجماعي الفعال (Batch Fetching)
        student_ids = set()
        renewal_ids = set()
        reg_ids = set()
        grade_ids = set()

        for log in page_logs:
            log.audit_match = None
            if log.action in ['update', 'delete', 'create', 'withdraw', 'renew', 'grade', 'grades', 'block_result', 'unblock_result']:
                match = next(
                    (a for a in audit_list 
                     if a.user_id == log.user_id 
                     and (not log.model_name or a.model_name.lower() in log.model_name.lower() or log.model_name.lower() in a.model_name.lower())
                     and abs((a.created_at - log.created_at).total_seconds()) < 15),
                    None
                )
                if match:
                    log.audit_match = match
                    obj_id = match.object_id
                    m_lower = (match.model_name or log.model_name or '').lower()
                    if obj_id and str(obj_id).isdigit():
                        int_id = int(obj_id)
                        if 'student' in m_lower and 'withdrawal' not in m_lower:
                            student_ids.add(int_id)
                        elif 'renewal' in m_lower:
                            renewal_ids.add(int_id)
                        elif 'coursereg' in m_lower or 'registration' in m_lower:
                            reg_ids.add(int_id)
                        elif 'grade' in m_lower:
                            grade_ids.add(int_id)

        # Batch queries
        student_map = {s.id: s for s in Student.objects.filter(id__in=student_ids)} if student_ids else {}
        renewal_map = {r.id: r for r in EnrollmentRenewal.objects.filter(id__in=renewal_ids).select_related('student', 'semester')} if renewal_ids else {}
        reg_map = {r.id: r for r in CourseRegistration.objects.filter(id__in=reg_ids).select_related('student', 'course')} if reg_ids else {}
        grade_map = {g.id: g for g in Grade.objects.filter(id__in=grade_ids).select_related('student', 'course')} if grade_ids else {}

        # تطبيق استخراج بيانات الطالب لكل سجل
        for log in page_logs:
            m_lower = (log.model_name or '').lower()
            details = str(log.details or '')
            object_name = str(log.object_name or '')
            
            stu_enrollment = None
            stu_name = None
            extra_info = None

            # أ) من الكائنات المباشرة المرتبطة بالـ ID
            obj_id_int = int(log.audit_match.object_id) if (log.audit_match and log.audit_match.object_id and str(log.audit_match.object_id).isdigit()) else None
            
            if obj_id_int and obj_id_int in student_map:
                s = student_map[obj_id_int]
                stu_enrollment = s.student_id
                stu_name = s.get_full_name()
            elif obj_id_int and obj_id_int in renewal_map:
                r = renewal_map[obj_id_int]
                if r.student:
                    stu_enrollment = r.student.student_id
                    stu_name = r.student.get_full_name()
                    extra_info = f"تجديد قيد: {r.semester or ''}"
            elif obj_id_int and obj_id_int in reg_map:
                reg = reg_map[obj_id_int]
                if reg.student:
                    stu_enrollment = reg.student.student_id
                    stu_name = reg.student.get_full_name()
                    extra_info = f"تنزيل مادة: {reg.course.name if reg.course else ''}"
            elif obj_id_int and obj_id_int in grade_map:
                grd = grade_map[obj_id_int]
                if grd.student:
                    stu_enrollment = grd.student.student_id
                    stu_name = grd.student.get_full_name()
                    extra_info = f"درجة مادة: {grd.course.name if grd.course else ''}"

            # ب) من object_name إذا كان يحتوي على رقم القيد والاسم
            if not stu_enrollment or not stu_name:
                m1 = re.search(r'(\d{4,})\s*-\s*([^\(\)]+)', object_name)
                if m1:
                    stu_enrollment = m1.group(1).strip()
                    stu_name = m1.group(2).strip()
                else:
                    m2 = re.search(r'([^\(\)]+)\s*\((?:رقم\s*القيد|قيد)?\s*:?\s*(\d{4,})\)', object_name)
                    if m2:
                        stu_name = m2.group(1).strip()
                        stu_enrollment = m2.group(2).strip()

            # ج) من details إذا لم يُعثر عليه بعد
            if not stu_enrollment:
                m3 = re.search(r'(?:رقم\s*القيد|قيد)\s*:?\s*([A-Za-z0-9_-]+)', details)
                if m3:
                    stu_enrollment = m3.group(1).strip()
                    
                m4 = re.search(r'(?:طالب|طالبة|الطالب|الطالبة)\s*:?\s*([^\(\),،\.]+)', details)
                if m4 and not stu_name:
                    stu_name = m4.group(1).strip()

            # د) معالجة العمليات الجماعية أو تجديد القيد واستخراج قائمة الطلاب
            renewed_students = []
            
            # فحص إذا كان النص يحتوي على أرقام قيد صريحة
            ids_found = re.findall(r'\b\d{5,8}\b', details)
            if ids_found and len(ids_found) >= 1:
                found_students = Student.objects.filter(student_id__in=ids_found)
                found_map = {s.student_id: s.get_full_name() for s in found_students}
                for sid in ids_found:
                    renewed_students.append({
                        'student_id': sid,
                        'name': found_map.get(sid, f"طالب برقم قيد {sid}")
                    })
            
            if not renewed_students and (m_lower == 'enrollmentrenewal' or 'تجديد' in details or log.action == 'renew'):
                # محاولة المطابقة المباشرة مع جدول تجديد القيد في نفس اليوم وبواسطة نفس المستخدم
                date_val = log.created_at.date()
                matching_renewals = EnrollmentRenewal.objects.filter(
                    renewal_date=date_val
                ).select_related('student', 'semester')
                if log.user:
                    matching_renewals = matching_renewals.filter(renewed_by=log.user)
                
                for r in matching_renewals:
                    if r.student:
                        renewed_students.append({
                            'student_id': r.student.student_id,
                            'name': r.student.get_full_name()
                        })

            if renewed_students:
                log.renewed_students = renewed_students
                log.student_enrollment = "، ".join([s['student_id'] for s in renewed_students])
                if len(renewed_students) == 1:
                    stu_name = renewed_students[0]['name']
                    stu_enrollment = renewed_students[0]['student_id']
                    log.student_full_name = stu_name
                else:
                    log.student_full_name = f"عدد ({len(renewed_students)}) طلاب تم تجديد قيدهم"
                
                enrollment_str = "، ".join([f"{s['student_id']} ({s['name']})" for s in renewed_students])
                if 'أرقام القيد' not in details:
                    log.enriched_details = f"{details} - [أرقام قيد الطلاب المجددين: {enrollment_str}]"
                else:
                    log.enriched_details = details
            elif stu_enrollment:
                if 'رقم القيد' not in details and 'قيد' not in details:
                    log.enriched_details = f"{details} (رقم قيد الطالب: {stu_enrollment})" if details else f"إجراء خاص بالطالب رقم قيده: {stu_enrollment}"
                else:
                    log.enriched_details = details
            else:
                log.enriched_details = details

            log.student_enrollment = getattr(log, 'student_enrollment', None) or stu_enrollment
            log.student_full_name = getattr(log, 'student_full_name', None) or stu_name
            log.extra_entity_info = extra_info
            log.model_ar = MODEL_TRANSLATIONS.get(m_lower, log.model_name)

    context = {
        'logs': logs_page,
        'logs_count': activity_qs.count(),
        'act_action': act_action,
        'model_name': model_name,
        'act_user': act_user,
        'date_from': date_from,
        'date_to': date_to,
    }
    return render(request, 'users/activity_log.html', context)


@role_required('admin', 'general_registrar')
def filter_activity_log(request):
    """فلترة الجدول الموحد لسجلات الأحداث"""
    return activity_log(request)


@role_required('admin', 'general_registrar')
def audit_log(request):
    """توجيه أرشيف التدقيق إلى الجدول الموحد"""
    return activity_log(request)


@role_required('admin', 'general_registrar')
def filter_audit_log(request):
    """توجيه فلترة التدقيق إلى الجدول الموحد"""
    return activity_log(request)


@role_required('admin', 'general_registrar')
def system_logs(request):
    """مسار الواجهة الموحدة"""
    return activity_log(request)


def get_admin_dashboard_context(request):
    """تجهيز واستخراج سياق وبيانات لوحة تحكم مدير النظام"""
    from apps.users.models import User, ActivityLog, get_official
    from apps.student.models import Student
    from apps.renewal.models import Department, Course, EnrollmentRenewal
    from apps.grades.models import Grade, GradeAppeal
    from django.db.models import Q, Count
    
    total_students = Student.objects.count()
    total_staff = User.objects.filter(Q(role__in=['teacher', 'staff', 'admin']) | Q(is_staff=True) | Q(is_superuser=True)).distinct().count()
    total_departments = Department.objects.filter(is_active=True).count()
    
    # حساب الحالات والطلبات المعلقة التي تتطلب مراجعة
    pending_appeals = 0
    try:
        pending_appeals = GradeAppeal.objects.filter(status__in=['pending', 'قيد المراجعة']).count()
    except Exception:
        pass

    pending_grades = 0
    try:
        pending_grades = Grade.objects.filter(is_published=False, is_final_published=False, total_grade__gt=0).count()
    except Exception:
        pass

    pending_renewals = 0
    try:
        pending_renewals = EnrollmentRenewal.objects.filter(status__in=['pending', 'معلق', 'قيد المراجعة']).count()
    except Exception:
        pass

    total_pending_actions = pending_appeals + pending_grades + pending_renewals

    # 1. إحصائيات توزيع الطلاب على الأقسام العلمية
    dept_labels = []
    dept_counts = []
    try:
        dept_stats = Department.objects.filter(is_active=True).annotate(
            student_cnt=Count('student')
        ).order_by('-student_cnt')
        
        dept_labels = [d.name for d in dept_stats if d.student_cnt > 0]
        dept_counts = [d.student_cnt for d in dept_stats if d.student_cnt > 0]
        
        unassigned_count = Student.objects.filter(department__isnull=True).count()
        if unassigned_count > 0:
            dept_labels.append('عام / بدون قسم')
            dept_counts.append(unassigned_count)
    except Exception:
        pass

    if not dept_labels:
        dept_labels = ['عام / المرحلة التمهيدية']
        dept_counts = [total_students]

    # 2. إحصائيات النشاط وحالات الطلاب بالمنظومة
    status_labels = []
    status_counts = []
    try:
        from apps.student.models import StudentStatus
        status_stats = StudentStatus.objects.annotate(
            student_cnt=Count('student')
        ).order_by('-student_cnt')
        
        status_labels = [s.name for s in status_stats if s.student_cnt > 0]
        status_counts = [s.student_cnt for s in status_stats if s.student_cnt > 0]
    except Exception:
        pass
    
    if not status_labels:
        status_labels = ['مستمر', 'خريج', 'موقوف قيد', 'منسحب']
        status_counts = [total_students, 0, 0, 0]

    # 3. إحصائيات تفاعلية لنشاطات وإجراءات النظام (مترجمة بالكامل للعربية)
    action_translations = {
        'login': 'تسجيل دخول',
        'logout': 'تسجيل خروج',
        'create': 'إضافة / إنشاء',
        'update': 'تعديل',
        'delete': 'حذف',
        'renew': 'تجديد قيد',
        'download': 'تنزيل مواد',
        'course_reg': 'تنزيل مواد',
        'grade': 'رصد درجات',
        'grades': 'رصد درجات',
        'view': 'عرض وتصفح',
        'view_student_data': 'استعراض بيانات طالب',
        'unblock_result': 'فك حجب نتيجة',
        'block_result': 'حجب نتيجة',
        'approve': 'اعتماد أكاديمي',
        'withdraw': 'سحب ملف',
        'clearance': 'إخلاء طرف',
        'export': 'تصدير بيانات',
        'import': 'استيراد بيانات',
        'search': 'بحث واستعلام',
        'password_change': 'تغيير كلمة المرور',
        'password_reset': 'استعادة كلمة المرور',
        'print': 'طباعة إفادات',
        'appeal': 'تقديم تظلم',
        'approve_appeal': 'قبول تظلم',
        'reject_appeal': 'رفض تظلم',
    }
    
    activity_stats = list(ActivityLog.objects.values('action').annotate(cnt=Count('id')).order_by('-cnt'))
    action_labels = []
    action_counts = []
    for a in activity_stats[:6]:
        raw_act = a['action']
        ar_name = action_translations.get(raw_act, action_translations.get(raw_act.lower(), raw_act.replace('_', ' ')))
        action_labels.append(ar_name)
        action_counts.append(a['cnt'])

    analytics_chart_data = {
        'deptLabels': dept_labels,
        'deptCounts': dept_counts,
        'statusLabels': status_labels,
        'statusCounts': status_counts,
        'actionLabels': action_labels,
        'actionCounts': action_counts,
    }

    total_activity_count = ActivityLog.objects.count()
    action_table_data = []
    for a in activity_stats[:10]:
        raw_act = a['action']
        ar_name = action_translations.get(raw_act, action_translations.get(raw_act.lower(), raw_act.replace('_', ' ')))
        pct = round((a['cnt'] / total_activity_count * 100), 1) if total_activity_count > 0 else 0
        action_table_data.append({
            'action_name': ar_name,
            'raw_action': raw_act,
            'count': a['cnt'],
            'percentage': pct
        })

    # تفصيل الأقسام العلمية كجدول
    dept_table_data = []
    try:
        dept_stats_qs = Department.objects.filter(is_active=True).annotate(
            student_cnt=Count('student')
        ).order_by('-student_cnt')
        for d in dept_stats_qs:
            pct = round((d.student_cnt / total_students * 100), 1) if total_students > 0 else 0
            dept_table_data.append({
                'name': d.name,
                'code': d.code or '—',
                'count': d.student_cnt,
                'percentage': pct,
                'is_active': d.is_active,
            })
        unassigned_count = Student.objects.filter(department__isnull=True).count()
        if unassigned_count > 0:
            pct = round((unassigned_count / total_students * 100), 1) if total_students > 0 else 0
            dept_table_data.append({
                'name': 'عام / بدون قسم',
                'code': 'GEN',
                'count': unassigned_count,
                'percentage': pct,
                'is_active': True,
            })
    except Exception:
        pass

    # تفصيل توزيع حسابات المنظومة حسب الأدوار
    role_counts = {
        'admin': 0,
        'general_registrar': 0,
        'registrar': 0,
        'exam_director': 0,
        'exam_officer': 0,
        'academic_dept': 0,
        'graduate_officer': 0,
    }
    try:
        user_role_stats = User.objects.values('role').annotate(cnt=Count('id'))
        for r in user_role_stats:
            if r['role'] in role_counts:
                role_counts[r['role']] = r['cnt']
    except Exception:
        pass

    roles_table_data = [
        {'role_name': 'مديرو النظام (Super Users)', 'role_key': 'admin', 'count': role_counts['admin']},
        {'role_name': 'المسجل العام', 'role_key': 'general_registrar', 'count': role_counts['general_registrar']},
        {'role_name': 'موظفو التسجيل والقبول', 'role_key': 'registrar', 'count': role_counts['registrar']},
        {'role_name': 'إدارة الدراسة والامتحانات', 'role_key': 'exam_director', 'count': role_counts['exam_director'] + role_counts['exam_officer']},
        {'role_name': 'رؤساء ومنسقو الأقسام العلمية', 'role_key': 'academic_dept', 'count': role_counts['academic_dept']},
        {'role_name': 'قسم شؤون الخريجين', 'role_key': 'graduate_officer', 'count': role_counts['graduate_officer']},
    ]

    # جلب التوقيعات الرسمية
    registrar_name = get_official('registrar', default='د. أسامة مصباح شليبك')
    dean_name = get_official('dean', default='أ.د. عميد الكلية')

    return {
        'total_students': total_students,
        'total_staff': total_staff,
        'total_departments': total_departments,
        'total_pending_actions': total_pending_actions,
        'pending_appeals': pending_appeals,
        'pending_grades': pending_grades,
        'pending_renewals': pending_renewals,
        'total_users': User.objects.count(),
        'total_courses': Course.objects.count(),
        'total_activity_count': total_activity_count,
        'recent_activities': ActivityLog.objects.all().order_by('-created_at')[:10],
        'analytics_chart_data': analytics_chart_data,
        'dept_table_data': dept_table_data,
        'action_table_data': action_table_data,
        'roles_table_data': roles_table_data,
        'registrar_name': registrar_name,
        'dean_name': dean_name,
    }


@admin_required
def admin_dashboard(request):
    """لوحة تحكم المدير الشاملة والإحصائيات الحيوية للمنظومة"""
    context = get_admin_dashboard_context(request)
    return render(request, 'users/admin_dashboard.html', context)


@admin_required
def admin_dashboard_print(request):
    """صفحة وقالب الطباعة الاحترافي المخصص للوحة تحكم مدير النظام على ورقة A4"""
    context = get_admin_dashboard_context(request)
    context['mode'] = request.GET.get('mode', 'statistical')
    return render(request, 'users/print_dashboard.html', context)


@login_required
@user_passes_test(lambda u: u.role == 'admin')
def add_user(request):
    """صفحة إضافة مستخدم جديد"""
    from apps.renewal.models import Department
    from django.contrib.auth.models import Group, Permission
    all_groups = Group.objects.all()
    all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
    departments = Department.objects.filter(is_active=True).order_by('name')
    
    translated_permissions = []
    for perm in all_permissions:
        model_name = perm.content_type.model.lower() if perm.content_type else ''
        model_ar = MODEL_TRANSLATIONS.get(model_name, model_name)
        translated_permissions.append({
            'id': perm.id,
            'codename': perm.codename,
            'name': translate_permission_name(perm.name, perm.codename),
            'content_type': perm.content_type,
            'model_ar': model_ar,
        })
        
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '').strip()
        role = request.POST.get('role', 'teacher')
        department_id = request.POST.get('department')
        
        if username and password:
            if User.objects.filter(username=username).exists():
                messages.error(request, f'اسم المستخدم ({username}) موجود بالفعل.')
            else:
                dept_obj = Department.objects.filter(id=department_id).first() if department_id else None
                user_obj = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    department=dept_obj
                )
                
                # 🛡️ توثيق إضافة مستخدم جديد في سجل الأحداث
                try:
                    from apps.users.utils import log_activity
                    log_activity(
                        user=request.user,
                        action='create',
                        model_name='User',
                        object_name=username,
                        details=f"إضافة مستخدم جديد ({username}) باسم ({first_name} {last_name}) ودور ({role})",
                        request=request
                    )
                except Exception:
                    pass

                messages.success(request, f'✅ تم إضافة المستخدم ({username}) بنجاح.')
                return redirect('users:add_user')

    context = {
        'all_groups': all_groups,
        'all_permissions': translated_permissions,
        'role_choices': User.ROLE_CHOICES,
        'departments': departments,
    }
    return render(request, 'users/add_user.html', context)


@login_required
def change_password_page(request):
    """صفحة تغيير كلمة المرور للمستخدم"""
    return render(request, 'users/change_password.html')

# ============================================================
# إعادة تعيين كلمة المرور (Password Reset)
# ============================================================

def password_reset_view(request):
    """
    صفحة إعادة تعيين كلمة المرور
    تستخدم PasswordResetView المدمجة في Django
    """
    from django.contrib.auth.views import PasswordResetView
    from django.urls import reverse_lazy
    
    view = PasswordResetView.as_view(
        template_name='users/password_reset.html',
        email_template_name='users/password_reset_email.html',
        subject_template_name='users/password_reset_subject.txt',
        success_url=reverse_lazy('users:password_reset_done')
    )
    return view(request)


def password_reset_done_view(request):
    """صفحة تأكيد إرسال رابط إعادة التعيين"""
    from django.contrib.auth.views import PasswordResetDoneView
    
    view = PasswordResetDoneView.as_view(
        template_name='users/password_reset_done.html'
    )
    return view(request)


def password_reset_confirm_view(request, uidb64, token):
    """صفحة تأكيد إعادة تعيين كلمة المرور"""
    from django.contrib.auth.views import PasswordResetConfirmView
    from django.urls import reverse_lazy
    
    view = PasswordResetConfirmView.as_view(
        template_name='users/password_reset_confirm.html',
        success_url=reverse_lazy('users:password_reset_complete')
    )
    return view(request, uidb64=uidb64, token=token)


def password_reset_complete_view(request):
    """صفحة اكتمال إعادة تعيين كلمة المرور"""
    from django.contrib.auth.views import PasswordResetCompleteView
    
    view = PasswordResetCompleteView.as_view(
        template_name='users/password_reset_complete.html'
    )
    return view(request)


# ============================================================
# ✅ دوال التوجيه حسب الدور (جديدة)
# ============================================================

def get_redirect_url_based_on_role(user):
    """
    تحديد مسار التوجيه الذكي للرئيسية ولوحات التحكم بناءً على صلاحيات ودور المستخدم
    """
    if not user or not user.is_authenticated:
        return reverse('users:login')

    # 1. مدير النظام (Super User أو Admin) -> لوحة تحكم المدير
    if user.is_superuser or (hasattr(user, 'role') and user.role == 'admin'):
        try:
            return reverse('users:admin_dashboard')
        except Exception:
            pass

    # 2. مدير الدراسة والامتحانات (Exam Director) -> لوحة تحكم مدير الدراسة والامتحانات
    if hasattr(user, 'role') and user.role.lower() in ['exam_director', 'مدير الدراسة والامتحانات', 'مدير ادارة الدراسة والامتحانات']:
        try:
            return reverse('faculty:exam_director_dashboard')
        except Exception:
            pass

    # 2.1 منسق وموظف الدراسة والامتحانات (Coordinator / Exam Officer) -> لوحة تحكم منسق الدراسة والامتحانات
    if hasattr(user, 'role') and user.role.lower() in ['exam_officer', 'exams', 'coordinator', 'study_exams', 'study_and_exams', 'منسق', 'منسقة', 'منسقة الدراسة والامتحانات', 'موظف دراسة وامتحانات']:
        try:
            return reverse('faculty:coordinator_dashboard')
        except Exception:
            pass

    # 2.5 قسم الخريجين (Graduate Officer / Graduates) -> لوحة تحكم قسم الخريجين
    if hasattr(user, 'role') and user.role.lower() in ['graduate_officer', 'graduates', 'قسم الخريجين', 'الخريجين', 'خريجين']:
        try:
            return reverse('renewal:graduates_dashboard')
        except Exception:
            pass

    # 3. الطالب (Student) -> لوحة تحكم الطالب
    try:
        if (hasattr(user, 'role') and user.role == 'student') or (hasattr(user, 'student') and user.student):
            return reverse('student:dashboard')
    except Exception:
        pass

    # 4. عضو هيئة التدريس (Teacher / Faculty)
    try:
        if (hasattr(user, 'role') and user.role == 'teacher') or (hasattr(user, 'teacher') and user.teacher):
            try:
                return reverse('faculty:sections')
            except Exception:
                return reverse('renewal:index')
    except Exception:
        pass

    # 5. التحقق من المجموعات (Groups)
    user_groups = [g.name.lower() for g in user.groups.all()]
    if any(g in ['admin', 'administrator', 'مدير', 'مدير النظام'] for g in user_groups):
        return reverse('users:admin_dashboard')
    if any(g in ['exam_director', 'مدير الدراسة والامتحانات', 'director of study and examinations'] for g in user_groups):
        try:
            return reverse('faculty:exam_director_dashboard')
        except Exception:
            pass
    if any(g in ['graduate_officer', 'graduates', 'قسم الخريجين', 'graduation department', 'الخريجين'] for g in user_groups):
        try:
            return reverse('renewal:graduates_dashboard')
        except Exception:
            pass
    if any(g in ['exam_officer', 'exams', 'coordinator', 'study_exams', 'دراسة وامتحانات', 'منسقة الدراسة والامتحانات', 'منسق الدراسة والامتحانات', 'الامتحانات', 'منسقة', 'منسق'] for g in user_groups):
        try:
            return reverse('faculty:coordinator_dashboard')
        except Exception:
            pass
    if any(g in ['student', 'students', 'طالب', 'طلاب'] for g in user_groups):
        return reverse('student:dashboard')
    if any(g in ['teacher', 'teachers', 'professor', 'أستاذ', 'أساتذة'] for g in user_groups):
        try:
            return reverse('faculty:sections')
        except Exception:
            pass

    # 6. الأقسام العلمية والتسجيل
    if hasattr(user, 'role'):
        role = user.role.lower()
        if role == 'academic_dept':
            if getattr(user, 'department', None):
                try:
                    return reverse('renewal:department_detail', kwargs={'dept_code': user.department.code})
                except Exception:
                    pass
            try:
                return reverse('renewal:department_list')
            except Exception:
                pass
        elif role in ['graduate_officer', 'graduates']:
            try:
                return reverse('renewal:graduates_dashboard')
            except Exception:
                pass
        elif role in ['general_registrar', 'registrar', 'staff', 'employee']:
            try:
                return reverse('renewal:dashboard')
            except Exception:
                pass

    # 7. المسار الافتراضي (للموظفين والمسجل العام)
    try:
        return reverse('renewal:dashboard')
    except Exception:
        return '/users/admin-dashboard/'


def redirect_user_to_dashboard(user):
    """
    توجيه المستخدم إلى لوحة التحكم المناسبة
    """
    redirect_url = get_redirect_url_based_on_role(user)
    return redirect(redirect_url)


def dashboard_redirect(request):
    """
    إعادة توجيه المستخدم إلى لوحة التحكم المناسبة ديناميكياً
    """
    if not request.user.is_authenticated:
        return redirect('users:login')
    return redirect_user_to_dashboard(request.user)

# ============================================================
# إدارة المسؤولين المعتمدين
# ============================================================

from .models import Official
from .utils import seed_default_officials_if_empty
from datetime import datetime

@role_required('admin')
def officials_management(request):
    """
    صفحة إدارة المسؤولين المعتمدين
    تعرض قائمة المسؤولين الذين تظهر أسماؤهم في التقارير والنماذج والإفادات
    """
    seed_default_officials_if_empty()
    context = {
        'page_title': 'إدارة المسؤولين المعتمدين',
        'page_subtitle': 'المرجع الرسمي لجميع المسؤولين الذين تظهر أسماؤهم في التقارير والنماذج والإفادات والشهادات',
    }
    return render(request, 'users/officials_management.html', context)


@login_required
def api_get_officials(request):
    """API: جلب قائمة جميع المسؤولين المعتمدين من قاعدة البيانات ومنسقي الأقسام"""
    try:
        seed_default_officials_if_empty()
        officials = Official.objects.all().order_by('-is_active', 'position_name')
        data = []
        for o in officials:
            data.append({
                'id': o.id,
                'position_key': o.position_key,
                'position': o.position_name,
                'name': o.official_name,
                'title': o.title,
                'status': 'active' if o.is_active else 'inactive',
                'startDate': o.start_date.strftime('%Y-%m-%d') if o.start_date else '',
                'notes': o.notes or '',
                'updatedAt': o.updated_at.strftime('%Y-%m-%d') if o.updated_at else '',
            })

        # إضافة موظفي ومنسقي الأقسام الأكاديمية للديناميكية عند الطباعة حسب القسم
        try:
            from apps.faculty.models import DepartmentStaff
            dept_staffs = DepartmentStaff.objects.filter(is_active=True).select_related('department')
            for ds in dept_staffs:
                data.append({
                    'id': f"staff_{ds.id}",
                    'position_key': 'department_coordinator' if 'منسق' in ds.role else 'department_staff',
                    'position': f"{ds.role} ({ds.department.name})" if ds.department else ds.role,
                    'role_name': ds.role,
                    'department_name': ds.department.name if ds.department else '',
                    'department_id': ds.department_id if ds.department else None,
                    'name': ds.full_name,
                    'title': 'أ.',
                    'status': 'active',
                    'startDate': '',
                    'notes': f'منسق/موظف قسم {ds.department.name if ds.department else ""}',
                    'updatedAt': ds.updated_at.strftime('%Y-%m-%d') if ds.updated_at else '',
                })
        except Exception:
            pass

        return JsonResponse({'success': True, 'officials': data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e), 'officials': []})


@role_required('admin')
@csrf_exempt
def api_save_official(request):
    """API: إضافة أو تعديل مسؤول معتمد"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json.loads(request.body.decode('utf-8')) if request.body else {}
        official_id = data.get('id')
        position_name = data.get('position', '').strip()
        official_name = data.get('name', '').strip()
        title = data.get('title', '').strip()
        status = data.get('status', 'active')
        is_active = (status == 'active' or status is True)
        start_date_str = data.get('startDate')
        notes = data.get('notes', '').strip()
        position_key = data.get('position_key', '').strip()

        if not position_name or not official_name:
            return JsonResponse({'success': False, 'error': 'اسم المنصب واسم المسؤول مطلوبان'})

        if not position_key or position_key == 'other':
            pos_clean = position_name.strip().lower()
            if ('منسق' in pos_clean or 'منسقة' in pos_clean) and ('دراس' in pos_clean or 'امتحان' in pos_clean):
                position_key = 'exams_coordinator'
            elif ('منسق' in pos_clean or 'منسقة' in pos_clean) and 'قسم' in pos_clean:
                position_key = 'department_coordinator'
            elif ('رئيس' in pos_clean or 'قسم' in pos_clean) and ('دراس' in pos_clean or 'امتحان' in pos_clean):
                position_key = 'exams_head'
            elif 'مسجل' in pos_clean:
                position_key = 'registrar'
            elif 'تسجيل' in pos_clean or 'قبول' in pos_clean:
                position_key = 'admission'
            elif 'خريج' in pos_clean:
                position_key = 'graduates'
            elif 'وكيل' in pos_clean:
                position_key = 'vice_dean'
            elif 'إداري' in pos_clean or 'اداري' in pos_clean:
                position_key = 'admin_affairs'
            elif 'عميد' in pos_clean:
                position_key = 'dean'
            else:
                mapping = {
                    'عميد الكلية': 'dean', 'العميد': 'dean',
                    'المسجل العام': 'registrar', 'المسجل العام بالكلية': 'registrar',
                    'قسم التسجيل والقبول': 'admission', 'رئيس قسم التسجيل والقبول': 'admission',
                    'منسق الدراسة والامتحانات': 'exams_coordinator', 'منسقة دراسة والامتحانات': 'exams_coordinator',
                    'منسقة الدراسة والامتحانات': 'exams_coordinator', 'منسق دراسة والامتحانات': 'exams_coordinator',
                    'قسم الدراسة والامتحانات': 'exams_head', 'رئيس قسم الدراسة والامتحانات': 'exams_head',
                    'قسم الخريجين': 'graduates', 'مسؤول قسم الخريجين': 'graduates',
                    'وكيل الشؤون العلمية': 'vice_dean',
                    'مدير الشؤون الإدارية': 'admin_affairs',
                }
                position_key = mapping.get(position_name, 'other')

        start_date = None
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                pass

        if is_active:
            query = Official.objects.filter(
                models.Q(position_name__iexact=position_name) | models.Q(position_key=position_key),
                is_active=True
            )
            if official_id:
                query = query.exclude(id=official_id)
            query.update(is_active=False)

        if official_id:
            official = get_object_or_404(Official, id=official_id)
            official.position_name = position_name
            official.position_key = position_key
            official.official_name = official_name
            official.title = title
            official.is_active = is_active
            official.start_date = start_date
            official.notes = notes
            official.save()
            msg = f'✅ تم تحديث بيانات المسؤول "{official_name}" بنجاح'
        else:
            official = Official.objects.create(
                position_name=position_name,
                position_key=position_key,
                official_name=official_name,
                title=title,
                is_active=is_active,
                start_date=start_date,
                notes=notes
            )
            msg = f'✅ تم إضافة المسؤول "{official_name}" بنجاح'

        # 🛡️ توثيق حفظ/تعديل المسؤول في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            act_type = 'update' if official_id else 'create'
            log_activity(
                user=request.user,
                action=act_type,
                model_name='Official',
                object_name=official_name,
                details=f"{msg} للمنصب ({position_name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': msg})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@role_required('admin')
@csrf_exempt
def api_toggle_official_status(request, official_id):
    """API: تبديل حالة المسؤول (تفعيل / تعطيل)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        official = get_object_or_404(Official, id=official_id)
        official.is_active = not official.is_active

        if official.is_active:
            Official.objects.filter(
                models.Q(position_name__iexact=official.position_name) | models.Q(position_key=official.position_key),
                is_active=True
            ).exclude(id=official.id).update(is_active=False)

        official.save()
        status_text = 'تفعيل' if official.is_active else 'تعطيل'

        # 🛡️ توثيق تفعيل/تعطيل المسؤول في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='Official',
                object_name=official.official_name,
                details=f"تم {status_text} المسؤول ({official.official_name}) للمنصب ({official.position_name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': f'✅ تم {status_text} المسؤول "{official.official_name}" بنجاح'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})