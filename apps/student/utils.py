# apps/student/utils.py
from .models import StudentEditHistory
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


def record_student_edit(original_student, edited_by, request=None, changes_summary=''):
    """تسجيل نسخة من الطالب قبل التعديل"""
    ip_address = request.META.get('REMOTE_ADDR') if request else None
    
    StudentEditHistory.objects.create(
        original_student=original_student,
        student_id=original_student.student_id,
        name=original_student.name,
        father_name=original_student.father_name,
        grandfather_name=original_student.grandfather_name,
        last_name=original_student.last_name,
        national_id=original_student.national_id,
        phone=original_student.phone,
        email=original_student.email,
        birth_date=original_student.birth_date,
        birth_place=str(original_student.birth_place),
        gender=str(original_student.gender),
        blood_type=str(original_student.blood_type) if original_student.blood_type else '',
        nationality=str(original_student.nationality),
        current_address=str(original_student.current_address),
        enrollment_date=original_student.enrollment_date,
        enrollment_semester=original_student.enrollment_semester,
        department=str(original_student.department),
        group=str(original_student.group) if original_student.group else '',
        study_plan=str(original_student.study_plan),
        student_status=str(original_student.student_status),
        graduation_year=original_student.graduation_year,
        graduation_semester=original_student.graduation_semester,
        graduation_mark=original_student.graduation_mark,
        notes=original_student.notes,
        qualification=str(original_student.qualification),
        guardian=str(original_student.guardian),
        edited_by=edited_by,
        ip_address=ip_address,
        changes_summary=changes_summary
    )


# apps/student/utils.py

import qrcode
import socket
from io import BytesIO
from django.core.files.base import ContentFile
from django.conf import settings
from django.urls import reverse


def get_local_network_ip():
    """الحصول على الآيبي الحقيقي للجهاز على الشبكة المحلية ليعمل مسح الـ QR من الهواتف"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def get_student_verification_qr_url(student, request=None):
    """
    بناء رابط التحقق الإلكتروني المباشر للطالب ديناميكياً مع استبدال 127.0.0.1 بآيبي الشبكة الحقيقي ليعمل من الهواتف
    """
    student_id = getattr(student, 'student_id', None) or str(student.pk)
    
    # 1. استخراج البروتوكول والمضيف مباشرة وبشكل ديناميكي من الطلب
    if request and hasattr(request, 'get_host'):
        scheme = request.scheme if hasattr(request, 'scheme') else 'http'
        host = request.get_host()
    else:
        site_domain = getattr(settings, 'SITE_DOMAIN', None)
        if site_domain:
            parts = site_domain.rstrip('/').split('://')
            scheme = parts[0] if len(parts) > 1 else 'http'
            host = parts[-1]
        else:
            scheme = 'http'
            host = "127.0.0.1:8000"

    # 🔥 إذا كان المضيف 127.0.0.1 أو localhost، استبدله بآيبي الجهاز الفعلي على الشبكة المحلية
    # لأن 127.0.0.1 بالنسبة للهاتف تعني الهاتف نفسه فيرفض الاتصال (ERR_CONNECTION_REFUSED)
    host_parts = host.split(':')
    host_name = host_parts[0]
    port_str = f":{host_parts[1]}" if len(host_parts) > 1 else ":8000"

    if host_name in ['127.0.0.1', 'localhost', '0.0.0.0']:
        local_ip = get_local_network_ip()
        if local_ip and local_ip != '127.0.0.1':
            host = f"{local_ip}{port_str}"

    base_url = f"{scheme}://{host}"
    
    # استخدام مفتاح الـ qr_key الفريد أو التوقيع الأمني
    sig = getattr(student, 'qr_key', None)
    if not sig and hasattr(student, 'generate_unique_qr_key'):
        sig = student.generate_unique_qr_key()
        student.qr_key = sig
    if not sig and hasattr(student, 'generate_secure_token'):
        sig = student.generate_secure_token()

    qr_data = f"{base_url}/student/qr/{student.qr_key}/"
    return qr_data


def generate_qr_for_student(student, request=None):
    """
    إنشاء رمز QR لطالب معين مشفر برابط التحقق المباشر والكامل ديناميكياً.
    - اسم الملف: qr_{student_id}.png
    """
    try:
        student_id = getattr(student, 'student_id', None) or str(student.pk)
        verification_url = get_student_verification_qr_url(student, request=request)

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        # البيانات المشفرة داخل الـ QR = الرابط الكامل الديناميكي
        qr.add_data(verification_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        image_name = f"qr_{student_id}.png"
        return ContentFile(buffer.getvalue()), image_name, verification_url

    except Exception as e:
        print(f"❌ خطأ في توليد QR: {str(e)}")
        return None, None, None


def generate_qr_bulk(students, request=None):
    """إنشاء QR Codes لعدة طلاب"""
    results = []
    for student in students:
        success = student.generate_qr_code(request=request)
        results.append({
            'student': student.name,
            'student_id': student.student_id,
            'success': success
        })
    return results





# ============================================================
# ✅ دوال log_create, log_update, log_delete, log_activity
# ============================================================

def log_create(user, obj, request=None):
    """
    تسجيل عملية إنشاء في سجل التدقيق
    """
    try:
        from apps.users.models import AuditLog
        
        audit_log = AuditLog.objects.create(
            user=user,
            action='create',
            model_name=obj.__class__.__name__,
            object_id=str(obj.id) if hasattr(obj, 'id') else None,
            object_name=str(obj),
            details=f'تم إنشاء {obj.__class__.__name__}: {obj}',
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT') if request else None,
            created_at=timezone.now()
        )
        logger.info(f"✅ تم تسجيل عملية إنشاء: {obj.__class__.__name__} - {obj}")
        return audit_log
    except Exception as e:
        logger.error(f"❌ خطأ في تسجيل عملية إنشاء: {e}")
        return None


def log_update(user, obj, old_data=None, new_data=None, request=None, details=None):
    """
    تسجيل عملية تحديث في سجل التدقيق موحّدة
    """
    try:
        from apps.users.utils import log_update as user_log_update
        return user_log_update(user, obj, old_data=old_data, new_data=new_data, request=request, details=details)
    except Exception as e:
        logger.error(f"❌ خطأ في تسجيل عملية تحديث: {e}")
        return None


def log_delete(user, obj, request=None):
    """
    تسجيل عملية حذف في سجل التدقيق
    """
    try:
        from apps.users.models import AuditLog
        
        audit_log = AuditLog.objects.create(
            user=user,
            action='delete',
            model_name=obj.__class__.__name__,
            object_id=str(obj.id) if hasattr(obj, 'id') else None,
            object_name=str(obj),
            details=f'تم حذف {obj.__class__.__name__}: {obj}',
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT') if request else None,
            created_at=timezone.now()
        )
        logger.info(f"✅ تم تسجيل عملية حذف: {obj.__class__.__name__} - {obj}")
        return audit_log
    except Exception as e:
        logger.error(f"❌ خطأ في تسجيل عملية حذف: {e}")
        return None


def log_activity(user, action, model_name=None, object_name=None, details=None, request=None):
    """
    تسجيل نشاط عام في سجل الأحداث
    """
    try:
        from apps.users.models import ActivityLog
        
        activity_log = ActivityLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_name=object_name,
            details=details or f'{action} performed',
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT') if request else None,
            created_at=timezone.now()
        )
        logger.info(f"✅ تم تسجيل نشاط: {action} - {details}")
        return activity_log
    except Exception as e:
        logger.error(f"❌ خطأ في تسجيل النشاط: {e}")
        return None


# ============================================================
# دوال QR Code
# ============================================================

import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
import json


def generate_qr_bulk(students, request=None):
    """إنشاء QR Codes لعدة طلاب"""
    results = []
    for student in students:
        success = student.generate_qr_code(request=request)
        results.append({
            'student': student.name,
            'student_id': student.student_id,
            'success': success
        })
    return results


# ============================================================
# 🎯 التحقق المركزي من حالات الطلاب الأكاديمية (Global Academic Eligibility)
# ============================================================

from django.db.models import Q

STATUS_BLOCKED_KEYWORDS = ['مسحوب', 'سحب ملف', 'مخلو طرفه', 'إخلاء طرف', 'مفصول', 'طرد', 'withdrawn', 'cleared']
STATUS_GRADUATED_KEYWORDS = ['خريج', 'متخرج', 'تخرج', 'graduated']
STATUS_SUSPENDED_KEYWORDS = ['موقوف', 'إيقاف', 'موقف', 'suspended']
STATUS_ACTIVE_KEYWORDS = ['مستمر', 'منتظم', 'جديد', 'مقيد', 'نشط']

def check_student_academic_eligibility(student, action_type='academic_operation'):
    """
    التحقق المركزي من أهلية الطالب لإجراء العمليات الأكاديمية:
    :param student: كائن الطالب (Student Object)
    :param action_type: نوع العملية ('academic_operation', 'registration', 'renewal', 'major_change', 'report_only', 'view')
    :return: dict يحتوي على (is_allowed, error_message, status_category, status_name, allow_reports)
    """
    if not student:
        return {
            'is_allowed': False,
            'status_category': 'not_found',
            'status_name': 'غير موجود',
            'error_message': 'بيانات الطالب غير موجودة في المنظومة.',
            'allow_reports': False
        }

    status_name = student.student_status.name.strip() if getattr(student, 'student_status', None) else ""
    status_lower = status_name.lower()
    
    # فحص إذا كان الطالب مسحوباً أو مخلى طرفه نهائياً
    has_clearance = hasattr(student, 'graduation_clearance') and student.graduation_clearance is not None
    is_blocked = (
        any(kw in status_lower or kw in status_name for kw in STATUS_BLOCKED_KEYWORDS) or
        (getattr(student, 'studentwithdrawals', None) and student.studentwithdrawals.exists())
    )

    # 1. حالة سحب الملف أو إخلاء الطرف الإداري التام (حظر كامل للعمليات والتعديلات)
    if is_blocked:
        display_status = status_name or "مسحوب ملفه / إخلاء طرف"
        return {
            'is_allowed': False,
            'status_category': 'blocked',
            'status_name': display_status,
            'error_message': f'🛑 تنبيه: ملف الطالب ({display_status}) - لا يمكن إجراء أي عمليات أو تعديلات أكاديمية على هذا القيد نهائياً.',
            'allow_reports': False
        }

    # 1.5 فحص حالة إيقاف القيد (حظر التجديد الجماعي وتوجيهه للحالات الخاصة)
    is_suspended = (
        any(kw in status_lower or kw in status_name for kw in STATUS_SUSPENDED_KEYWORDS) or
        (hasattr(student, 'enrollmentrenewal_set') and student.enrollmentrenewal_set.filter(status='suspended').exists())
    )
    if is_suspended:
        if action_type in ['special_renewal', 'special_renew', 'view', 'report_only']:
            return {
                'is_allowed': True,
                'status_category': 'suspended',
                'status_name': status_name or "موقوف قيده",
                'error_message': None,
                'allow_reports': True
            }
        elif action_type in ['renewal', 'regular_renewal', 'registration']:
            display_status = status_name or "موقوف قيده"
            return {
                'is_allowed': False,
                'status_category': 'suspended',
                'status_name': display_status,
                'error_message': f'🛑 تنبيه: الطالب ({display_status}) - لا يمكن تجديد قيده أو تنزيل مواده عبر الشاشات العامة، ويجب إتمام ذلك حصراً عبر شاشات (الحالات الخاصة).',
                'allow_reports': True
            }

    # 1.6 فحص حالة تغيير المسار لأول مرة (حظر التجديد والتنزيل العام لأول فصل)
    is_major_change_first_time = False
    if getattr(student, 'has_changed_major', False) or (getattr(student, 'major_change_count', 0) or 0) >= 1:
        if hasattr(student, 'enrollmentrenewal_set'):
            has_prev_regular = student.enrollmentrenewal_set.filter(
                status__in=['active', 'RENEWED'],
                special_type='REGULAR'
            ).exists()
            is_major_change_first_time = not has_prev_regular
        else:
            is_major_change_first_time = True

    if is_major_change_first_time:
        if action_type in ['special_renewal', 'special_renew', 'view', 'report_only', 'major_change']:
            return {
                'is_allowed': True,
                'status_category': 'major_change',
                'status_name': status_name or "تغيير مسار (أول مرة)",
                'error_message': None,
                'allow_reports': True
            }
        elif action_type in ['renewal', 'regular_renewal', 'registration']:
            return {
                'is_allowed': False,
                'status_category': 'major_change',
                'status_name': status_name or "تغيير مسار (أول مرة)",
                'error_message': '🛑 تنبيه: الطالب قام بتغيير مساره الأكاديمي حديثاً - لا يمكن تجديد قيده أو تنزيل مواده عبر الشاشات العامة، ويجب إتمام ذلك حصراً عبر شاشات (الحالات الخاصة).',
                'allow_reports': True
            }

    # 2. فحص حالة التخرج
    is_grad = (
        getattr(student, 'is_graduated', False) or 
        has_clearance or 
        any(kw in status_lower or kw in status_name for kw in STATUS_GRADUATED_KEYWORDS) or
        getattr(student, 'graduation_year', None) is not None
    )

    if is_grad:
        display_status = status_name or 'خريج'
        if action_type in ['report_only', 'view_archive', 'view_grades', 'transcript', 'view']:
            return {
                'is_allowed': True,
                'status_category': 'graduated',
                'status_name': display_status,
                'error_message': None,
                'allow_reports': True
            }
        return {
            'is_allowed': False,
            'status_category': 'graduated',
            'status_name': display_status,
            'error_message': f'🎓 تنبيه: الطالب متخرج ({display_status}) - يُسمح فقط بسحب التقارير والشهادات وسجلات الدرجات ولا يُسمح بتعديل القيد أو تنزيل المواد أو تغيير المسار.',
            'allow_reports': True
        }

    # 3. الطالب المستمر / المنتظم
    return {
        'is_allowed': True,
        'status_category': 'active',
        'status_name': status_name or 'منتظم',
        'error_message': None,
        'allow_reports': True
    }


def get_active_students_queryset():
    """
    استعلام مركزي: إرجاع الطلاب النشطين والمستمرين فقط (استبعاد المسحوبين والمخلو طرفهم والخريجين)
    """
    from apps.student.models import Student
    
    withdrawn_or_blocked = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب', 'إخلاء طرف', 'مخلو طرفه', 'مفصول']
    graduated_statuses = ['خريج', 'متخرج', 'Graduated', 'تخرج']

    return Student.objects.exclude(
        Q(student_status__name__in=withdrawn_or_blocked) |
        Q(student_status__name__icontains='مسحوب') |
        Q(student_status__name__icontains='سحب') |
        Q(student_status__name__icontains='طرف') |
        Q(student_status__name__in=graduated_statuses) |
        Q(graduation_year__isnull=False)
    )

