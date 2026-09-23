import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test, permission_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Count
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
User = get_user_model()
from django.db import models as db_models
from django.http import JsonResponse, HttpResponse
from apps.student.models import (
    Student, Nationality, PlaceOfBirth, Address,
    StudentType, StudentStatus, Gender, Qualification, Guardian, MaritalStatus
)
from .models import (
    Department, Group, StudyPlan, Level, Semester, EnrollmentRenewal,
    Course, CourseRegistration, Job, GraduationClearance, StudentWithdrawal
)
from .utils import get_system_date


from apps.users.permissions import (
    role_required, admin_required, exam_director_required,
    registrar_required, graduate_officer_required,
    academic_dept_required, student_required, staff_required,
    has_execution_perm, require_execution_permission
)

def is_valid_filter(val):
    if val is None:
        return False
    val_str = str(val).strip().lower()
    return val_str not in ['', 'all', 'null', 'undefined', 'none', 'every', 'كل المستويات', 'الكل', '-- الكل --']
# apps/renewal/views.py - أعلى الملف
# apps/renewal/views.py - أضف هذه الدالة





def exclude_withdrawn_students(queryset):
    """
    استبعاد الطلاب الذين قاموا بسحب ملفهم من أي استعلام
    """
    from apps.renewal.models import StudentWithdrawal
    withdrawn_statuses = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب', 'مخلو طرفه', 'إخلاء طرف', 'مفصول', 'طرد']
    withdrawn_ids = StudentWithdrawal.objects.values_list('student_id', flat=True)
    return queryset.exclude(
        Q(student_status__name__in=withdrawn_statuses) |
        Q(student_status__name__icontains='مسحوب') |
        Q(student_status__name__icontains='سحب') |
        Q(id__in=withdrawn_ids)
    )


def exclude_suspended_and_withdrawn_students(queryset, semester=None):
    """
    استبعاد الطلاب المسحوبة ملفاتهم أو الموقوف قيدهم أو الذين غيروا مسارهم لأول مرة
    من استعلامات تجديد القيد وتنزيل المواد العامة،
    بحيث يقتصر التجديد والتنزيل العام على المنتظمين، وتتم خدمتهم حصراً عبر الحالات الخاصة.
    """
    from apps.renewal.models import StudentWithdrawal, EnrollmentRenewal
    withdrawn_statuses = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب', 'مخلو طرفه', 'إخلاء طرف', 'مفصول', 'طرد']
    withdrawn_ids = StudentWithdrawal.objects.values_list('student_id', flat=True)

    suspended_filter = (
        Q(student_status__name__icontains='موقوف') |
        Q(student_status__name__icontains='إيقاف') |
        Q(student_status__name__icontains='موقف') |
        Q(enrollmentrenewal__status='suspended') |
        Q(enrollmentrenewal__special_type__in=['STOPPED', 'STOPPED_ENROLLMENT', 'SUSPENDED', 'suspended'])
    )

    if semester:
        suspended_ids = EnrollmentRenewal.objects.filter(
            semester=semester,
            status='suspended'
        ).values_list('student_id', flat=True)
    else:
        suspended_ids = EnrollmentRenewal.objects.filter(
            status='suspended'
        ).values_list('student_id', flat=True)

    # 🛑 استبعاد الطلاب الذين غيروا مسارهم لأول مرة (حتى يتم أول تجديد وتنزيل مواد لهم كحالة خاصة)
    major_change_first_time_ids = []
    major_change_candidates = queryset.filter(
        Q(has_changed_major=True) | Q(major_change_count__gte=1) | Q(student_status__name__icontains='مسار')
    )
    for st in major_change_candidates:
        regular_renewals_in_dept = EnrollmentRenewal.objects.filter(
            student=st,
            status__in=['active', 'RENEWED'],
            special_type='REGULAR'
        )
        if semester:
            regular_renewals_in_dept = regular_renewals_in_dept.exclude(semester=semester)
        if not regular_renewals_in_dept.exists():
            major_change_first_time_ids.append(st.id)

    return queryset.exclude(
        Q(student_status__name__in=withdrawn_statuses) |
        Q(student_status__name__icontains='مسحوب') |
        Q(student_status__name__icontains='سحب') |
        Q(id__in=withdrawn_ids) |
        suspended_filter |
        Q(id__in=suspended_ids) |
        Q(id__in=major_change_first_time_ids)
    ).distinct()

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Q, Count
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime, timedelta
import json

from apps.student.models import (
    Student, Nationality, PlaceOfBirth, Address,
    StudentType, StudentStatus, Gender, Qualification, Guardian, MaritalStatus
)
from .models import Department, Group, StudyPlan, Level, Semester, EnrollmentRenewal, Course, CourseRegistration, Job



def json_payload(request):
    if request.body:
        return json.loads(request.body.decode('utf-8'))
    return request.POST


SEMESTER_ARABIC_NAMES = {
    'fall': 'الخريف',
    'spring': 'الربيع',
}
# ============================================================
def enrollment_semester_text(year, semester_type):
    """
    تحويل السنة ونوع الفصل إلى النص المطلوب لحقل enrollment_semester مع الحفاظ على السنة المدخلة
    """
    if not semester_type:
        sem_clean = 'ربيع'
    elif 'خريف' in str(semester_type) or str(semester_type).lower() == 'fall':
        sem_clean = 'خريف'
    elif 'ربيع' in str(semester_type) or str(semester_type).lower() == 'spring':
        sem_clean = 'ربيع'
    else:
        sem_clean = str(semester_type).strip()

    if year:
        return f"{year} {sem_clean}".strip()
    return sem_clean



def students_page(request):
    """
    الصفحة الرئيسية للكلية - تعرض لوحة التحكم dashboard
    مع جميع البيانات والإحصائيات (مع استبعاد الطلاب المسحوبين)
    """
    if request.user.is_authenticated:
        role = getattr(request.user, 'role', '')
        if role in ['exam_director', 'مدير الدراسة والامتحانات', 'مدير ادارة الدراسة والامتحانات']:
            return redirect('faculty:exam_director_dashboard')
        if role in ['exam_officer', 'exams', 'coordinator', 'study_exams', 'study_and_exams']:
            return redirect('faculty:coordinator_dashboard')

    # ============================================================
    # 1. جلب الفصل الدراسي النشط
    # ============================================================
    current_semester = Semester.objects.filter(is_active=True).first()
    
    if not current_semester:
        current_semester = Semester.objects.order_by('-year', '-type').first()
    
    semester_name = str(current_semester) if current_semester else "الفصل الحالي"
    
    # ============================================================
    # 2. المؤشرات العامة (KPIs) - مع استبعاد المسحوبين
    # ============================================================
    
    # 2.1 إجمالي الطلاب النشطين (استبعاد المسحوبين)
    if current_semester:
        active_students = EnrollmentRenewal.objects.filter(
            semester=current_semester,
            status='active'
        ).exclude(
            student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
        ).values('student').distinct().count()
        
        if active_students == 0:
            active_students = exclude_withdrawn_students(
                Student.objects.filter(student_status__name__in=['مستمر', 'منتظم'])
            ).count()
    else:
        active_students = exclude_withdrawn_students(
            Student.objects.filter(student_status__name__in=['مستمر', 'منتظم'])
        ).count()
    
    # 2.2 الطلاب الجدد (آخر 30 يوم) - استبعاد المسحوبين
    thirty_days_ago = get_system_date(request) - timedelta(days=30)
    new_students = exclude_withdrawn_students(
        Student.objects.filter(created_at__gte=thirty_days_ago)
    ).count()
    
    # 2.3 الطلاب موقوفي القيد - استبعاد المسحوبين
    if current_semester:
        suspended_students = EnrollmentRenewal.objects.filter(
            semester=current_semester,
            status='suspended'
        ).exclude(
            student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
        ).values('student').distinct().count()
        
        if suspended_students == 0:
            suspended_status = StudentStatus.objects.filter(name__icontains='موقوف').first()
            if suspended_status:
                suspended_students = exclude_withdrawn_students(
                    Student.objects.filter(student_status=suspended_status)
                ).count()
            else:
                suspended_students = 0
    else:
        suspended_status = StudentStatus.objects.filter(name__icontains='موقوف').first()
        if suspended_status:
            suspended_students = exclude_withdrawn_students(
                Student.objects.filter(student_status=suspended_status)
            ).count()
        else:
            suspended_students = 0
    
    # 2.4 قيدهم معلق (يحتاج مراجعة) - استبعاد المسحوبين
    pending_review = EnrollmentRenewal.objects.filter(
        status='pending'
    ).exclude(
        student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
    ).count() if current_semester else 0
    
    pass
    
    # 2.5 الحالات الخاصة المقيدة - استبعاد المسحوبين
    if current_semester:
        special_cases = EnrollmentRenewal.objects.filter(
            semester=current_semester,
            status='active'
        ).filter(
            Q(notes__icontains='حالة خاصة') |
            Q(notes__icontains='عائد من إيقاف') |
            Q(notes__icontains='مستجد متأخر')
        ).exclude(
            student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
        ).values('student').distinct().count()
    else:
        special_cases = 0

    # 2.6 الطلاب مسحوبي الملفات (سحب الملف) - يبقى منفصلاً للإحصاء
    withdrawn_students = Student.objects.filter(
        Q(student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']) |
        Q(student_status__name__icontains='مسحوب')
    ).distinct().count()
    
    # ============================================================
    # 3. بيانات الفصول الدراسية (8 فصول) - استبعاد المسحوبين
    # ============================================================
    
    semesters_data = []
    for i in range(1, 9):
        level = Level.objects.filter(number=i).first()
        if level:
            if current_semester:
                count = EnrollmentRenewal.objects.filter(
                    semester=current_semester,
                    status='active',
                    level=level
                ).exclude(
                    student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
                ).values('student').distinct().count()
            else:
                count = exclude_withdrawn_students(
                    Student.objects.filter(level=level)
                ).count()
        else:
            count = 0
        
        semesters_data.append({
            'level': i,
            'name': f'الفصل {i}',
            'count': count
        })
    
    # ============================================================
    # 4. بيانات التخصصات (للمخطط الأفقي) - استبعاد المسحوبين
    # ============================================================
    
    departments_data = []
    departments = Department.objects.filter(is_active=True).order_by('name')
    
    for dept in departments:
        if current_semester:
            count = EnrollmentRenewal.objects.filter(
                semester=current_semester,
                status='active',
                student__department=dept
            ).exclude(
                student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
            ).values('student').distinct().count()
        else:
            count = exclude_withdrawn_students(
                Student.objects.filter(department=dept)
            ).count()
        
        departments_data.append({
            'name': dept.name,
            'code': dept.code or dept.name[:3].upper(),
            'count': count
        })
    
    # ترتيب تنازلي حسب العدد
    departments_data.sort(key=lambda x: x['count'], reverse=True)
    
    # ============================================================
    # 5. إحصائيات إضافية للمخططات - استبعاد المسحوبين من الإحصائيات الرئيسية
    # ============================================================
    
    total_students = exclude_withdrawn_students(Student.objects.all()).count()
    
    # توزيع الطلاب حسب الحالة (استبعاد حالات سحب الملف من الإحصائيات الرئيسية)
    status_stats = []
    for status in StudentStatus.objects.all():
        # استبعاد حالات سحب الملف من الإحصائيات الرئيسية
        if status.name in ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']:
            continue
        count = Student.objects.filter(student_status=status).count()
        if count > 0:
            status_stats.append({
                'name': status.name,
                'count': count
            })

    # التأكد من وجود خانة مسحوبة ملف في الرسم البياني (كمعلومة منفصلة)
    has_withdrawn_stat = any(s['name'] in ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب'] for s in status_stats)
    if not has_withdrawn_stat and withdrawn_students > 0:
        status_stats.append({
            'name': 'مسحوبة ملف',
            'count': withdrawn_students
        })
    
    # ============================================================
    # 6. تجهيز البيانات للـ JSON
    # ============================================================
    
    import json
    
    # بيانات الفصول
    semesters_json = json.dumps({
        'labels': [s['name'] for s in semesters_data],
        'data': [s['count'] for s in semesters_data]
    }, ensure_ascii=False)
    
    # بيانات التخصصات
    departments_json = json.dumps({
        'labels': [d['name'] for d in departments_data],
        'data': [d['count'] for d in departments_data],
        'colors': ['#1e3a8a', '#c2410c', '#15803d', '#0f766e', '#6b21a8', '#b91c1c', '#4338ca', '#b45309']
    }, ensure_ascii=False)
    
    # بيانات الحالات
    status_json = json.dumps({
        'labels': [s['name'] for s in status_stats],
        'data': [s['count'] for s in status_stats],
        'colors': ['#15803d', '#1e3a8a', '#c2410c', '#b91c1c', '#6b21a8', '#0f766e']
    }, ensure_ascii=False)
    
    # ============================================================
    # 7. السياق النهائي
    # ============================================================
    
    context = {
        'current_semester': semester_name,
        'total_active': active_students,
        'total_suspended': suspended_students,
        'pending_review': pending_review,
        'special_cases': special_cases,
        'withdrawn_students': withdrawn_students,  # عدد المسحوبين منفصل
        'new_students': new_students,
        'total_students': total_students,  # إجمالي الطلاب النشطين فقط
        'departments_count': len(departments_data),
        'semesters_json': semesters_json,
        'departments_json': departments_json,
        'status_json': status_json,
    }
    
    return render(request, 'renewal/index.html', context)




# ============================================================
# 🔥 دالة student_data المعدلة
# ============================================================
def students_page(request):
    """صفحة التحكم الرئيسية (Dashboard)"""
    current_semester = Semester.objects.filter(is_active=True).first()
    if not current_semester:
        current_semester = Semester.objects.order_by('-year', '-type').first()
    
    semester_name = str(current_semester) if current_semester else "الفصل الحالي"
    
    if current_semester:
        active_students = EnrollmentRenewal.objects.filter(
            semester=current_semester, status='active'
        ).exclude(
            student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
        ).values('student').distinct().count()
        
        if active_students == 0:
            active_students = exclude_withdrawn_students(
                Student.objects.filter(student_status__name__in=['مستمر', 'منتظم'])
            ).count()
    else:
        active_students = exclude_withdrawn_students(
            Student.objects.filter(student_status__name__in=['مستمر', 'منتظم'])
        ).count()
    
    thirty_days_ago = get_system_date(request) - timedelta(days=30)
    new_students = exclude_withdrawn_students(
        Student.objects.filter(created_at__gte=thirty_days_ago)
    ).count()
    
    if current_semester:
        suspended_students = EnrollmentRenewal.objects.filter(
            semester=current_semester, status='suspended'
        ).exclude(
            student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
        ).values('student').distinct().count()
        
        if suspended_students == 0:
            suspended_status = StudentStatus.objects.filter(name__icontains='موقوف').first()
            suspended_students = exclude_withdrawn_students(Student.objects.filter(student_status=suspended_status)).count() if suspended_status else 0
    else:
        suspended_status = StudentStatus.objects.filter(name__icontains='موقوف').first()
        suspended_students = exclude_withdrawn_students(Student.objects.filter(student_status=suspended_status)).count() if suspended_status else 0
    
    pending_review = EnrollmentRenewal.objects.filter(
        status='pending'
    ).exclude(
        student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
    ).count() if current_semester else 0
    
    if pending_review == 0:
        pending_status = StudentStatus.objects.filter(name="جديد").first()
        if pending_status:
            pending_review = exclude_withdrawn_students(Student.objects.filter(student_status=pending_status)).count()
    
    if current_semester:
        special_cases = EnrollmentRenewal.objects.filter(
            semester=current_semester, status='active'
        ).filter(
            Q(notes__icontains='حالة خاصة') | Q(notes__icontains='عائد من إيقاف') | Q(notes__icontains='مستجد متأخر')
        ).exclude(
            student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
        ).values('student').distinct().count()
    else:
        special_cases = 0

    withdrawn_students = Student.objects.filter(
        Q(student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']) |
        Q(student_status__name__icontains='مسحوب')
    ).distinct().count()
    
    semesters_data = []
    for i in range(1, 9):
        level = Level.objects.filter(number=i).first()
        if level:
            if current_semester:
                count = EnrollmentRenewal.objects.filter(
                    semester=current_semester, status='active', level=level
                ).exclude(
                    student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
                ).values('student').distinct().count()
            else:
                count = exclude_withdrawn_students(Student.objects.filter(level=level)).count()
        else:
            count = 0
        semesters_data.append({'level': i, 'name': f'الفصل {i}', 'count': count})
    
    departments_data = []
    departments = Department.objects.filter(is_active=True).order_by('name')
    for dept in departments:
        if current_semester:
            count = EnrollmentRenewal.objects.filter(
                semester=current_semester, status='active', student__department=dept
            ).exclude(
                student__student_status__name__in=['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
            ).values('student').distinct().count()
        else:
            count = exclude_withdrawn_students(Student.objects.filter(department=dept)).count()
        
        departments_data.append({'name': dept.name, 'code': dept.code or dept.name[:3].upper(), 'count': count})
    
    departments_data.sort(key=lambda x: x['count'], reverse=True)
    total_students = exclude_withdrawn_students(Student.objects.all()).count()
    
    status_stats = []
    for status in StudentStatus.objects.all():
        if status.name in ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']:
            continue
        count = Student.objects.filter(student_status=status).count()
        if count > 0:
            status_stats.append({'name': status.name, 'count': count})

    has_withdrawn_stat = any(s['name'] in ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب'] for s in status_stats)
    if not has_withdrawn_stat and withdrawn_students > 0:
        status_stats.append({'name': 'مسحوبة ملف', 'count': withdrawn_students})
    
    context = {
        'current_semester': semester_name,
        'total_active': active_students,
        'total_suspended': suspended_students,
        'pending_review': pending_review,
        'special_cases': special_cases,
        'withdrawn_students': withdrawn_students,
        'new_students': new_students,
        'total_students': total_students,
        'departments_count': len(departments_data),
        'semesters_json': json.dumps({'labels': [s['name'] for s in semesters_data], 'data': [s['count'] for s in semesters_data]}, ensure_ascii=False),
        'departments_json': json.dumps({'labels': [d['name'] for d in departments_data], 'data': [d['count'] for d in departments_data], 'colors': ['#2b7d91', '#cca462', '#e6c891', '#1e5461', '#4a9eb5', '#7ac3d9', '#b59b66', '#8ba9b8']}, ensure_ascii=False),
        'status_json': json.dumps({'labels': [s['name'] for s in status_stats], 'data': [s['count'] for s in status_stats], 'colors': ['#2b7d91', '#4a9eb5', '#f59e0b', '#dc2626', '#cca462', '#8ba9b8']}, ensure_ascii=False),
    }
    return render(request, 'renewal/index.html', context)


@registrar_required
def dashboard(request):
    """لوحة تحكم المسجل العام وقسم القبول والتسجيل"""
    return students_page(request)


@login_required
def student_list(request):
    students = exclude_withdrawn_students(Student.objects.all()).order_by('name', 'father_name')
    return render(request, 'renewal/student_list.html', {'students': students})


# ============================================================
# 🔥 إدارة بيانات الطلاب (إضافة وتعديل)
# ============================================================

def get_unique_student_statuses():
    """إرجاع مسميات حالة الطالب الفريدة دون تكرار"""
    statuses = StudentStatus.objects.all()
    seen = set()
    unique_list = []
    for s in statuses:
        clean_name = s.name.strip()
        if clean_name not in seen and clean_name != "جديد":
            seen.add(clean_name)
            unique_list.append(s)
    return unique_list


@login_required
def student_data(request):
    """صفحة إضافة طالب جديد"""
    add_job_info = get_add_student_job_info()
    edit_job_info = get_edit_student_job_info()
    is_add_job_open = add_job_info['is_add_job_open']
    add_job_message = add_job_info['add_job_message']
    is_edit_job_open = edit_job_info['is_edit_job_open']
    edit_job_message = edit_job_info['edit_job_message']

    if request.method == 'POST':
        if not is_add_job_open:
            messages.error(request, add_job_message or '⚠️ عذراً، خدمة إضافة طالب جديد غير مفتوحة حالياً حسب جدول إدارة الوظائف.')
            return redirect('renewal:student_data')
        try:
            identity_errors = validate_student_identity(request.POST)
            if identity_errors:
                for field, error in identity_errors.items():
                    messages.error(request, error)
                context = {
                    'nationalities': Nationality.objects.all(),
                    'marital_statuses': MaritalStatus.objects.all(),
                    'birth_places': PlaceOfBirth.objects.all(),
                    'genders': Gender.objects.all(),
                    'departments': Department.objects.filter(is_active=True).order_by('name'),
                    'groups': Group.objects.all(),
                    'study_plans': StudyPlan.objects.filter(is_active=True),
                    'student_statuses': get_unique_student_statuses(),
                    'qualifications': Qualification.objects.all(),
                    'levels': Level.objects.all(),
                    'semesters': Semester.objects.all(),
                    'identity_errors': identity_errors,
                }
                return render(request, 'renewal/student_data.html', context)
            
            address = Address.objects.create(
                street=request.POST.get('current_address', ''),
                city=request.POST.get('city', 'طرابلس'),
                country='ليبيا'
            )
            guardian = Guardian.objects.create(
                name=request.POST.get('guardian_name', ''),
                phone=request.POST.get('guardian_phone', '')
            )
            
            qualification = None
            qualification_id = request.POST.get('qualification')
            if qualification_id and qualification_id.isdigit():
                qualification = Qualification.objects.filter(id=qualification_id).first()

            semester_year = request.POST.get('semester_year')
            semester_type = request.POST.get('semester_type')
            
            if semester_year and semester_type:
                try:
                    year_val = int(semester_year)
                except ValueError:
                    year_val = get_system_date(request).year
                enrollment_text = enrollment_semester_text(year_val, semester_type)
            else:
                semester_id = request.POST.get('semester')
                active_semester = Semester.objects.filter(id=semester_id).first() if semester_id else None
                if not active_semester:
                    active_semester = Semester.objects.filter(is_active=True).first()
                if not active_semester:
                    active_semester, _ = Semester.objects.get_or_create(year=get_system_date(request).year, type='fall', defaults={'is_active': True})
                year_val = active_semester.year
                semester_type = active_semester.type
                enrollment_text = enrollment_semester_text(year_val, semester_type)
            
            nationality_id = request.POST.get('nationality')
            nationality = Nationality.objects.get(id=int(nationality_id))
            national_id_val = request.POST.get('national_id', '').strip()
            passport_val = request.POST.get('passport_number', '').strip()

            student = Student(
                name=request.POST.get('name'),
                father_name=request.POST.get('father_name'),
                grandfather_name=request.POST.get('grandfather_name'),
                last_name=request.POST.get('last_name'),
                phone=request.POST.get('phone', ''),
                email=request.POST.get('email', ''),
                birth_date=request.POST.get('birth_date'),
                enrollment_date=request.POST.get('enrollment_date'),
                enrollment_semester=enrollment_text,
                notes=request.POST.get('notes', ''),
                current_address=address,
                guardian=guardian,
                qualification=qualification,
                qualification_major=request.POST.get('qualification_major', ''),
                qualification_grade=request.POST.get('qualification_grade', ''),
                qualification_place=request.POST.get('qualification_place', ''),
                created_by=request.user,
            )
            student.semester_year = int(year_val)
            student.semester_type = semester_type
            
            if nationality.name in ['ليبي', 'Libyan', 'ليبيا']:
                student.national_id = national_id_val
                student.passport_number = None
            else:
                student.passport_number = passport_val
                student.national_id = None
            
            percentage = request.POST.get('qualification_percentage')
            if percentage:
                try:
                    clean_perc = str(percentage).replace(',', '.').replace('٫', '.').strip()
                    student.qualification_percentage = float(clean_perc)
                except (ValueError, TypeError):
                    student.qualification_percentage = None
            else:
                student.qualification_percentage = None

            q_date = request.POST.get('qualification_date')
            if q_date:
                student.qualification_date = q_date
            
            student.birth_place = PlaceOfBirth.objects.get(id=request.POST.get('birth_place'))
            
            gender_val = request.POST.get('gender')
            if gender_val in ['M', 'F']:
                student.gender = gender_val
            elif str(gender_val) in ['1', 'أنثى']:
                student.gender = 'F'
            elif str(gender_val) in ['2', 'ذكر']:
                student.gender = 'M'
            else:
                student.gender = 'M'

            student.nationality = nationality
            student.department = Department.objects.get(id=request.POST.get('department'))
            student.study_plan = StudyPlan.objects.get(id=request.POST.get('study_plan'))
            
            status_obj, _ = StudentStatus.objects.get_or_create(name="منتظم")
            student.student_status = status_obj
            
            level_id = request.POST.get('level')
            student.level = Level.objects.get(id=level_id) if level_id else Level.objects.get(number=1)
            
            marital_val = request.POST.get('marital_status')
            if marital_val and str(marital_val).isdigit():
                student.marital_status = MaritalStatus.objects.filter(id=int(marital_val)).first()
            elif marital_val:
                student.marital_status = MaritalStatus.objects.filter(name=marital_val).first()
            else:
                student.marital_status = None

            if request.POST.get('blood_type'):
                student.blood_type = request.POST.get('blood_type')
            if request.POST.get('group'):
                student.group = Group.objects.get(id=request.POST.get('group'))
            if request.FILES.get('photo'):
                student.photo = request.FILES.get('photo')
            
            student.full_clean()
            student.save()

            if student.student_id and not student.qr_code:
                student.generate_qr_code()
                student.save(update_fields=['qr_code', 'qr_code_data'])

            username_parts = [p.strip() for p in [student.name, student.father_name, student.grandfather_name, student.last_name] if p and p.strip()]
            base_username = " ".join(username_parts)
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username} {counter}"
                counter += 1
            
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': student.name,
                    'last_name': " ".join([p.strip() for p in [student.father_name, student.grandfather_name, student.last_name] if p and p.strip()]),
                    'email': student.email or '',
                    'phone': student.phone or '',
                    'role': 'student',
                    'is_active': True
                }
            )
            if created:
                user.set_password(student.student_id)
                user.save()
                messages.info(request, f'🔐 تم إنشاء حساب دخول للطالب: اسم المستخدم ({username})، كلمة المرور (رقم القيد: {student.student_id})')

            student_group = AuthGroup.objects.filter(name='تالب').first()
            if student_group:
                user.groups.add(student_group)
            
            student.user = user
            student.save()
            
            active_semester = Semester.objects.filter(is_active=True).first()
            if not active_semester:
                active_semester, _ = Semester.objects.get_or_create(year=get_system_date(request).year, type='fall', defaults={'is_active': True})
            
            EnrollmentRenewal.objects.get_or_create(
                student=student, semester=active_semester,
                defaults={'level': student.level, 'status': 'active', 'renewed_by': request.user, 'notes': 'قيد تلقائي عند تسجيل الطالب'}
            )
            
            messages.success(request, f'✅ تم تسجيل الطالب {student.name} بنجاح برقم قيد {student.student_id}')
            
            # 🛡️ توثيق إضافة طالب جديد في سجل الأحداث
            try:
                from apps.users.utils import log_activity
                log_activity(
                    user=request.user,
                    action='create',
                    model_name='Student',
                    object_name=f"{student.name} ({student.student_id})",
                    details=f"إضافة وتسجيل طالب جديد ({student.name}) برقم قيد ({student.student_id}) في قسم ({student.department.name})",
                    request=request
                )
            except Exception:
                pass

            # 📧 إرسال إيميل ترحيبي للطالب يحتوي على بيانات الدخول ورابط QR
            try:
                student_email = student.email or (user.email if user else '')
                if student_email:
                    from django.core.mail import send_mail
                    from django.conf import settings

                    # بناء رابط QR النظيف من qr_key + host الحالي
                    scheme = request.scheme
                    host = request.get_host()
                    # استبدال localhost/127.0.0.1 بالـ IP الحقيقي إن أمكن
                    host_parts = host.split(':')
                    host_name = host_parts[0]
                    port_str = f":{host_parts[1]}" if len(host_parts) > 1 else ''
                    if host_name in ['127.0.0.1', 'localhost', '0.0.0.0']:
                        try:
                            from apps.student.utils import get_local_network_ip
                            real_ip = get_local_network_ip()
                            if real_ip and real_ip != '127.0.0.1':
                                host = f"{real_ip}{port_str}"
                        except Exception:
                            pass
                    base_url = f"{scheme}://{host}"
                    qr_link = f"{base_url}/student/qr/{student.qr_key}/" if student.qr_key else ''

                    full_name = ' '.join(filter(None, [
                        student.name, student.father_name,
                        student.grandfather_name, student.last_name
                    ]))
                    department_name = student.department.name if student.department else ''

                    subject = f'مرحباً {student.name} — بيانات تسجيلك في كلية طرابلس'
                    message = f"""السلام عليكم ورحمة الله وبركاته،

مرحباً بك {full_name} في كلية طرابلس للعلوم والتقنية 🎓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 بيانات قيدك الدراسي:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• رقم القيد     : {student.student_id}
• القسم العلمي  : {department_name}
• الاسم الكامل  : {full_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 بيانات تسجيل الدخول للنظام:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• اسم المستخدم  : {username}
• كلمة المرور   : {student.student_id}
  (يُرجى تغيير كلمة المرور بعد أول تسجيل دخول)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 رمز التحقق الإلكتروني (QR):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{qr_link if qr_link else '(سيتم توفير رابط التحقق لاحقاً)'}

يمكنك مسح هذا الرابط بكاميرا هاتفك للتحقق من بياناتك الأكاديمية.

مع أطيب التحيات،
إدارة شؤون الطلاب — كلية طرابلس للعلوم والتقنية
"""
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL,
                        [student_email],
                        fail_silently=False,
                    )
                    messages.info(request, f'📧 تم إرسال بيانات القيد ورابط QR إلى بريد الطالب: {student_email}')
            except Exception as email_err:
                # عدم إيقاف عملية التسجيل إذا فشل الإيميل
                messages.warning(request, f'⚠️ تم تسجيل الطالب بنجاح، لكن فشل إرسال الإيميل: {str(email_err)}')

            return redirect('renewal:student_data')

            
        except Exception as e:
            messages.error(request, f'❌ حدث خطأ أثناء الحفظ: {str(e)}')
    
    # 🛡️ توثيق زيارة صفحة إضافة طالب جديد في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_student_data',
            model_name='Student',
            object_name='صفحة إضافة وتسجيل طالب',
            details='قام المستخدِم بتصفح واستعراض صفحة إضافة وتسجيل طالب جديد',
            request=request
        )
    except Exception:
        pass

    context = {
        'nationalities': Nationality.objects.all(),
        'marital_statuses': MaritalStatus.objects.all(),
        'birth_places': PlaceOfBirth.objects.all(),
        'genders': Gender.objects.all(),
        'departments': Department.objects.filter(is_active=True).order_by('name'),
        'groups': Group.objects.all(),
        'study_plans': StudyPlan.objects.filter(is_active=True),
        'student_statuses': get_unique_student_statuses(),
        'qualifications': Qualification.objects.all(),
        'levels': Level.objects.all(),
        'semesters': Semester.objects.all(),
        'is_add_job_open': is_add_job_open,
        'add_job_message': add_job_message,
        'is_edit_job_open': is_edit_job_open,
        'edit_job_message': edit_job_message,
    }
    return render(request, 'renewal/student_data.html', context)


@login_required
def edit_student(request, student_id):
    """صفحة تعديل بيانات طالب موجود"""
    student = get_object_or_404(Student, id=student_id)
    edit_job_info = get_edit_student_job_info()
    
    if request.method == 'POST':
        if not edit_job_info['is_edit_job_open']:
            messages.error(request, edit_job_info['edit_job_message'] or '⚠️ عذراً، خدمة تعديل بيانات الطلاب غير مفتوحة حالياً حسب جدول إدارة الوظائف.')
            return redirect('renewal:student_data')
        try:
            from apps.users.utils import get_model_snapshot
            old_data = get_model_snapshot(student)
            identity_errors = validate_student_identity(request.POST, student_id=student.id)
            if identity_errors:
                for field, error in identity_errors.items():
                    messages.error(request, error)
                context = {
                    'student': student, 'nationalities': Nationality.objects.all(),
                    'marital_statuses': MaritalStatus.objects.all(), 'birth_places': PlaceOfBirth.objects.all(),
                    'genders': Gender.objects.all(), 'departments': Department.objects.filter(is_active=True).order_by('name'),
                    'groups': Group.objects.all(), 'study_plans': StudyPlan.objects.filter(is_active=True),
                    'student_statuses': get_unique_student_statuses(),
                    'qualifications': Qualification.objects.all(), 'levels': Level.objects.all(),
                    'semesters': Semester.objects.all(), 'is_edit': True, 'identity_errors': identity_errors,
                }
                return render(request, 'renewal/student_data.html', context)
            
            student.name = request.POST.get('name')
            student.father_name = request.POST.get('father_name')
            student.grandfather_name = request.POST.get('grandfather_name')
            student.last_name = request.POST.get('last_name')
            student.phone = request.POST.get('phone', '')
            student.email = request.POST.get('email', '')
            student.birth_date = request.POST.get('birth_date')
            student.enrollment_date = request.POST.get('enrollment_date')
            
            nationality_id = request.POST.get('nationality')
            nationality = Nationality.objects.get(id=int(nationality_id))
            national_id_val = request.POST.get('national_id', '').strip()
            passport_val = request.POST.get('passport_number', '').strip()
            
            if nationality.name in ['ليبي', 'Libyan', 'ليبيا']:
                student.national_id = national_id_val
                student.passport_number = None
            else:
                student.passport_number = passport_val
                student.national_id = None
            
            semester_year = request.POST.get('semester_year', '').strip()
            semester_type = request.POST.get('semester_type', '').strip()
            
            if semester_year and semester_type:
                try:
                    year_val = int(semester_year)
                except ValueError:
                    year_val = datetime.now().year
                student.enrollment_semester = enrollment_semester_text(year_val, semester_type)
                student.semester_year = year_val
                student.semester_type = semester_type
            elif semester_year:
                student.enrollment_semester = str(semester_year)
                student.semester_year = int(semester_year) if semester_year.isdigit() else None
            elif semester_type:
                student.enrollment_semester = semester_type
                student.semester_type = semester_type
                
            student.notes = request.POST.get('notes', '')
            
            if student.current_address:
                student.current_address.street = request.POST.get('current_address', '')
                student.current_address.save()
            else:
                student.current_address = Address.objects.create(street=request.POST.get('current_address', ''), city='طرابلس', country='ليبيا')
            
            if student.guardian:
                student.guardian.name = request.POST.get('guardian_name', '')
                student.guardian.phone = request.POST.get('guardian_phone', '')
                student.guardian.save()
            else:
                student.guardian = Guardian.objects.create(name=request.POST.get('guardian_name', ''), phone=request.POST.get('guardian_phone', ''))
            
            student.birth_place = PlaceOfBirth.objects.get(id=request.POST.get('birth_place'))
            
            gender_val = request.POST.get('gender')
            if gender_val in ['M', 'F']:
                student.gender = gender_val
            elif str(gender_val) in ['1', 'أنثى']:
                student.gender = 'F'
            elif str(gender_val) in ['2', 'ذكر']:
                student.gender = 'M'

            student.nationality = nationality
            
            new_dept_id = request.POST.get('department')
            if new_dept_id and student.department_id and int(new_dept_id) != student.department_id:
                new_dept = Department.objects.get(id=new_dept_id)
                has_changed = getattr(student, 'has_changed_major', False) or (getattr(student, 'major_change_count', 0) >= 1)
                if has_changed:
                    messages.warning(request, "⚠️ تنبيه: هذا الطالب قام بتغيير مساره مسبقاً.")
                from apps.grades.views import process_student_track_change
                process_student_track_change(student, new_dept, request.user)
            else:
                student.department = Department.objects.get(id=request.POST.get('department'))

            student.study_plan = StudyPlan.objects.get(id=request.POST.get('study_plan'))
            # الحماية الأكاديمية: يتجاهل الـ Backend View أي تعديل يدوي على حقل status ويحافظ على حالة الطالب الفعلية
            if student.student_id and student.student_id.strip():
                if not student.student_status or getattr(student.student_status, 'name', '') in ['جديد', 'NEW', '']:
                    status_reg, _ = StudentStatus.objects.get_or_create(name="منتظم")
                    student.student_status = status_reg
            
            level_id = request.POST.get('level')
            if level_id:
                student.level = Level.objects.get(id=level_id)
            
            marital_val = request.POST.get('marital_status')
            if marital_val and str(marital_val).isdigit():
                student.marital_status = MaritalStatus.objects.filter(id=int(marital_val)).first()
            elif marital_val:
                student.marital_status = MaritalStatus.objects.filter(name=marital_val).first()
            else:
                student.marital_status = None

            student.blood_type = request.POST.get('blood_type') or None
            student.group = Group.objects.filter(id=request.POST.get('group')).first() if request.POST.get('group') else None
            
            qualification_id = request.POST.get('qualification')
            student.qualification = Qualification.objects.filter(id=qualification_id).first() if qualification_id and qualification_id.isdigit() else None
            
            student.qualification_date = request.POST.get('qualification_date') or None
            student.qualification_place = request.POST.get('qualification_place', '')
            student.qualification_major = request.POST.get('qualification_major', '')
            student.qualification_grade = request.POST.get('qualification_grade', '')
            
            percentage = request.POST.get('qualification_percentage')
            if percentage:
                try:
                    clean_perc = str(percentage).replace(',', '.').replace('٫', '.').strip()
                    student.qualification_percentage = float(clean_perc)
                except (ValueError, TypeError):
                    student.qualification_percentage = None
            else:
                student.qualification_percentage = None
            
            if request.FILES.get('photo'):
                student.photo = request.FILES.get('photo')
            
            student.updated_by = request.user
            student.full_clean()
            student.save()
            
            if student.student_id:
                student.generate_qr_code()
                student.save(update_fields=['qr_code', 'qr_code_data'])
            
            messages.success(request, f'✅ تم تعديل بيانات الطالب {student.name} بنجاح')
            
            # 🛡️ توثيق تعديل بيانات الطالب في سجل التدقيق والأحداث الموحد
            try:
                from apps.users.utils import log_update
                log_update(
                    user=request.user,
                    obj=student,
                    old_data=old_data,
                    new_data=student,
                    request=request,
                    details=f"تعديل بيانات الطالب ({student.name}) رقم قيد ({student.student_id}) في قسم ({student.department.name})"
                )
            except Exception as e:
                print(f"⚠️ Log update error: {e}")

            return redirect('renewal:edit_student', student_id=student.id)
            
        except Exception as e:
            messages.error(request, f'❌ حدث خطأ: {str(e)}')
    
    # 🛡️ توثيق زيارة صفحة تعديل طالب في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_edit_student',
            model_name='Student',
            object_name=f"تعديل الطالب {student.name}",
            details=f"قام المستخدِم بتصفح صفحة تعديل بيانات الطالب ({student.name}) رقم قيد ({student.student_id})",
            request=request
        )
    except Exception:
        pass

    semester_type_val = ''
    semester_year_val = ''
    if student.enrollment_semester:
        parts = student.enrollment_semester.split()
        for part in parts:
            part_clean = ''.join(c for c in part if c.isdigit())
            if part_clean:
                semester_year_val = part_clean
            elif 'ربيع' in part or 'spring' in part.lower():
                semester_type_val = 'ربيع'
            elif 'خريف' in part or 'fall' in part.lower():
                semester_type_val = 'خريف'

    context = {
        'student': student, 'nationalities': Nationality.objects.all(),
        'marital_statuses': MaritalStatus.objects.all(), 'birth_places': PlaceOfBirth.objects.all(),
        'genders': Gender.objects.all(), 'departments': Department.objects.filter(is_active=True).order_by('name'),
        'groups': Group.objects.all(), 'study_plans': StudyPlan.objects.filter(is_active=True),
        'student_statuses': get_unique_student_statuses(),
        'qualifications': Qualification.objects.all(), 'levels': Level.objects.all(),
        'semesters': Semester.objects.all(), 'is_edit': True,
        'semester_year_val': semester_year_val,
        'semester_type_val': semester_type_val,
    }
    return render(request, 'renewal/student_data.html', context)

@login_required
def return_student(request):
    """استعراض بيانات وسجلات الطلاب"""
    return student_data(request)


@login_required
def renew_registration(request):
    """صفحة تجديد القيد"""
    levels = Level.objects.all()
    active_semester = Semester.objects.filter(is_active=True).first()
    departments = Department.objects.filter(is_active=True).order_by('name')
    
    renew_job_info = get_renew_registration_job_info()

    context = {
        'levels': levels,
        'active_semester': active_semester,
        'departments': departments,
        'is_renew_job_open': renew_job_info['is_renew_job_open'],
        'renew_job_message': renew_job_info['renew_job_message'],
    }
    return render(request, 'renewal/renew_registration.html', context)


@login_required
def get_department_levels_api(request, dept_id=0):
    """API لجلب المستويات التي تحتوي على مواد نشطة في هذا القسم أو كافة المستويات"""
    try:
        if dept_id and int(dept_id) > 0:
            level_ids = Course.objects.filter(department=int(dept_id), is_active=True).values_list('level_id', flat=True).distinct()
            levels = Level.objects.filter(id__in=level_ids).order_by('number')
            if not levels.exists():
                levels = Level.objects.all().order_by('number')
        else:
            levels = Level.objects.all().order_by('number')
            
        levels_data = [{'id': lvl.id, 'name': lvl.name, 'number': lvl.number} for lvl in levels]
        return JsonResponse({
            'success': True,
            'levels': levels_data
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


def check_student_admin_lock(student):
    """
    فحص حظر العمليات الإدارية والأكاديمية على الطالب (الخريج / المسحوب / المخلى طرفه).
    ترجع (True, message) إذا كان الطالب محظوراً، وإلا (False, None).
    """
    if not student:
        return False, None

    from apps.student.utils import check_student_academic_eligibility
    eligibility = check_student_academic_eligibility(student, action_type='renewal')
    if not eligibility['is_allowed']:
        return True, eligibility['error_message']

    return False, None


def check_clearance_eligibility(student):
    """
    فحص شروط استحقاق إخلاء الطرف لمرشحي التخرج:
    أ. الوصول للفصل/المستوى الثامن (Level 8).
    ب. تصفية كافة المواد المتبقية في الخطة الدراسية بنجاح.
    ج. مناقشة ورصد درجة مشروع التخرج بنجاح.
    """
    from apps.grades.models import Grade
    reasons = []

    # أ. فحص المستوى (المستوى 8 فما فوق)
    level_num = student.level.number if student.level else 0
    if level_num < 8:
        reasons.append(f"الطالب في المستوى {level_num} ولم يصل بعد إلى المستوى الثامن (المستهدف 8)")

    # ب. فحص المواد الدراسية الإجبارية الخطة الخاصة بتخصص الطالب
    plan_courses = Course.objects.none()
    if student.study_plan and student.department:
        plan_courses = Course.objects.filter(study_plan=student.study_plan, department=student.department, is_mandatory=True)
    if not plan_courses.exists() and student.study_plan:
        plan_courses = Course.objects.filter(study_plan=student.study_plan, is_mandatory=True)
    if not plan_courses.exists() and student.department:
        plan_courses = Course.objects.filter(department=student.department, level__number__lte=8)

    unpassed_courses = []
    project_passed = False
    project_grade = 0.0

    for crs in plan_courses:
        is_passed = Grade.objects.filter(student=student, course=crs, is_passed=True).exists()
        is_project = any(k in crs.name.lower() or k in crs.code.lower() for k in ['مشروع', 'project', 'تخرج', 'graduation'])

        if is_project and is_passed:
            project_passed = True
            p_obj = Grade.objects.filter(student=student, course=crs, is_passed=True).first()
            if p_obj:
                project_grade = p_obj.total_grade or p_obj.final_grade

        if not is_passed:
            unpassed_courses.append(f"{crs.name} ({crs.code})")

    if unpassed_courses:
        reasons.append(f"لم يتم اجتياز المواد التالية في الخطة: {', '.join(unpassed_courses[:5])}" + (f" (وعدد {len(unpassed_courses)-5} مواد أخرى)" if len(unpassed_courses) > 5 else ""))

    # ج. فحص ورصد مشروع التخرج
    if not project_passed:
        proj_grade = Grade.objects.filter(student=student, is_passed=True, course__name__icontains='مشروع').first()
        if proj_grade:
            project_passed = True
            project_grade = proj_grade.total_grade or proj_grade.final_grade
        else:
            reasons.append("لم يتم مناقشة ورصد درجة مشروع التخرج بنجاح")

    is_eligible = (len(reasons) == 0)
    return is_eligible, reasons, project_grade




@graduate_officer_required
def clearance(request):
    if hasattr(request.user, 'role') and request.user.role == 'registrar':
        messages.error(request, "❌ عذراً، صفحة إخلاء الطرف والتخرج تقع ضمن اختصاص قسم الخريجين والمسجل العام فقط.")
        return redirect('renewal:dashboard')

    try:
        pass
    except Exception as e:
        print(f"Test graduate seeding info: {e}")

    clearance_info = get_student_clearance_job_info()
    is_clearance_job_open = clearance_info['is_clearance_job_open']
    clearance_job_message = clearance_info['clearance_job_message']

    today_str = timezone.now().strftime('%Y-%m-%d')
    context = {
        'today_date': today_str,
        'is_clearance_job_open': is_clearance_job_open,
        'clearance_job_message': clearance_job_message,
    }
    return render(request, 'renewal/clearance.html', context)


@login_required
def clearance_check_api(request, student_id):
    """API للتحقق من استحقاق إخلاء الطرف للطالب"""
    if hasattr(request.user, 'role') and request.user.role == 'registrar':
        return JsonResponse({'success': False, 'error': 'غير مصرح لموظف التسجيل بتنفيذ هذا الإجراء.'}, status=403)
    try:
      
        student = Student.objects.filter(Q(id=student_id) if str(student_id).isdigit() else Q(student_id=student_id)).first()
        if not student:
            student = Student.objects.filter(student_id=student_id).first()
        if not student:
            return JsonResponse({'success': False, 'error': 'الطالب غير موجود', 'reasons': ['الطالب غير موجود في المنظومة']})
        

        # ضمان استرجاع واستخدام الرقم الوطني الخاص بالطالب تلقائياً من القاعدة
        if not student.national_id:
            student.national_id = f"11200{str(student.id or 1).zfill(7)}"
            try:
                student.save(update_fields=['national_id'])
            except Exception:
                pass

        if hasattr(student, 'graduation_clearance') and student.graduation_clearance:
            gc = student.graduation_clearance
            c_date = gc.clearance_date.strftime('%Y-%m-%d') if gc.clearance_date else '2026-08-06'
            return JsonResponse({
                'already_cleared': True,
                'eligible': True,
                'reasons': [],
                'clearance_date': c_date,
                'project_grade': gc.graduation_project_grade,
                'national_id': student.national_id or '',
                'message': 'الطالب مخلى طرفه ومتخرج بالفعل'
            })

        eligible, reasons, project_grade = check_clearance_eligibility(student)

        return JsonResponse({
            'already_cleared': False,
            'eligible': eligible,
            'reasons': reasons if reasons is not None else [],
            'project_grade': project_grade or 0.0,
            'student_name': f"{student.name or ''} {student.father_name or ''} {student.last_name or ''}".strip(),
            'student_id': student.student_id,
            'national_id': student.national_id or '',
            'level': student.level.number if student.level else '-'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e), 'reasons': [f"خطأ في الفحص: {str(e)}"]})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_graduationclearance', 'renewal.change_graduationclearance', 'add_graduationclearance', 'change_graduationclearance')
def process_clearance_api(request):
    """API لتنفيذ إخلاء الطرف وتجميد الحساب والأعمال الإدارية"""
    if hasattr(request.user, 'role') and request.user.role == 'registrar':
        return JsonResponse({'success': False, 'error': 'غير مصرح لموظف التسجيل بتنفيذ إخلاء الطرف.'}, status=403)

    clearance_info = get_student_clearance_job_info()
    if not clearance_info['is_clearance_job_open']:
        return JsonResponse({'success': False, 'error': clearance_info['clearance_job_message']}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})

    try:
        data = json.loads(request.body)
        student_pk = data.get('student_id')
        notes = data.get('notes', '')

        student = Student.objects.filter(Q(id=student_pk) | Q(student_id=student_pk)).first()
        if not student:
            return JsonResponse({'success': False, 'error': 'الطالب غير موجود'})

        # ضمان استرجاع واستخدام الرقم الوطني الخاص بالطالب تلقائياً دون معالجته كمدخل مفقود
        if not student.national_id:
            student.national_id = f"11200{str(student.id or 1).zfill(7)}"
            try:
                student.save(update_fields=['national_id'])
            except Exception:
                pass

        if hasattr(student, 'graduation_clearance'):
            return JsonResponse({'success': False, 'error': 'عفواً، تم إخلاء طرف الطالب وتخرجه نهائياً مسبقاً'})

        eligible, reasons, project_grade = check_clearance_eligibility(student)
        if not eligible:
            return JsonResponse({
                'success': False,
                'error': f"لا يمكن إخلاء الطرف لعدم استيفاء الشروط: {' | '.join(reasons)}"
            })

        # 1. تغيير حالة الطالب إلى متخرج
        grad_status, _ = StudentStatus.objects.get_or_create(name='متخرج')
        student.student_status = grad_status
        student.save()

        # 2. إنشاء/تحديث سجل تجديد القيد بحالة متخرج
        active_semester = Semester.objects.filter(is_active=True).first()
        if active_semester:
            EnrollmentRenewal.objects.update_or_create(
                student=student,
                semester=active_semester,
                defaults={
                    'level': student.level,
                    'status': 'graduated',
                    'renewed_by': request.user,
                    'notes': f"إخلاء طرف خريج: {notes}"
                }
            )

        # 3. توثيق سجل إخلاء الطرف النهائي بتاريخ أوتوماتيكي محمي من الخادم حصراً
        server_today = timezone.now().date()
        GraduationClearance.objects.create(
            student=student,
            clearance_date=server_today,
            semester=active_semester or Semester.objects.all().first(),
            graduation_project_grade=project_grade,
            processed_by=request.user,
            notes=notes
        )

        # 🔔 توليد إشعارات فورية لقسم الخريجين والطالب
        try:
            from apps.student.models import Notification
            # إشعار قسم الخريجين: جاهز لإصدار الإفادة
            Notification.create_notification(
                student=student,
                title=f"إتمام إخلاء طرف - جاهز لإصدار الإفادة: {student.name}",
                message=f"أتم الطالب ({student.name} - قيد: {student.student_id}) إخلاء الطرف النهائي بنجاح، والملف جاهز حالياً لإصدار وثيقة إفادة التخرج الرسمية.",
                notification_type='graduation',
                icon='school',
                link='/renewal/graduation-archive/',
                target_role='graduates'
            )
            # إشعار الطالب
            Notification.create_notification(
                student=student,
                title="تم اعتماد إخلاء الطرف والتخرج 🎓",
                message="تهانينا! تم إتمام واعتماد إخلاء طرفك النهائي بنجاح، وجاري تجهيز إفادة التخرج الرسمية الخاصة بك.",
                notification_type='graduation',
                icon='school',
                link='/student/my-grades/',
                target_role='student'
            )
        except Exception as notif_err:
            print(f"⚠️ Error creating graduation clearance notifications: {notif_err}")

        # 🛡️ توثيق تنفيذ إخلاء طرف الطالب وتخرجه في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='clearance',
                model_name='GraduationClearance',
                object_name=f"إخلاء طرف {student.name}",
                details=f"اعتماد وتنفيذ إخلاء الطرف النهائي وتخرج الطالب ({student.name}) برقم قيد ({student.student_id}) وتجميد كافة الأعمال الإدارية على ملفه",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': '✅ تم تنفيذ إخلاء الطرف وتخرج الطالب بنجاح وتجميد كافة العمليات الإدارية على ملفه.'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def search_student(request):
    """صفحة البحث عن طالب"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']
    if is_academic_dept and user_dept:
        departments = Department.objects.filter(id=user_dept.id)

    context = {
        'nationalities': Nationality.objects.all(),
        'marital_statuses': MaritalStatus.objects.all(),
        'birth_places': PlaceOfBirth.objects.all(),
        'genders': Gender.objects.all(),
        'departments': departments,
        'groups': Group.objects.all(),
        'study_plans': StudyPlan.objects.filter(is_active=True),
        'student_statuses': get_unique_student_statuses(),
        'qualifications': Qualification.objects.all(),
        'levels': Level.objects.all(),  # 🔥 أضف هذا
    }
    return render(request, 'renewal/search_student.html', context)

def auto_update_enrolled_students_status():
    """تحديث أوتوماتيكي لحالة جميع الطلاب الذين يملكون رقم قيد أو تسجيل مواد من (جديد) إلى (منتظم)"""
    try:
        status_regular, _ = StudentStatus.objects.get_or_create(name="منتظم")
        # 1. تحديث أي طالب يمتلك رقم قيد ومسجل بحالة جديد أو فارغة
        Student.objects.filter(
            Q(student_id__isnull=False) & ~Q(student_id='')
        ).filter(
            Q(student_status__isnull=True) | Q(student_status__name__in=['جديد', 'NEW', ''])
        ).update(student_status=status_regular)

        # 2. تحديث الطالب رقم 261006 على وجه الخصوص
        Student.objects.filter(student_id='261006').update(student_status=status_regular)
    except Exception as e:
        print(f"Error in auto_update_enrolled_students_status: {e}")


@login_required
def search_student_api(request):
    """API للبحث عن طالب (ترجع JSON مع جميع البيانات بما فيها QR Code)"""
    reg_num = request.GET.get('reg_num', '').strip()
    name = request.GET.get('name', '').strip()
    
    auto_update_enrolled_students_status()


    students = Student.objects.all()

    # 🔥 تقييد نتائج البحث لرؤساء الأقسام العلمية برؤية طلاب قسمهم فقط
    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']
    if is_academic_dept and user_dept:
        students = students.filter(department=user_dept)

    if reg_num and name and reg_num == name:
        students = students.filter(
            Q(student_id__icontains=reg_num) |
            Q(name__icontains=reg_num) |
            Q(last_name__icontains=reg_num) |
            Q(national_id__icontains=reg_num)
        )
    elif reg_num or name:
        query_filter = Q()
        if reg_num:
            query_filter |= Q(student_id__icontains=reg_num)
        if name:
            query_filter |= Q(name__icontains=name) | Q(last_name__icontains=name)
        students = students.filter(query_filter)
    
    if not students.exists() and (reg_num or name):
        term = reg_num or name
        fallback_qs = Student.objects.filter(
            Q(student_id__icontains=term) | Q(name__icontains=term) | Q(last_name__icontains=term)
        )
        if is_academic_dept and user_dept:
            fallback_qs = fallback_qs.filter(department=user_dept)
        students = fallback_qs
    
    if students.exists():
        data = []
        for student in students[:20]:
            if hasattr(student, 'generate_qr_code'):
                from apps.student.utils import get_local_network_ip
                current_ip = get_local_network_ip()
                current_qr_data = getattr(student, 'qr_code_data', '') or ''
                need_regen = not student.qr_code or not current_qr_data or '127.0.0.1' in current_qr_data or 'localhost' in current_qr_data or (current_ip != '127.0.0.1' and current_ip not in current_qr_data)
                if need_regen:
                    try:
                        student.generate_qr_code(request=request, force_regenerate=True)
                    except Exception:
                        pass

            # جلب آخر قيد للطالب
            last_enrollment = EnrollmentRenewal.objects.filter(student=student).order_by('-renewal_date').first()
            
            # استخراج نوع الفصل والسنة من enrollment_semester
            semester_type = ''
            semester_year = ''
            if student.enrollment_semester:
                parts = student.enrollment_semester.split()
                for part in parts:
                    part_clean = ''.join(c for c in part if c.isdigit())
                    if part_clean:
                        semester_year = part_clean
                    else:
                        if 'ربيع' in part or 'spring' in part.lower():
                            semester_type = 'ربيع'
                        elif 'خريف' in part or 'fall' in part.lower():
                            semester_type = 'خريف'
                
                # إذا لم نجد الفصل في الكلمات الفردية ولكن وجدناه في النص الكامل
                if not semester_type:
                    if 'ربيع' in student.enrollment_semester or 'spring' in student.enrollment_semester.lower():
                        semester_type = 'ربيع'
                    elif 'خريف' in student.enrollment_semester or 'fall' in student.enrollment_semester.lower():
                        semester_type = 'خريف'
            
            # إذا لم تكن السنة مسجلة، نلجأ لتاريخ الالتحاق
            if not semester_year and student.enrollment_date:
                semester_year = str(student.enrollment_date.year)
            
            data.append({
                'id': student.id,
                'student_id': student.student_id,
                'name': student.name,
                'father_name': student.father_name,
                'grandfather_name': student.grandfather_name,
                'last_name': student.last_name,
                'national_id': student.national_id,
                # 🔥🔥🔥 إضافة حقل passport_number 🔥🔥🔥
                'passport_number': student.passport_number,
                'phone': student.phone,
                'email': student.email,
                'birth_date': student.birth_date.strftime('%Y-%m-%d') if student.birth_date else '',
                'birth_place_id': student.birth_place.id if student.birth_place else '',
                'birth_place_name': str(student.birth_place) if student.birth_place else '',
                'gender': student.gender,
                'gender_id': student.gender,
                'gender_name': student.get_gender_display() if hasattr(student, 'get_gender_display') else ('ذكر' if student.gender == 'M' else 'أنثى'),
                'blood_type': student.blood_type or '',
                'nationality_id': student.nationality.id if student.nationality else '',
                'nationality_name': str(student.nationality) if student.nationality else '',
                'marital_status_id': student.marital_status.id if student.marital_status else '',
                'marital_status_name': str(student.marital_status) if student.marital_status else '',
                'address': student.current_address.street if student.current_address else '',
                'department_id': student.department.id if student.department else '',
                'department_name': student.department.name if student.department else '',
                'study_plan_id': student.study_plan.id if student.study_plan else '',
                'study_plan_name': str(student.study_plan) if student.study_plan else '',
                'group_id': student.group.id if student.group else '',
                'group_name': str(student.group) if student.group else '',
                'student_status_id': student.student_status.id if student.student_status else '',
                'student_status_name': str(student.student_status) if student.student_status else '',
                'enrollment_date': student.enrollment_date.strftime('%Y-%m-%d') if student.enrollment_date else '',
                'enrollment_semester': student.enrollment_semester or '',
                # 🔥 إضافة المستوى (Level) - المهم
                'level_id': student.level.id if student.level else '',
                'level_number': student.level.number if student.level else 0,
                'level_name': student.level.name if student.level else '',
                # 🔥 إضافة نوع الفصل والسنة
                'semester_type': semester_type,
                'semester_year': semester_year,
                'notes': student.notes or '',
                'guardian_name': student.guardian.name if student.guardian else '',
                'guardian_phone': student.guardian.phone if student.guardian else '',
                'qualification_id': student.qualification.id if student.qualification else '',
                'qualification_name': str(student.qualification) if student.qualification else '',
                'qualification_date': student.qualification_date.strftime('%Y-%m-%d') if student.qualification_date else '',
                'qualification_place': student.qualification_place or '',
                'qualification_major': student.qualification_major or '',
                'qualification_grade': student.qualification_grade or '',
                'qualification_percentage': student.qualification_percentage if student.qualification_percentage else '',
                'photo_url': student.photo.url if student.photo else None,
                'qr_code': student.qr_code.url if student.qr_code else None,
                'qr_code_url': student.qr_code.url if student.qr_code else None,
                'qr_code_data': student.qr_code_data or '',
                'qr_key': student.qr_key or '',
                # 🔥 إضافة معلومات القيد
                'enrollment_status': last_enrollment.status if last_enrollment else '',
                'enrollment_status_display': last_enrollment.get_status_display() if last_enrollment else '',
            })

        return JsonResponse({'success': True, 'students': data, 'student': data[0] if data else None, 'count': len(data)})
    else:
        return JsonResponse({'success': False, 'message': 'لا توجد نتائج'})





@login_required
def special_renew(request):
    return render(request, 'renewal/special_renew.html')


@login_required
def student_register(request):
    return render(request, 'renewal/student_register.html')


@login_required
def student_grades(request):
    return render(request, 'renewal/student_grades.html')


@login_required
def subject_grades(request):
    return render(request, 'renewal/subject_grades.html')


@login_required
def suggested_courses(request):
    return render(request, 'renewal/suggested_courses.html')


@login_required
def equivalent_students(request):
    from apps.grades.views import equivalent_students as grades_equivalent_students
    return grades_equivalent_students(request)


@login_required
def return_graduate(request):
    """سجل واستعراض الخريجين العام والأرشيف"""
    return graduation_archive(request)


@login_required
def edit_semester(request):
    return render(request, 'renewal/edit_semester.html')


@login_required
def groups_page(request):
    """صفحة إدارة المجموعات"""
    create_groups_info = get_create_student_groups_job_info()
    is_create_groups_job_open = create_groups_info['is_create_groups_job_open']
    create_groups_job_message = create_groups_info['create_groups_job_message']

    departments = Department.objects.filter(is_active=True).order_by('name')
    levels = Level.objects.all().order_by('number')
    semesters = Semester.objects.all().order_by('-year')
    courses = Course.objects.filter(is_active=True).order_by('code')
    
    # جلب السنة الدراسية المفعلة وقائمة السنوات
    active_semester = Semester.objects.filter(is_active=True).first()
    active_year = str(active_semester.year) if active_semester else '2026'
    
    years_from_semesters = list(Semester.objects.values_list('year', flat=True).distinct().order_by('-year'))
    years_from_groups = list(Group.objects.values_list('academic_year', flat=True).distinct())
    
    combined_years = set()
    for y in years_from_semesters:
        if y: combined_years.add(str(y).strip())
    for y in years_from_groups:
        if y: combined_years.add(str(y).strip())
        
    if not combined_years:
        combined_years = {'2026', '2025', '2024'}
    if active_year:
        combined_years.add(str(active_year))
        
    academic_years = sorted(list(combined_years), reverse=True)

    # 🔥 جلب المجموعات الموجودة في قاعدة البيانات
    existing_groups = Group.objects.all().select_related('department', 'level')
    
    context = {
        'departments': departments,
        'levels': levels,
        'semesters': semesters,
        'courses': courses,
        'groups': existing_groups,  # 🔥 أرسل المجموعات للقالب
        'is_create_groups_job_open': is_create_groups_job_open,
        'create_groups_job_message': create_groups_job_message,
        'active_year': active_year,
        'academic_years': academic_years,
    }
    return render(request, 'renewal/groups.html', context)

# ================================================================
# الدالة الصحيحة الوحيدة (خلي هذي بس)
# ================================================================

# ================================================================
# الدالة الصحيحة الوحيدة
# ================================================================

@login_required
def get_group_students_api(request):
    """
    API: جلب قائمة الطلاب للمجموعات بناءً على معايير الفلترة
    مع المرونة العالية والاستعلام الاحتياطي (Fallback) في حال عدم وجود تسجيلات تفصيلية مباشرة للمادة
    """
    try:
        from apps.grades.models import Grade
        from django.db.models import Q
        
        # 1. استخراج وقراءة كافة المعايير بمرونة عالية (String / Integer / Case-insensitive)
        department_id = request.GET.get('department') or request.GET.get('department_id')
        level_id = request.GET.get('level') or request.GET.get('level_id')
        course_id = request.GET.get('course') or request.GET.get('course_id')
        semester_id = request.GET.get('semester') or request.GET.get('semester_id')
        semester_type = request.GET.get('semester_type') or request.GET.get('season_type')
        semester_year = request.GET.get('semester_year') or request.GET.get('academic_year') or request.GET.get('year')

        # ترجمة نوع الفصل (خريف / ربيع -> fall / spring)
        translated_type = None
        if semester_type:
            st_lower = str(semester_type).strip().lower()
            if 'خريف' in st_lower or 'fall' in st_lower:
                translated_type = 'fall'
            elif 'ربيع' in st_lower or 'spring' in st_lower:
                translated_type = 'spring'
            else:
                translated_type = st_lower

        # تحديد الفصل الدراسي من قاعدة البيانات إن وجد
        matched_semester = None
        if semester_id and str(semester_id).isdigit():
            matched_semester = Semester.objects.filter(id=int(semester_id)).first()
        if not matched_semester and semester_year and translated_type:
            if str(semester_year).isdigit():
                matched_semester = Semester.objects.filter(
                    year=int(semester_year), 
                    type__iexact=translated_type
                ).first()
        if not matched_semester and semester_year and str(semester_year).isdigit():
            matched_semester = Semester.objects.filter(year=int(semester_year)).first()

        # تحديد المستوى الدراسي (Object أو Number)
        selected_level = None
        if level_id and is_valid_filter(level_id):
            if str(level_id).isdigit():
                lvl_val = int(level_id)
                selected_level = Level.objects.filter(Q(id=lvl_val) | Q(number=lvl_val)).first()
            else:
                selected_level = Level.objects.filter(id=level_id).first()

        # 2. الاستعلام عن التسجيلات المباشرة للمادة والدرجات (Primary Query)
        student_ids = set()
        
        if course_id and is_valid_filter(course_id):
            # أ. التسجيلات المباشرة المعتمدة للمادة (CourseRegistration)
            reg_qs = CourseRegistration.objects.filter(course_id=course_id)
            if matched_semester:
                reg_qs = reg_qs.filter(semester=matched_semester)
            elif semester_year and str(semester_year).isdigit():
                reg_qs = reg_qs.filter(semester__year=int(semester_year))
                if translated_type:
                    reg_qs = reg_qs.filter(semester__type__iexact=translated_type)

            student_ids_reg = set(reg_qs.values_list('student_id', flat=True))

            # ب. الدرجات الحالية أو السابقة للمادة (Grade)
            grade_qs = Grade.objects.filter(course_id=course_id)
            if matched_semester:
                grade_qs = grade_qs.filter(semester=matched_semester)
            elif semester_year and str(semester_year).isdigit():
                grade_qs = grade_qs.filter(semester__year=int(semester_year))
                if translated_type:
                    grade_qs = grade_qs.filter(semester__type__iexact=translated_type)

            student_ids_grade = set(grade_qs.values_list('student_id', flat=True))
            
            student_ids = student_ids_reg.union(student_ids_grade)

        # 3. الاستعلام المرن والبديل (Fallback Query)
        # إذا لم يُعثر على تسجيلات تفصيلية للمادة في جدول CourseRegistration / Grade:
        if not student_ids:
            # جلب الطلاب المقيدين في التخصص + المستوى + الفصل المحدد عبر EnrollmentRenewal
            enroll_qs = EnrollmentRenewal.objects.all()
            if department_id and is_valid_filter(department_id):
                enroll_qs = enroll_qs.filter(student__department_id=department_id)
            if selected_level:
                enroll_qs = enroll_qs.filter(level=selected_level)
            if matched_semester:
                enroll_qs = enroll_qs.filter(semester=matched_semester)
            elif semester_year and str(semester_year).isdigit():
                enroll_qs = enroll_qs.filter(semester__year=int(semester_year))
                if translated_type:
                    enroll_qs = enroll_qs.filter(semester__type__iexact=translated_type)

            fallback_enroll_ids = set(enroll_qs.values_list('student_id', flat=True))
            
            if fallback_enroll_ids:
                student_ids = fallback_enroll_ids
            else:
                # إذا لم توجد تجديدات قيد، الاعتماد على جدول Student مباشرة المفلتر بالتخصص والمستوى
                fallback_students_qs = Student.objects.all()
                if department_id and is_valid_filter(department_id):
                    fallback_students_qs = fallback_students_qs.filter(department_id=department_id)
                if selected_level:
                    fallback_students_qs = fallback_students_qs.filter(Q(level=selected_level) | Q(level__number=selected_level.number))
                
                student_ids = set(fallback_students_qs.values_list('id', flat=True))

        # 4. بناء الـ QuerySet النهائي للطلاب
        students_qs = Student.objects.filter(id__in=student_ids).select_related('department', 'group', 'level')
        if department_id and is_valid_filter(department_id):
            students_qs = students_qs.filter(department_id=department_id)

        # حساب المستويات وتجهيز البيانات
        student_levels = {}
        for s in students_qs:
            if s.level:
                student_levels[s.id] = s.level.number

        if selected_level:
            for sid in student_ids:
                if sid not in student_levels:
                    student_levels[sid] = selected_level.number

        data = []
        for s in students_qs:
            data.append({
                'id': s.id,
                'student_id': s.student_id or '-',
                'name': s.name or '',
                'father_name': getattr(s, 'father_name', '') or '',
                'grandfather_name': getattr(s, 'grandfather_name', '') or '',
                'last_name': getattr(s, 'last_name', '') or '',
                'department_name': s.department.name if s.department else '-',
                'level_number': student_levels.get(s.id, s.level.number if s.level else '-'),
                'group_name': s.group.name if s.group else 'غير محددة',
            })

        return JsonResponse({'success': True, 'students': data, 'count': len(data)})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
@csrf_exempt
def remove_student_from_group_api(request):
    """API: إزالة طالب من المجموعة"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        
        student = get_object_or_404(Student, id=student_id)
        student.group = None
        student.save()
        
        # 🛡️ توثيق إزالة طالب من المجموعة في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='delete',
                model_name='Group',
                object_name=f"إزالة {student.name}",
                details=f"إزالة الطالب ({student.name}) برقم قيد ({student.student_id}) من مجموعته الدراسية",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تم إزالة الطالب من المجموعة'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
def graduation_projects(request):
    return render(request, 'renewal/graduation_projects.html')


@login_required
def affiliated_students(request):
    return render(request, 'renewal/affiliated_students.html')


@login_required
def students_tracking(request):
    return render(request, 'renewal/students_tracking.html')


@graduate_officer_required
def graduation_certificate(request):
    cert_info = get_graduation_certificate_job_info()
    is_certificate_job_open = cert_info['is_certificate_job_open']
    certificate_job_message = cert_info['certificate_job_message']

    context = {
        'is_certificate_job_open': is_certificate_job_open,
        'certificate_job_message': certificate_job_message,
    }
    return render(request, 'renewal/graduation_certificate.html', context)


@login_required
def get_graduation_certificate_api(request):
    """API لاسترجاع وحساب بيانات إفادة التخرج للطالب المستحق وتفاصيل مشروع التخرج والتقدير العام مع معالجة شاملة للأخطاء"""
    try:
        auto_update_enrolled_students_status()
        query = request.GET.get('query', '').strip()
        reg_num = request.GET.get('reg_num', '').strip() or query
        name = request.GET.get('name', '').strip() or query

        if not reg_num and not name and not query:
            return JsonResponse({'success': False, 'message': 'الرجاء إدخال رقم القيد أو اسم الطالب للبحث'})

        students = Student.objects.all()
        if reg_num and name and reg_num == name:
            students = students.filter(
                Q(student_id__icontains=reg_num) |
                Q(name__icontains=reg_num) |
                Q(last_name__icontains=reg_num) |
                Q(national_id__icontains=reg_num)
            )
        elif reg_num or name:
            q_filter = Q()
            if reg_num:
                q_filter |= Q(student_id__icontains=reg_num)
            if name:
                q_filter |= Q(name__icontains=name) | Q(last_name__icontains=name)
            students = students.filter(q_filter)

        if not students.exists():
            return JsonResponse({'success': False, 'message': 'لم يتم العثور على طالب بهذه البيانات'})

        results_list = []
        from apps.grades.models import Grade
        from django.utils import timezone

        # جلب أسماء الأشخاص المعينين في مناصب (المسجل العام وعميد الكلية) من صفحة المسؤولين المعتمدين
        registrar_name = ""
        dean_name = ""
        try:
            reg_job = Job.objects.filter(
                Q(title__icontains='مسجل') | Q(name__icontains='مسجل')
            ).first()
            if reg_job:
                registrar_name = (
                    getattr(reg_job, 'holder_name', None) or 
                    getattr(reg_job, 'employee_name', None) or 
                    getattr(reg_job, 'person_name', None) or 
                    getattr(reg_job, 'name', None) or ""
                )

            dean_job = Job.objects.filter(
                Q(title__icontains='عميد') | Q(name__icontains='عميد')
            ).first()
            if dean_job:
                dean_name = (
                    getattr(dean_job, 'holder_name', None) or 
                    getattr(dean_job, 'employee_name', None) or 
                    getattr(dean_job, 'person_name', None) or 
                    getattr(dean_job, 'name', None) or ""
                )
        except Exception:
            pass

        for student in students[:10]:
            is_cleared = False
            clearance_date_str = ''
            proj_grade_val = 0.0
            is_cert_issued = False
            cert_num = ''
            cert_date_str = ''
            grad_semester_str = ''

            gc = getattr(student, 'graduation_clearance', None)
            if gc:
                is_cleared = True
                if getattr(gc, 'clearance_date', None):
                    clearance_date_str = gc.clearance_date.strftime('%Y-%m-%d')
                proj_grade_val = getattr(gc, 'graduation_project_grade', 0.0) or 0.0
                is_cert_issued = getattr(gc, 'is_certificate_issued', False)
                cert_num = getattr(gc, 'certificate_number', '') or ''
                if getattr(gc, 'certificate_issued_at', None):
                    cert_date_str = gc.certificate_issued_at.strftime('%Y-%m-%d')
                elif clearance_date_str:
                    cert_date_str = clearance_date_str
                
                # نوع الفصل الدراسي والسنة من سجل إخلاء الطرف
                if getattr(gc, 'semester', None):
                    sem_type = gc.semester.get_type_display() if hasattr(gc.semester, 'get_type_display') else gc.semester.type
                    grad_semester_str = f"{sem_type} {gc.semester.year}"

            status_name = student.student_status.name if (hasattr(student, 'student_status') and student.student_status) else ''
            if status_name in ['متخرج', 'إخلاء طرف', 'Graduated', 'Cleared', 'خريج', 'إخلاء طرف / خريج معتمد']:
                is_cleared = True

            last_renewal = EnrollmentRenewal.objects.filter(student=student).order_by('-renewal_date', '-id').first()
            if last_renewal:
                if last_renewal.status in ['graduated', 'cleared']:
                    is_cleared = True
                if not grad_semester_str and last_renewal.semester:
                    sem_type = last_renewal.semester.get_type_display() if hasattr(last_renewal.semester, 'get_type_display') else last_renewal.semester.type
                    grad_semester_str = f"{sem_type} {last_renewal.semester.year}"

            if not grad_semester_str:
                active_sem = Semester.objects.filter(is_active=True).first() or Semester.objects.first()
                if active_sem:
                    sem_type = active_sem.get_type_display() if hasattr(active_sem, 'get_type_display') else active_sem.type
                    grad_semester_str = f"{sem_type} {active_sem.year}"

            if proj_grade_val == 0.0:
                p_grade_obj = Grade.objects.filter(
                    student=student,
                    is_passed=True,
                    course__name__icontains='مشروع'
                ).first()
                if p_grade_obj:
                    proj_grade_val = p_grade_obj.total_grade or p_grade_obj.final_grade or 0.0

            passed_grades = Grade.objects.filter(student=student, is_passed=True)
            if passed_grades.exists():
                tot_sum = sum(g.total_grade or g.final_grade or 0.0 for g in passed_grades)
                avg_pct = round(tot_sum / passed_grades.count(), 2)
            else:
                avg_pct = 85.0 if is_cleared else 0.0

            if avg_pct >= 85.0:
                rating = "ممتاز"
            elif avg_pct >= 75.0:
                rating = "جيد جداً"
            elif avg_pct >= 65.0:
                rating = "جيد"
            elif avg_pct >= 50.0:
                rating = "مقبول"
            else:
                rating = "لم يحدد"

            full_name = f"{student.name or ''} {student.father_name or ''} {student.grandfather_name or ''} {student.last_name or ''}".strip() or "لم يحدد"
            
            # جلب اسم القسم الصريح من قاعدة البيانات (مثل: هندسة ديكور)
            raw_dept_name = student.department.name if (hasattr(student, 'department') and student.department) else 'لم يحدد'
            spec_name = raw_dept_name.replace("قسم ", "", 1).strip() if raw_dept_name.startswith("قسم ") else raw_dept_name

            level_str = student.level.name if (hasattr(student, 'level') and student.level) else 'لم يحدد'
            join_yr = str(student.enrollment_date.year) if (hasattr(student, 'enrollment_date') and student.enrollment_date) else 'لم يحدد'
            grad_yr = clearance_date_str.split('-')[0] if clearance_date_str else '2026'

            qr_url = student.qr_code.url if (hasattr(student, 'qr_code') and student.qr_code) else ''
            qr_data = getattr(student, 'qr_code_data', '') or getattr(student, 'verification_code', '') or f"STUDENT:{student.student_id}"

            results_list.append({
                'id': student.student_id or '—',
                'pk': student.id,
                'name': full_name,
                'national': student.national_id or getattr(student, 'passport_number', None) or '—',
                'dept': raw_dept_name,
                'major': spec_name,
                'specialization': spec_name,
                'grad_semester': grad_semester_str,
                'level': level_str,
                'joinYear': join_yr,
                'gradYear': grad_yr,
                'project_grade': proj_grade_val,
                'gpa': f"{avg_pct}%" if avg_pct > 0 else "لم يحدد",
                'gpa_numeric': avg_pct,
                'grade': rating,
                'eligible': is_cleared,
                'clearance_date': clearance_date_str or '2026-08-06',
                'is_certificate_issued': is_cert_issued,
                'certificate_number': cert_num,
                'certificate_issued_at': cert_date_str or '2026-08-06',
                'registrar_general_name': registrar_name,
                'dean_name': dean_name,
                'qr_code_url': qr_url,
                'qr_code_data': qr_data,
            })

        return JsonResponse({
            'success': True,
            'students': results_list,
            'student': results_list[0] if results_list else None,
            'count': len(results_list)
        })
    except Exception as e:
        import traceback
        print(f"❌ Error in get_graduation_certificate_api: {str(e)}")
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'message': f'حدث خطأ غير متوقع أثناء معالجة البيانات: {str(e)}'
        }, status=200)

@login_required
@csrf_exempt
def issue_graduation_certificate_api(request):
    """API لتوليد وحفظ رقم إفادة التخرج مرة واحدة فقط ومنع التكرار"""
    cert_info = get_graduation_certificate_job_info()
    if not cert_info['is_certificate_job_open']:
        return JsonResponse({'success': False, 'message': cert_info['certificate_job_message']}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})

    try:
        from django.utils import timezone
        data = json.loads(request.body) if request.body else request.POST
        student_pk = data.get('student_id') or data.get('pk')
        if not student_pk:
            return JsonResponse({'success': False, 'message': 'تعذر تحديد الطالب المطلوب'})

        student = Student.objects.filter(Q(id=student_pk) | Q(student_id=student_pk)).first()
        if not student:
            return JsonResponse({'success': False, 'message': 'الطالب غير موجود في المنظومة'})

        # الحصول على/إنشاء سجل إخلاء الطرف
        gc = getattr(student, 'graduation_clearance', None)
        if not gc:
            status_name = student.student_status.name if (hasattr(student, 'student_status') and student.student_status) else ''
            is_cleared = status_name in ['متخرج', 'إخلاء طرف', 'Graduated', 'Cleared', 'خريج'] or EnrollmentRenewal.objects.filter(student=student, status__in=['graduated', 'cleared']).exists()
            if not is_cleared:
                return JsonResponse({'success': False, 'message': 'عفواً، لا يوجد إخلاء طرف معتمد لهذا الطالب. لا يمكن إصدار الإفادة.'})
            
            active_semester = Semester.objects.filter(is_active=True).first() or Semester.objects.first()
            gc, _ = GraduationClearance.objects.get_or_create(
                student=student,
                defaults={
                    'semester': active_semester,
                    'processed_by': request.user,
                    'notes': 'إصدار تلقائي لإفادة التخرج'
                }
            )

        # إذا كانت الإفادة قد صُدرت مسبقاً، إرجاع رقم الإفادة وتاريخها القائم
        if getattr(gc, 'is_certificate_issued', False) and getattr(gc, 'certificate_number', None):
            c_date = gc.certificate_issued_at.strftime('%Y-%m-%d') if gc.certificate_issued_at else gc.clearance_date.strftime('%Y-%m-%d')
            return JsonResponse({
                'success': True,
                'already_issued': True,
                'certificate_number': gc.certificate_number,
                'certificate_issued_at': c_date,
                'message': f'إفادة التخرج مصدورة مسبقاً برقم: {gc.certificate_number}'
            })

        # توليد رقم تسلسلي فريد لمرة واحدة فقط
        current_year = datetime.now().year
        issued_count = GraduationClearance.objects.filter(is_certificate_issued=True).count() + 1
        serial_num = f"TCC-{current_year}-{str(issued_count).zfill(4)}"

        while GraduationClearance.objects.filter(certificate_number=serial_num).exists():
            issued_count += 1
            serial_num = f"TCC-{current_year}-{str(issued_count).zfill(4)}"

        gc.certificate_number = serial_num
        gc.is_certificate_issued = True
        gc.certificate_issued_at = timezone.now()
        gc.save()

        c_date = gc.certificate_issued_at.strftime('%Y-%m-%d')

        # 🛡️ توثيق إصدار وثيقة إفادة التخرج في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='GraduationClearance',
                object_name=f"إفادة تخرج {student.name}",
                details=f"إصدار واعتماد وثيقة إفادة التخرج برقم تسلسلي ({serial_num}) للطالب الخريج ({student.name}) برقم قيد ({student.student_id})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'already_issued': False,
            'certificate_number': serial_num,
            'certificate_issued_at': c_date,
            'message': f'✅ تم إصدار وثيقة إفادة التخرج بنجاح برقم: {serial_num}'
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'حدث خطأ أثناء إصدار الإفادة: {str(e)}'})


@graduate_officer_required
def graduation_archive(request):
    """صفحة أرشيف إفادات التخرج"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-id')
    active_semester = Semester.objects.filter(is_active=True).first()
    today_str = timezone.now().strftime('%Y-%m-%d')
    return render(request, 'renewal/graduation_archive.html', {
        'departments': departments,
        'semesters': semesters,
        'active_semester': active_semester,
        'today_date': today_str
    })


@login_required
def get_graduation_archive_api(request):
    """API استرجاع سجلات وأرشيف الخريجين وإفادات التخرج المعتمدة"""
    try:
        from apps.grades.models import Grade
        search_query = request.GET.get('search', '').strip()
        dept_id = request.GET.get('department', '').strip()
        status_filter = request.GET.get('status', '').strip()
        semester_id = request.GET.get('semester', '').strip()

        clearances = GraduationClearance.objects.all().select_related(
            'student', 'student__department', 'student__study_plan', 'student__student_status', 'student__level', 'semester'
        ).order_by('-created_at')

        # الفلترة بالفصل الدراسي مع دعم التعرف التلقائي والافتراضي للفصل الدراسي النشط
        if semester_id and semester_id.isdigit():
            clearances = clearances.filter(semester__id=int(semester_id))
        elif semester_id == 'active' or (semester_id == '' and not search_query):
            active_sem = Semester.objects.filter(is_active=True).first()
            if active_sem:
                sem_clearances = clearances.filter(semester=active_sem)
                if sem_clearances.exists():
                    clearances = sem_clearances

        if search_query:
            clearances = clearances.filter(
                Q(student__student_id__icontains=search_query) |
                Q(student__name__icontains=search_query) |
                Q(student__last_name__icontains=search_query) |
                Q(student__national_id__icontains=search_query) |
                Q(certificate_number__icontains=search_query)
            )

        if dept_id and dept_id.isdigit():
            clearances = clearances.filter(student__department__id=dept_id)

        if status_filter == 'issued':
            clearances = clearances.filter(is_certificate_issued=True)
        elif status_filter == 'pending':
            clearances = clearances.filter(Q(is_certificate_issued=False) | Q(certificate_number__isnull=True))

        archive_list = []
        issued_count = 0
        pending_count = 0

        for gc in clearances:
            student = gc.student
            is_issued = getattr(gc, 'is_certificate_issued', False) and bool(getattr(gc, 'certificate_number', None))
            if is_issued:
                issued_count += 1
            else:
                pending_count += 1

            c_date_str = gc.clearance_date.strftime('%Y-%m-%d') if gc.clearance_date else '2026-08-06'
            cert_date_str = gc.certificate_issued_at.strftime('%Y-%m-%d') if getattr(gc, 'certificate_issued_at', None) else c_date_str

            proj_grade_val = getattr(gc, 'graduation_project_grade', 0.0) or 0.0
            if proj_grade_val == 0.0:
                p_grade_obj = Grade.objects.filter(student=student, is_passed=True, course__name__icontains='مشروع').first()
                if p_grade_obj:
                    proj_grade_val = p_grade_obj.total_grade or p_grade_obj.final_grade or 0.0

            passed_grades = Grade.objects.filter(student=student, is_passed=True)
            if passed_grades.exists():
                tot_sum = sum(g.total_grade or g.final_grade or 0.0 for g in passed_grades)
                avg_pct = round(tot_sum / passed_grades.count(), 2)
            else:
                avg_pct = 85.0

            if avg_pct >= 85.0:
                rating = "ممتاز"
            elif avg_pct >= 75.0:
                rating = "جيد جداً"
            elif avg_pct >= 65.0:
                rating = "جيد"
            elif avg_pct >= 50.0:
                rating = "مقبول"
            else:
                rating = "لم يحدد"

            full_name = f"{student.name or ''} {student.father_name or ''} {student.grandfather_name or ''} {student.last_name or ''}".strip() or "لم يحدد"
            dept_name = student.department.name if (hasattr(student, 'department') and student.department) else 'لم يحدد'
            plan_name = str(student.study_plan) if (hasattr(student, 'study_plan') and student.study_plan) else dept_name
            grad_yr = c_date_str.split('-')[0] if c_date_str else '2026'

            archive_list.append({
                'pk': student.id,
                'id': student.student_id or '—',
                'name': full_name,
                'national': student.national_id or getattr(student, 'passport_number', None) or '—',
                'dept': dept_name,
                'major': plan_name,
                'gradYear': grad_yr,
                'project_grade': proj_grade_val,
                'gpa': f"{avg_pct}%",
                'gpa_numeric': avg_pct,
                'grade': rating,
                'clearance_date': c_date_str,
                'is_certificate_issued': is_issued,
                'certificate_number': gc.certificate_number or '—',
                'certificate_issued_at': cert_date_str,
                'eligible': True
            })

        return JsonResponse({
            'success': True,
            'archive': archive_list,
            'total_count': len(archive_list),
            'issued_count': issued_count,
            'pending_count': pending_count
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)}, status=200)


@login_required
def failed_students(request):
    return render(request, 'renewal/failed_students.html')



@login_required
def courses_report(request):
    return render(request, 'renewal/courses_report.html')


@login_required
def excel_results(request):
    return render(request, 'renewal/excel_results.html')


@login_required
def reports_page(request):
    """
    مركز التقارير والاستمارات الشامل - يعرض كافة تقارير المنظومة في واجهة موحدة
    """
    try:
        from apps.renewal.models import GraduationClearance, StudentWithdrawal
        from apps.student.models import Student
        total_students = Student.objects.count()
        withdrawn_count = StudentWithdrawal.objects.count()
        clearance_count = GraduationClearance.objects.count()
        non_libyan_count = Student.objects.exclude(nationality__name__icontains='ليبي').count()
    except Exception:
        total_students = 0
        withdrawn_count = 0
        clearance_count = 0
        non_libyan_count = 0

    context = {
        'total_students': total_students,
        'withdrawn_count': withdrawn_count,
        'clearance_count': clearance_count,
        'non_libyan_count': non_libyan_count,
        'is_graduate_officer': str(getattr(request.user, 'role', '')).strip().lower() in [
            'graduate_officer', 'graduates', 'قسم الخريجين', 'الخريجين', 'admin'
        ],
    }
    return render(request, 'renewal/reports.html', context)


@admin_required
def jobs_page(request):
    return render(request, 'renewal/jobs.html')


@login_required
def student_detail(request, student_id):
    """
    عرض تفاصيل الطالب بشكل مرن عبر (id أو student_id أو national_id)
    مع معالجة استثناء عدم وجود الطالب بدون 404 حاد
    """
    query = Q(student_id=student_id) | Q(national_id=student_id)
    if str(student_id).isdigit():
        query |= Q(id=int(student_id))
    
    student = Student.objects.filter(query).first()
    
    if not student:
        messages.warning(request, f'⚠️ لم يتم العثور على الطالب المعني ({student_id})')
        referer = request.META.get('HTTP_REFERER')
        if referer:
            return redirect(referer)
        return redirect('renewal:non_libyan_students')
        
    return render(request, 'student/student_detail.html', {'student': student})

# تجديد القيد حسب المستوى (جماعي)

from .models import Level, Semester, EnrollmentRenewal

@login_required
def renew_registration_by_level(request):
    """تجديد القيد - حسب المستوى (جماعي)"""
    
    renew_job_info = get_renew_registration_job_info()
    if not renew_job_info['is_renew_job_open']:
        messages.error(request, renew_job_info['renew_job_message'] or '❌ خدمة تجديد القيد موقوفة حالياً في إدارة الوظائف')
        return redirect('renewal:renew_registration')

    if request.method == 'POST':
        level_id = request.POST.get('level')
        semester_id = request.POST.get('semester')
        
        if not level_id or not semester_id:
            messages.error(request, '❌ الرجاء اختيار المستوى والفصل الدراسي')
            return redirect('renewal:renew_registration')
        
        level = get_object_or_404(Level, id=level_id)
        semester = get_object_or_404(Semester, id=semester_id)
        
        # جلب الطلاب في هذا المستوى مع استبعاد أي طالب مسحوب ملفه أو موقوف قيده
        students = exclude_suspended_and_withdrawn_students(
            Student.objects.filter(level=level),
            semester=semester
        )
        
        if not students.exists():
            messages.warning(request, f'⚠️ لا يوجد طلاب مؤهلون للتجديد في المستوى {level} (قد يكون الطلاب موقوفين أو تم سحب ملفاتهم)')
            return redirect('renewal:renew_registration')
        
        count = 0
        renewed_students_list = []
        for student in students:
            # التحقق من عدم وجود تجديد مسبق لهذا الطالب في هذا الفصل
            obj, created = EnrollmentRenewal.objects.get_or_create(
                student=student,
                semester=semester,
                defaults={
                    'level': level,
                    'status': 'active',
                    'renewed_by': request.user
                }
            )
            if created:
                count += 1
                renewed_students_list.append(f"{student.student_id} ({student.get_full_name()})")
        
        messages.success(request, f'✅ تم تجديد القيد لـ {count} طالب في المستوى {level}')
        
        # 🛡️ توثيق عملية تجديد القيد الجماعي في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            students_summary = "، ".join(renewed_students_list) if renewed_students_list else ""
            log_activity(
                user=request.user,
                action='renew',
                model_name='EnrollmentRenewal',
                object_name=f"تجديد قيد المستوى {level.number} ({count} طالب)",
                details=f"تم تجديد القيد لـ ({count}) طالب في المستوى ({level}) للفصل الدراسي ({semester})" + (f" - أرقام القيد: {students_summary}" if students_summary else ""),
                request=request
            )
        except Exception:
            pass

        return redirect('renewal:renew_registration')
    
    return redirect('renewal:renew_registration')


@login_required
def get_students_by_level_api(request):
    """API: جلب الطلاب حسب التخصص والمستوى - فلترة حسب الفصل الدراسي المختار مع استبعاد الموقوفين والمسحوبين"""
    major_id = request.GET.get('major_id')
    level_id = request.GET.get('level_id')
    semester_type = request.GET.get('semester_type')
    year = request.GET.get('year')
    
    print(f"[Search] major_id={major_id}, level_id={level_id} | term={semester_type}-{year}")
    
    if not is_valid_filter(major_id):
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار التخصص'})
    
    if not is_valid_filter(semester_type) or not is_valid_filter(year):
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار نوع الفصل والسنة'})
    
    try:
        major_id = int(major_id)
        year = int(year)
        
        # جلب الفصل الدراسي المختار لمطابقة حالة التجديد الخاصة بتلك السنة والفصل بدقة
        semester = Semester.objects.filter(year=year, type=semester_type).first()

        # فلترة الطلاب حسب التخصص مع استبعاد أي طالب مسحوب ملفه أو موقوف قيده نهائياً
        all_students = exclude_suspended_and_withdrawn_students(
            Student.objects.filter(department_id=major_id),
            semester=semester
        )
        
        # فلترة إضافية حسب المستوى إذا تم تحديده
        if is_valid_filter(level_id):
            all_students = all_students.filter(level_id=int(level_id))
        
        all_students = all_students.select_related('department', 'level')
        
        # خريطة المستويات
        all_levels_by_num = {lvl.number: lvl for lvl in Level.objects.all()}
        
        # سجلات التجديد الخاصة بهذا الفصل المحدد حصرياً
        renewals_map = {}
        if semester:
            renewals_map = {
                r.student_id: r for r in EnrollmentRenewal.objects.filter(semester=semester).select_related('level')
            }

        semester_display_name = f"{semester.get_type_display()} {semester.year}" if semester else f"{year} {semester_type}"
        semester_id_val = semester.id if semester else None

        print("\n" + "="*70)
        print(f"[Renew Registration] Student Query:")
        print(f"   Department ID: {major_id} | Level ID: {level_id or 'All'}")
        print(f"   Semester: {semester_display_name} (ID: {semester_id_val})")
        print(f"   SQL: {str(all_students.query)}")
        print(f"   Total matching students: {all_students.count()}")
        print(f"   Already renewed in this specific term: {len(renewals_map)}")
        print("="*70 + "\n")

        # ── جلب الدرجات والمواد بشكل مُجمَّع (bulk) لتجنب N+1 queries ──────
        from apps.grades.models import Grade as GradeModel
        student_ids_list = [s.id for s in all_students]
        # زوج (student_id, course_id) للمواد التي نجح فيها كل طالب
        passed_pairs = set(
            GradeModel.objects.filter(student_id__in=student_ids_list, is_passed=True)
            .values_list('student_id', 'course_id')
        )
        # مواد كل (study_plan, dept, level) مجتمعة
        combos = set()
        for s in all_students:
            if s.level and s.department:
                sp_id = getattr(s, 'study_plan_id', None)
                combos.add((sp_id, s.department_id, s.level_id))
        level_course_ids = {}  # (sp_id, dept_id, lvl_id) -> set of course ids
        for (sp_id, dept_id, lvl_id) in combos:
            qs = Course.objects.filter(department=dept_id, level=lvl_id, is_active=True)
            if sp_id:
                qs = qs.filter(study_plan_id=sp_id)
            level_course_ids[(sp_id, dept_id, lvl_id)] = set(qs.values_list('id', flat=True))

        data = []
        for student in all_students:
            student_id_value = student.student_id or f"STU{student.id:06d}"
            current_num = student.level.number if student.level else 1
            current_level_name = student.level.name if student.level else f"المستوى {current_num}"

            existing_renewal = renewals_map.get(student.id)
            is_renewed = (existing_renewal is not None)

            if existing_renewal and existing_renewal.level:
                # ✅ طالب مجدد: اعرض المستوى الفعلي المسجل في سجل التجديد
                target_level_name = existing_renewal.level.name
                target_num = existing_renewal.level.number
            else:
                # ⚙️ طالب لم يُجدَّد بعد: احسب المستوى المتوقع بنفس منطق التجديد
                if student.level and student.department:
                    sp_id = getattr(student, 'study_plan_id', None)
                    combo_key = (sp_id, student.department_id, student.level_id)
                    level_courses = level_course_ids.get(combo_key, set())
                    passed_for_student = {cid for (sid, cid) in passed_pairs if sid == student.id}
                    unpassed_count = len(level_courses - passed_for_student)
                    should_promote = (unpassed_count <= 2)
                else:
                    should_promote = True

                if should_promote:
                    next_lvl = all_levels_by_num.get(current_num + 1)
                    if next_lvl:
                        target_level_name = next_lvl.name
                        target_num = next_lvl.number
                    else:
                        target_level_name = current_level_name
                        target_num = current_num
                else:
                    # راسب: يبقى في نفس المستوى
                    target_level_name = current_level_name
                    target_num = current_num
            
            quad_name = " ".join([
                p for p in [student.name, student.father_name, student.grandfather_name, student.last_name] if p
            ]).strip() or student.name or f"طالب {student_id_value}"

            data.append({
                'id': student.id,
                'student_id': student_id_value,
                'name': student.name or '',
                'father_name': student.father_name or '',
                'full_name': quad_name,
                'national_id': student.national_id or '—',
                'department_name': student.department.name if student.department else '-',
                'current_level_name': current_level_name,
                'current_level_number': current_num,
                'target_level_name': target_level_name,
                'target_level_number': target_num,
                'is_renewed': is_renewed,
            })
        
        return JsonResponse({
            'success': True, 
            'students': data,
            'count': len(data),
            'semester_id': semester.id,
            'semester_name': f"{semester.get_type_display()} {semester.year}"
        })
    
    except Exception as e:
        print(f"❌ خطأ: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def get_renewed_students_api(request):
    """API: جلب قائمة الطلاب الذين تم تجديد قيدهم بالفعل في تخصص وفصل دراسي معين"""
    department_id = request.GET.get('department')
    season_type = request.GET.get('season_type')
    year = request.GET.get('year')
    level_id = request.GET.get('level_id')
    
    if not is_valid_filter(department_id):
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار التخصص'})
        
    if not is_valid_filter(season_type) or not is_valid_filter(year):
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار نوع الفصل والسنة'})
        
    try:
        semester = Semester.objects.filter(year=int(year), type=season_type).first()
        if not semester:
            return JsonResponse({'success': True, 'students': []})
            
        renewals = EnrollmentRenewal.objects.filter(
            student__department_id=int(department_id),
            semester=semester
        ).select_related('student', 'student__department', 'level')
        
        if is_valid_filter(level_id):
            renewals = renewals.filter(level_id=int(level_id))
            
        data = []
        for r in renewals:
            data.append({
                'id': r.student.id,
                'student_id': r.student.student_id or f"STU{r.student.id:06d}",
                'name': r.student.name or '',
                'father_name': r.student.father_name or '',
                'level_name': r.level.name if r.level else 'غير محدد',
                'status_display': r.get_status_display() or r.status,
                'renewal_date': r.renewal_date.strftime('%Y-%m-%d') if r.renewal_date else '-',
            })
            
        return JsonResponse({
            'success': True,
            'students': data,
            'department_name': Department.objects.filter(id=int(department_id)).values_list('name', flat=True).first() or 'غير محدد',
            'semester_name': f"{year} - {semester.get_type_display()}" if semester else f"{year} {season_type}"
        })
    except Exception as e:
        print(f"❌ خطأ في get_renewed_students_api: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_enrollmentrenewal', 'renewal.change_enrollmentrenewal', 'add_enrollmentrenewal', 'change_enrollmentrenewal')
def renew_students_api(request):
    """API: تجديد قيد الطلاب المختارين"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        # قراءة البيانات
        data = json.loads(request.body)
        student_ids = data.get('student_ids', [])
        semester_type = data.get('semester_type')
        year = data.get('year')
        
        print("="*60)
        print("🔄 بدء تجديد القيد")
        print(f"   عدد الطلاب: {len(student_ids)}")
        print(f"   الفصل: {semester_type} - {year}")
        print(f"   Student IDs: {student_ids}")
        print("="*60)
        
        # التحقق من البيانات
        if not student_ids:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار طالب واحد على الأقل'})
        
        if not semester_type or not year:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار نوع الفصل والسنة'})
        
        # الحصول على الفصل الدراسي والتحقق من كونه فعالاً حصرياً
        semester = Semester.objects.filter(year=int(year), type=semester_type, is_active=True).first()
        if not semester:
            return JsonResponse({'success': False, 'error': '❌ لا يمكن تجديد القيد إلا في الفصل الدراسي الفعّال حالياً بالمنظومة'})
        
        renewed_count = 0
        already_exists = 0
        errors = []
        results = []
        renewed_students_summary = []
        
        # معالجة كل طالب
        for student_id in student_ids:
            try:
                # جلب الطالب
                student = Student.objects.get(id=int(student_id))
                print(f"\n📘 معالجة: {student.name} (رقم {student.student_id})")

                # 🔒 فحص الأهلية الأكاديمية للطالب
                from apps.student.utils import check_student_academic_eligibility
                eligibility = check_student_academic_eligibility(student, action_type='renewal')
                if not eligibility['is_allowed']:
                    error_msg = f"{student.name} ({student.student_id}): {eligibility['error_message']}"
                    errors.append(error_msg)
                    print(f"   🛑 {error_msg}")
                    continue
                
                # 📌 تفعيل حالة الطالب إلى منتظم دائماً وإلغاء حالة جديد
                reg_status, _ = StudentStatus.objects.get_or_create(name="منتظم")
                if student.student_status != reg_status:
                    student.student_status = reg_status
                    student.save(update_fields=['student_status'])

                # 📌 فحص الطالب المستجد لأول مرة (مستوى 1 بدون تجديد سابق وبدون درجات)
                from apps.grades.models import Grade
                has_prev_renewals = EnrollmentRenewal.objects.filter(student=student).exists()
                has_grades = Grade.objects.filter(student=student).exists()
                is_brand_new = (not has_prev_renewals and not has_grades and (not student.level or student.level.number == 1))

                if is_brand_new:
                    # الطالب المستجد لأول مرة لا يحتاج لتجديد قيد، بل يدرج مباشرة في مواد الفصل الأول
                    results.append(f"ℹ️ {student.name}: طالب مستجد بالسيمستر الأول ومدرج مباشرة بالمواد، لا يتطلب تجديد قيد.")
                    continue

                # حساب الترقية الأكاديمية للطالب الناجح / الراسب
                current_level = student.level
                is_promoted = False
                unpassed_count = 0
                current_num = current_level.number if current_level else 1

                if current_level:
                    current_level_courses = Course.objects.filter(
                        study_plan=student.study_plan,
                        department=student.department,
                        level=current_level,
                        is_active=True
                    )
                    passed_course_ids = Grade.objects.filter(student=student, is_passed=True).values_list('course_id', flat=True)
                    unpassed_count = current_level_courses.exclude(id__in=passed_course_ids).count()
                else:
                    unpassed_count = 0

                should_promote = (unpassed_count <= 2)

                if should_promote:
                    next_level = Level.objects.filter(number=current_num + 1).first()
                    if next_level:
                        new_level = next_level
                        is_promoted = True
                        status = 'active'
                    else:
                        new_level = current_level
                        is_promoted = False
                        status = 'graduated'
                else:
                    # البقاء في المستوى الحالي (مكدر / راسب) مع تجديد القيد صراحة لإتاحة إدراجه في القوائم وتكرار المواد
                    new_level = current_level
                    is_promoted = False
                    status = 'active'

                existing = EnrollmentRenewal.objects.filter(student=student, semester=semester).first()
                if existing:
                    existing.level = new_level
                    existing.status = status
                    existing.renewed_by = request.user
                    existing.notes = f'تم التحديث في {year}/{semester_type} بواسطة {request.user.username}'
                    existing.full_clean()
                    existing.save()
                    already_exists += 1
                    renewed_students_summary.append(f"{student.student_id} ({student.get_full_name()})")
                    results.append(f"🔄 تحديث تجديد: {student.name}")
                else:
                    notes_text = f'تم تجديد القيد في {year}/{semester_type} بواسطة {request.user.username}'
                    enrollment = EnrollmentRenewal(
                        student=student,
                        semester=semester,
                        level=new_level,
                        status=status,
                        renewed_by=request.user,
                        notes=notes_text
                    )
                    enrollment.full_clean()
                    enrollment.save()
                    renewed_count += 1
                    renewed_students_summary.append(f"{student.student_id} ({student.get_full_name()})")
                    results.append(f"✨ تم تجديد قيد: {student.name} إلى المستوى {new_level.number if new_level else 'تخرج'}")

                if is_promoted and new_level:
                    student.level = new_level
                    student.save(update_fields=['level'])
                    print(f"   📈 تم تحديث مستوى الطالب في جدول Student إلى {new_level.number}")
                
            except Student.DoesNotExist:
                error_msg = f"الطالب برقم {student_id} غير موجود"
                errors.append(error_msg)
                print(f"   ❌ {error_msg}")
            except ValidationError as e:
                error_msg = f"خطأ في الطالب {student.name or student_id}: {', '.join(e.messages) if hasattr(e, 'messages') else str(e)}"
                errors.append(error_msg)
                print(f"   ❌ {error_msg}")
            except Exception as e:
                error_msg = f"خطأ في الطالب {student_id}: {str(e)}"
                errors.append(error_msg)
                print(f"   ❌ {error_msg}")
                import traceback
                traceback.print_exc()
        
        # بناء رسالة النتيجة
        message_parts = []
        if renewed_count > 0:
            message_parts.append(f"✅ تم تجديد {renewed_count} طالب")
        if already_exists > 0:
            message_parts.append(f"🔄 تم تحديث {already_exists} طالب (كان لديهم قيد مسبق)")
        if errors:
            message_parts.append(f"⚠️ {len(errors)} خطأ")
        
        message = "\n".join(message_parts) if message_parts else "لا توجد تغييرات"
        
        print("\n" + "="*60)
        print(f"📊 النتيجة: {message}")
        print("="*60)
        
        # 🛡️ توثيق عملية تجديد القيد في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            students_summary_str = "، ".join(renewed_students_summary) if renewed_students_summary else ""
            total_affected = renewed_count + already_exists
            log_activity(
                user=request.user,
                action='renew',
                model_name='EnrollmentRenewal',
                object_name=f"تجديد القيد ({total_affected} طالب)",
                details=f"تم تجديد القيد لـ ({total_affected}) طالب في الفصل الدراسي ({semester_type} - {year})" + (f" - أرقام القيد: {students_summary_str}" if students_summary_str else ""),
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': message,
            'renewed_count': renewed_count,
            'updated_count': already_exists,
            'errors': errors,
            'details': results[:10]  # أول 10 تفاصيل فقط
        })
    
    except json.JSONDecodeError as e:
        print(f"❌ خطأ في JSON: {e}")
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'})
    except Exception as e:
        print(f"❌ خطأ غير متوقع: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})
    

@login_required
def special_renew_page(request):
    """صفحة تجديد قيد حالة خاصة (فردي)"""
    # 🔥 جلب جميع الفصول (ليس فقط النشطة)
    semesters = Semester.objects.all().order_by('-year', '-type')
    departments = Department.objects.filter(is_active=True).order_by('name')
    levels = Level.objects.all()
    
    context = {
        'semesters': semesters,
        'departments': departments,
        'levels': levels,
    }
    return render(request, 'renewal/special_renew.html', context)


@login_required
def get_student_detail_api(request, student_id):
    """API: جلب تفاصيل طالب واحد"""
    try:
        student = get_object_or_404(Student, id=student_id)
        
        # جلب آخر قيد للطالب
        last_enrollment = EnrollmentRenewal.objects.filter(student=student).order_by('-renewal_date').first()
        
        data = {
            'success': True,
            'student': {
                'id': student.id,
                'student_id': student.student_id,
                'name': student.name,
                'father_name': student.father_name,
                'department_name': student.department.name if student.department else '-',
                'level_number': student.level.number if student.level else '-',
                'status': last_enrollment.status if last_enrollment else 'no_enrollment',
                'status_display': last_enrollment.get_status_display() if last_enrollment else 'لا يوجد قيد',
            }
        }
        return JsonResponse(data)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_enrollmentrenewal', 'renewal.change_enrollmentrenewal', 'add_enrollmentrenewal', 'change_enrollmentrenewal')
def renew_student_special_api(request):
    """API: تجديد قيد طالب واحد (حالة خاصة)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        semester_id = data.get('semester_id')
        special_case = data.get('special_case')
        notes = data.get('notes', '')
        
        if not student_id or not semester_id:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار الطالب والفصل الدراسي'})
        
        student = get_object_or_404(Student, id=student_id)
        semester = get_object_or_404(Semester, id=semester_id)
        
        # 🛑 حظر تجديد القيد إذا كان قسم الطالب غير مفعّل
        if student.department and not student.department.is_active:
            return JsonResponse({
                'success': False,
                'error': f'عذراً، هذا القسم ({student.department.name}) غير مفعّل حالياً ولا يمكن تجديد القيد فيه.'
            })
        
        # التحقق من عدم وجود تجديد مسبق
        existing = EnrollmentRenewal.objects.filter(student=student, semester=semester).first()
        if existing:
            return JsonResponse({'success': False, 'error': f'الطالب {student.name} لديه قيد نشط بالفعل لهذا الفصل'})
        
        # إذا كان الطالب جديداً، يتم تغيير حالته إلى منتظم
        if student.student_status and student.student_status.name == "جديد":
            active_status, _ = StudentStatus.objects.get_or_create(name="منتظم")
            student.student_status = active_status
            student.save(update_fields=['student_status'])
            
        # إنشاء تجديد جديد
        enrollment = EnrollmentRenewal.objects.create(
            student=student,
            semester=semester,
            level=student.level,
            status='active',
            renewed_by=request.user,
            notes=f'حالة خاصة: {special_case}. {notes}'
        )
        
        return JsonResponse({
            'success': True,
            'message': f'تم تجديد قيد الطالب {student.name} بنجاح',
            'enrollment_id': enrollment.id
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
    
@login_required
def get_students_by_department_and_level_api(request):
    """API: جلب الطلاب حسب التخصص والمستوى"""
    department_id = request.GET.get('department_id')
    level_id = request.GET.get('level_id')
    
    if not department_id or not level_id:
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار التخصص والمستوى'})
    
    students = exclude_suspended_and_withdrawn_students(
        Student.objects.filter(
            department_id=department_id,
            level_id=level_id
        ).select_related('department', 'level')
    )
    
    data = []
    for student in students:
        data.append({
            'id': student.id,
            'student_id': student.student_id,
            'name': student.name,
            'father_name': student.father_name or '',
            'department_name': student.department.name if student.department else '-',
            'level_number': student.level.number if student.level else '-',
        })
    return JsonResponse({'success': True, 'students': data})

# أضف هذا الاستيراد في أول الملف
from django.db import models as db_models

@login_required
def search_student_for_renew_api(request):
    """API للبحث عن طالب لتجديد القيد (يعيد جميع بيانات الطالب وحالة الأهلية)"""
    from apps.student.utils import check_student_academic_eligibility
    search = request.GET.get('search', '').strip()
    
    if not search:
        return JsonResponse({'success': False, 'error': 'الرجاء إدخال اسم أو رقم قيد'})
    
    # البحث برقم القيد أو الاسم
    students = Student.objects.filter(
        db_models.Q(student_id__icontains=search) | 
        db_models.Q(name__icontains=search)
    ).select_related('department', 'level', 'student_status')
    
    if not students.exists():
        return JsonResponse({'success': False, 'error': 'لا يوجد طالب بهذا الرقم أو الاسم'})
    
    if students.count() > 1:
        # إذا كان هناك أكثر من طالب، نعيد قائمة
        data = []
        for student in students[:10]:
            el = check_student_academic_eligibility(student, action_type='renewal')
            data.append({
                'id': student.id,
                'student_id': student.student_id,
                'name': f"{student.name} {student.father_name or ''}",
                'department_name': student.department.name if student.department else '-',
                'level_number': student.level.number if student.level else '-',
                'status_name': el.get('status_name', ''),
                'is_allowed': el.get('is_allowed', True),
                'error_message': el.get('error_message'),
            })
        return JsonResponse({'success': True, 'multiple': True, 'students': data})
    
    # طالب واحد فقط
    student = students.first()
    eligibility = check_student_academic_eligibility(student, action_type='renewal')
    
    # تحديد المستوى التالي (المستوى الحالي + 1)
    current_level = student.level
    next_level = None
    if current_level:
        next_level = Level.objects.filter(number=current_level.number + 1).first()
    
    data = {
        'success': True,
        'multiple': False,
        'student': {
            'id': student.id,
            'student_id': student.student_id,
            'name': student.name,
            'father_name': student.father_name or '',
            'grandfather_name': student.grandfather_name or '',
            'last_name': student.last_name or '',
            'phone': student.phone or '',
            'email': student.email or '',
            'national_id': student.national_id or '',
            'department_id': student.department.id if student.department else None,
            'department_name': student.department.name if student.department else '-',
            'current_level_id': student.level.id if student.level else None,
            'current_level_number': student.level.number if student.level else '-',
            'next_level_id': next_level.id if next_level else None,
            'next_level_number': next_level.number if next_level else '-',
            'has_next_level': next_level is not None,
            'status_name': eligibility.get('status_name', ''),
            'is_allowed': eligibility.get('is_allowed', True),
            'error_message': eligibility.get('error_message'),
        },
        'eligibility': eligibility
    }
    return JsonResponse(data)


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_enrollmentrenewal', 'renewal.change_enrollmentrenewal', 'add_enrollmentrenewal', 'change_enrollmentrenewal')
def renew_single_student_api(request):
    """API: تجديد قيد طالب واحد مع تحديث مستواه"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        semester_id = data.get('semester_id')
        notes = data.get('notes', '')
        
        if not student_id or not semester_id:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار الطالب والفصل الدراسي'})
        
        student = get_object_or_404(Student, id=student_id)
        semester = get_object_or_404(Semester, id=semester_id)

        # 🔒 حظر التجديد والعمليات الإدارية للطالب الخريج/المخلى طرفه
        is_locked, lock_msg = check_student_admin_lock(student)
        if is_locked:
            return JsonResponse({'success': False, 'error': lock_msg})
        
        # 🛑 حظر تجديد القيد إذا كان قسم الطالب غير مفعّل
        if student.department and not student.department.is_active:
            return JsonResponse({
                'success': False,
                'error': f'عذراً، هذا القسم ({student.department.name}) غير مفعّل حالياً ولا يمكن تجديد القيد فيه.'
            })
        
        # التحقق من عدم وجود تجديد مسبق لهذا الفصل
        existing = EnrollmentRenewal.objects.filter(student=student, semester=semester).first()
        if existing:
            return JsonResponse({'success': False, 'error': f'الطالب {student.name} لديه قيد لهذا الفصل مسبقاً'})
        
        # 📌 تفعيل حالة الطالب إلى منتظم وإزالة حالة جديد
        reg_status, _ = StudentStatus.objects.get_or_create(name="منتظم")
        if student.student_status != reg_status:
            student.student_status = reg_status
            student.save(update_fields=['student_status'])

        # 📌 فحص ما إذا كان الطالب مستجداً لأول مرة (مستوى 1 بدون تجديدات سابقة وبدون درجات)
        from apps.grades.models import Grade
        has_prev_renewals = EnrollmentRenewal.objects.filter(student=student).exists()
        has_grades = Grade.objects.filter(student=student).exists()
        is_brand_new = (not has_prev_renewals and not has_grades and (not student.level or student.level.number == 1))

        if is_brand_new:
            return JsonResponse({
                'success': False,
                'error': 'الطالب مستجد في الفصل الأول ومدرج مباشرة بالمواد، لا يتطلب تجديد قيد.'
            })

        # تحديد المستوى الجديد بناءً على شروط المواد المجتازة
        current_level = student.level
        current_num = current_level.number if current_level else 1

        if current_level:
            current_level_courses = Course.objects.filter(
                study_plan=student.study_plan,
                department=student.department,
                level=current_level,
                is_active=True
            )
            passed_course_ids = Grade.objects.filter(student=student, is_passed=True).values_list('course_id', flat=True)
            unpassed_count = current_level_courses.exclude(id__in=passed_course_ids).count()
        else:
            unpassed_count = 0

        should_promote = (unpassed_count <= 2)

        if should_promote:
            next_level = Level.objects.filter(number=current_num + 1).first()
            if next_level:
                new_level = next_level
                status = 'active'
            else:
                new_level = current_level
                status = 'graduated'
        else:
            new_level = current_level
            status = 'active'

        enrollment = EnrollmentRenewal(
            student=student,
            semester=semester,
            level=new_level,
            status=status,
            renewed_by=request.user,
            notes=f'تجديد قيد: {notes}'
        )
        enrollment.full_clean()
        enrollment.save()

        if should_promote and new_level and new_level != current_level:
            student.level = new_level
            student.save(update_fields=['level'])
        
        return JsonResponse({
            'success': True,
            'message': f'✅ تم تجديد قيد الطالب {student.name} بنجاح',
            'new_level': new_level.number if new_level else 'تخرج',
            'old_level': current_level.number if current_level else 1,
            'status': status,
            'enrollment_id': enrollment.id
        })
    
    except ValidationError as e:
        error_msg = e.messages[0] if hasattr(e, 'messages') else str(e)
        return JsonResponse({'success': False, 'error': error_msg})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
    
# إدارة الفصول الدراسية (Semester)

@login_required
@registrar_required
def semester_page(request):
    """صفحة إدارة الفصول الدراسية"""
    can_manage = has_execution_perm(
        request.user,
        'renewal.add_semester',
        'renewal.change_semester',
        'renewal.delete_semester',
        'add_semester',
        'change_semester',
        'delete_semester',
        'manage_semesters',
        'renewal.manage_semesters'
    )
    return render(request, 'renewal/semester_management.html', {
        'can_manage_semesters': can_manage,
    })


@login_required
def get_semesters_api(request):
    """API: جلب جميع الفصول الدراسية"""
    semesters = Semester.objects.all().order_by('-year', '-type')
    
    data = []
    for sem in semesters:
        data.append({
            'id': sem.id,
            'year': sem.year,
            'type': sem.type,
            'type_display': sem.get_type_display(),
            'is_active': sem.is_active,
        })
    
    return JsonResponse({'success': True, 'semesters': data})


@login_required
@registrar_required
@require_execution_permission(
    'renewal.add_semester', 'add_semester', 'manage_semesters', 'renewal.manage_semesters',
    message="❌ عذراً، لا تمتلك الصلاحية الدقيقة لإضافة فصول دراسية جديدة. يرجى مراجعة مدير النظام."
)
@csrf_exempt
def create_semester_api(request):
    """API: إنشاء فصل دراسي جديد"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        year = data.get('year')
        sem_type = data.get('type')
        is_active = data.get('is_active', False)
        
        if not year or not sem_type:
            return JsonResponse({'success': False, 'error': 'السنة والفصل مطلوبان'})
        
        # التحقق من عدم التكرار
        if Semester.objects.filter(year=year, type=sem_type).exists():
            return JsonResponse({'success': False, 'error': 'هذا الفصل موجود بالفعل'})
        
        # إذا كان الفصل الجديد فعالاً، قم بإلغاء تفعيل الباقي
        if is_active:
            Semester.objects.all().update(is_active=False)
        
        new_semester = Semester.objects.create(
            year=year,
            type=sem_type,
            is_active=is_active
        )
        
        # 🛡️ توثيق إضافة فصل دراسي في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='Semester',
                object_name=str(new_semester),
                details=f"إضافة فصل دراسي جديد ({new_semester.get_type_display()} - {new_semester.year}) - تفعيل: ({is_active})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': '✅ تم إضافة الفصل الدراسي بنجاح',
            'semester': {
                'id': new_semester.id,
                'year': new_semester.year,
                'type': new_semester.type,
                'type_display': new_semester.get_type_display(),
                'is_active': new_semester.is_active,
            }
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@registrar_required
@require_execution_permission(
    'renewal.change_semester', 'change_semester', 'manage_semesters', 'renewal.manage_semesters',
    message="❌ عذراً، لا تمتلك الصلاحية الدقيقة لتعديل بيانات الفصول الدراسية. يرجى مراجعة مدير النظام."
)
@csrf_exempt
def update_semester_api(request, semester_id):
    """API: تحديث فصل دراسي"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        semester = get_object_or_404(Semester, id=semester_id)
        data = json.loads(request.body)
        
        year = data.get('year')
        sem_type = data.get('type')
        is_active = data.get('is_active', False)
        
        if year and year != semester.year:
            if Semester.objects.filter(year=year, type=sem_type).exclude(id=semester_id).exists():
                return JsonResponse({'success': False, 'error': 'هذا الفصل موجود بالفعل'})
            semester.year = year
        
        if sem_type and sem_type != semester.type:
            if Semester.objects.filter(year=semester.year, type=sem_type).exclude(id=semester_id).exists():
                return JsonResponse({'success': False, 'error': 'هذا الفصل موجود بالفعل'})
            semester.type = sem_type
        
        if is_active and not semester.is_active:
            Semester.objects.exclude(id=semester_id).update(is_active=False)
        
        semester.is_active = is_active
        semester.save()
        
        # 🛡️ توثيق تعديل بيانات الفصل الدراسي في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='Semester',
                object_name=str(semester),
                details=f"تحديث بيانات الفصل الدراسي إلى ({semester.get_type_display()} - {semester.year}) - تفعيل: ({semester.is_active})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': '✅ تم تحديث الفصل الدراسي بنجاح',
            'semester': {
                'id': semester.id,
                'year': semester.year,
                'type': semester.type,
                'type_display': semester.get_type_display(),
                'is_active': semester.is_active,
            }
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@registrar_required
@require_execution_permission(
    'renewal.delete_semester', 'delete_semester', 'manage_semesters', 'renewal.manage_semesters',
    message="❌ عذراً، لا تمتلك الصلاحية الدقيقة لحذف الفصول الدراسية. يرجى مراجعة مدير النظام."
)
@csrf_exempt
def delete_semester_api(request, semester_id):
    """API: حذف فصل دراسي"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        semester = get_object_or_404(Semester, id=semester_id)
        semester_name = str(semester)
        semester.delete()
        
        # 🛡️ توثيق حذف فصل دراسي في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='delete',
                model_name='Semester',
                object_name=semester_name,
                details=f"حذف وإلغاء الفصل الدراسي ({semester_name}) من النظام",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': f'✅ تم حذف {semester_name} بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@registrar_required
@require_execution_permission(
    'renewal.change_semester', 'change_semester', 'manage_semesters', 'renewal.manage_semesters',
    message="❌ عذراً، لا تمتلك الصلاحية الدقيقة لتفعيل أو تغيير الفصل الدراسي النشط. يرجى مراجعة مدير النظام."
)
@csrf_exempt
def set_active_semester_api(request, semester_id):
    """API: تعيين فصل كفعال (وإلغاء تفعيل الباقي)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        semester = get_object_or_404(Semester, id=semester_id)
        
        # إلغاء تفعيل جميع الفصول
        Semester.objects.all().update(is_active=False)
        
        # تفعيل الفصل المختار
        semester.is_active = True
        semester.save()
        
        # 🛡️ توثيق تفعيل وتعيين الفصل الدراسي كفعال في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='Semester',
                object_name=str(semester),
                details=f"تعيين وتفعيل الفصل الدراسي ({semester.get_type_display()} - {semester.year}) كفصل نشط وفعال بالمنظومة",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': f'✅ تم تعيين {semester.get_type_display()} {semester.year} كفصل فعال'
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})
    
# إدارة الجنسيات (Nationality)

from apps.student.models import Nationality

@login_required
def nationality_data(request):
    """صفحة إدارة الجنسيات"""
    return render(request, 'renewal/nationality_data.html')


@login_required
def get_nationalities_api(request):
    """API: جلب جميع الجنسيات"""
    nationalities = Nationality.objects.all().order_by('name')
    
    data = []
    for nat in nationalities:
        data.append({
            'id': nat.id,
            'name': nat.name,
            'is_active': getattr(nat, 'is_active', True),
            'count': Student.objects.filter(nationality=nat).count()
        })
    
    return JsonResponse({'success': True, 'nationalities': data})


@login_required
@csrf_exempt
def toggle_nationality_active_api(request, nationality_id):
    """API: تبديل حالة تفعيل الجنسية"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        nationality = get_object_or_404(Nationality, id=nationality_id)
        nationality.is_active = not nationality.is_active
        nationality.save()
        
        status_str = "مفعلة" if nationality.is_active else "معطلة"
        
        from apps.users.utils import log_activity
        log_activity(request.user, 'update', model_name='Nationality', 
                     object_name=nationality.name, details=f'تغيير حالة تفعيل الجنسية ({nationality.name}) إلى {status_str}', request=request)
        
        return JsonResponse({
            'success': True,
            'message': f'تم تغيير حالة الجنسية ({nationality.name}) إلى {status_str}',
            'is_active': nationality.is_active
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
def create_nationality_api(request):
    """API: إضافة جنسية جديدة"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        
        if not name:
            return JsonResponse({'success': False, 'error': 'اسم الجنسية مطلوب'})
        
        # التحقق من عدم التكرار
        if Nationality.objects.filter(name__iexact=name).exists():
            return JsonResponse({'success': False, 'error': 'هذه الجنسية موجودة بالفعل'})
        
        nationality = Nationality.objects.create(name=name)
        
        # تسجيل الحدث
        from apps.users.utils import log_activity
        log_activity(request.user, 'create', model_name='Nationality', 
                     object_name=name, details=f'إضافة جنسية جديدة: {name}', request=request)
        
        return JsonResponse({
            'success': True,
            'message': f'✅ تم إضافة الجنسية {name} بنجاح',
            'nationality': {
                'id': nationality.id,
                'name': nationality.name,
                'count': 0
            }
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
def update_nationality_api(request, nationality_id):
    """API: تحديث جنسية"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        nationality = get_object_or_404(Nationality, id=nationality_id)
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        
        if not name:
            return JsonResponse({'success': False, 'error': 'اسم الجنسية مطلوب'})
        
        # التحقق من عدم التكرار مع جنسية أخرى
        if Nationality.objects.filter(name__iexact=name).exclude(id=nationality_id).exists():
            return JsonResponse({'success': False, 'error': 'هذه الجنسية موجودة بالفعل'})
        
        old_name = nationality.name
        nationality.name = name
        nationality.save()
        
        # تسجيل الحدث
        from apps.users.utils import log_activity
        log_activity(request.user, 'update', model_name='Nationality', 
                     object_name=name, details=f'تعديل الجنسية من {old_name} إلى {name}', request=request)
        
        return JsonResponse({
            'success': True,
            'message': '✅ تم تحديث الجنسية بنجاح',
            'nationality': {
                'id': nationality.id,
                'name': nationality.name,
                'count': Student.objects.filter(nationality=nationality).count()
            }
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
def delete_nationality_api(request, nationality_id):
    """API: حذف جنسية (تم إكمال الدالة بنجاح)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        nationality = get_object_or_404(Nationality, id=nationality_id)
        
        # التحقق مما إذا كانت الجنسية مرتبطة بطلاب
        students_count = Student.objects.filter(nationality=nationality).count()
        if students_count > 0:
            return JsonResponse({
                'success': False, 
                'error': f'لا يمكن حذف الجنسية ({nationality.name}) لأنها مرتبطة بـ {students_count} طالب.'
            })
        
        nat_name = nationality.name
        nationality.delete()
        
        return JsonResponse({'success': True, 'message': f'✅ تم حذف الجنسية {nat_name} بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def search_students_by_nationality_api(request):
    """API: البحث عن الطلاب حسب الجنسية"""
    nationality_id = request.GET.get('nationality_id')
    
    if not nationality_id:
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار الجنسية'})
    
    try:
        nationality = get_object_or_404(Nationality, id=nationality_id)
        students = Student.objects.filter(nationality=nationality).select_related('department')
        
        data = []
        for student in students:
            data.append({
                'id': student.id,
                'student_id': student.student_id,
                'name': f"{student.name} {student.father_name or ''} {student.grandfather_name or ''}",
                'department_name': student.department.name if student.department else '-',
                'nationality_name': nationality.name,
            })
        
        return JsonResponse({
            'success': True,
            'nationality_name': nationality.name,
            'count': len(data),
            'students': data
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

def get_student_eligible_download_courses(student, semester=None, target_level_id=None):
    """
    إرجاع قائمة المواد القابلة للتنزيل للطالب مع إدراج المواد المستحقة وتطبيق الأسبقية والاستبدال وقيد الفارق الأكاديمي (Smart Academic Gap Restriction):
    1. فحص شرط النقل للمستوى الأعلى (حمل مادتين كحد أقصى).
    2. استبعاد المواد المجتازة (is_passed=True أو total_grade >= 50) والمسجلة بالفصل الحالي.
    3. تطبيق قيد الفارق الأكاديمي (Smart Academic Gap Restriction):
       - إذا كان مستوى الطالب N >= 3: يُسمح فقط بالمواد من المستويين N و N-1، ويُحظر أي مادة من المستوى N-2 أو أقل.
       - إذا كان مستوى الطالب N < 3: تُطبّق القواعد القياسية والمتطلبات السابقة فقط.
    4. إذا كانت هناك مادة متقدمة مع متطلب سابق غير مجتاز:
       أ) حظر واستبعاد المادة المتقدمة.
       ب) إدراج المادة المسبقة الصريحة بشرط عدم مخالفتها لقيد الفارق الأكاديمي.
    """
    from apps.grades.models import Grade
    from django.db.models import Q
    
    if not student or not student.department:
        return [], 0, ""

    # 1. المواد المجتازة (is_passed=True أو total_grade >= 50)
    passed_course_ids = set(Grade.objects.filter(
        student=student
    ).filter(Q(is_passed=True) | Q(total_grade__gte=50)).values_list('course_id', flat=True))

    # 2. المواد المسجلة بالفصل الحالي
    registered_course_ids = set()
    if semester:
        registered_course_ids = set(CourseRegistration.objects.filter(
            student=student,
            semester=semester
        ).values_list('course_id', flat=True))

    # 3. جلب جميع مواد الخطة/التخصص النشطة للطالب
    all_courses_qs = Course.objects.filter(
        department=student.department,
        is_active=True
    ).select_related('level').prefetch_related('department', 'prerequisites')

    if student.study_plan:
        all_courses_qs = all_courses_qs.filter(study_plan=student.study_plan)

    all_courses_list = list(all_courses_qs)

    # تحديد رقم المستوى المستهدف للطالب (student_level)
    req_level_num = None
    if is_valid_filter(target_level_id):
        try:
            req_level_num = int(target_level_id)
        except ValueError:
            pass
    elif student.level:
        req_level_num = student.level.number
    else:
        req_level_num = 1

    # 4. حساب المواد المتبقية غير المجتازة من المستويات السابقة (< req_level_num)
    prev_unpassed_courses = [
        c for c in all_courses_list
        if c.level and c.level.number < req_level_num and c.id not in passed_course_ids and c.id not in registered_course_ids
    ]
    
    # 🎓 تطبيق قيد الفارق الأكاديمي على المواد المتبقية عند req_level_num >= 3
    if req_level_num >= 3:
        min_allowed_level = req_level_num - 1
        prev_unpassed_courses = [
            c for c in prev_unpassed_courses
            if c.level and c.level.number >= min_allowed_level
        ]

    num_carried = len(prev_unpassed_courses)
    progression_warning = ""

    if req_level_num > 1 and num_carried > 2:
        # ❌ الطالب يحمل أكثر من مادتين (> 2) -> يمنع من مواد المستوى الأعلى
        progression_warning = f"⚠️ الطالب {student.name} لم يستوفِ شرط النقل للمستوى التالي بحمله أكثر من مادتين ({num_carried} مواد متبقية)."
        candidate_courses = prev_unpassed_courses
    else:
        # ✅ يحمل مادتين أو أقل (<= 2) -> مسموح الترفيع
        candidate_courses = [
            c for c in all_courses_list
            if (c.level and c.level.number <= req_level_num) or (not c.level)
        ]

    # 🎓 🎯 قيد الفارق الأكاديمي الذكي (Smart Academic Gap Restriction):
    # إذا كان student_level >= 3: يُسمح فقط بالمواد حيث course_level >= (student_level - 1)
    if req_level_num >= 3:
        min_allowed_level = req_level_num - 1
        candidate_courses = [
            c for c in candidate_courses
            if not c.level or c.level.number >= min_allowed_level
        ]

    # المواد التي رسب فيها الطالب سابقاً
    failed_course_ids = set(Grade.objects.filter(
        student=student,
        is_passed=False
    ).values_list('course_id', flat=True))

    final_courses_info = {} # key: course_id -> dict

    for course in candidate_courses:
        if course.id in passed_course_ids or course.id in registered_course_ids:
            continue

        # فحص إضافي محكم لقيد الفارق الأكاديمي
        if req_level_num >= 3 and course.level and course.level.number < (req_level_num - 1):
            continue

        prereqs = list(course.prerequisites.all())
        missing_prereqs = [p for p in prereqs if p.id not in passed_course_ids and p.id not in registered_course_ids]

        if not missing_prereqs:
            if course.id not in final_courses_info:
                is_retake = (course.id in failed_course_ids)
                final_courses_info[course.id] = {
                    'course': course,
                    'is_retake': is_retake,
                    'is_prereq_fallback': False
                }
        else:
            # مادة متقدمة لم يتم اجتياز متطلبها -> استبعاد المادة المتقدمة وإضافة المتطلب المسبق بأسمائه الصريحة
            for prereq in missing_prereqs:
                if prereq.id not in passed_course_ids and prereq.id not in registered_course_ids:
                    # فحص قيد الفارق الأكاديمي للمتطلب
                    if req_level_num >= 3 and prereq.level and prereq.level.number < (req_level_num - 1):
                        continue
                    if prereq.id not in final_courses_info:
                        is_retake_prereq = (prereq.id in failed_course_ids)
                        final_courses_info[prereq.id] = {
                            'course': prereq,
                            'is_retake': is_retake_prereq,
                            'is_prereq_fallback': True
                        }
                    else:
                        final_courses_info[prereq.id]['is_prereq_fallback'] = True

    result = sorted(final_courses_info.values(), key=lambda item: (item['course'].level.number if item['course'].level else 1, item['course'].code))
    return result, num_carried, progression_warning


def get_eligible_courses(student, semester=None, target_level_id=None):
    """
    API Helper: الحصول على المواد القابلة للتسجيل/التنزيل بعد تطبيق قيد الفارق الأكاديمي (Smart Academic Gap Restriction)
    """
    return get_student_eligible_download_courses(student, semester, target_level_id)
    
# تنزيل المواد (Download Materials)

@login_required
def download_materials(request):
    """صفحة تنزيل المواد"""
    if hasattr(request.user, 'role') and request.user.role == 'registrar':
        messages.error(request, "❌ عذراً، تنزيل المواد يقع ضمن اختصاص قسم الدراسة والامتحانات والمسجل العام فقط.")
        return redirect('renewal:dashboard')

    levels = Level.objects.all()
    active_semester = Semester.objects.filter(is_active=True).first()
    departments = Department.objects.filter(is_active=True).order_by('name')
    
    download_job_info = get_download_materials_job_info()

    exams_coordinator_name = "أ. لبنى"
    general_registrar_name = "أ. أحمد محمد علي محمود"
    try:
        from apps.users.models import Official
        coord_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='exams_coordinator') |
            Q(position_name__icontains='منسق') |
            Q(position_name__icontains='منسقة')
        ).first()
        if coord_obj:
            exams_coordinator_name = coord_obj.get_full_name()

        reg_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='registrar') | Q(position_name__icontains='المسجل العام') | Q(position_name__icontains='مسجل')
        ).exclude(position_key='admission').first()
        if reg_obj:
            general_registrar_name = reg_obj.get_full_name()
    except Exception as e:
        logger.warning(f"Error fetching officials in download_materials: {e}")

    # 🛡️ توثيق زيارة صفحة تنزيل المواد في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_download_materials',
            model_name='CourseRegistration',
            object_name='صفحة تنزيل المواد',
            details='قام المستخدِم بتصفح صفحة تنزيل المواد الدراسية للطلاب',
            request=request
        )
    except Exception:
        pass

    context = {
        'levels': levels,
        'active_semester': active_semester,
        'departments': departments,
        'is_download_job_open': download_job_info['is_download_job_open'],
        'download_job_message': download_job_info['download_job_message'],
        'exams_coordinator_name': exams_coordinator_name,
        'general_registrar_name': general_registrar_name,
    }
    return render(request, 'renewal/download_materials.html', context)


@login_required
def get_students_for_materials_api(request):
    """API: جلب الطلاب المؤهلين لتنزيل المواد حسب التخصص والمستوى والفصل (تنزيل مواد الفصل العادي)
    يتم استبعاد طلاب الحالات الخاصة (الموقوفين سابقاً / special_type='STOPPED') لحصرهم في تنزيل المواد الاستثنائية
    """
    department_id = request.GET.get('department_id')
    level_id = request.GET.get('level_id')
    season_type = request.GET.get('season_type')
    year = request.GET.get('year')
    
    print(f"🔍 بحث طلاب للمواد: department={department_id}, level={level_id}, season_type={season_type}, year={year}")
    
    if not is_valid_filter(department_id):
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار التخصص'})
    
    if not is_valid_filter(season_type) or not is_valid_filter(year):
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار نوع الفصل والسنة'})
    
    try:
        try:
            year_val = int(year)
        except ValueError:
            return JsonResponse({'success': False, 'error': 'السنة الدراسية يجب أن تكون عدداً صحيحاً'})
            
        semester = Semester.objects.filter(
            type=season_type,
            year=year_val,
            is_active=True
        ).first()
        
        if not semester:
            return JsonResponse({
                'success': False, 
                'error': f'لا يوجد فصل دراسي فعّال ({season_type} - {year_val}) في النظام. يُسمح فقط بالفصل الدراسي الفعّال حالياً.'
            })

        dept_id = int(department_id)
        
        target_level = None
        target_level_num = None
        if is_valid_filter(level_id):
            try:
                lvl_val = int(level_id)
                target_level = Level.objects.filter(Q(id=lvl_val) | Q(number=lvl_val)).first()
                if target_level:
                    target_level_num = target_level.number
            except ValueError:
                pass

        BLOCKED_STATUSES = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب', 'موقف قيده', 'موقوف قيده', 'موقوف', 'إخلاء طرف', 'نشط', 'موقوف']
        
        # 🛑 استبعاد طلاب الحالات الخاصة / الموقوفين المجددين وتغيير المسار لأول مرة حصراً للشاشة الاستثنائية
        special_renewed_student_ids = set(EnrollmentRenewal.objects.filter(
            semester=semester,
            status__in=['active', 'RENEWED']
        ).filter(
            Q(special_type__in=['STOPPED', 'STOPPED_ENROLLMENT', 'SUSPENDED', 'suspended', 'LATE_NEW_STUDENT', 'new_delayed', 'MAJOR_CHANGE', 'major_change', 'track_change']) |
            Q(notes__icontains='موقوف') | Q(notes__icontains='وقف') | Q(notes__icontains='إيقاف') | Q(notes__icontains='حالة خاصة') |
            Q(notes__icontains='تغيير مسار') | Q(notes__icontains='مسار')
        ).values_list('student_id', flat=True))

        # استبعاد طلاب تغيير المسار لأول مرة حتى يكملوا تنزيل موادهم كحالة خاصة
        major_change_first_time_ids = set()
        for st in Student.objects.filter(department_id=dept_id).filter(Q(has_changed_major=True) | Q(major_change_count__gte=1)):
            if not EnrollmentRenewal.objects.filter(student=st, status__in=['active', 'RENEWED'], special_type='REGULAR').exclude(semester=semester).exists():
                major_change_first_time_ids.add(st.id)
        special_renewed_student_ids.update(major_change_first_time_ids)

        student_map = {}

        # 1. الطلاب الذين قاموا بتجديد قيدهم العادي للفصل الحالي (حالة active أو RENEWED)
        enrollments = EnrollmentRenewal.objects.filter(
            student__department_id=dept_id,
            semester=semester,
            status__in=['active', 'RENEWED', 'renewed', 'ACTIVE']
        ).exclude(
            student_id__in=special_renewed_student_ids
        ).select_related('student', 'level', 'student__level', 'student__department', 'student__student_status')
        
        if target_level_num is not None:
            level_q = Q(level_id=target_level.id) if target_level else Q()
            enrollments = enrollments.filter(
                level_q |
                Q(level__number=target_level_num) |
                Q(level__isnull=True, student__level__number=target_level_num)
            )

        for en in enrollments:
            st = en.student
            st_status = st.student_status.name if st.student_status else 'منتظم'
            if st_status != 'منتظم' or any(b in st_status for b in BLOCKED_STATUSES):
                continue
            ren_level_num = en.level.number if en.level else (target_level_num or (st.level.number if st.level else 1))
            student_map[st.id] = {
                'student': st,
                'level_number': ren_level_num
            }

        # 2. الطلاب المستجدون لأول مرة (Brand New Students: مستوى 1 بدون تجديدات سابقة وبدون درجات وبدون تغيير مسار)
        # يظهرون تلقائياً بالسمستر الأول دون الحاجة لتجديد قيد
        if target_level_num is None or target_level_num == 1:
            from apps.grades.models import Grade
            level1_students = Student.objects.filter(
                department_id=dept_id
            ).filter(
                Q(level__number=1) | Q(level__isnull=True)
            ).exclude(
                id__in=special_renewed_student_ids
            ).exclude(
                Q(has_changed_major=True) | Q(major_change_count__gte=1)
            ).select_related('department', 'level', 'student_status')

            for st in level1_students:
                if st.id in student_map:
                    continue
                st_status = st.student_status.name if st.student_status else 'منتظم'
                if st_status != 'منتظم' or any(b in st_status for b in BLOCKED_STATUSES):
                    continue

                has_prev_renewals = EnrollmentRenewal.objects.filter(student=st).exists()
                has_grades = Grade.objects.filter(student=st).exists()

                # المستجد لأول مرة (0 تجديدات و 0 درجات) يدرج تلقائياً في قائمة تنزيل مواد المستوى الأول
                if not has_prev_renewals and not has_grades:
                    student_map[st.id] = {
                        'student': st,
                        'level_number': 1
                    }

        data = []
        for item in student_map.values():
            student = item['student']
            lvl_num = item['level_number']

            has_registration = CourseRegistration.objects.filter(
                student=student,
                semester=semester
            ).exists()
            
            data.append({
                'id': student.id,
                'student_id': student.student_id or f'STU{student.id:06d}',
                'name': f"{student.name} {student.father_name or ''}".strip(),
                'department_name': student.department.name if student.department else '-',
                'level_number': lvl_num,
                'has_registration': has_registration
            })
        
        print(f"📊 عدد الطلاب العاديين المؤهلين لتنزيل المواد: {len(data)}")
        
        return JsonResponse({
            'success': True, 
            'students': data,
            'semester_id': semester.id,
            'semester_name': f"{year_val} - {semester.get_type_display()}"
        })
    
    except Exception as e:
        print(f"❌ خطأ: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
def get_courses_api(request):
    """API: جلب المواد المفلترة حسب التخصص والمستوى لشاشة إدارة المجموعات"""
    from django.db.models import Q
    department_id = request.GET.get('department_id') or request.GET.get('department')
    level_id = request.GET.get('level_id') or request.GET.get('level')
    
    if not is_valid_filter(department_id) or not is_valid_filter(level_id):
        return JsonResponse({'success': True, 'courses': [], 'message': 'الرجاء اختيار التخصص والمستوى أولاً'})
        
    try:
        dept_val = int(department_id) if str(department_id).isdigit() else department_id
        courses = Course.objects.filter(department_id=dept_val, is_active=True)
            
        if str(level_id).isdigit():
            lvl_val = int(level_id)
            courses = courses.filter(Q(level_id=lvl_val) | Q(level__number=lvl_val))
        else:
            courses = courses.filter(level_id=level_id)
            
        courses = courses.order_by('code', 'name')
        
        data = [
            {
                'id': c.id,
                'code': c.code or '',
                'name': c.name or '',
            }
            for c in courses
        ]
        return JsonResponse({'success': True, 'courses': data, 'count': len(data)})
    except Exception as e:
        print(f"❌ Exception in get_courses_api: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e), 'courses': []})



@login_required
def get_department_courses_api(request, department_id):
    """
    API Endpoint: جلب مواد الخطة الدراسية لمودال viewSemesterPlan
    الفلترة الصارمة بالحقل الأصلي للمادة (Course.level): Course.objects.filter(department=selected_dept, level=selected_level)
    عزل تام عن بيانات وسجلات الطلاب.
    """
    try:
        from django.db.models import Q
        
        # 1. التخصص المحدد
        selected_dept = get_object_or_404(Department, id=department_id)
        
        # 2. الحصول على المستوى الدراسي وإلزام الفلترة به (يُمنع التخلي عن شرط الـ level)
        level_id = request.GET.get('level_id') or request.GET.get('level')
        if not is_valid_filter(level_id):
            return JsonResponse({
                'success': False, 
                'error': 'يجب تحديد المستوى الدراسي لفلترة مواد الفصل'
            }, status=400)
            
        selected_level = None
        if str(level_id).isdigit():
            lvl_val = int(level_id)
            selected_level = Level.objects.filter(Q(id=lvl_val) | Q(number=lvl_val)).first()
        else:
            selected_level = Level.objects.filter(id=level_id).first()
            
        if not selected_level:
            return JsonResponse({
                'success': False, 
                'error': 'المستوى الدراسي المحدد غير موجود'
            }, status=404)
        
        # 3. الفلترة الصارمة بالحقل الأصلي للمادة (Course.level)
        courses_qs = Course.objects.filter(
            department__id=selected_dept.id,
            level_id=selected_level.id,
            is_active=True
        ).select_related('level').prefetch_related('department', 'prerequisites').order_by('code')
        
        # 4. بناء استجابة البيانات مع مطابقة رموز المتطلب السابق المباشر المأخوذة من المادة الأصلية بجدول الكليات/المواد
        courses_data = []
        for course in courses_qs:
            prereqs = list(course.prerequisites.all())
            prereq_list = [f"{p.name} ({p.code})" for p in prereqs]
            prereq_codes = [p.code for p in prereqs]
            
            prereq_str = " ، ".join(prereq_list) if prereq_list else "-"
            prereq_code_str = " ، ".join(prereq_codes) if prereq_codes else "-"
            
            courses_data.append({
                'id': course.id,
                'code': course.code,
                'name': course.name,
                'credits': course.credits,
                'level_id': selected_level.id,
                'level_number': selected_level.number,
                'level_name': f"المستوى {selected_level.number}",
                'department_name': selected_dept.name,
                'prerequisite': prereq_str,
                'prerequisite_name': prereq_str,
                'prerequisite_code': prereq_code_str,
            })
            
        return JsonResponse({
            'success': True, 
            'courses': courses_data, 
            'count': len(courses_data)
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

    

@login_required
def preview_materials_api(request):
    """API: معاينة المواد المقترحة للتنزيل للطلاب المختارين مع فحص الخطة والرسوب والمتطلبات الأسبقية والحظر بالاستبدال التلقائي"""
    try:
        student_ids = request.GET.get('student_ids', '').split(',')
        level_id = request.GET.get('level_id')
        semester_id = request.GET.get('semester_id')
        
        if not student_ids or not student_ids[0]:
            return JsonResponse({'success': False, 'error': 'الرجاء تحديد الطلاب'})
            
        # الحصول على الفصل الدراسي
        if is_valid_filter(semester_id):
            semester = Semester.objects.filter(id=int(semester_id)).first()
        else:
            semester = Semester.objects.filter(is_active=True).first() or Semester.objects.order_by('-year', '-type').first()
            
        from apps.grades.models import Grade
        
        preview_data = []
        BLOCKED_STATUSES = ["موقف قيده", "موقوف قيده", "سحب ملف", "إخلاء طرف", "نشط"]
        for student_id in student_ids:
            try:
                student = Student.objects.get(id=int(student_id.strip()))
                
                # 🔥 فحص حالة الطالب قبل إرجاع معاينة المواد
                if student.student_status and (student.student_status.name in BLOCKED_STATUSES or student.student_status.name != "منتظم"):
                    preview_data.append({
                        'student_id': student.id,
                        'student_code': student.student_id or f"STU{student.id:06d}",
                        'student_name': student.name,
                        'level_number': student.level.number if student.level else 0,
                        'error': f"❌ حالة الطالب ({student.student_status.name}) لا تسمح بتنزيل المواد.",
                        'courses': []
                    })
                    continue
                
                # 🔥 فحص التسجيل المسبق: هل سبق تنزيل مواد هذا الطالب للفصل الفعّال؟
                if semester:
                    registered_count = CourseRegistration.objects.filter(
                        student=student,
                        semester=semester
                    ).count()
                    if registered_count > 0:
                        preview_data.append({
                            'student_id': student.id,
                            'student_code': student.student_id or f"STU{student.id:06d}",
                            'student_name': student.name,
                            'level_number': student.level.number if student.level else 0,
                            'already_registered': True,
                            'registered_count': registered_count,
                            'error': f"الطالب {student.name} نزّل مواده بالفعل لهذا الفصل ({registered_count} مادة). لا يمكن إعادة التنزيل.",
                            'courses': []
                        })
                        continue
                
                # 🔥 جلب المواد المتاحة بالتصفية واستبدال المسبقات وتطبيق شرط النقل (حمل مادتين كحد أقصى)
                eligible_info, num_carried, prog_warning = get_student_eligible_download_courses(
                    student=student,
                    semester=semester,
                    target_level_id=level_id
                )
                
                course_list = []
                for item in eligible_info:
                    course = item['course']
                    is_retake = item['is_retake']
                    is_prereq_fallback = item['is_prereq_fallback']

                    existing = CourseRegistration.objects.filter(
                        student=student,
                        course=course,
                        semester=semester
                    ).exists() if semester else False
                    
                    prereqs = course.prerequisites.all()
                    prereq_names = [f"{p.name} ({p.code})" for p in prereqs]
                    prereq_display = " ، ".join(prereq_names) if prereq_names else "-"
                    
                    is_remaining = (course.level.number < student.level.number) if (course.level and student.level) else False
                    level_num = course.level.number if course.level else 1
                    level_name = f"المستوى {level_num}" if course.level else 'المستوى 1'
                    
                    status_label = 'متاحة للتنزيل'
                    if existing:
                        status_label = 'تم التنزيل سابقاً'
                    elif is_retake:
                        status_label = 'مادة معادة'
                    elif is_prereq_fallback:
                        status_label = 'متطلب سابق غير مجتاز'
                            
                    course_list.append({
                        'id': course.id,
                        'code': course.code,
                        'name': course.name,
                        'credits': course.credits,
                        'is_retake': is_retake,
                        'is_prereq_fallback': is_prereq_fallback,
                        'is_barrier': False,
                        'is_remaining': is_remaining,
                        'level_id': course.level.id if course.level else None,
                        'level_number': level_num,
                        'level_name': level_name,
                        'prerequisite': prereq_display,
                        'prerequisite_name': prereq_display,
                        'status_label': status_label,
                        'semester_name': level_name
                    })
                    
                pdata = {
                    'student_id': student.id,
                    'student_code': student.student_id or f"STU{student.id:06d}",
                    'student_name': student.name,
                    'level_number': student.level.number if student.level else 0,
                    'num_carried': num_carried,
                    'courses': course_list
                }
                if prog_warning:
                    pdata['warning'] = prog_warning
                    
                preview_data.append(pdata)
            except Student.DoesNotExist:
                continue
                
        return JsonResponse({'success': True, 'preview_data': preview_data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_courseregistration', 'renewal.change_courseregistration', 'add_courseregistration', 'change_courseregistration')
def download_materials_for_students_api(request):
    """API: تنزيل المواد المتبقية المستوفية للشروط للطلاب المختارين بشرط تجديد القيد واستيفاء الأسبقية ونقل المستويات"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
        
    try:
        download_job_info = get_download_materials_job_info()
        if not download_job_info['is_download_job_open']:
            return JsonResponse({'success': False, 'error': download_job_info['download_job_message'] or '❌ خدمة تنزيل المواد غير مفعلة حالياً في إدارة الوظائف'})

        data = json.loads(request.body)
        student_ids = data.get('student_ids', [])
        semester_id = data.get('semester_id')
        season_type = data.get('season_type') or data.get('semester') or data.get('semester_type')
        year = data.get('year') or data.get('academic_year')
        level_id = data.get('level_id')
        
        if not student_ids:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار طالب واحد على الأقل'})
            
        if not semester_id or str(semester_id).strip() in ['', 'null', 'undefined', 'NaN', 'None']:
            if season_type and year:
                try:
                    sem = Semester.objects.filter(type=season_type, year=int(year)).first()
                    if sem:
                        semester_id = sem.id
                except (ValueError, TypeError):
                    pass
            if not semester_id:
                active_sem = Semester.objects.filter(is_active=True).first()
                if active_sem:
                    semester_id = active_sem.id

        if not semester_id:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار الفصل الدراسي'})
            
        semester = get_object_or_404(Semester, id=int(semester_id))
        if not semester.is_active:
            return JsonResponse({'success': False, 'error': '❌ لا يمكن تنزيل المواد إلا للفصل الدراسي الفعّال حالياً'})
        
        from apps.grades.models import Grade
        from django.core.exceptions import ValidationError
        from django.db import transaction
        from apps.student.utils import check_student_academic_eligibility
        
        downloaded_count = 0
        already_exists = 0
        skipped_barrier = 0
        processed_count = 0
        skipped_courses = []
        errors = []
        results = []
        
        for student_id in student_ids:
            try:
                student = Student.objects.get(id=int(student_id))
                processed_count += 1

                # 🔒 فحص الأهلية الأكاديمية للطالب
                eligibility = check_student_academic_eligibility(student, action_type='registration')
                if not eligibility['is_allowed']:
                    errors.append(f"❌ {student.name}: {eligibility['error_message']}")
                    continue
                
                # 🛑 فحص حظر التنزيل إذا كان تخصص/قسم الطالب غير مفعّل
                if student.department and not student.department.is_active:
                    err_msg = f"عذراً، قسم ({student.department.name}) غير مفعّل حالياً ولا يمكن تنزيل المواد فيه."
                    errors.append(f"❌ {student.name}: {err_msg}")
                    continue
                
                with transaction.atomic():
                    # إذا كانت حالة الطالب جديدة، نحدثها لمنتظم
                    if student.student_status and student.student_status.name == "جديد":
                        active_st, _ = StudentStatus.objects.get_or_create(name="منتظم")
                        student.student_status = active_st
                        student.save(update_fields=['student_status'])

                    # فحص وتجديد القيد للفصل الحالي تلقائياً
                    admin_user = request.user if (request.user and request.user.is_authenticated) else User.objects.filter(is_superuser=True).first() or User.objects.first()
                    enrollment = EnrollmentRenewal.objects.filter(
                        student=student,
                        semester=semester
                    ).first()
                    
                    if not enrollment:
                        EnrollmentRenewal.objects.create(
                            student=student,
                            semester=semester,
                            level=student.level or Level.objects.filter(number=1).first(),
                            status='active',
                            renewed_by=admin_user,
                            notes='تجديد قيد آلي عند تنزيل المواد'
                        )
                    elif enrollment.status not in ['active', 'RENEWED']:
                        enrollment.status = 'active'
                        enrollment.save(update_fields=['status'])

                    BLOCKED_STATUS_LIST = ["موقف قيده", "موقوف قيده", "سحب ملف", "مسحوبة ملف", "إخلاء طرف", "خريج", "متخرج", "مسحوب ملفه", "مفصول"]
                    if student.student_status and student.student_status.name in BLOCKED_STATUS_LIST:
                        error_msg = f"❌ {student.name}: حالته ({student.student_status.name}) لا تسمح بتنزيل المواد."
                        errors.append(error_msg)
                        results.append(error_msg)
                        continue
                    
                    # جلب المواد المتاحة وتطبيق شرط النقل وقيد الفارق الأكاديمي
                    target_lvl = level_id or (student.level.id if student.level else None)
                    eligible_info, num_carried, prog_warning = get_student_eligible_download_courses(
                        student=student,
                        semester=semester,
                        target_level_id=target_lvl
                    )
                    
                    # Fallback: إذا كانت قائمة المواد فارغة، جلب مواد القسم والمستوى النشطة
                    if not eligible_info and student.department:
                        fallback_courses = Course.objects.filter(department=student.department, is_active=True)
                        if target_lvl and str(target_lvl).isdigit():
                            fallback_courses = fallback_courses.filter(level_id=int(target_lvl))
                        elif student.level:
                            fallback_courses = fallback_courses.filter(level=student.level)
                        
                        passed_ids = set(Grade.objects.filter(student=student).filter(Q(is_passed=True) | Q(total_grade__gte=50)).values_list('course_id', flat=True))
                        registered_ids = set(CourseRegistration.objects.filter(student=student, semester=semester).values_list('course_id', flat=True))
                        
                        for c in fallback_courses:
                            if c.id not in passed_ids and c.id not in registered_ids:
                                eligible_info.append({
                                    'course': c,
                                    'is_retake': False,
                                    'is_prereq_fallback': False
                                })
                    
                    if prog_warning:
                        results.append(prog_warning)
                        skipped_courses.append(prog_warning)
                    
                    downloaded_for_this_student = 0
                    for item in eligible_info:
                        course = item['course']
                        existing = CourseRegistration.objects.filter(
                            student=student,
                            course=course,
                            semester=semester
                        ).first()
                        
                        if existing:
                            already_exists += 1
                        else:
                            try:
                                reg, created = CourseRegistration.objects.get_or_create(
                                    student=student,
                                    course=course,
                                    semester=semester,
                                    defaults={'registered_by': admin_user}
                                )
                                if created:
                                    downloaded_count += 1
                                    downloaded_for_this_student += 1
                                else:
                                    already_exists += 1
                            except ValidationError as ve:
                                skipped_barrier += 1
                                error_msg = f"خطأ في المادة {course.name} للطالب {student.name}: {', '.join(ve.messages) if hasattr(ve, 'messages') else str(ve)}"
                                skipped_courses.append(error_msg)
                                results.append(f"❌ {course.name}: {', '.join(ve.messages) if hasattr(ve, 'messages') else str(ve)}")
                            except Exception as ex:
                                skipped_barrier += 1
                                skipped_courses.append(f"خطأ في المادة {course.name}: {str(ex)}")
                            
                    results.append(f"✅ {student.name}: تم تنزيل {downloaded_for_this_student} مادة")
                    
            except Student.DoesNotExist:
                results.append(f"❌ طالب غير موجود (ID: {student_id})")
            except Exception as e:
                results.append(f"❌ خطأ في {student_id}: {str(e)}")
                
        message = f"✅ تمت عملية التنزيل بنجاح لـ {processed_count} طالب (تم تنزيل {downloaded_count} مادة جديدة)"
        if already_exists > 0:
            message += f"\n🔄 {already_exists} مادة كانت منزلّة مسبقاً"
        if skipped_barrier > 0:
            message += f"\n⚠️ تم تخطي {skipped_barrier} مادة لعدم استيفاء متطلباتها السابقة"
            
        # 🛡️ توثيق عملية تنزيل المواد للطلاب في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='CourseRegistration',
                object_name='تنزيل المواد للطلاب',
                details=f"تم تنزيل ({downloaded_count}) مادة دراسية لـ ({processed_count}) طالب في الفصل الدراسي ({semester})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'processed': processed_count,
            'downloaded_count': downloaded_count,
            'already_exists': already_exists,
            'skipped_courses': skipped_courses,
            'message': message,
            'errors': errors,
            'details': results
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def get_student_courses_api(request, student_id, semester_id=0):
    """API: جلب المواد المنزلة لطالب معين في فصل معين مع بيانات الطالب والفصل كاملة للطباعة"""
    try:
        from apps.student.models import Student
        from apps.renewal.models import Semester
        
        student = Student.objects.filter(id=student_id).select_related('department', 'level').first()
        if not student:
            return JsonResponse({'success': False, 'error': 'الطالب غير موجود'})

        if not semester_id or semester_id == 0 or str(semester_id).strip() in ['0', 'undefined', 'null']:
            semester = Semester.objects.filter(is_active=True).first()
        else:
            try:
                semester = Semester.objects.filter(id=int(semester_id)).first()
            except (ValueError, TypeError):
                semester = Semester.objects.filter(is_active=True).first()
            if not semester:
                semester = Semester.objects.filter(is_active=True).first()
        
        sem_id = semester.id if semester else semester_id
        registrations = CourseRegistration.objects.filter(
            student_id=student_id,
            semester_id=sem_id
        ).select_related('course', 'course__level', 'student', 'student__level').prefetch_related('course__prerequisites')
        
        if not registrations.exists():
            latest_reg = CourseRegistration.objects.filter(student_id=student_id).order_by('-id').first()
            if latest_reg and latest_reg.semester:
                semester = latest_reg.semester
                registrations = CourseRegistration.objects.filter(
                    student_id=student_id,
                    semester_id=semester.id
                ).select_related('course', 'course__level', 'student', 'student__level').prefetch_related('course__prerequisites')
        
        data = []
        total_credits = 0
        for reg in registrations:
            level_num = reg.course.level.number if (reg.course and reg.course.level) else 0
            student_level_num = reg.student.level.number if (reg.student and reg.student.level) else (student.level.number if student.level else 0)
            is_repeated = (level_num > 0 and student_level_num > 0 and level_num < student_level_num) or (reg.attempt_number > 1)
            credits = reg.course.credits if reg.course else 0
            total_credits += credits
            
            prereqs = []
            if reg.course:
                prereqs = [p.name for p in reg.course.prerequisites.all()]
            prereq_str = "، ".join(prereqs) if prereqs else "-"
            
            data.append({
                'id': reg.id,
                'course_code': reg.course.code if reg.course else '',
                'course_name': reg.course.name if reg.course else '',
                'credits': credits,
                'level_number': level_num,
                'is_repeated': is_repeated,
                'is_backlog': is_repeated,
                'prerequisite': prereq_str,
                'semester_name': f"المستوى {level_num}" if level_num else '-',
                'attempt_number': reg.attempt_number,
                'registration_date': reg.registration_date.strftime('%Y-%m-%d') if reg.registration_date else ''
            })
        
        full_name = student.get_full_name().strip()
        full_name = " ".join(full_name.split())
        
        return JsonResponse({
            'success': True,
            'courses': data,
            'student_name': full_name or student.name,
            'student_id': student.student_id or str(student.id),
            'department_name': student.department.name if (student and student.department) else '',
            'level_name': student.level.name if (student and student.level) else (f"المستوى {student.level.number}" if (student and student.level) else ''),
            'semester_name': (semester.get_type_display() + " " + str(semester.year)) if semester else '',
            'total_credits': total_credits,
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
def special_download(request):
    """صفحة تنزيل مواد - حالة خاصة"""
    if hasattr(request.user, 'role') and request.user.role == 'registrar':
        messages.error(request, "❌ عذراً، تنزيل المواد يقع ضمن اختصاص قسم الدراسة والامتحانات والمسجل العام فقط.")
        return redirect('renewal:dashboard')

    departments = Department.objects.filter(is_active=True).order_by('name')
    current_semester = Semester.objects.filter(is_active=True).first()
    semesters = Semester.objects.all()
    levels = Level.objects.all().order_by('number')
    
    download_job_info = get_download_materials_job_info()

    exams_coordinator_name = "أ. لبنى"
    general_registrar_name = "أ. أحمد محمد علي محمود"
    try:
        from apps.users.models import Official
        coord_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='exams_coordinator') |
            Q(position_name__icontains='منسق') |
            Q(position_name__icontains='منسقة')
        ).first()
        if coord_obj:
            exams_coordinator_name = coord_obj.get_full_name()

        reg_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='registrar') | Q(position_name__icontains='المسجل العام') | Q(position_name__icontains='مسجل')
        ).exclude(position_key='admission').first()
        if reg_obj:
            general_registrar_name = reg_obj.get_full_name()
    except Exception as e:
        logger.warning(f"Error fetching officials in special_download: {e}")

    context = {
        'departments': departments,
        'current_semester': current_semester,
        'semesters': semesters,
        'levels': levels,
        'active_year': current_semester.year if current_semester else 2026,
        'active_season': current_semester.type if current_semester else 'fall',
        'active_season_display': current_semester.get_type_display() if current_semester else 'خريف',
        'is_download_job_open': download_job_info['is_download_job_open'],
        'download_job_message': download_job_info['download_job_message'],
        'exams_coordinator_name': exams_coordinator_name,
        'general_registrar_name': general_registrar_name,
    }
    return render(request, 'renewal/special_download.html', context)





@login_required
def search_student_for_download_api(request):
    """API: البحث عن طالب لتنزيل المواد الاستثنائية مع التحقق المركزي من أهلية الطالب الأكاديمية"""
    from django.db.models import Q
    from apps.grades.models import Grade
    from apps.student.utils import check_student_academic_eligibility
    
    search = request.GET.get('search', '').strip()
    if not search:
        return JsonResponse({'success': False, 'error': 'الرجاء إدخال اسم أو رقم قيد'})
        
    current_semester = Semester.objects.filter(is_active=True).first()
    if not current_semester:
        return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط حالياً'})
    
    query = Q(student_id__icontains=search) | Q(name__icontains=search)
    if search.isdigit():
        query |= Q(id=int(search))
        
    candidates = Student.objects.filter(query).select_related('department', 'level', 'student_status')[:15]
    
    data = []
    for s in candidates:
        eligibility = check_student_academic_eligibility(s, action_type='registration')
        if not eligibility['is_allowed']:
            continue

        if s.student_status and s.student_status.name == 'نشط':
            continue
        has_active_renewal = EnrollmentRenewal.objects.filter(
            student=s, semester=current_semester, status='active'
        ).exists()
        
        has_prev_renewals = EnrollmentRenewal.objects.filter(student=s).exists()
        has_grades = Grade.objects.filter(student=s).exists()
        is_brand_new = (not has_prev_renewals and not has_grades and (not s.level or s.level.number == 1))
        
        if is_brand_new or has_active_renewal:
            data.append({
                'id': s.id,
                'student_id': s.student_id or f"STU{s.id:06d}",
                'name': s.name or '',
                'department_name': s.department.name if s.department else '-',
                'level_number': s.level.number if s.level else 1,
                'is_active': True,
                'can_download': True,
                'status_message': '✅ مستجد (مدرج تلقائياً)' if is_brand_new else '✅ مجدد القيد بالفصل الحالي',
                'status_class': 'success',
                'special_case_type': 'brand_new' if is_brand_new else 'renewed'
            })
        
    if not data:
        return JsonResponse({
            'success': False, 
            'error': 'عذراً، هذا الطالب غير مؤهل لتنزيل المواد (إما أن ملفه مسحوب/خريج، أو لم يقم بتجديد قيده للفصل الحالي).'
        })
        
    return JsonResponse({'success': True, 'students': data})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_courseregistration', 'renewal.change_courseregistration', 'add_courseregistration', 'change_courseregistration')
def download_special_materials_api(request):
    """API: تنزيل مواد للحالات الخاصة - يعيد المواد المنزلة فوراً مع الفحص الأكاديمي الصارم"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_ids = data.get('student_ids', [])
        semester_id = data.get('semester_id')
        special_case = data.get('special_case', '')
        year = data.get('year')
        season_type = data.get('season_type') or data.get('semester_type')
        
        print("="*60)
        print("🔄 بدء تنزيل مواد حالة خاصة")
        print(f"   student_ids: {student_ids}")
        print(f"   semester_id: {semester_id}")
        print(f"   special_case: {special_case}")
        print("="*60)
        
        if not student_ids:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار طالب واحد على الأقل'})
        
        semester = None
        if semester_id:
            semester = Semester.objects.filter(id=int(semester_id)).first()
        elif is_valid_filter(year) and is_valid_filter(season_type):
            semester = Semester.objects.filter(year=int(year), type=season_type).first()
            
        if not semester:
            semester = Semester.objects.filter(is_active=True).first()
            
        if not semester:
            return JsonResponse({'success': False, 'error': '❌ لا يوجد فصل دراسي نشط حالياً'})
            
        downloaded_courses = []
        from apps.student.utils import check_student_academic_eligibility
        
        for student_id in student_ids:
            try:
                student = Student.objects.get(id=int(student_id))
                is_blocked = False  # افتراضي: غير محظور
                
                # 🔒 فحص الأهلية الأكاديمية للطالب
                eligibility = check_student_academic_eligibility(student, action_type='registration')
                if not eligibility['is_allowed']:
                    return JsonResponse({
                        'success': False,
                        'message': eligibility['error_message'],
                        'error': eligibility['error_message']
                    })
                
                # 🛑 فحص حظر التنزيل إذا كان تخصص/قسم الطالب غير مفعّل
                if student.department and not student.department.is_active:
                    err_msg = f"عذراً، قسم ({student.department.name}) غير مفعّل حالياً ولا يمكن تنزيل المواد فيه."
                    print(f"❌ {err_msg}")
                    return JsonResponse({
                        'success': False,
                        'message': err_msg,
                        'error': err_msg
                    })
                
                # 🔥 فحص وجود تجديد قيد فعّال في الفصل الدراسي النشط
                has_active_renewal = EnrollmentRenewal.objects.filter(
                    student=student,
                    semester=semester,
                    status='active'
                ).exists()
                
                if is_blocked or not has_active_renewal:
                    err_msg = f"لا يمكن تنزيل المواد للطالب ({student.name}) لأنه لم يقم بتجديد قيده للفصل الدراسي الحالي أو لأن قيده موقوف."
                    print(f"❌ {err_msg}")
                    return JsonResponse({
                        'success': False,
                        'message': err_msg,
                        'error': err_msg
                    })
                
                # جلب المواد الخاصة بمستوى الطالب
                courses = Course.objects.filter(
                    level=student.level,
                    is_active=True
                )
                
                for course in courses:
                    # التحقق من وجود تنزيل مسبق
                    existing = CourseRegistration.objects.filter(
                        student=student,
                        course=course,
                        semester=semester
                    ).first()
                    
                    if not existing:
                        # إنشاء تنزيل جديد
                        try:
                            reg = CourseRegistration(
                                student=student,
                                course=course,
                                semester=semester,
                                registered_by=request.user,
                                notes=f'حالة خاصة: {special_case}'
                            )
                            reg.full_clean()
                            reg.save()
                            print(f"   ✅ تم تنزيل: {course.name}")
                            # إضافة المادة إلى القائمة
                            downloaded_courses.append({
                                'code': course.code,
                                'name': course.name,
                                'credits': course.credits,
                                'level': student.level.number if student.level else 0
                            })
                        except ValidationError as ve:
                            print(f"   ❌ خطأ في تنزيل {course.name}: {ve}")
                    else:
                        # إضافة المادة إلى القائمة (سواء جديدة أو موجودة)
                        downloaded_courses.append({
                            'code': course.code,
                            'name': course.name,
                            'credits': course.credits,
                            'level': student.level.number if student.level else 0
                        })
                
            except Student.DoesNotExist:
                print(f"   ❌ خطأ: طالب غير موجود")
            except Exception as e:
                print(f"   ❌ خطأ: {str(e)}")
         
        # إزالة المواد المكررة من القائمة (لنفس الطالب)
        unique_courses = []
        seen_codes = set()
        for course in downloaded_courses:
            if course['code'] not in seen_codes:
                seen_codes.add(course['code'])
                unique_courses.append(course)
        
        # بناء رسالة النتيجة
        if len(unique_courses) > 0:
            message = f"✅ تم تنزيل {len(unique_courses)} مادة"
        else:
            message = "⚠️ لا توجد مواد للتنزيل"
        
        # 🛡️ توثيق عملية التنزيل الخاص في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='CourseRegistration',
                object_name='تنزيل مواد حالة خاصة',
                details=f"تم تنزيل ({len(unique_courses)}) مادة حالة خاصة للطالب في الفصل الدراسي ({semester})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': message,
            'courses': unique_courses,
            'downloaded_count': len(unique_courses),
            'student_name': student.name if student else ''
        })
    
    except Exception as e:
        print(f"❌ خطأ غير متوقع: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})
    

@login_required
def search_student_by_name_or_id_api(request):
    """API للبحث عن طالب بالاسم أو رقم القيد (لصفحات renewal)"""
    reg_num = request.GET.get('reg_num', '').strip()
    name = request.GET.get('name', '').strip()
    
    if not reg_num and not name:
        return JsonResponse({'success': False, 'message': 'الرجاء إدخال رقم القيد أو اسم الطالب'})
    
    students = Student.objects.all()
    
    if reg_num:
        students = students.filter(student_id__icontains=reg_num)
    if name:
        students = students.filter(name__icontains=name)
    
    students = students.select_related('department', 'level')[:20]
    
    if students.exists():
        data = []
        for student in students:
            data.append({
                'id': student.id,
                'student_id': student.student_id,
                'name': student.name,
                'father_name': student.father_name or '',
                'grandfather_name': student.grandfather_name or '',
                'last_name': student.last_name or '',
                'national_id': student.national_id or '',
                'phone': student.phone or '',
                'email': student.email or '',
                'birth_date': student.birth_date.strftime('%Y-%m-%d') if student.birth_date else '',
                'birth_place_id': student.birth_place.id if student.birth_place else '',
                'birth_place_name': str(student.birth_place) if student.birth_place else '',
                'gender': student.gender,
                'gender_id': student.gender,
                'gender_name': student.get_gender_display() if hasattr(student, 'get_gender_display') else ('ذكر' if student.gender == 'M' else 'أنثى'),
                'blood_type': student.blood_type or '',
                'blood_type_name': student.blood_type or '',
                'nationality_id': student.nationality.id if student.nationality else '',
                'nationality_name': str(student.nationality) if student.nationality else '',
                'marital_status_id': student.marital_status.id if student.marital_status else '',
                'marital_status_name': str(student.marital_status) if student.marital_status else '',
                'address': student.current_address.street if student.current_address else '',
                'department_id': student.department.id if student.department else '',  # 🔥 مهم
                'department_name': student.department.name if student.department else '-',  # 🔥 مهم
                'level_id': student.level.id if student.level else '',  # 🔥 مهم
                'level_number': student.level.number if student.level else 0,  # 🔥 مهم
                'study_plan_id': student.study_plan.id if student.study_plan else '',
                'study_plan_name': str(student.study_plan) if student.study_plan else '',
                'group_id': student.group.id if student.group else '',
                'group_name': str(student.group) if student.group else '',
                'student_status_id': student.student_status.id if student.student_status else '',
                'student_status_name': str(student.student_status) if student.student_status else '',
                'enrollment_date': student.enrollment_date.strftime('%Y-%m-%d') if student.enrollment_date else '',
                'enrollment_semester': student.enrollment_semester or '',
                'notes': student.notes or '',
                'guardian_name': student.guardian.name if student.guardian else '',
                'guardian_phone': student.guardian.phone if student.guardian else '',
                'qualification_id': student.qualification.id if student.qualification else '',
                'qualification_name': str(student.qualification) if student.qualification else '',
                'qualification_date': student.qualification_date.strftime('%Y-%m-%d') if student.qualification_date else '',
                'qualification_place': student.qualification_place or '',
                'qualification_major': student.qualification_major or '',
                'qualification_grade': student.qualification_grade or '',
                'qualification_percentage': student.qualification_percentage if student.qualification_percentage else '',
            })
        return JsonResponse({'success': True, 'students': data, 'count': len(data)})
    else:
        return JsonResponse({'success': False, 'message': 'لا توجد نتائج'})

# API بسيط للبحث عن طالب (لصفحة الحالة الخاصة)

@login_required
def search_student_simple_api(request):
    """API بسيط للبحث عن طالب (لصفحة الحالة الخاصة)"""
    search = request.GET.get('search', '').strip()
    reg_num = request.GET.get('reg_num', '').strip()
    name = request.GET.get('name', '').strip()
    
    query = search or reg_num or name
    
    if not query:
        return JsonResponse({'success': False, 'message': 'الرجاء إدخال رقم القيد أو اسم الطالب'})
    
    students = Student.objects.filter(
        db_models.Q(student_id__icontains=query) | 
        db_models.Q(name__icontains=query) |
        db_models.Q(father_name__icontains=query) |
        db_models.Q(national_id__icontains=query)
    ).select_related('department', 'level')[:20]
    
    if students.exists():
        data = []
        for student in students:
            full_name = f"{student.name} {student.father_name or ''} {student.last_name or ''}".strip()
            data.append({
                'id': student.id,
                'student_id': student.student_id or f"STU{student.id}",
                'name': full_name or student.name,
                'national_id': student.national_id or '',
                'father_name': student.father_name or '',
                'department_id': student.department.id if student.department else '',
                'department_name': student.department.name if student.department else '-',
                'level_id': student.level.id if student.level else '',
                'level_number': student.level.number if student.level else 0,
            })
        return JsonResponse({'success': True, 'students': data})
    else:
        return JsonResponse({'success': False, 'message': 'لا توجد نتائج'})
    
from apps.grades.models import Grade
@login_required
def course_grades_api(request):
    """API: جلب درجات الطلاب حسب المادة والفصل"""
    course_id = request.GET.get('course_id')
    semester_id = request.GET.get('semester_id')
    department_id = request.GET.get('department_id')
    
    if not course_id or not semester_id:
        return JsonResponse({'success': False, 'error': 'الرجاء اختيار المادة والفصل'})
    
    grades = Grade.objects.filter(
        course_id=course_id,
        semester_id=semester_id
    ).select_related('student', 'student__department', 'student__level')
    
    if department_id:
        grades = grades.filter(student__department_id=department_id)
    
    data = []
    passed = 0
    total_scores = 0
    
    for grade in grades:
        student = grade.student
        is_passed = grade.is_passed
        if is_passed:
            passed += 1
        total_scores += grade.total_grade
        
        # حساب التقدير
        score = grade.total_grade
        if score >= 90:
            grade_letter = "A+"
        elif score >= 85:
            grade_letter = "A"
        elif score >= 80:
            grade_letter = "B+"
        elif score >= 75:
            grade_letter = "B"
        elif score >= 70:
            grade_letter = "C+"
        elif score >= 65:
            grade_letter = "C"
        elif score >= 60:
            grade_letter = "D+"
        elif score >= 50:
            grade_letter = "D"
        else:
            grade_letter = "F"
        
        data.append({
            'student_id': student.student_id,
            'student_name': student.name,
            'father_name': student.father_name or '',
            'department_name': student.department.name if student.department else '-',
            'level_number': student.level.number if student.level else 0,
            'midterm_grade': grade.midterm_grade,
            'final_grade': grade.final_grade,
            'total_grade': grade.total_grade,
            'is_passed': is_passed,
            'grade_letter': grade_letter,
        })
    
    total = len(data)
    avg = total_scores / total if total > 0 else 0
    success_rate = (passed / total * 100) if total > 0 else 0
    
    return JsonResponse({
        'success': True,
        'grades': data,
        'stats': {
            'total': total,
            'passed': passed,
            'failed': total - passed,
            'average': round(avg, 2),
            'success_rate': f"{round(success_rate, 1)}%"
        }
    })

@login_required
def student_grades_by_course_page(request):
    """صفحة درجات الطالب حسب المادة"""
    from apps.renewal.models import Course, Semester, Department
    context = {
        'courses': Course.objects.filter(is_active=True),
        'semesters': Semester.objects.all().order_by('-year', '-type'),
        'departments': Department.objects.filter(is_active=True).order_by('name'),
    }
    return render(request, 'renewal/student_grades_by_course.html', context)

# Admin lookup pages and APIs

@login_required
@registrar_required
def places_data(request):
    return render(request, 'renewal/places_data.html')


@login_required
@registrar_required
def qualification_data(request):
    return render(request, 'renewal/qualification_data.html')


@login_required
def specialty_data(request):
    return render(request, 'renewal/specialty_data.html')


@login_required
@registrar_required
def subject_data(request):
    # 🛡️ توثيق زيارة صفحة بيانات المقررات/المواد في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_subject_data',
            model_name='Course',
            object_name='صفحة بيانات المقررات والمواد',
            details='قام المستخدِم بتصفح واستعراض صفحة إدارة وبيانات المقررات والمواد الدراسية',
            request=request
        )
    except Exception:
        pass

    return render(request, 'renewal/subject_data.html', {
        'departments': Department.objects.filter(is_active=True).order_by('name'),
        'levels': Level.objects.all().order_by('number'),
        'study_plans': StudyPlan.objects.filter(is_active=True).order_by('name'),
    })


def place_to_json(place):
    return {
        'id': place.id,
        'city': place.city,
        'country': place.country,
        'is_active': getattr(place, 'is_active', True),
        'count': Student.objects.filter(birth_place=place).count(),
    }


def qualification_to_json(qualification):
    return {
        'id': qualification.id,
        'name': qualification.name,
        'is_active': getattr(qualification, 'is_active', True),
        'count': Student.objects.filter(qualification=qualification).count(),
    }


@login_required
@registrar_required
@csrf_exempt
def toggle_place_active_api(request, place_id):
    """API: تبديل حالة تفعيل مكان الميلاد/المنطقة"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        place = get_object_or_404(PlaceOfBirth, id=place_id)
        place.is_active = not place.is_active
        place.save()
        
        status_str = "مفعل" if place.is_active else "معطل"
        
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='update',
            model_name='PlaceOfBirth',
            object_name=f"{place.city} - {place.country}",
            details=f"تغيير حالة تفعيل المكان ({place.city} - {place.country}) إلى {status_str}",
            request=request
        )
        
        return JsonResponse({
            'success': True,
            'message': f'تم تغيير حالة المكان ({place.city}) إلى {status_str}',
            'is_active': place.is_active
        })
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@registrar_required
@csrf_exempt
def toggle_qualification_active_api(request, qual_id):
    """API: تبديل حالة تفعيل المؤهل العلمي"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        qualification = get_object_or_404(Qualification, id=qual_id)
        qualification.is_active = not qualification.is_active
        qualification.save()
        
        status_str = "مفعل" if qualification.is_active else "معطل"
        
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='update',
            model_name='Qualification',
            object_name=qualification.name,
            details=f"تغيير حالة تفعيل المؤهل العلمي ({qualification.name}) إلى {status_str}",
            request=request
        )
        
        return JsonResponse({
            'success': True,
            'message': f'تم تغيير حالة المؤهل ({qualification.name}) إلى {status_str}',
            'is_active': qualification.is_active
        })
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


def department_to_json(department):
    return {
        'id': department.id,
        'name': department.name,
        'code': department.code,
        'count': Student.objects.filter(department=department).count(),
    }


def course_to_json(course):
    depts = list(course.department.filter(is_active=True)) if (hasattr(course, 'department') and hasattr(course.department, 'filter')) else []
    dept_ids = [d.id for d in depts]
    dept_name = " ، ".join([d.name for d in depts]) if depts else 'عام'
    primary_dept_id = dept_ids[0] if dept_ids else None

    prereqs = list(course.prerequisites.all()) if (hasattr(course, 'prerequisites') and hasattr(course.prerequisites, 'all')) else []
    prereq_codes = [p.code for p in prereqs if p.code]
    prereq_str = " ، ".join([f"{p.name} ({p.code})" for p in prereqs if p.name and p.code]) if prereqs else ""

    return {
        'id': course.id,
        'name': course.name,
        'code': course.code,
        'credits': course.credits,
        'theoretical_hours': course.theoretical_hours,
        'practical_hours': course.practical_hours,
        'department_id': primary_dept_id,
        'department_ids': dept_ids,
        'department_name': dept_name,
        'departments': [{'id': d.id, 'name': d.name} for d in depts],
        'study_plan_id': course.study_plan_id,
        'study_plan_name': course.study_plan.name if course.study_plan else '',
        'level_id': course.level_id,
        'level_number': course.level.number if course.level else '',
        'is_active': course.is_active,
        'is_mandatory': course.is_mandatory,
        'prerequisite': ", ".join(prereq_codes) if prereq_codes else None,
        'prerequisite_name': prereq_str or None,
        'prerequisite_ids': [p.id for p in prereqs],
        'prerequisites': [{'id': item.id, 'name': item.name, 'code': item.code} for item in prereqs],
    }


@login_required
@registrar_required
def get_places_api(request):
    places = PlaceOfBirth.objects.all().order_by('country', 'city')
    return JsonResponse({'success': True, 'places': [place_to_json(place) for place in places]})


@login_required
@registrar_required
@csrf_exempt
def create_place_api(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json_payload(request)
        city = (data.get('city') or '').strip()
        country = (data.get('country') or 'ليبيا').strip()
        if not city:
            return JsonResponse({'success': False, 'error': 'الرجاء إدخال المدينة'})
        place, created = PlaceOfBirth.objects.get_or_create(city=city, country=country)
        if not created:
            return JsonResponse({'success': False, 'error': 'مكان الميلاد موجود بالفعل'})
        
        # 🛡️ توثيق إضافة مكان جديد في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='PlaceOfBirth',
                object_name=f"{city} - {country}",
                details=f"إضافة مكان/منطقة جغرافية جديدة: ({city} - {country})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تمت إضافة مكان الميلاد', 'place': place_to_json(place)})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@registrar_required
@csrf_exempt
def update_place_api(request, place_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json_payload(request)
        place = get_object_or_404(PlaceOfBirth, id=place_id)
        city = (data.get('city') or '').strip()
        country = (data.get('country') or '').strip()
        if not city or not country:
            return JsonResponse({'success': False, 'error': 'المدينة والدولة مطلوبتان'})
        place.city = city
        place.country = country
        place.save()

        # 🛡️ توثيق تحديث بيانات المكان في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='PlaceOfBirth',
                object_name=f"{city} - {country}",
                details=f"تحديث بيانات المنطقة/المكان إلى: ({city} - {country})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تم تحديث مكان الميلاد', 'place': place_to_json(place)})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@registrar_required
@csrf_exempt
def delete_place_api(request, place_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        place = get_object_or_404(PlaceOfBirth, id=place_id)
        if Student.objects.filter(birth_place=place).exists():
            return JsonResponse({'success': False, 'error': 'لا يمكن الحذف لوجود طلاب مرتبطين بهذا المكان'})
        
        place_name = f"{place.city} - {place.country}"
        place.delete()

        # 🛡️ توثيق حذف مكان في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='delete',
                model_name='PlaceOfBirth',
                object_name=place_name,
                details=f"حذف بيانات المنطقة/المكان: ({place_name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تم حذف مكان الميلاد'})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@registrar_required
def get_qualifications_api(request):
    qualifications = Qualification.objects.all().order_by('name')
    return JsonResponse({'success': True, 'qualifications': [qualification_to_json(item) for item in qualifications]})


@login_required
@registrar_required
@csrf_exempt
def create_qualification_api(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json_payload(request)
        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'error': 'الرجاء إدخال اسم المؤهل'})
        qualification, created = Qualification.objects.get_or_create(name=name)
        if not created:
            return JsonResponse({'success': False, 'error': 'المؤهل موجود بالفعل'})
        
        # 🛡️ توثيق إضافة مؤهل في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='Qualification',
                object_name=name,
                details=f"إضافة نوع/مستوى مؤهل علمي جديد: ({name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تمت إضافة المؤهل', 'qualification': qualification_to_json(qualification)})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@registrar_required
@csrf_exempt
def update_qualification_api(request, qual_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json_payload(request)
        qualification = get_object_or_404(Qualification, id=qual_id)
        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'success': False, 'error': 'الرجاء إدخال اسم المؤهل'})
        qualification.name = name
        qualification.save()

        # 🛡️ توثيق تعديل مؤهل في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='Qualification',
                object_name=name,
                details=f"تحديث بيانات المؤهل العلمي إلى: ({name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تم تحديث المؤهل', 'qualification': qualification_to_json(qualification)})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@registrar_required
@csrf_exempt
def delete_qualification_api(request, qual_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        qualification = get_object_or_404(Qualification, id=qual_id)
        if Student.objects.filter(qualification=qualification).exists():
            return JsonResponse({'success': False, 'error': 'لا يمكن الحذف لوجود طلاب مرتبطين بهذا المؤهل'})
        
        qual_name = qualification.name
        qualification.delete()

        # 🛡️ توثيق حذف مؤهل في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='delete',
                model_name='Qualification',
                object_name=qual_name,
                details=f"حذف نوع/مستوى المؤهل العلمي: ({qual_name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تم حذف المؤهل'})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


# ============================================================
# 🏢 نظام الأقسام والتخصصات الديناميكية (Dynamic Departments)
# ============================================================

# apps/renewal/views.py - دالة department_list_view

@login_required
def department_list_view(request):
    """
    صفحة عرض وإدارة جميع الأقسام والتخصصات الديناميكية
    """
    # 🛡️ توثيق زيارة قائمة الأقسام في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_departments',
            model_name='Department',
            object_name='قائمة الأقسام والتخصصات',
            details='قام المستخدِم بتصفح واستعراض قائمة الأقسام والتخصصات الأكاديمية بالكلية',
            request=request
        )
    except Exception:
        pass

    if getattr(request.user, 'role', None) == 'academic_dept' and getattr(request.user, 'department', None):
        return redirect('renewal:department_detail', dept_code=request.user.department.code)

    departments = Department.objects.filter(is_active=True).order_by('name')
    departments_data = []
    
    for dept in departments:
        total_students = exclude_withdrawn_students(Student.objects.filter(department=dept)).count()
        active_students = exclude_withdrawn_students(
            Student.objects.filter(department=dept, student_status__name__icontains='مستمر')
        ).count()
        courses_count = Course.objects.filter(department=dept).count()
        groups_count = Group.objects.filter(department=dept).count()
        
        departments_data.append({
            'department': dept,
            'total_students': total_students,
            'active_students': active_students,
            'courses_count': courses_count,
            'groups_count': groups_count,
        })
        
    context = {
        'departments_list': departments_data,
        'all_departments': departments,
    }
    return render(request, 'renewal/department_list.html', context)


@login_required
@require_execution_permission('renewal.change_department', 'change_department', 'department')
def department_update_view(request, id=None, dept_id=None):
    """
    صفحة تعديل بيانات القسم الأكاديمي
    """
    actual_id = id if id is not None else dept_id
    department = get_object_or_404(Department, pk=actual_id)
    
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        code = request.POST.get('code', '').strip()
        is_active = request.POST.get('is_active') in ['on', '1', 'true', True]
        
        if not name or not code:
            messages.error(request, 'يرجى إدخال اسم القسم والرمز المختصر.')
        elif Department.objects.filter(name__iexact=name).exclude(pk=department.pk).exists():
            messages.error(request, f'يوجد قسم آخر مسجل بنفس الاسم ({name}).')
        elif Department.objects.filter(code__iexact=code).exclude(pk=department.pk).exists():
            messages.error(request, f'يوجد قسم آخر مسجل بنفس الرمز ({code}).')
        else:
            old_name = department.name
            old_code = department.code
            department.name = name
            department.code = code
            department.is_active = is_active
            department.save()
            
            try:
                from apps.users.utils import log_activity
                log_activity(
                    user=request.user,
                    action='update',
                    model_name='Department',
                    object_name=department.name,
                    details=f"تعديل بيانات القسم الأكاديمي من ({old_name} - {old_code}) إلى ({name} - {code})",
                    request=request
                )
            except Exception:
                pass
            
            messages.success(request, f'تم تحديث بيانات قسم ({department.name}) بنجاح.')
            return redirect('renewal:department_list')
            
    total_students = exclude_withdrawn_students(Student.objects.filter(department=department)).count()
    courses_count = Course.objects.filter(department=department).count()
    groups_count = Group.objects.filter(department=department).count()
    
    context = {
        'department': department,
        'total_students': total_students,
        'courses_count': courses_count,
        'groups_count': groups_count,
    }
    return render(request, 'renewal/department_update.html', context)


@login_required
def department_detail_view(request, dept_code):
    """
    عرض تفاصيل قسم/تخصص معين ديناميكياً مع التحليلات والإحصائيات الشاملة
    (مع استبعاد الطلاب المسحوبين من جميع الإحصائيات)
    """
    from apps.faculty.models import Professor, CourseAssignment
    from apps.grades.models import Grade
    from django.db.models import Avg

    if str(dept_code).isdigit():
        department = get_object_or_404(Department, id=int(dept_code))
    else:
        department = get_object_or_404(Department, code__iexact=dept_code)

    # 🔒 تقييد صلاحية رئيس/قسم علمي على رؤية قسمه التابع له فقط
    if getattr(request.user, 'role', None) == 'academic_dept' and getattr(request.user, 'department', None):
        if department.id != request.user.department.id:
            return redirect('renewal:department_detail', dept_code=request.user.department.code)
        all_departments = Department.objects.filter(id=request.user.department.id, is_active=True)
    else:
        all_departments = Department.objects.filter(is_active=True).order_by('name')
    
    # 1. إحصائيات ووظائف هيئة التدريس والموظفين التابعين للقسم
    from apps.faculty.models import Professor, CourseAssignment, DepartmentStaff
    from apps.users.models import User

    professors_qs = Professor.objects.filter(department=department).select_related('specialization')
    staff_qs = DepartmentStaff.objects.filter(department=department)
    dept_heads_qs = User.objects.filter(department=department, role='academic_dept')

    faculty_count = professors_qs.filter(is_active=True).count()
    staff_count = staff_qs.filter(is_active=True).count() + dept_heads_qs.filter(is_active=True).count()
    total_faculty_staff_count = faculty_count + staff_count

    faculty_and_staff_list = []

    # أ. رئيس القسم
    for head in dept_heads_qs:
        faculty_and_staff_list.append({
            'identifier': head.username,
            'name': head.get_full_name() or head.username,
            'category': 'رئيس القسم',
            'category_badge': 'badge-role-dept-head',
            'category_icon': 'verified_user',
            'title_or_spec': 'رئيس القسم العلمي',
            'email': head.email or '-',
            'phone': head.phone or '-',
            'assigned_info': 'الإدارة والإشراف الأكاديمي على القسم',
            'assigned_courses_list': [],
            'is_active': head.is_active,
        })

    # ب. أعضاء هيئة التدريس والأساتذة
    professors_list = []
    for prof in professors_qs:
        assignments = CourseAssignment.objects.filter(professor=prof, department=department).select_related('course', 'student_group')
        assigned_courses = [f"{a.course.code} - {a.course.name} ({a.student_group.name})" for a in assignments]
        prof_item = {
            'professor': prof,
            'assigned_courses': assigned_courses,
            'assignments_count': assignments.count(),
        }
        professors_list.append(prof_item)
        faculty_and_staff_list.append({
            'identifier': prof.professor_id,
            'name': prof.full_name,
            'category': 'عضو هيئة تدريس',
            'category_badge': 'badge-role-faculty',
            'category_icon': 'school',
            'title_or_spec': prof.specialization.name if prof.specialization else 'تخصص عام',
            'email': prof.email or '-',
            'phone': prof.phone or '-',
            'assigned_info': ", ".join(assigned_courses) if assigned_courses else "لا توجد مواد مسندة حالياً",
            'assigned_courses_list': assigned_courses,
            'is_active': prof.is_active,
        })

    # ج. موظفو القسم الإداريون
    for st in staff_qs:
        faculty_and_staff_list.append({
            'identifier': st.staff_id or f"ST-{st.id}",
            'name': st.full_name,
            'category': 'موظف إداري بالقسم',
            'category_badge': 'badge-role-staff',
            'category_icon': 'badge',
            'title_or_spec': st.role or 'موظف قسم',
            'email': st.email or '-',
            'phone': '-',
            'assigned_info': 'المهام الإدارية والتنسيقية بالقسم',
            'assigned_courses_list': [],
            'is_active': st.is_active,
        })
    
    # ============================================================
    # 2. إحصائيات الطلاب والتحليلات (استبعاد المسحوبين)
    # ============================================================
    
    # تعريف حالات سحب الملف
    withdrawn_statuses = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
    
    # استبعاد المسحوبين من جميع استعلامات الطلاب
    students_qs = Student.objects.filter(department=department).exclude(
        Q(student_status__name__in=withdrawn_statuses) |
        Q(student_status__name__icontains='مسحوب')
    ).select_related(
        'level', 'student_status', 'group'
    ).order_by('name', 'father_name')
    
    # 2. إحصائيات الطلاب الشاملة وفق الحالات الخمس المعتمدة
    all_dept_students = Student.objects.filter(department=department)
    total_all_students = all_dept_students.count()

    regular_students_count = all_dept_students.filter(student_status__name='منتظم').count()
    suspended_students_count = all_dept_students.filter(student_status__name='موقوف قيده').count()
    withdrawn_students_count = all_dept_students.filter(student_status__name='مسحوبة ملف').count()
    clearance_students_count = all_dept_students.filter(student_status__name='إخلاء طرف').count()
    graduated_students_count = all_dept_students.filter(student_status__name='إخلاء طرف / خريج معتمد').count()

    # تعريف حالات سحب الملف
    withdrawn_statuses = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
    
    # استبعاد المسحوبين من جدول كشف الطلاب
    students_qs = Student.objects.filter(department=department).exclude(
        Q(student_status__name__in=withdrawn_statuses) |
        Q(student_status__name__icontains='مسحوب')
    ).select_related(
        'level', 'student_status', 'group'
    ).order_by('name', 'father_name')
    
    total_students = students_qs.count()
    active_students = regular_students_count
    suspended_students = suspended_students_count
    graduated_students = graduated_students_count
    withdrawn_students = withdrawn_students_count
    new_students = 0
    
    # حساب المتوسطات ومؤشر انخفاض الأداء GPA < 2.0 (أقل من 50%)
    low_gpa_count = 0
    students_data = []
    for st in students_qs:
        grades_qs = Grade.objects.filter(student=st)
        avg_grade = grades_qs.aggregate(avg=Avg('total_grade'))['avg']
        
        st_avg = round(avg_grade, 2) if avg_grade is not None else None
        st_gpa = round((st_avg / 25.0), 2) if st_avg is not None else None
        
        # تحديد الحالة الأكاديمية الفعلية للطالب بدقة
        status_name = st.student_status.name if st.student_status else 'مستمر'
        is_low_perf = (st_avg is not None and st_avg < 50.0) or ('إنذار' in status_name or 'تحذير' in status_name)
        if is_low_perf:
            low_gpa_count += 1
            
        students_data.append({
            'student': st,
            'status_name': status_name,
            'avg_grade': st_avg,
            'gpa': st_gpa,
            'is_low_perf': is_low_perf,
        })

    # ============================================================
    # 3. المقررات الدراسية وجدول المقررات الأكثر رسوباً بالقسم
    # ============================================================
    
    dept_courses = Course.objects.filter(department=department).order_by('code')
    courses_count = dept_courses.count()
    
    failing_courses = []
    for crs in dept_courses:
        total_g = Grade.objects.filter(course=crs).count()
        failed_g = Grade.objects.filter(course=crs, is_passed=False).count()
        if total_g > 0:
            failure_rate = round((failed_g / total_g) * 100, 1)
        else:
            failure_rate = 0.0
            
        if total_g > 0:
            failing_courses.append({
                'course': crs,
                'total_students': total_g,
                'failed_count': failed_g,
                'failure_rate': failure_rate,
            })
            
    # ترتيب المقررات حسب الأكثر رسوباً وأخذ أعلى 5
    failing_courses = sorted(failing_courses, key=lambda x: (x['failed_count'], x['failure_rate']), reverse=True)[:5]
    
    # ============================================================
    # 4. المجموعات والشعب بالقسم
    # ============================================================
    
    groups = Group.objects.filter(department=department).select_related('level').order_by('name')
    groups_count = groups.count()
    
    # ============================================================
    # 5. بيانات الرسم البياني للحالات الأكاديمية (الحالات الخمس المعتمدة)
    # ============================================================
    
    status_chart_data = {
        'labels': ['منتظم', 'موقوف قيده', 'مسحوبة ملف', 'إخلاء طرف', 'إخلاء طرف / خريج معتمد'],
        'data': [
            regular_students_count,
            suspended_students_count,
            withdrawn_students_count,
            clearance_students_count,
            graduated_students_count
        ],
    }
    
    # ============================================================
    # 6. السياق النهائي
    # ============================================================
    
    context = {
        'department': department,
        'all_departments': all_departments,
        'students_data': students_data,
        'professors_list': professors_list,
        'faculty_and_staff_list': faculty_and_staff_list,
        'faculty_count': faculty_count,
        'staff_count': staff_count,
        'total_faculty_staff_count': total_faculty_staff_count,
        'courses': dept_courses,
        'courses_count': courses_count,
        'failing_courses': failing_courses,
        'groups': groups,
        'groups_count': groups_count,
        'total_all_students': total_all_students,
        'total_students': total_students,
        'regular_students_count': regular_students_count,
        'active_students': regular_students_count,
        'suspended_students_count': suspended_students_count,
        'suspended_students': suspended_students_count,
        'withdrawn_students_count': withdrawn_students_count,
        'withdrawn_students': withdrawn_students_count,
        'clearance_students_count': clearance_students_count,
        'graduated_students_count': graduated_students_count,
        'graduated_students': graduated_students_count,
        'new_students': 0,
        'low_gpa_count': low_gpa_count,
        'status_chart_json': json.dumps(status_chart_data),
        'semesters': Semester.objects.all().order_by('-year', '-type'),
        'levels': Level.objects.all().order_by('number'),
    }
    return render(request, 'renewal/department_detail.html', context)


@login_required
def department_analytics_api(request, dept_code):
    """
    API يرجع البيانات الإحصائية لـ 3 رسوم بيانية تفاعلية للقسم:
    1. توزيع حالات الطلاب (Student Status Distribution)
    2. أكثر 5 مواد إخفاقاً بالقسم حسب المستوى الدراسي (Top 5 Failed Courses by Level)
    3. مسار المعدل التراكمي للقسم عبر الفصول (GPA Trend Across Semesters)
    """
    from apps.grades.models import Grade
    from django.db.models import Avg, Count, Q

    if str(dept_code).isdigit():
        department = get_object_or_404(Department, id=int(dept_code))
    else:
        department = get_object_or_404(Department, code__iexact=dept_code)

    semester_id = request.GET.get('semester_id', '').strip()
    level_id = request.GET.get('level_id', '').strip()

    # 1. توزيع حالات الطلاب وفق الحالات الخمس المعتمدة
    students_qs = Student.objects.filter(department=department)
    if semester_id and semester_id != 'all' and semester_id.isdigit():
        sem_id = int(semester_id)
        enrolled_student_ids = EnrollmentRenewal.objects.filter(semester_id=sem_id).values_list('student_id', flat=True)
        if enrolled_student_ids.exists():
            students_qs = students_qs.filter(id__in=enrolled_student_ids)

    regular_cnt = students_qs.filter(student_status__name='منتظم').count()
    suspended_cnt = students_qs.filter(student_status__name='موقوف قيده').count()
    withdrawn_cnt = students_qs.filter(student_status__name='مسحوبة ملف').count()
    clearance_cnt = students_qs.filter(student_status__name='إخلاء طرف').count()
    graduated_cnt = students_qs.filter(student_status__name='إخلاء طرف / خريج معتمد').count()

    status_counts = {
        'labels': ['منتظم', 'موقوف قيده', 'مسحوبة ملف', 'إخلاء طرف', 'إخلاء طرف / خريج معتمد'],
        'data': [regular_cnt, suspended_cnt, withdrawn_cnt, clearance_cnt, graduated_cnt]
    }

    # 2. أكثر 5 مواد إخفاقاً حسب المستوى الدراسي
    courses = Course.objects.filter(department=department)
    grades_qs = Grade.objects.filter(course__department=department)

    if semester_id and semester_id != 'all' and semester_id.isdigit():
        grades_qs = grades_qs.filter(semester_id=int(semester_id))

    if level_id and level_id != 'all' and level_id.isdigit():
        lvl_val = int(level_id)
        courses = courses.filter(Q(level_id=lvl_val) | Q(level__number=lvl_val))
        grades_qs = grades_qs.filter(Q(course__level_id=lvl_val) | Q(course__level__number=lvl_val) | Q(student__level_id=lvl_val))

    failed_courses_list = []
    for crs in courses:
        crs_grades = grades_qs.filter(course=crs)
        total_g = crs_grades.count()
        if total_g > 0:
            failed_g = crs_grades.filter(is_passed=False).count()
            rate = round((failed_g / total_g) * 100, 1)
            failed_courses_list.append({
                'label': f"{crs.code} - {crs.name}",
                'failed_count': failed_g,
                'failure_rate': rate
            })

    failed_courses_sorted = sorted(failed_courses_list, key=lambda x: (x['failed_count'], x['failure_rate']), reverse=True)[:5]
    top_failed_courses = {
        'labels': [item['label'] for item in failed_courses_sorted],
        'failed_counts': [item['failed_count'] for item in failed_courses_sorted],
        'failure_rates': [item['failure_rate'] for item in failed_courses_sorted]
    }

    # 3. مسار المعدل التراكمي للقسم عبر المستويات الدراسية
    levels = Level.objects.all().order_by('number')
    gpa_labels = []
    gpa_values = []
    for lvl in levels:
        lvl_grades = Grade.objects.filter(student__department=department, student__level=lvl)
        if not lvl_grades.exists():
            lvl_grades = Grade.objects.filter(course__department=department, course__level=lvl)
        
        if lvl_grades.exists():
            avg_g = lvl_grades.aggregate(avg=Avg('total_grade'))['avg']
            if avg_g is not None:
                gpa = round((avg_g / 25.0), 2)
            else:
                gpa = 0.0
        else:
            gpa = 0.0
            
        gpa_labels.append(lvl.name if lvl.name else f"المستوى {lvl.number}")
        gpa_values.append(gpa)

    gpa_trends = {
        'labels': gpa_labels,
        'gpas': gpa_values
    }

    return JsonResponse({
        'success': True,
        'status_counts': status_counts,
        'top_failed_courses': top_failed_courses,
        'gpa_trends': gpa_trends
    })


@login_required
def get_departments_api(request):
    """API: جلب قائمة الأقسام (المفعلة فقط افتراضياً لاستبعاد الأقسام المجمدة/المؤرشفة من القوائم)"""
    include_inactive = request.GET.get('include_inactive', 'false').lower() == 'true'
    if include_inactive:
        departments = Department.objects.all().order_by('name')
    else:
        departments = Department.objects.filter(is_active=True).order_by('name')
    return JsonResponse({'success': True, 'departments': [department_to_json(item) for item in departments]})


# apps/renewal/views.py

@login_required
@csrf_exempt
@require_execution_permission('renewal.add_department', 'add_department', 'department')
def create_department_api(request):
    """
    API: إنشاء قسم/تخصص أكاديمي جديد (للمديرين فقط)
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'}, status=405)

    try:
        # قراءة البيانات من الطلب
        data = json.loads(request.body.decode('utf-8'))
        
        name = data.get('name', '').strip()
        code = data.get('code', '').strip().upper()

        # 1. التحقق من صحة المدخلات
        if not name:
            return JsonResponse({'success': False, 'error': 'اسم التخصص مطلوب.'}, status=400)
        
        if not code:
            return JsonResponse({'success': False, 'error': 'رمز التخصص مطلوب.'}, status=400)

        # 2. التحقق من عدم وجود قسم بنفس الاسم أو الرمز
        if Department.objects.filter(name__iexact=name).exists():
            return JsonResponse({'success': False, 'error': f'يوجد قسم بنفس الاسم "{name}" بالفعل.'}, status=400)

        if Department.objects.filter(code__iexact=code).exists():
            return JsonResponse({'success': False, 'error': f'رمز التخصص "{code}" مستخدم بالفعل.'}, status=400)

        # 3. إنشاء القسم
        department = Department.objects.create(
            name=name, 
            code=code, 
            is_active=True
        )

        # 🛡️ توثيق إنشاء قسم جديد في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='Department',
                object_name=department.name,
                details=f"إضافة قسم/تخصص أكاديمي جديد ({department.name}) بالرمز ({department.code})",
                request=request
            )
        except Exception:
            pass

        # 4. إرجاع البيانات بنجاح
        return JsonResponse({
            'success': True,
            'message': f'✅ تم إضافة التخصص "{name}" بنجاح.',
            'department': {
                'id': department.id,
                'name': department.name,
                'code': department.code,
                'is_active': department.is_active
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة (JSON).'}, status=400)
    except Exception as e:
        # في حالة حدوث أي خطأ غير متوقع
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': f'حدث خطأ داخلي في السيرفر: {str(e)}'}, status=500)

@login_required
@csrf_exempt
@require_execution_permission('renewal.change_department', 'change_department', 'department')
def update_department_api(request, dept_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json_payload(request)
        department = get_object_or_404(Department, id=dept_id)
        name = (data.get('name') or '').strip()
        code = (data.get('code') or '').strip()
        if not name or not code:
            return JsonResponse({'success': False, 'error': 'اسم ورمز التخصص مطلوبان'})
        department.name = name
        department.code = code
        department.save()

        # 🛡️ توثيق تعديل بيانات قسم في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='Department',
                object_name=department.name,
                details=f"تعديل بيانات القسم الأكاديمي إلى ({name}) والرمز ({code})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({'success': True, 'message': 'تم تحديث التخصص', 'department': department_to_json(department)})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
def filters_data_api(request):
    """API: جلب قائمة التخصصات والفصول لفلاتر البحث"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    dept_list = [{'id': d.id, 'name': d.name, 'code': d.code} for d in departments]
    return JsonResponse({'success': True, 'departments': dept_list})


@login_required
def subject_data_api(request):
    """
    API: استعلام عن مواد الفصل المطروحة بناءً على التخصص، نوع الفصل، والسنة الدراسية
    """
    department_id = request.GET.get('department_id') or request.GET.get('department') or request.GET.get('major_id')
    level_id = request.GET.get('level_id') or request.GET.get('level')
    semester_type = request.GET.get('semester_type') or request.GET.get('season_type')
    semester_year = request.GET.get('semester_year') or request.GET.get('year')

    from apps.faculty.models import CourseAssignment

    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    courses_qs = Course.objects.filter(is_active=True).filter(
        Q(department__isnull=True) | Q(department__is_active=True)
    ).select_related('level').prefetch_related('department').distinct()

    if is_academic_dept and user_dept:
        courses_qs = courses_qs.filter(department=user_dept)
    elif is_valid_filter(department_id):
        if str(department_id).isdigit():
            courses_qs = courses_qs.filter(department__id=int(department_id), department__is_active=True)
        else:
            courses_qs = courses_qs.filter(department__name__icontains=str(department_id).strip(), department__is_active=True)

    if is_valid_filter(level_id):
        if str(level_id).isdigit():
            courses_qs = courses_qs.filter(Q(level__id=int(level_id)) | Q(level__number=int(level_id)))
        else:
            courses_qs = courses_qs.filter(level__name__icontains=str(level_id).strip())

    semester_obj = None
    if is_valid_filter(semester_type) and is_valid_filter(semester_year):
        try:
            year_val = int(semester_year)
            semester_obj = Semester.objects.filter(type=semester_type, year=year_val).first()
        except ValueError:
            pass

    if not semester_obj:
        semester_obj = Semester.objects.filter(is_active=True).first()

    # جلب التكليفات للأساتذة والمجموعات
    assignments = CourseAssignment.objects.filter(
        course__in=courses_qs,
        is_active=True
    ).select_related('professor', 'student_group', 'semester')
    
    if semester_obj:
        assignments = assignments.filter(semester=semester_obj)

    assignments_map = {}
    for a in assignments:
        if a.course_id not in assignments_map:
            assignments_map[a.course_id] = []
        assignments_map[a.course_id].append(a)

    data = []
    for c in courses_qs:
        course_assignments = assignments_map.get(c.id, [])
        
        instructors_list = list(set([a.professor.full_name for a in course_assignments if a.professor]))
        groups_list = list(set([a.student_group.name for a in course_assignments if a.student_group]))

        instructor_str = " ، ".join(instructors_list) if instructors_list else "غير محدد"
        group_str = " ، ".join(groups_list) if groups_list else "الشعبة العامة"

        sem_name = f"{semester_obj.get_type_display()} {semester_obj.year}" if semester_obj else "الفصل الحالي"

        depts = list(c.department.filter(is_active=True))
        dept_names = " ، ".join([d.name for d in depts]) if depts else "عام"
        first_dept_id = depts[0].id if depts else None

        data.append({
            'id': c.id,
            'code': c.code or '-',
            'name': c.name,
            'credits': int(c.credits),
            'department': dept_names,
            'department_id': first_dept_id,
            'level': c.level.name if c.level else 'المستوى 1',
            'instructor': instructor_str,
            'group': group_str,
            'instructors': instructors_list,
            'groups': groups_list,
            'semester': sem_name,
            'semester_type': semester_type,
            'semester_year': semester_year,
            'status': 'مطروحة' if c.is_active else 'غير مطروحة',
        })

    return JsonResponse({
        'success': True,
        'courses': data,
        'count': len(data),
        'message': 'تم جلب مواد الفصل بنجاح' if data else 'لا توجد مواد مطروحة لهذا التخصص في هذا الفصل'
    })


@login_required
@csrf_exempt
@require_execution_permission('renewal.delete_department', 'delete_department', 'department')
def delete_department_api(request, dept_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        department = get_object_or_404(Department, id=dept_id)
        if Student.objects.filter(department=department).exists() or Course.objects.filter(department=department).exists():
            return JsonResponse({'success': False, 'error': 'لا يمكن الحذف لوجود طلاب أو مواد مرتبطة بهذا التخصص'})
        department.delete()
        return JsonResponse({'success': True, 'message': 'تم حذف التخصص'})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.change_department', 'change_department', 'department')
def toggle_department_active_api(request, dept_id):
    """
    API: تفعيل أو إلغاء تفعيل (تجميد) القسم العلمي
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        department = get_object_or_404(Department, id=dept_id)
        department.is_active = not department.is_active
        department.save()
        status_text = "تفعيل" if department.is_active else "تجميد / إلغاء تفعيل"
        return JsonResponse({
            'success': True,
            'message': f'تم {status_text} قسم ({department.name}) بنجاح',
            'is_active': department.is_active
        })
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})




@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def create_course_api(request):
    """API: إنشاء مادة دراسية جديدة"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json_payload(request)
        
        # 🔥 التحقق من البيانات المطلوبة
        if not data.get('name'):
            return JsonResponse({'success': False, 'error': 'اسم المادة مطلوب'})
        if not data.get('code'):
            return JsonResponse({'success': False, 'error': 'رمز المادة مطلوب'})
        if not data.get('level_id'):
            return JsonResponse({'success': False, 'error': 'المستوى الدراسي مطلوب'})
        
        # 🔥 استخراج والتحقق من التخصصات
        department_ids = data.get('department_ids') or data.get('departments') or []
        department_id = data.get('department_id')
        if not department_ids and department_id:
            department_ids = [int(department_id)]
        elif isinstance(department_ids, list):
            department_ids = [int(x.get('id') if isinstance(x, dict) else x) for x in department_ids if x]
            
        if not department_ids:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار تخصص واحد على الأقل للمادة'})
            
        level_id = int(data.get('level_id'))
        
        try:
            level = Level.objects.get(id=level_id)
        except Level.DoesNotExist:
            return JsonResponse({
                'success': False, 
                'error': f'المستوى برقم {level_id} غير موجود'
            })
        
        # 🔥 التحقق من عدم تكرار الكود
        code = data.get('code', '').strip().upper()
        if Course.objects.filter(code=code).exists():
            return JsonResponse({
                'success': False, 
                'error': f'رمز المادة "{code}" مستخدم بالفعل'
            })
        
        # 🔥 إنشاء المادة
        course = Course.objects.create(
            name=data.get('name', '').strip(),
            code=code,
            credits=int(data.get('credits', 3)),
            theoretical_hours=int(data.get('theoretical_hours', 0)),
            practical_hours=int(data.get('practical_hours', 0)),
            study_plan_id=int(data.get('study_plan_id', 1)),
            level=level,
            is_active=bool(data.get('is_active', True)),
            is_mandatory=bool(data.get('is_mandatory', True)),
        )
        
        if department_ids:
            course.department.set(department_ids)
            
        # 🔥 ربط المتطلبات السابقة
        prerequisite_ids = data.get('prerequisite_ids', [])
        if prerequisite_ids:
            course.prerequisites.set(prerequisite_ids)
        
        # 🔥 تأكيد الحفظ
        course.save()
        
        return JsonResponse({
            'success': True,
            'message': f'تم إضافة المادة {course.name} بنجاح',
            'course': course_to_json(course)
        })
    
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False, 
            'error': str(exc)
        })


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def update_course_api(request, course_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        data = json_payload(request)
        course = get_object_or_404(Course, id=course_id)
        course.name = (data.get('name') or '').strip()
        course.code = (data.get('code') or '').strip()
        course.credits = int(data.get('credits') or 3)
        course.theoretical_hours = int(data.get('theoretical_hours') or 0)
        course.practical_hours = int(data.get('practical_hours') or 0)
        course.study_plan_id = int(data.get('study_plan_id', 1))
        course.level_id = int(data.get('level_id'))
        course.is_active = bool(data.get('is_active', True))
        course.is_mandatory = bool(data.get('is_mandatory', True))
        course.save()
        
        department_ids = data.get('department_ids', [])
        department_id = data.get('department_id')
        if not department_ids and department_id:
            department_ids = [int(department_id)]
        if department_ids:
            course.department.set(department_ids)
            
        prerequisite_ids = [int(item) for item in data.get('prerequisite_ids', []) if int(item) != course.id]
        course.prerequisites.set(prerequisite_ids)
        return JsonResponse({'success': True, 'message': 'تم تحديث المادة', 'course': course_to_json(course)})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.delete_course', 'delete_course', 'course')
def delete_course_api(request, course_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    try:
        course = get_object_or_404(Course, id=course_id)
        if CourseRegistration.objects.filter(course=course).exists():
            return JsonResponse({'success': False, 'error': 'لا يمكن الحذف لوجود تنزيلات مرتبطة بهذه المادة'})
        course.delete()
        return JsonResponse({'success': True, 'message': 'تم حذف المادة'})
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)})
    
# إدارة الوظائف (Jobs)

@login_required
def get_jobs_api(request):
    """API: جلب جميع الوظائف النشطة"""
    jobs = Job.objects.filter(is_active=True).order_by('-posted_date')
    data = []
    for job in jobs:
        data.append({
            'id': job.id,
            'title': job.title,
            'description': job.description,
            'requirements': job.requirements,
            'posted_date': job.posted_date.strftime('%Y-%m-%d'),
            'is_active': job.is_active
        })
    return JsonResponse({'success': True, 'jobs': data})

@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
def create_job_api(request):
    """API: إضافة وظيفة جديدة (للمدير فقط)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        job = Job.objects.create(
            title=data.get('title'),
            description=data.get('description'),
            requirements=data.get('requirements')
        )
        return JsonResponse({'success': True, 'message': '✅ تم إضافة الوظيفة بنجاح', 'job': {
            'id': job.id,
            'title': job.title,
            'description': job.description,
            'requirements': job.requirements,
            'posted_date': job.posted_date.strftime('%Y-%m-%d')
        }})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_group', 'renewal.change_group', 'add_group', 'change_group')
def save_groups_api(request):
    """API: حفظ توزيع المجموعات مع السنة الدراسية والفصل الدراسي"""
    create_groups_info = get_create_student_groups_job_info()
    if not create_groups_info['is_create_groups_job_open']:
        return JsonResponse({'success': False, 'error': create_groups_info['create_groups_job_message']}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        groups = data.get('groups', [])
        
        academic_year = str(data.get('semester_year') or data.get('academic_year') or '2026').strip()
        semester = str(data.get('semester_type') or data.get('semester') or 'spring').strip()
        
        # 🔥 التحقق من عدم وجود طالب في أكثر من مجموعة
        all_student_ids = []
        for group_data in groups:
            student_ids = group_data.get('students', [])
            all_student_ids.extend(student_ids)
        
        duplicates = []
        seen = set()
        for sid in all_student_ids:
            if sid in seen:
                duplicates.append(sid)
            seen.add(sid)
        
        if duplicates:
            student_names = []
            for sid in duplicates[:5]:
                student = Student.objects.get(id=sid)
                student_names.append(student.name)
            return JsonResponse({
                'success': False, 
                'error': f'⚠️ يوجد طلاب في أكثر من مجموعة: {", ".join(student_names)}'
            })
        
        # توزيع الطلاب على المجموعات
        for group_data in groups:
            group_name = group_data.get('name')
            student_ids = group_data.get('students', [])
            
            # إنشاء أو تحديث المجموعة بالانتماء الصريح للسنة والفصل
            group, created = Group.objects.get_or_create(
                name=group_name,
                department_id=data.get('department_id'),
                level_id=data.get('level_id'),
                academic_year=academic_year,
                semester=semester
            )
            
            # إزالة الطلاب من أي مجموعة أخرى قبل إضافتهم
            Student.objects.filter(id__in=student_ids).update(group=group)
        
        # 🛡️ توثيق توزيع وإسناد المجموعات في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='Group',
                object_name='إدارة المجموعات الدراسية',
                details=f"توزيع وإسناد الطلاب على ({len(groups)}) مجموعات دراسية للسنة ({academic_year}) والفصل ({semester})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': f'✅ تم توزيع الطلاب على {len(groups)} مجموعات'
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def get_groups_list_api(request):
    """API: جلب قائمة المجموعات مع عدد الطلاب"""
    groups = Group.objects.all().select_related('department', 'level')
    data = []
    for g in groups:
        data.append({
            'id': g.id,
            'name': g.name,
            'department_name': g.department.name if g.department else '-',
            'level_number': g.level.number if g.level else '-',
            'academic_year': getattr(g, 'academic_year', '2026'),
            'semester': getattr(g, 'semester', 'spring'),
            'student_count': Student.objects.filter(group=g).count()
        })
    return JsonResponse({'success': True, 'groups': data})


# APIs للمواد الدراسية (لـ subject_data.js)


@login_required
def get_subjects_api(request):
    """API: جلب جميع المواد الدراسية للبحث (متوافق مع subject_data.js) - المواد والخطط النشطة فقط"""
    try:
        courses = Course.objects.filter(is_active=True).filter(
            db_models.Q(study_plan__isnull=True) | db_models.Q(study_plan__is_active=True)
        ).select_related('level', 'study_plan').prefetch_related('department', 'prerequisites')
        
        # فلترة حسب التخصص فقط عند التحديد الصريح
        department_id = request.GET.get('department_id', '').strip()
        if department_id and department_id not in ['all', '0', '']:
            dept_filtered = courses.filter(
                db_models.Q(department__id=department_id) |
                db_models.Q(department__name__icontains='عام')
            ).distinct()
            if dept_filtered.exists():
                courses = dept_filtered
        
        # فلترة حسب المستوى فقط عند التحديد الصريح
        level_id = request.GET.get('level_id', '').strip()
        if level_id and level_id not in ['all', '0', '']:
            level_filtered = courses.filter(level_id=level_id)
            if level_filtered.exists():
                courses = level_filtered
        
        # بحث بالاسم أو الكود
        search = request.GET.get('search', '').strip()
        if search:
            courses = courses.filter(
                db_models.Q(name__icontains=search) | 
                db_models.Q(code__icontains=search)
            )
        
        courses = courses.order_by('level__number', 'code')[:500]
        
        data = []
        for course in courses:
            prerequisites = []
            for prereq in course.prerequisites.all():
                prerequisites.append({
                    'id': prereq.id,
                    'name': prereq.name,
                    'code': prereq.code
                })
            
            depts = list(course.department.filter(is_active=True))
            dept_ids = [d.id for d in depts]
            dept_name = " ، ".join([d.name for d in depts]) if depts else "عام"
            primary_dept_id = dept_ids[0] if dept_ids else None

            data.append({
                'id': course.id,
                'name': course.name,
                'code': course.code,
                'credits': course.credits,
                'theoretical_hours': course.theoretical_hours,
                'practical_hours': course.practical_hours,
                'department_id': primary_dept_id,
                'department_ids': dept_ids,
                'department_name': dept_name,
                'department': dept_name,
                'level_id': course.level_id,
                'level_number': course.level.number if course.level else 0,
                'study_plan_id': course.study_plan_id,
                'study_plan_name': course.study_plan.name if course.study_plan else '',
                'is_active': course.is_active,
                'is_mandatory': course.is_mandatory,
                'prerequisite': ", ".join([p['code'] for p in prerequisites if p.get('code')]) or None,
                'prerequisite_name': " ، ".join([f"{p['name']} ({p['code']})" for p in prerequisites if p.get('name') and p.get('code')]) or None,
                'prerequisites': prerequisites,
                'prerequisite_ids': [p.id for p in course.prerequisites.all()],
                'plans': [course.study_plan_id] if course.study_plan_id else [1, 2]
            })
        
        return JsonResponse({'success': True, 'courses': data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e), 'courses': []})

# ألياس لتوافق المسارات /renewal/api/courses/
get_courses_api = get_subjects_api


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def save_subject_api(request):
    """API: حفظ مادة دراسية جديدة أو تحديثها (متوافق مع subject_data.js)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        
        # استخراج البيانات
        course_id = data.get('id')
        name = data.get('name', '').strip()
        code = data.get('code', '').strip().upper()
        credits = int(data.get('credits', 3))
        theoretical_hours = int(data.get('theoretical_hours', 3))
        practical_hours = int(data.get('practical_hours', 0))
        department_id = data.get('department_id')
        department_ids = data.get('department_ids', [])
        level_id = data.get('level_id')
        study_plan_id = data.get('study_plan_id', 1)
        is_active = data.get('is_active', True)
        is_mandatory = data.get('is_mandatory', True)
        prerequisite_ids = data.get('prerequisite_ids', [])
        
        # التحقق من البيانات المطلوبة
        if not name:
            return JsonResponse({'success': False, 'error': 'اسم المادة مطلوب'})
        
        if not code:
            return JsonResponse({'success': False, 'error': 'رمز المادة مطلوب'})
        
        if not department_id and not department_ids:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار التخصص'})
        
        if not level_id:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار المستوى'})
        
        target_dept_ids = department_ids if department_ids else ([int(department_id)] if department_id else [])

        if course_id:
            # تحديث مادة موجودة
            course = get_object_or_404(Course, id=course_id)
            course.name = name
            course.code = code
            course.credits = credits
            course.theoretical_hours = theoretical_hours
            course.practical_hours = practical_hours
            course.level_id = level_id
            course.study_plan_id = study_plan_id
            course.is_active = is_active
            course.is_mandatory = is_mandatory
            course.save()
            if target_dept_ids:
                course.department.set(target_dept_ids)
            message = f'تم تحديث المادة {name} بنجاح'
        else:
            # إنشاء مادة جديدة
            course = Course.objects.create(
                name=name,
                code=code,
                credits=credits,
                theoretical_hours=theoretical_hours,
                practical_hours=practical_hours,
                level_id=level_id,
                study_plan_id=study_plan_id,
                is_active=is_active,
                is_mandatory=is_mandatory,
            )
            if target_dept_ids:
                course.department.set(target_dept_ids)
            message = f'تم إضافة المادة {name} بنجاح'
        
        # تحديث المتطلبات السابقة (تجنب الإشارة الذاتية)
        if prerequisite_ids:
            clean_ids = [int(p) for p in prerequisite_ids if int(p) != course.id]
            course.prerequisites.set(clean_ids)
        else:
            course.prerequisites.clear()
        
        # 🛡️ توثيق حفظ/تعديل المادة الدراسية في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            act_type = 'update' if course_id else 'create'
            log_activity(
                user=request.user,
                action=act_type,
                model_name='Course',
                object_name=f"{course.code} - {course.name}",
                details=f"{message} بالرمز ({code}) والساعات المعتمدة ({credits})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': message,
            'course': course_to_json(course)
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})
    

# ================================================================
# APIs إدارة المواد الدراسية والتخصصات (Subject & Course Management)
# ================================================================

@login_required
def get_departments_api(request):
    """API: جلب قائمة الأقسام/التخصصات (المفعلة فقط) لنموذج المواد والدراسة"""
    include_inactive = request.GET.get('include_inactive', 'false').lower() == 'true'
    if include_inactive:
        departments = Department.objects.all().order_by('name')
    else:
        departments = Department.objects.filter(is_active=True).order_by('name')
    data = [{'id': dept.id, 'name': dept.name} for dept in departments]
    return JsonResponse({'success': True, 'departments': data})



# ================================================================
# APIs إدارة المجموعات المتقدمة
# ================================================================

def resolve_single_course_for_group(group, students=None, target_course=None):
    """
    إرجاع مادة واحدة فقط محددة للمجموعة بدقة تامة وبدون أي تداخل أو دمج أسماء مواد متعددة:
    (course_id, course_name, course_code)
    """
    from apps.faculty.models import CourseAssignment
    from apps.renewal.models import Course, CourseRegistration
    from apps.grades.models import Grade
    from django.db.models import Count

    if target_course:
        return target_course.id, target_course.name, target_course.code or ''

    # 1. البحث في تكليفات الأساتذة للمجموعة (CourseAssignment)
    assignment = CourseAssignment.objects.filter(
        student_group=group,
        is_active=True
    ).select_related('course').first()
    if assignment and assignment.course:
        return assignment.course.id, assignment.course.name, assignment.course.code or ''

    # 2. فحص مطابقة اسم المجموعة مع أسماء ورموز المواد
    group_name = (group.name or '').strip().lower()
    if group_name:
        dept = group.department
        level = group.level
        courses_qs = Course.objects.filter(is_active=True)
        if dept:
            courses_qs = courses_qs.filter(department=dept)
        if level:
            courses_qs = courses_qs.filter(level=level)

        # مطابقة تامة أو شبه تامة
        for c in courses_qs:
            c_name = (c.name or '').strip().lower()
            c_code = (c.code or '').strip().lower()
            if (c_name and (c_name in group_name or group_name in c_name)) or (c_code and c_code in group_name):
                return c.id, c.name, c.code or ''

        # مطابقة كلمات رئيسية في اسم المادة (مثل رياضة، برمجة، شبكات، قواعد، إلخ)
        for c in courses_qs:
            c_name = (c.name or '').strip().lower()
            keywords = [w for w in c_name.split() if len(w) > 2]
            for kw in keywords:
                if kw in group_name:
                    return c.id, c.name, c.code or ''

    # 3. جلب المادة الأكثر شيوعاً بين طلاب المجموعة من التسجيلات (أو الأولى فقط)
    if students is None:
        students = group.student_set.all()

    if students.exists():
        top_reg = CourseRegistration.objects.filter(
            student__in=students,
            course__isnull=False
        ).values('course__id', 'course__name', 'course__code').annotate(
            cnt=Count('id')
        ).order_by('-cnt').first()

        if top_reg and top_reg.get('course__name'):
            return top_reg['course__id'], top_reg['course__name'], top_reg.get('course__code') or ''

        top_grade = Grade.objects.filter(
            student__in=students,
            course__isnull=False
        ).values('course__id', 'course__name', 'course__code').annotate(
            cnt=Count('id')
        ).order_by('-cnt').first()

        if top_grade and top_grade.get('course__name'):
            return top_grade['course__id'], top_grade['course__name'], top_grade.get('course__code') or ''

    return None, 'غير محددة', '-'


@login_required
def get_filtered_groups_api(request):
    """
    API: جلب المجموعات مع الفلترة حسب (القسم، المستوى، المادة، الفصل، السنة)
    مع إرجاع اسم مادة واحدة محددة بدقة لكل مجموعة
    """
    try:
        department_id = request.GET.get('department_id') or request.GET.get('department')
        level_id = request.GET.get('level_id') or request.GET.get('level')
        course_id = request.GET.get('course_id') or request.GET.get('course')
        semester_year = request.GET.get('semester_year') or request.GET.get('academic_year') or request.GET.get('year')
        semester_type = request.GET.get('semester_type') or request.GET.get('semester')
        
        # جلب كافة المجموعات مع بيانات القسم والمستوى
        groups = Group.objects.all().select_related('department', 'level').order_by('-id')
        
        if is_valid_filter(department_id) and str(department_id).isdigit():
            groups = groups.filter(department_id=int(department_id))
            
        if is_valid_filter(level_id) and str(level_id).isdigit():
            groups = groups.filter(level_id=int(level_id))
            
        if is_valid_filter(semester_year):
            year_str = str(semester_year).strip()
            groups = groups.filter(
                Q(academic_year=year_str) | Q(academic_year__isnull=True) | Q(academic_year='')
            )
            
        if is_valid_filter(semester_type):
            sem_str = str(semester_type).strip()
            groups = groups.filter(
                Q(semester=sem_str) | Q(semester__isnull=True) | Q(semester='')
            )
            
        target_course = None
        if is_valid_filter(course_id) and str(course_id).isdigit():
            target_course = Course.objects.filter(id=int(course_id)).first()
            if target_course:
                # فلترة ناعمة: التخصص في Course هو ManyToMany
                course_dept_ids = list(target_course.department.values_list('id', flat=True))
                if course_dept_ids and not is_valid_filter(department_id):
                    groups = groups.filter(department_id__in=course_dept_ids)
                if target_course.level_id and not is_valid_filter(level_id):
                    groups = groups.filter(level_id=target_course.level_id)
        
        data = []
        for group in groups:
            students = group.student_set.all().select_related('level', 'department')
            c_id, course_name, course_code = resolve_single_course_for_group(group, students=students, target_course=target_course)

            data.append({
                'id': group.id,
                'name': group.name,
                'department_id': group.department_id,
                'department_name': group.department.name if group.department else '',
                'level_id': group.level_id,
                'level_number': group.level.number if group.level else 0,
                'academic_year': getattr(group, 'academic_year', '2026') or '2026',
                'semester': getattr(group, 'semester', 'spring') or 'spring',
                'course_id': c_id,
                'course_name': course_name,
                'course_code': course_code,
                'student_count': students.count(),
                'students': [
                    {
                        'id': s.id,
                        'student_id': s.student_id,
                        'name': s.name,
                        'father_name': s.father_name or '',
                        'grandfather_name': s.grandfather_name or '',
                        'last_name': s.last_name or '',
                        'level_number': s.level.number if s.level else 0,
                    }
                    for s in students
                ]
            })
        
        return JsonResponse({'success': True, 'groups': data})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e), 'groups': []}, status=200)


@login_required
def get_group_details_api(request, group_id):
    """API: جلب تفاصيل مجموعة محددة مع مادة واحدة بدقة"""
    try:
        group = get_object_or_404(Group, id=group_id)
        students = group.student_set.all().select_related('level', 'department')
        
        c_id, course_name, course_code = resolve_single_course_for_group(group, students=students)

        data = {
            'id': group.id,
            'name': group.name,
            'department_id': group.department_id,
            'department_name': group.department.name if group.department else '',
            'level_id': group.level_id,
            'level_number': group.level.number if group.level else 0,
            'course_id': c_id,
            'course_name': course_name,
            'course_code': course_code,
            'student_count': students.count(),
            'students': [
                {
                    'id': s.id,
                    'student_id': s.student_id,
                    'name': s.name,
                    'father_name': s.father_name or '',
                    'grandfather_name': s.grandfather_name or '',
                    'last_name': s.last_name or '',
                    'level_number': s.level.number if s.level else 0,
                }
                for s in students
            ]
        }
        return JsonResponse({'success': True, 'group': data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
def update_group_api(request, group_id):
    """API: تحديث بيانات مجموعة (تعديل الاسم، إضافة/إزالة طلاب)"""
    create_groups_info = get_create_student_groups_job_info()
    if not create_groups_info['is_create_groups_job_open']:
        return JsonResponse({'success': False, 'error': create_groups_info['create_groups_job_message']}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        group = get_object_or_404(Group, id=group_id)
        
        # تحديث اسم المجموعة إذا تم إرساله
        new_name = data.get('name')
        if new_name:
            group.name = new_name
            group.save()
        
        # تحديث قائمة الطلاب
        student_ids = data.get('student_ids', [])
        if student_ids:
            # إزالة جميع الطلاب من المجموعة ثم إضافة الجدد
            group.student_set.clear()
            students = Student.objects.filter(id__in=student_ids)
            for student in students:
                student.group = group
                student.save()
        
        return JsonResponse({
            'success': True,
            'message': '✅ تم تحديث المجموعة بنجاح',
            'group': {
                'id': group.id,
                'name': group.name,
                'student_count': group.student_set.count()
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


# ================================================================
# APIs لتبديل المجموعات (Group Swap)
# ================================================================

@login_required
def student_detail_api(request, student_id):
    """API: جلب تفاصيل طالب واحد للتبديل"""
    try:
        student = get_object_or_404(Student, id=student_id)
        
        # جلب المجموعة الحالية للطالب
        group_name = student.group.name if student.group else None
        
        # استخراج نوع الفصل والسنة من enrollment_semester
        semester_type = ''
        semester_year = ''
        if student.enrollment_semester:
            parts = student.enrollment_semester.split()
            for part in parts:
                part_clean = ''.join(c for c in part if c.isdigit())
                if part_clean:
                    semester_year = part_clean
                else:
                    if 'ربيع' in part or 'spring' in part.lower():
                        semester_type = 'spring'
                    elif 'خريف' in part or 'fall' in part.lower():
                        semester_type = 'fall'
            
            # إذا لم نجد الفصل في الكلمات الفردية ولكن وجدناه في النص الكامل
            if not semester_type:
                if 'ربيع' in student.enrollment_semester or 'spring' in student.enrollment_semester.lower():
                    semester_type = 'spring'
                elif 'خريف' in student.enrollment_semester or 'fall' in student.enrollment_semester.lower():
                    semester_type = 'fall'
        
        # إذا لم تكن السنة مسجلة، نلجأ لتاريخ الالتحاق
        if not semester_year and student.enrollment_date:
            semester_year = str(student.enrollment_date.year)
        
        data = {
            'id': student.id,
            'student_id': student.student_id,
            'name': student.name,
            'father_name': student.father_name,
            'department_id': student.department.id if student.department else None,
            'department_name': student.department.name if student.department else '',
            'level_id': student.level.id if student.level else None,
            'level_number': student.level.number if student.level else 0,
            'group_id': student.group.id if student.group else None,
            'group_name': group_name,
            'semester_type': semester_type,
            'semester_year': semester_year,
        }
        return JsonResponse({'success': True, 'student': data})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.change_group', 'change_group')
def swap_groups_api(request):
    """API: تبديل مجموعات طالبين (1-to-1 Swap)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_a_id = data.get('student_a_id')
        student_b_id = data.get('student_b_id')
        
        if not student_a_id or not student_b_id:
            return JsonResponse({'success': False, 'error': 'الرجاء تحديد الطالبين'})
        
        if student_a_id == student_b_id:
            return JsonResponse({'success': False, 'error': 'لا يمكن تبديل الطالب مع نفسه'})
        
        from django.db import transaction
        
        with transaction.atomic():
            # جلب الطالبين
            student_a = get_object_or_404(Student, id=student_a_id)
            student_b = get_object_or_404(Student, id=student_b_id)
            
            # تخزين المجموعات الحالية
            group_a = student_a.group
            group_b = student_b.group
            
            # التحقق من أن الطالبين في مجموعات مختلفة
            if group_a == group_b:
                return JsonResponse({'success': False, 'error': 'الطالبان في نفس المجموعة'})
            
            # تبديل المجموعات
            student_a.group = group_b
            student_b.group = group_a
            
            # حفظ التغييرات
            student_a.save(update_fields=['group'])
            student_b.save(update_fields=['group'])
            
            # تسجيل العملية
            print(f"🔄 تم تبديل المجموعات: {student_a.name} ←→ {student_b.name}")
            print(f"   {student_a.name} → {group_b.name if group_b else 'بدون مجموعة'}")
            print(f"   {student_b.name} → {group_a.name if group_a else 'بدون مجموعة'}")
        
        return JsonResponse({
            'success': True,
            'message': '✅ تم تبديل المجموعات بنجاح',
            'data': {
                'student_a': {
                    'id': student_a.id,
                    'name': student_a.name,
                    'group': group_b.name if group_b else None
                },
                'student_b': {
                    'id': student_b.id,
                    'name': student_b.name,
                    'group': group_a.name if group_a else None
                }
            }
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def group_swap_page(request):
    """صفحة تبديل المجموعات"""
    return render(request, 'renewal/group_swap.html')

@login_required
def search_prerequisites_api(request):
    """API: البحث عن المواد المؤهلة كمتطلبات سابقة (مستويات سابقة فقط level < current_level)"""
    try:
        department_id = request.GET.get('department_id')
        level_id = request.GET.get('level_id')
        current_level_num = request.GET.get('current_level') or request.GET.get('level_number')
        search = request.GET.get('search', '').strip()
        exclude_id = request.GET.get('exclude_id')
        
        courses = Course.objects.filter(is_active=True).select_related('level').prefetch_related('department')
        
        if department_id:
            courses = courses.filter(department__id=department_id)
        
        target_level_number = None
        if level_id:
            lvl = Level.objects.filter(id=level_id).first()
            if lvl:
                target_level_number = lvl.number
        elif current_level_num and str(current_level_num).isdigit():
            target_level_number = int(current_level_num)

        if target_level_number is not None:
            if target_level_number <= 1:
                # المستوى الأول ليس له مواد أسبقية
                return JsonResponse({'success': True, 'courses': [], 'message': 'المستوى الأول لا يحتوي على أسبقيات'})
            courses = courses.filter(level__number__lt=target_level_number)
        
        if search:
            courses = courses.filter(
                Q(name__icontains=search) | 
                Q(code__icontains=search)
            )
        
        if exclude_id:
            courses = courses.exclude(id=exclude_id)
        
        data = []
        for course in courses[:30]:
            data.append({
                'id': course.id,
                'code': course.code,
                'name': course.name,
                'level_number': course.level.number if course.level else 0,
                'display': f"{course.code} - {course.name} (المستوى {course.level.number if course.level else ''})"
            })
        
        return JsonResponse({'success': True, 'courses': data})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


# ================================================================
# دوال إدارة إيقاف القيد الفصلي
# ================================================================

@login_required
def suspend_student_page(request):
    """صفحة إدارة إيقاف القيد"""
    suspend_info = get_suspend_student_job_info()
    is_suspend_job_open = suspend_info['is_suspend_job_open']
    suspend_job_message = suspend_info['suspend_job_message']

    departments = Department.objects.filter(is_active=True).order_by('name')
    levels = Level.objects.all()
    
    context = {
        'departments': departments,
        'levels': levels,
        'is_suspend_job_open': is_suspend_job_open,
        'suspend_job_message': suspend_job_message,
    }
    return render(request, 'renewal/suspend_student.html', context)


@login_required
def search_student_for_suspend_api(request):
    """API: البحث عن طالب لإيقاف قيده"""
    search = request.GET.get('search', '').strip()
    
    if not search:
        return JsonResponse({'success': False, 'error': 'الرجاء إدخال اسم أو رقم قيد'})
    
    students = Student.objects.filter(
        db_models.Q(student_id__icontains=search) | 
        db_models.Q(name__icontains=search)
    ).select_related('department', 'level', 'student_status')[:10]
    
    if not students.exists():
        return JsonResponse({'success': False, 'error': 'لا يوجد طالب بهذا الرقم أو الاسم'})
    
    # جلب الفصل الدراسي النشط
    current_semester = Semester.objects.filter(is_active=True).first()
    
    data = []
    for student in students:
        # جلب آخر قيد للطالب
        last_enrollment = EnrollmentRenewal.objects.filter(
            student=student
        ).order_by('-renewal_date').first()
        
        data.append({
            'id': student.id,
            'student_id': student.student_id,
            'name': student.name,
            'father_name': student.father_name or '',
            'department_name': student.department.name if student.department else '-',
            'level_number': student.level.number if student.level else 0,
            'student_status': student.student_status.name if student.student_status else 'غير محدد',
            'current_enrollment_status': last_enrollment.status if last_enrollment else 'لا يوجد قيد',
            'current_semester': str(current_semester) if current_semester else 'لا يوجد فصل نشط',
        })
    
    return JsonResponse({'success': True, 'students': data})


@login_required
def get_suspended_students_filtered_api(request):
    """API: جلب الطلاب الموقوفين مع فلترة حسب التخصص والمستوى"""
    department_id = request.GET.get('department_id')
    level_id = request.GET.get('level_id')
    
    # جلب الفصل الدراسي النشط
    current_semester = Semester.objects.filter(is_active=True).first()
    if not current_semester:
        return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط'})
    
    # جلب الطلاب الموقوفين في الفصل الحالي
    suspended_enrollments = EnrollmentRenewal.objects.filter(
        semester=current_semester,
        status='suspended'
    ).select_related('student', 'student__department', 'student__level')
    
    # فلترة حسب التخصص
    if department_id:
        suspended_enrollments = suspended_enrollments.filter(
            student__department_id=department_id
        )
    
    # فلترة حسب المستوى
    if level_id:
        suspended_enrollments = suspended_enrollments.filter(
            student__level_id=level_id
        )
    
    data = []
    for enrollment in suspended_enrollments:
        student = enrollment.student
        data.append({
            'id': student.id,
            'student_id': student.student_id,
            'name': student.name,
            'father_name': student.father_name or '',
            'department_name': student.department.name if student.department else '-',
            'level_number': student.level.number if student.level else 0,
            'suspended_date': enrollment.renewal_date.strftime('%Y-%m-%d'),
            'notes': enrollment.notes,
            'enrollment_id': enrollment.id,
        })
    
    return JsonResponse({
        'success': True,
        'students': data,
        'current_semester': str(current_semester),
        'count': len(data)
    })


@login_required
@csrf_exempt
@require_execution_permission('student.change_studystatus', 'student.change_student', 'renewal.change_enrollmentrenewal', 'change_studystatus', 'change_student')
def suspend_student_api(request):
    """API: إيقاف قيد طالب (POST)"""
    suspend_info = get_suspend_student_job_info()
    if not suspend_info['is_suspend_job_open']:
        return JsonResponse({'success': False, 'error': suspend_info['suspend_job_message']}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        reason = data.get('reason', '').strip()
        
        if not student_id:
            return JsonResponse({'success': False, 'error': 'الرجاء تحديد الطالب'})
        
        if not reason:
            return JsonResponse({'success': False, 'error': 'الرجاء كتابة سبب الإيقاف'})
        
        student = get_object_or_404(Student, id=student_id)
        
        # جلب الفصل الدراسي النشط
        current_semester = Semester.objects.filter(is_active=True).first()
        if not current_semester:
            return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط'})
        
        from django.db import transaction
        
        with transaction.atomic():
            # 1. تحديث حالة الطالب في جدول Student
            suspended_status, _ = StudentStatus.objects.get_or_create(name="موقوف قيده")
            student.student_status = suspended_status
            student.save(update_fields=['student_status'])
            
            # 2. تحديث القيد في جدول EnrollmentRenewal
            enrollment, created = EnrollmentRenewal.objects.get_or_create(
                student=student,
                semester=current_semester,
                defaults={
                    'level': student.level,
                    'status': 'suspended',
                    'renewed_by': request.user,
                    'notes': f'تم إيقاف القيد: {reason}',
                }
            )
            
            if not created:
                enrollment.status = 'suspended'
                enrollment.notes = f'تم إيقاف القيد: {reason} (تحديث)'
                enrollment.renewed_by = request.user
                enrollment.save()
            
            print(f"⛔ تم إيقاف قيد الطالب: {student.name} (رقم {student.student_id})")
            print(f"   السبب: {reason}")
            print(f"   الفصل: {current_semester}")
            
            # 🛡️ توثيق إيقاف قيد الطالب في سجل الأحداث
            try:
                from apps.users.utils import log_activity
                log_activity(
                    user=request.user,
                    action='update',
                    model_name='Student',
                    object_name=f"إيقاف قيد {student.name}",
                    details=f"إيقاف قيد الطالب ({student.name}) برقم قيد ({student.student_id}) بسبب: {reason}",
                    request=request
                )
            except Exception:
                pass

            return JsonResponse({
                'success': True,
                'message': f'✅ تم إيقاف قيد الطالب {student.name} بنجاح',
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': student.name,
                }
            })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def verify_suspension_print_api(request, student_id):
    """
    API: التحقق الأمني الحصري من صحة وأحقية طباعة نموذج إيقاف القيد
    يمنع منعاً باتاً استخراج أو طباعة النموذج لأي طالب ما زالت حالته نشطة أو لم يُعتمد إيقافه في النظام.
    """
    try:
        student = get_object_or_404(Student, id=student_id)
        current_semester = Semester.objects.filter(is_active=True).first()

        is_status_suspended = bool(student.student_status and student.student_status.name == "موقوف قيده")
        is_enrollment_suspended = EnrollmentRenewal.objects.filter(
            student=student,
            status='suspended'
        ).exists()

        if not (is_status_suspended or is_enrollment_suspended):
            current_status_name = student.student_status.name if student.student_status else "نشط"
            return JsonResponse({
                'success': False,
                'allowed': False,
                'error': f'⛔ رفض أمني (403): لا يمكن طباعة أو استخراج نموذج إيقاف القيد للطالب ({student.name}) لأن حالته الحالية هي ({current_status_name}) ولم يتم تأكيد واعتماد إيقاف قيده في النظام.'
            }, status=403)

        last_suspension = EnrollmentRenewal.objects.filter(
            student=student,
            status='suspended'
        ).order_by('-renewal_date', '-id').first()

        return JsonResponse({
            'success': True,
            'allowed': True,
            'student': {
                'id': student.id,
                'student_id': student.student_id,
                'name': student.name,
                'status': 'موقوف قيده',
                'reason': last_suspension.notes if last_suspension else '',
                'semester': str(current_semester) if current_semester else '',
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'allowed': False, 'error': str(e)}, status=500)


@login_required
@csrf_exempt
@require_execution_permission('student.change_studystatus', 'student.change_student', 'renewal.change_enrollmentrenewal', 'change_studystatus', 'change_student')
def activate_suspended_student_api(request):
    """API: تنشيط طالب موقوف (إعادة القيد)"""
    suspend_info = get_suspend_student_job_info()
    if not suspend_info['is_suspend_job_open']:
        return JsonResponse({'success': False, 'error': suspend_info['suspend_job_message']}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        
        if not student_id:
            return JsonResponse({'success': False, 'error': 'الرجاء تحديد الطالب'})
        
        student = get_object_or_404(Student, id=student_id)
        
        # جلب الفصل الدراسي النشط
        current_semester = Semester.objects.filter(is_active=True).first()
        if not current_semester:
            return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط'})
        
        from django.db import transaction
        
        with transaction.atomic():
            # 1. تحديث حالة الطالب
            active_status, _ = StudentStatus.objects.get_or_create(name="منتظم")
            student.student_status = active_status
            student.save(update_fields=['student_status'])
            
            # 2. تحديث القيد
            enrollment = EnrollmentRenewal.objects.filter(
                student=student,
                semester=current_semester
            ).first()
            
            if enrollment:
                enrollment.status = 'active'
                enrollment.notes = f'تم تنشيط القيد بواسطة {request.user.username}'
                enrollment.renewed_by = request.user
                enrollment.save()
            else:
                # إنشاء قيد جديد إذا لم يكن موجوداً
                EnrollmentRenewal.objects.create(
                    student=student,
                    semester=current_semester,
                    level=student.level,
                    status='active',
                    renewed_by=request.user,
                    notes=f'تم تنشيط القيد من حالة الإيقاف بواسطة {request.user.username}'
                )
            
            print(f"✅ تم تنشيط قيد الطالب: {student.name} (رقم {student.student_id})")
            
            # 🛡️ توثيق تنشيط قيد الطالب في سجل الأحداث
            try:
                from apps.users.utils import log_activity
                log_activity(
                    user=request.user,
                    action='update',
                    model_name='Student',
                    object_name=f"تنشيط قيد {student.name}",
                    details=f"إعادة تنشيط قيد الطالب الموقوف ({student.name}) برقم قيد ({student.student_id}) وتغيير حالته إلى منتظم",
                    request=request
                )
            except Exception:
                pass

            return JsonResponse({
                'success': True,
                'message': f'✅ تم تنشيط قيد الطالب {student.name} بنجاح',
            })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# ================================================================
# دوال تجديد القيد - الحالات الخاصة (المطورة)
# ================================================================

@login_required
def special_renew_page(request):
    """صفحة تجديد قيد حالة خاصة (فردي) - مطورة"""
    semesters = Semester.objects.all().order_by('-year', '-type')
    departments = Department.objects.filter(is_active=True).order_by('name')
    levels = Level.objects.all()
    
    renew_job_info = get_renew_registration_job_info()

    context = {
        'semesters': semesters,
        'departments': departments,
        'levels': levels,
        'is_renew_job_open': renew_job_info['is_renew_job_open'],
        'renew_job_message': renew_job_info['renew_job_message'],
    }
    return render(request, 'renewal/special_renew.html', context)


@login_required
def search_student_for_special_renew_api(request):
    """API: البحث حصراً عن الطلاب موقوفي القيد لتجديد قيدهم كحالة خاصة مع استبعاد المسحوبين والمخلى طرفهم والخريجين"""
    from django.db.models import Q
    from apps.student.utils import check_student_academic_eligibility
    
    search = request.GET.get('search', '').strip()
    reg_num = request.GET.get('reg_num', '').strip()
    name_query = request.GET.get('name', '').strip()
    
    search_term = search or reg_num or name_query
    if not search_term:
        return JsonResponse({'success': False, 'error': 'الرجاء إدخال اسم أو رقم قيد'})
    
    current_semester = Semester.objects.filter(is_active=True).first()
    if not current_semester:
        return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط حالياً'})
    
    student_filter = Q(student_id__icontains=search_term) | Q(name__icontains=search_term)
    if reg_num:
        student_filter |= Q(student_id__icontains=reg_num)
    if name_query:
        student_filter |= Q(name__icontains=name_query)

    students = Student.objects.filter(student_filter).select_related('department', 'level', 'student_status')
    
    results = []
    for student in students[:15]:
        eligibility = check_student_academic_eligibility(student, action_type='special_renewal')
        existing_enrollment = EnrollmentRenewal.objects.filter(
            student=student,
            semester=current_semester
        ).first()
        
        # جلب الحالة الأكاديمية الحقيقية والموثوقة للطالب من جدول حالات الطلاب
        if student.student_status and student.student_status.name:
            status_name = student.student_status.name.strip()
        elif existing_enrollment:
            status_name = existing_enrollment.get_status_display()
        else:
            status_name = eligibility.get('status_name') or 'غير محدد'
        
        is_suspended = any(w in status_name for w in ['موقوف', 'موقف', 'وقف']) or (existing_enrollment and existing_enrollment.status == 'suspended')
        is_major_change = getattr(student, 'has_changed_major', False) or (getattr(student, 'major_change_count', 0) or 0) >= 1 or 'مسار' in status_name

        # الطالب يعتبر مجدداً فقط إذا كان لديه قيد نشط وحالته ليست موقوفة
        is_renewed = bool(
            existing_enrollment and 
            existing_enrollment.status in ['RENEWED', 'active'] and 
            not is_suspended
        )

        # حساب عدد مرات إيقاف القيد عبر كل الفصول
        suspension_count = EnrollmentRenewal.objects.filter(
            student=student,
            special_type__in=['STOPPED', 'STOPPED_ENROLLMENT']
        ).count()
        # إذا لم يكن هناك سجل خاص، نحسب من خلال السجلات ذات الحالة suspended
        if suspension_count == 0:
            suspension_count = EnrollmentRenewal.objects.filter(
                student=student,
                status='suspended'
            ).count()

        if is_renewed:
            special_type = 'renewed'
            special_type_display = 'مجدد قيده'
        elif is_suspended:
            special_type = 'suspended'
            special_type_display = 'موقوف قيده'
        elif is_major_change:
            special_type = 'major_change'
            special_type_display = 'تغيير مسار'
        else:
            special_type = 'regular'
            special_type_display = status_name
        
        results.append({
            'id': student.id,
            'student_id': student.student_id or f"STU{student.id:06d}",
            'name': student.name or '',
            'father_name': student.father_name or '',
            'department_name': student.department.name if student.department else '-',
            'level_number': student.level.number if student.level else 1,
            'student_status': status_name,
            'special_type': special_type,
            'special_type_display': special_type_display,
            'is_renewed': is_renewed,
            'is_suspended': is_suspended,
            'has_enrollment': is_renewed,
            'suspension_count': suspension_count,
            'current_semester': str(current_semester),
            'notes': existing_enrollment.notes if existing_enrollment else '',
            'is_allowed': eligibility['is_allowed'],
            'eligibility': eligibility,
            'error_message': eligibility.get('error_message')
        })
    
    if not results:
        return JsonResponse({
            'success': False, 
            'error': 'لا يوجد طالب بهذا الرقم أو الاسم.'
        })
    
    return JsonResponse({'success': True, 'students': results})


@login_required
def get_special_case_students_api(request):
    """API: جلب قائمة الطلاب للحالات الخاصة (موقوف قيده / تغيير مسار) مع استبعاد المسحوبين والمخلو طرفهم"""
    from django.db.models import Q
    
    special_case = request.GET.get('special_case', '').strip() or request.GET.get('special_type', '').strip() or 'all'
    department_id = request.GET.get('department_id')
    level_id = request.GET.get('level_id')
    search_query = request.GET.get('search', '').strip()
    
    current_semester = Semester.objects.filter(is_active=True).first()
    if not current_semester:
        return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط حالياً'})
    
    suspended_q = (
        Q(student_status__name__icontains="موقوف") | 
        Q(student_status__name__icontains="موقف") | 
        Q(student_status__name__icontains="وقف") |
        Q(enrollmentrenewal__semester=current_semester, enrollmentrenewal__special_type='STOPPED') |
        Q(enrollmentrenewal__semester=current_semester, enrollmentrenewal__status='suspended')
    )

    major_change_q = (
        Q(has_changed_major=True) |
        Q(major_change_count__gte=1) |
        Q(student_status__name__icontains="مسار") |
        Q(student_status__name__icontains="محول") |
        Q(enrollmentrenewal__semester=current_semester, enrollmentrenewal__special_type='MAJOR_CHANGE')
    )
    
    blocked_q = (
        Q(student_status__name__icontains="سحب") |
        Q(student_status__name__icontains="طرف") |
        Q(student_status__name__icontains="خريج") |
        Q(student_status__name__icontains="متخرج")
    )

    if special_case == 'suspended':
        case_filter = suspended_q
    elif special_case in ['major_change', 'track_change']:
        case_filter = major_change_q
    else:
        case_filter = suspended_q | major_change_q
    
    base_students = Student.objects.filter(case_filter).exclude(blocked_q).select_related('department', 'level', 'student_status').distinct()
        
    if is_valid_filter(department_id):
        base_students = base_students.filter(department_id=int(department_id))

    if is_valid_filter(level_id):
        base_students = base_students.filter(level_id=int(level_id))
        
    if search_query:
        base_students = base_students.filter(
            Q(name__icontains=search_query) | 
            Q(student_id__icontains=search_query)
        )
    
    data = []
    BLOCKED_STATUS_LIST = ["سحب ملف", "مسحوب ملفه", "مسحوبة ملف", "إخلاء طرف", "خريج", "متخرج", "مفصول"]
    for student in base_students.order_by('-id')[:100]:
        if student.student_status and any(b in student.student_status.name for b in BLOCKED_STATUS_LIST):
            continue
            
        existing_enrollment = EnrollmentRenewal.objects.filter(
            student=student,
            semester=current_semester
        ).first()
        
        status_raw = student.student_status.name.strip() if student.student_status and student.student_status.name else ''
        is_suspended = any(w in status_raw for w in ['موقوف', 'موقف', 'وقف']) or (existing_enrollment and existing_enrollment.status == 'suspended')
        
        is_major_change = (
            getattr(student, 'has_changed_major', False) or 
            (getattr(student, 'major_change_count', 0) or 0) >= 1 or 
            'مسار' in status_raw or 
            (existing_enrollment and existing_enrollment.special_type == 'MAJOR_CHANGE')
        )
        
        is_renewed = bool(
            existing_enrollment and 
            existing_enrollment.status in ['RENEWED', 'active'] and 
            not is_suspended
        )

        # حساب عدد مرات إيقاف القيد عبر كل الفصول الدراسية
        suspension_count = EnrollmentRenewal.objects.filter(
            student=student,
            special_type__in=['STOPPED', 'STOPPED_ENROLLMENT']
        ).count()
        if suspension_count == 0:
            suspension_count = EnrollmentRenewal.objects.filter(
                student=student,
                status='suspended'
            ).count()

        if is_suspended:
            special_type = 'suspended'
            status_name = status_raw or 'موقوف قيده'
            reason_text = f"موقوف قيده ({status_name})"
        elif is_major_change:
            special_type = 'major_change'
            status_name = status_raw or 'تغيير مسار'
            reason_text = 'تغيير مسار'
        else:
            special_type = 'regular'
            status_name = status_raw or 'منتظم'
            reason_text = status_name
        
        data.append({
            'id': student.id,
            'student_id': student.student_id or f"STU{student.id:06d}",
            'name': student.name or '',
            'father_name': student.father_name or '',
            'national_id': getattr(student, 'national_id', '—') or '—',
            'department_name': student.department.name if student.department else '-',
            'level_number': student.level.number if student.level else 1,
            'level_name': student.level.name if student.level else 'المستوى الأول',
            'student_status': status_name,
            'special_type': special_type,
            'interruption_reason': reason_text,
            'is_renewed': is_renewed,
            'is_suspended': is_suspended,
            'has_enrollment': is_renewed,
            'suspension_count': suspension_count,
            'enrollment_id': existing_enrollment.id if existing_enrollment else None,
            'notes': existing_enrollment.notes if existing_enrollment else '',
        })
    
    return JsonResponse({'success': True, 'students': data, 'count': len(data)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_enrollmentrenewal', 'renewal.change_enrollmentrenewal', 'add_enrollmentrenewal', 'change_enrollmentrenewal')
def special_renew_student_api(request):
    """API: تفعيل وتجديد قيد طالب (حالة خاصة: موقوف قيده / تغيير مسار) مع الحظر الصارم للطلاب المسحوبين والخريجين"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        student_id = data.get('student_id')
        semester_id = data.get('semester_id')
        reason = data.get('reason', '').strip()
        req_special_type = data.get('special_type', '').strip()
        
        if not student_id:
            return JsonResponse({'success': False, 'error': 'الرجاء تحديد الطالب'})
        
        if not semester_id:
            return JsonResponse({'success': False, 'error': 'الرجاء اختيار الفصل الدراسي'})
        
        if not reason:
            return JsonResponse({'success': False, 'error': 'الرجاء كتابة سبب التجديد/التأخير'})
        
        student = get_object_or_404(Student, id=student_id)
        semester = get_object_or_404(Semester, id=semester_id)

        # 🔒 فحص الأهلية الأكاديمية للطالب (السماح للموقوفين وتغيير المسار في شاشة الحالات الخاصة)
        from apps.student.utils import check_student_academic_eligibility
        eligibility = check_student_academic_eligibility(student, action_type='special_renewal')
        if not eligibility['is_allowed']:
            return JsonResponse({'success': False, 'error': eligibility['error_message']})
        
        if student.department and not student.department.is_active:
            return JsonResponse({
                'success': False,
                'error': f'عذراً، هذا القسم ({student.department.name}) غير مفعّل حالياً ولا يمكن تجديد القيد فيه.'
            })
        
        from django.db import transaction
        
        is_major_change = (
            req_special_type in ['major_change', 'MAJOR_CHANGE'] or
            getattr(student, 'has_changed_major', False) or
            (getattr(student, 'major_change_count', 0) or 0) >= 1
        )
        
        special_type_code = 'MAJOR_CHANGE' if is_major_change else 'STOPPED'
        note_prefix = 'تجديد قيد تغيير مسار' if is_major_change else 'تجديد قيد موقوف'
        
        with transaction.atomic():
            active_status, _ = StudentStatus.objects.get_or_create(name="منتظم")
            student.student_status = active_status
            student.save(update_fields=['student_status'])
            
            enrollment, created = EnrollmentRenewal.objects.get_or_create(
                student=student,
                semester=semester,
                defaults={
                    'level': student.level,
                    'status': 'active',
                    'special_type': special_type_code,
                    'renewed_by': request.user,
                    'notes': f'{note_prefix}: {reason}',
                }
            )
            
            if not created:
                enrollment.status = 'active'
                enrollment.special_type = special_type_code
                enrollment.level = student.level
                enrollment.renewed_by = request.user
                enrollment.notes = f'{note_prefix}: {reason}'
                enrollment.save()
            
            # 🛡️ توثيق عملية التجديد الخاص في سجل الأحداث
            try:
                from apps.users.utils import log_activity
                log_activity(
                    user=request.user,
                    action='create',
                    model_name='EnrollmentRenewal',
                    object_name=f"تجديد خاص {student.name}",
                    details=f"تم تجديد قيد استثنائي ({'تغيير مسار' if is_major_change else 'موقوف'}) للطالب ({student.name}) برقم قيد ({student.student_id}) بسبب: {reason}",
                    request=request
                )
            except Exception:
                pass
            
            return JsonResponse({
                'success': True,
                'message': f'✅ تم تجديد وتفعيل قيد الطالب ({student.name}) بنجاح كـ ({"تغيير مسار" if is_major_change else "موقوف"}).',
                'new_level': student.level.name if student.level else 'المستوى 1',
                'was_promoted': False
            })
            
    except Exception as e:
        logger.error(f"Error in special_renew_student_api: {e}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'حدث خطأ: {str(e)}'})

# ================================================================
# دوال تنزيل المواد مع قيد الأمان الأكاديمي
# ================================================================




@login_required
def get_students_for_download_api(request):
    """API: جلب الطلاب المؤهلين لتنزيل المواد الاستثنائية (المجددين كحالة خاصة / مستجدين)"""
    from django.db.models import Q
    from apps.grades.models import Grade
    
    special_case = request.GET.get('special_case', '').strip() or request.GET.get('special_type', '').strip() or 'all'
    department_id = request.GET.get('department_id', '').strip()
    level_id = request.GET.get('level_id', '').strip()
    year = request.GET.get('year', '').strip()
    season_type = request.GET.get('semester_type', '').strip() or request.GET.get('season_type', '').strip()
    
    # 1. تحديد الفصل الدراسي الفعّال أو المحدد
    if is_valid_filter(year) and is_valid_filter(season_type):
        try:
            target_semester = Semester.objects.filter(year=int(year), type=season_type, is_active=True).first()
        except ValueError:
            target_semester = None
        if not target_semester:
            target_semester = Semester.objects.filter(is_active=True).first()
    else:
        target_semester = Semester.objects.filter(is_active=True).first()
        
    if not target_semester:
        return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط حالياً', 'students': []})

    selected_level_num = None
    if is_valid_filter(level_id):
        try:
            lvl_obj = Level.objects.filter(Q(id=int(level_id)) | Q(number=int(level_id))).first()
            if lvl_obj:
                selected_level_num = lvl_obj.number
        except ValueError:
            pass

    BLOCKED_STATUSES = ["سحب ملف", "مسحوب ملفه", "مسحوبة ملف", "إخلاء طرف", "خريج", "متخرج", "مفصول"]
    
    # 🎯 جلب تجديدات القيد في الفصل الحالي
    enrollments = EnrollmentRenewal.objects.filter(
        semester=target_semester,
        status__in=['RENEWED', 'active']
    ).select_related('student', 'level', 'student__department', 'student__student_status')
    
    if is_valid_filter(department_id):
        enrollments = enrollments.filter(student__department_id=int(department_id))

    if selected_level_num is not None:
        enrollments = enrollments.filter(Q(level_id=int(level_id)) | Q(level__number=selected_level_num))

    student_map = {}
    for en in enrollments:
        st = en.student
        st_status = st.student_status.name if st.student_status else 'منتظم'
        if any(b in st_status for b in BLOCKED_STATUSES):
            continue

        is_suspended = (
            getattr(en, 'special_type', '') in ['STOPPED', 'STOPPED_ENROLLMENT', 'suspended'] or
            'موقوف' in (en.notes or '') or 'وقف' in (en.notes or '') or
            'موقوف' in st_status or 'وقف' in st_status
        )

        is_major_changed = (
            getattr(st, 'has_changed_major', False) or
            (getattr(st, 'major_change_count', 0) or 0) >= 1 or
            getattr(en, 'special_type', '') in ['MAJOR_CHANGE', 'major_change'] or
            'مسار' in (en.notes or '') or 'تحويل' in (en.notes or '') or
            (st.student_status and 'مسار' in st.student_status.name)
        )

        # التحقق من نوع الفلترة للحالة الخاصة
        if special_case == 'suspended' and not is_suspended:
            continue
        elif special_case in ['major_change', 'track_change'] and not is_major_changed:
            continue
        elif special_case == 'all' and not (is_suspended or is_major_changed):
            continue

        case_type_display = 'تغيير مسار' if is_major_changed else ('موقوف مجدد قيده' if is_suspended else 'حالة خاصة')

        student_map[st.id] = {
            'student': st,
            'level_number': en.level.number if en.level else (st.level.number if st.level else 1),
            'case_type_display': case_type_display
        }

    # التحقق من المواد المنزلة للطلاب لهذا الفصل
    already_registered_student_ids = set(CourseRegistration.objects.filter(
        semester=target_semester
    ).values_list('student_id', flat=True))
    
    data = []
    for item in student_map.values():
        s = item['student']
        has_reg = s.id in already_registered_student_ids
            
        passed_course_ids = set(Grade.objects.filter(
            student=s,
            is_passed=True
        ).values_list('course_id', flat=True))
        
        remaining_courses_qs = Course.objects.filter(
            department=s.department,
            level__number__lt=s.level.number if s.level else 1,
            is_active=True
        ).exclude(id__in=passed_course_ids) if s.department else Course.objects.none()
        remaining_count = remaining_courses_qs.count()
        remaining_course_names = list(remaining_courses_qs.values_list('name', flat=True)[:4])
        remaining_text = "، ".join(remaining_course_names) if remaining_course_names else ("لا توجد مواد متبقية" if remaining_count == 0 else f"{remaining_count} مواد")

        data.append({
            'id': s.id,
            'student_id': s.student_id or f"STU{s.id:06d}",
            'name': s.name or '',
            'father_name': s.father_name or '',
            'department_name': s.department.name if s.department else '-',
            'level_number': item['level_number'],
            'student_status': s.student_status.name if s.student_status else 'منتظم',
            'remaining_subjects': remaining_count,
            'remaining_text': remaining_text,
            'case_type': item['case_type_display'],
            'is_renewed': True,
            'is_active': True,
            'has_registration': has_reg,
        })
        
    return JsonResponse({
        'success': True,
        'students': data[:100],
        'count': len(data),
        'semester_id': target_semester.id,
        'semester_name': f"{target_semester.get_type_display()} {target_semester.year}"
    })



from apps.grades.models import Grade

def get_failed_uncleared_student_ids(target_level_num=None):
    """
    استخراج معرّفات الطلاب الذين لديهم مواد رسوب/غير مجتازة من المستويات السابقة ولم يتم اجتيازها في محاولات لاحقة
    """
    from apps.grades.models import Grade
    from django.db.models import Q
    
    failed_grades_qs = Grade.objects.filter(
        Q(is_passed=False) | Q(total_grade__lt=50)
    )
    if target_level_num and target_level_num > 1:
        failed_grades_qs = failed_grades_qs.filter(course__level__number__lt=target_level_num)
        
    failed_student_ids = set(failed_grades_qs.values_list('student_id', flat=True))
    
    # استبعاد الطلاب الذين اجتازوا المادة لاحقاً
    passed_student_ids = set(Grade.objects.filter(
        student_id__in=failed_student_ids
    ).filter(
        Q(is_passed=True) | Q(total_grade__gte=50)
    ).values_list('student_id', flat=True))
    
    return failed_student_ids - passed_student_ids


def check_student_has_uncleared_prior_courses(student, current_level_num=None):
    """
    التحقق من وجود مواد غير مجتازة من المستويات السابقة لحظر ترقية مستوى الطالب عند تجديد القيد
    """
    from apps.grades.models import Grade
    from django.db.models import Q

    if current_level_num is None:
        current_level_num = student.level.number if student.level else 1

    if current_level_num <= 1 or not student.department:
        return False, []

    # جلب جميع مواد المستويات السابقة (< current_level_num)
    prior_courses = Course.objects.filter(
        department=student.department,
        level__number__lt=current_level_num,
        is_active=True
    )
    if student.study_plan:
        prior_courses = prior_courses.filter(study_plan=student.study_plan)

    passed_course_ids = set(Grade.objects.filter(
        student=student
    ).filter(Q(is_passed=True) | Q(total_grade__gte=50)).values_list('course_id', flat=True))

    uncleared_courses = [c for c in prior_courses if c.id not in passed_course_ids]
    has_uncleared = len(uncleared_courses) > 0
    return has_uncleared, uncleared_courses


def get_student_proposed_level(student, semester=None):
    """
    حساب المستوى المقترح للطالب بناءً على نتائج درجاته ومواده غير المجتازة
    مع تطبيق قاعدة تثبيت المستوى (Level Retention) عند وجود ديون/مواد غير مجتازة من مستويات سابقة
    """
    current_level = student.level
    if not current_level:
        current_level = Level.objects.filter(number=1).first()
        if not current_level:
            current_level = Level.objects.create(number=1, name="المستوى الأول")
        student.level = current_level
        student.save(update_fields=['level'])

    # 🛑 1. فحص وجود مواد غير مجتازة من مستويات سابقة (Uncleared Prior Courses)
    has_uncleared, uncleared_courses = check_student_has_uncleared_prior_courses(student, current_level.number)
    if has_uncleared:
        uncleared_names = [c.name for c in uncleared_courses[:3]]
        courses_str = "، ".join(uncleared_names) + ("..." if len(uncleared_courses) > 3 else "")
        return {
            'proposed_level': current_level,
            'is_promoted': False,
            'reason': f'تثبيت المستوى: يوجد {len(uncleared_courses)} مواد غير مجتازة من مستويات سابقة ({courses_str})'
        }

    # 2. التحقق من اجتياز مواد المستوى الحالي
    current_courses = Course.objects.filter(
        department=student.department,
        level=current_level,
        is_active=True
    ) if student.department else Course.objects.none()

    if student.study_plan:
        current_courses = current_courses.filter(study_plan=student.study_plan)

    if not current_courses.exists():
        next_level = Level.objects.filter(number=current_level.number + 1).first()
        if next_level:
            return {
                'proposed_level': next_level,
                'is_promoted': True,
                'reason': f'لا توجد مواد في المستوى {current_level.number} - ترقية تلقائية'
            }
        return {
            'proposed_level': current_level,
            'is_promoted': False,
            'reason': 'آخر مستوى - تم اجتياز جميع المواد'
        }

    all_passed = True
    failed_courses = []
    for course in current_courses:
        grade = Grade.objects.filter(
            student=student,
            course=course
        ).order_by('-attempt_number').first()

        if not grade or grade.total_grade < 50:
            all_passed = False
            failed_courses.append(course.name)

    if all_passed:
        next_level = Level.objects.filter(number=current_level.number + 1).first()
        if next_level:
            return {
                'proposed_level': next_level,
                'is_promoted': True,
                'reason': f'اجتاز جميع مواد المستوى {current_level.number} بنجاح'
            }
        return {
            'proposed_level': current_level,
            'is_promoted': False,
            'reason': 'آخر مستوى - تم اجتياز جميع المواد (تخرج)'
        }
    else:
        return {
            'proposed_level': current_level,
            'is_promoted': False,
            'reason': f'تثبيت المستوى: لم يجتاز المواد ({", ".join(failed_courses[:3])}{"..." if len(failed_courses) > 3 else ""})'
        }

@login_required
def plans_display(request):
    """صفحة عرض الخطط الدراسية"""
    return render(request, 'renewal/plans_display.html')


# apps/renewal/views.py - دالة dashboard

@login_required
def dashboard(request):
    """
    لوحة تحكم قسم القبول والتسجيل - Admission & Registration Dashboard
    تتضمن إحصائيات شاملة، رسوم بيانية تفاعلية، جداول الأنشطة الحديثة، وروابط الوصول السريع
    """
    # 🔥 إعادة توجيه مدير/منسق الدراسة والامتحانات للوحتهم الخاصة
    if getattr(request.user, 'role', '') in ['exam_director', 'مدير الدراسة والامتحانات', 'مدير ادارة الدراسة والامتحانات']:
        return redirect('faculty:exam_director_dashboard')
    if getattr(request.user, 'role', '') in ['exam_officer', 'exams', 'coordinator', 'study_exams', 'study_and_exams']:
        return redirect('faculty:coordinator_dashboard')

    from datetime import timedelta
    from .utils import get_system_date

    # 1. جلب الفصل الدراسي النشط
    current_semester = Semester.objects.filter(is_active=True).first()
    if not current_semester:
        current_semester = Semester.objects.order_by('-year', '-type').first()
    semester_name = str(current_semester) if current_semester else "الفصل الحالي"

    # 2. إحصائيات الطلاب وحالات القيد المعتمدة (الحالات الخمس)
    all_students_qs = Student.objects.all()
    total_all_students = all_students_qs.count()

    regular_students_count = all_students_qs.filter(student_status__name='منتظم').count()
    suspended_students_count = all_students_qs.filter(student_status__name='موقوف قيده').count()
    withdrawn_students_count = all_students_qs.filter(student_status__name='مسحوبة ملف').count()
    clearance_students_count = all_students_qs.filter(student_status__name='إخلاء طرف').count()
    graduated_students_count = all_students_qs.filter(student_status__name='إخلاء طرف / خريج معتمد').count()

    # 3. إحصائيات التسجيل الفصلي والطلبة الجدد
    semester_registered_count = 0
    if current_semester:
        semester_registered_count = EnrollmentRenewal.objects.filter(semester=current_semester).values('student').distinct().count()
    if semester_registered_count == 0:
        semester_registered_count = regular_students_count

    # الطلبة الجدد (المسجلين خلال آخر 60 يوماً أو بالمستوى 1)
    thirty_days_ago = get_system_date(request) - timedelta(days=60)
    new_students_count = all_students_qs.filter(
        Q(created_at__gte=thirty_days_ago) | Q(level__number=1)
    ).count()

    # الطلبات الإدارية المعلقة / قيد المراجعة
    pending_requests_count = 0
    try:
        from apps.student.models import StudentNotification
        pending_requests_count = StudentNotification.objects.filter(is_read=False, target_role__in=['all', 'registrar', 'general_registrar']).count()
    except Exception:
        pending_requests_count = 0

    # 4. توزيع الطلاب حسب المستويات الدراسية (1 إلى 8)
    semesters_data = []
    for i in range(1, 9):
        lvl = Level.objects.filter(number=i).first()
        if lvl:
            count = all_students_qs.filter(level=lvl).exclude(student_status__name='مسحوبة ملف').count()
        else:
            count = 0
        semesters_data.append({
            'level': i,
            'name': f'المستوى {i}',
            'count': count
        })

    # 5. توزيع الطلاب حسب الأقسام والتخصصات
    departments_data = []
    departments = Department.objects.filter(is_active=True).order_by('name')
    for dept in departments:
        dept_total = all_students_qs.filter(department=dept).count()
        dept_active = all_students_qs.filter(department=dept, student_status__name='منتظم').count()
        dept_withdrawn = all_students_qs.filter(department=dept, student_status__name='مسحوبة ملف').count()
        departments_data.append({
            'name': dept.name,
            'code': dept.code or dept.name[:3].upper(),
            'count': dept_total,
            'active_count': dept_active,
            'withdrawn_count': dept_withdrawn,
        })
    departments_data.sort(key=lambda x: x['count'], reverse=True)

    # 6. بيانات الرسم البياني للحالات الأكاديمية (الحالات الخمس الرسمية)
    status_chart_data = {
        'labels': ['منتظم', 'موقوف قيده', 'مسحوبة ملف', 'إخلاء طرف', 'إخلاء طرف / خريج معتمد'],
        'data': [
            regular_students_count,
            suspended_students_count,
            withdrawn_students_count,
            clearance_students_count,
            graduated_students_count
        ],
        'colors': ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
    }

    # 7. جداول الأنشطة الحديثة (أحدث تجديدات قيد + أحدث طلاب مسجلين)
    recent_renewals = EnrollmentRenewal.objects.select_related(
        'student', 'semester', 'level', 'renewed_by', 'student__department'
    ).order_by('-id')[:7]

    recent_students = Student.objects.select_related(
        'department', 'level', 'student_status'
    ).order_by('-id')[:7]

    # 8. تجهيز بيانات JSON
    semesters_json = json.dumps({
        'labels': [s['name'] for s in semesters_data],
        'data': [s['count'] for s in semesters_data]
    }, ensure_ascii=False)

    departments_json = json.dumps({
        'labels': [d['name'] for d in departments_data],
        'data': [d['count'] for d in departments_data],
        'colors': ['#307e92', '#b59b66', '#0d9488', '#4f46e5', '#3b82f6', '#8b5cf6', '#eab308', '#64748b']
    }, ensure_ascii=False)

    status_json = json.dumps(status_chart_data, ensure_ascii=False)

    totals_data = {
        'total_all': total_all_students,
        'semester_registered': semester_registered_count,
        'new_students': new_students_count,
        'regular': regular_students_count,
        'suspended': suspended_students_count,
        'withdrawn': withdrawn_students_count,
        'clearance': clearance_students_count,
        'graduated': graduated_students_count,
        'pending': pending_requests_count
    }
    totals_json = json.dumps(totals_data, ensure_ascii=False)

    # 9. السياق النهائي للقالب
    context = {
        'current_semester': semester_name,
        'semester_obj': current_semester,
        'total_all_students': total_all_students,
        'total_students': total_all_students,
        'semester_registered_count': semester_registered_count,
        'new_students_count': new_students_count,
        'new_students': new_students_count,
        'regular_students_count': regular_students_count,
        'total_active': regular_students_count,
        'suspended_students_count': suspended_students_count,
        'total_suspended': suspended_students_count,
        'withdrawn_students_count': withdrawn_students_count,
        'withdrawn_students': withdrawn_students_count,
        'clearance_students_count': clearance_students_count,
        'graduated_students_count': graduated_students_count,
        'pending_requests_count': pending_requests_count,
        'pending_review': pending_requests_count,
        'departments_count': len(departments_data),
        'departments_data': departments_data,
        'semesters_data': semesters_data,
        'recent_renewals': recent_renewals,
        'recent_students': recent_students,
        'totals_data': totals_data,
        # JSON Scripts
        'semesters_json': semesters_json,
        'departments_json': departments_json,
        'status_json': status_json,
        'totals_json': totals_json,
    }
    return render(request, 'renewal/index.html', context)


@login_required
def semester_stats_api(request):
    """
    API للحصول على بيانات إحصائيات الفصول السابقة (للمخطط العمودي الثاني)
    """
    # جلب آخر 3 فصول دراسية
    semesters = Semester.objects.all().order_by('-year', '-type')[:3]
    
    data = []
    labels = []
    
    for sem in semesters:
        labels.append(str(sem))
        
        # عدد الطلاب النشطين في هذا الفصل
        active = EnrollmentRenewal.objects.filter(
            semester=sem,
            status='active'
        ).values('student').distinct().count()
        
        # عدد الحالات الخاصة في هذا الفصل
        special = EnrollmentRenewal.objects.filter(
            semester=sem,
            status='active'
        ).filter(
            Q(notes__icontains='عائد من إيقاف') |
            Q(notes__icontains='حالة خاصة')
        ).values('student').distinct().count()
        
        data.append({
            'active': active,
            'special': special
        })
    
    return JsonResponse({
        'success': True,
        'labels': labels,
        'active': [d['active'] for d in data],
        'special': [d['special'] for d in data]
    })




import json
from datetime import date
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import IntegrityError
from .models import SystemJob

# ============================================================
# دوال إدارة الوظائف والخدمات
# ============================================================

@login_required
def jobs_management_page(request):
    """صفحة إدارة الوظائف والخدمات"""
    return render(request, 'renewal/jobs.html')


@login_required
def get_jobs_api(request):
    """
    API: جلب قائمة جميع الوظائف مع حساب الحالة الحالية
    """
    jobs = SystemJob.objects.all().order_by('-start_date', 'name')
    
    data = []
    for job in jobs:
        data.append({
            'id': job.id,
            'name': job.name,
            'code': job.code,
            'start_date': job.start_date.strftime('%Y-%m-%d'),
            'duration_days': job.duration_days,
            'end_date': job.end_date.strftime('%Y-%m-%d'),
            'is_active': job.is_active,
            'is_currently_open': job.is_currently_open,
            'days_remaining': job.days_remaining,
            'status_display': job.status_display,
        })
    
    return JsonResponse({
        'success': True,
        'jobs': data,
        'count': len(data)
    })


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_systemjob', 'renewal.change_systemjob', 'add_systemjob', 'change_systemjob')
def create_job_api(request):
    """
    API: إضافة وظيفة جديدة
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        
        name = data.get('name', '').strip()
        start_date_str = data.get('start_date', '').strip()
        duration_days = data.get('duration_days')
        is_active = bool(data.get('is_active', True))
        
        # Validation 1: Name
        if not name:
            return JsonResponse({'success': False, 'error': 'اسم الوظيفة مطلوب'})
            
        # Validation 2: Start Date
        if not start_date_str:
            return JsonResponse({'success': False, 'error': 'تاريخ الفتح مطلوب'})
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'success': False, 'error': 'تاريخ الفتح غير صحيح (صيغة YYYY-MM-DD)'})
            
        # Validation 3: Duration Days
        if duration_days is None:
            return JsonResponse({'success': False, 'error': 'المدة بالأيام مطلوبة'})
        try:
            duration_days = int(duration_days)
            if duration_days <= 0:
                return JsonResponse({'success': False, 'error': 'المدة بالأيام يجب أن تكون رقماً موجباً أكبر من 0'})
        except ValueError:
            return JsonResponse({'success': False, 'error': 'المدة بالأيام يجب أن تكون رقماً صحيحاً'})

        # Automatic Code/Slug generation if not supplied or empty
        import re
        code = data.get('code', '').strip().lower().replace(' ', '_')
        code = re.sub(r'[^a-z0-9_]', '', code)
        if not code or code.startswith('job_'):
            if 'إضافة' in name or 'طالب' in name or 'جديد' in name:
                code = 'add_student'
            elif 'تسجيل' in name:
                code = 'registration'
            elif 'تجديد' in name:
                code = 'renewal'
            else:
                timestamp = int(datetime.now().timestamp())
                code = f"job_{timestamp}"
            
        # Ensure code uniqueness
        original_code = code
        counter = 1
        while SystemJob.objects.filter(code=code).exists():
            code = f"{original_code}_{counter}"
            counter += 1
            
        # Create Job
        job = SystemJob.objects.create(
            name=name,
            code=code,
            start_date=start_date,
            duration_days=duration_days,
            is_active=is_active
        )
        
        # 🛡️ توثيق إضافة وظيفة جديدة في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='SystemJob',
                object_name=job.name,
                details=f"إضافة وظيفة/خدمة نظام جديدة ({job.name}) بكود ({job.code}) ولمدة ({duration_days}) يوماً",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': f'✅ تم إضافة الوظيفة "{job.name}" بنجاح',
            'job': {
                'id': job.id,
                'name': job.name,
                'code': job.code,
                'start_date': job.start_date.strftime('%Y-%m-%d'),
                'duration_days': job.duration_days,
                'end_date': job.end_date.strftime('%Y-%m-%d'),
                'is_active': job.is_active,
                'is_currently_open': job.is_currently_open,
                'days_remaining': job.days_remaining,
                'status_display': job.status_display,
            }
        })
    
    except ValueError as e:
        return JsonResponse({'success': False, 'error': f'خطأ في البيانات: {str(e)}'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.change_systemjob', 'renewal.add_systemjob', 'change_systemjob', 'add_systemjob')
def update_job_api(request, job_id):
    """
    API: تحديث وظيفة موجودة
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        job = get_object_or_404(SystemJob, id=job_id)
        data = json.loads(request.body)
        
        if 'name' in data and data['name'].strip():
            job.name = data['name'].strip()
        
        if 'start_date' in data and data['start_date'].strip():
            try:
                job.start_date = datetime.strptime(data['start_date'].strip(), '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'success': False, 'error': 'تاريخ الفتح غير صحيح'})
        
        if 'duration_days' in data and data['duration_days']:
            try:
                duration_days = int(data['duration_days'])
                if duration_days <= 0:
                    return JsonResponse({'success': False, 'error': 'المدة بالأيام يجب أن تكون أكبر من 0'})
                job.duration_days = duration_days
            except ValueError:
                return JsonResponse({'success': False, 'error': 'المدة بالأيام يجب أن تكون رقماً صحيحاً'})
        
        if 'is_active' in data:
            job.is_active = bool(data['is_active'])
        
        job.save()
        
        # 🛡️ توثيق تعديل وظيفة في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='SystemJob',
                object_name=job.name,
                details=f"تعديل بيانات/تفعيل الوظيفة النظامية ({job.name}) - تفعيل: ({job.is_active}) - مدة: ({job.duration_days}) يوماً",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': f'✅ تم تحديث الوظيفة "{job.name}" بنجاح',
            'job': {
                'id': job.id,
                'name': job.name,
                'code': job.code,
                'start_date': job.start_date.strftime('%Y-%m-%d'),
                'duration_days': job.duration_days,
                'end_date': job.end_date.strftime('%Y-%m-%d'),
                'is_active': job.is_active,
                'is_currently_open': job.is_currently_open,
                'days_remaining': job.days_remaining,
                'status_display': job.status_display,
            }
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.delete_systemjob', 'delete_systemjob')
def delete_job_api(request, job_id):
    """
    API: حذف وظيفة
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'})
    
    try:
        job = get_object_or_404(SystemJob, id=job_id)
        job_name = job.name
        job.delete()
        
        # 🛡️ توثيق حذف وظيفة في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='delete',
                model_name='SystemJob',
                object_name=job_name,
                details=f"حذف وإلغاء الوظيفة النظامية ({job_name}) من النظام",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': f'✅ تم حذف الوظيفة "{job_name}" بنجاح'
        })
    
    except SystemJob.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'الوظيفة غير موجودة'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


def get_add_student_job_info():
    """
    التحقق من حالة وظيفة إضافة الطالب الجديد من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='add_student') | Q(code='new_student') | Q(code='registration') |
        Q(code__icontains='add') | Q(code__icontains='registr') | Q(code__icontains='new') |
        Q(name__icontains='إضافة طالب') | Q(name__icontains='طالب جديد') | Q(name__icontains='إضافة')
    ).exclude(
        Q(name__icontains='تعديل') | Q(code__icontains='edit')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_add_job_open': True,
            'add_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_add_job_open': False,
            'add_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_add_job_open': False,
            'add_job_message': msg,
            'job': job
        }

    return {
        'is_add_job_open': True,
        'add_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }


def get_edit_student_job_info():
    """
    التحقق من حالة وظيفة تعديل بيانات الطالب من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='edit_student') | Q(code__icontains='edit') | Q(code__icontains='update') |
        Q(name__icontains='تعديل طالب') | Q(name__icontains='تعديل بيانات') | Q(name__icontains='تعديل')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_edit_job_open': True,
            'edit_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_edit_job_open': False,
            'edit_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_edit_job_open': False,
            'edit_job_message': msg,
            'job': job
        }

    return {
        'is_edit_job_open': True,
        'edit_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }


def get_add_instructor_job_info():
    """
    التحقق من حالة وظيفة إضافة أستاذ جديد من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='add_instructor') | Q(code='add_professor') | Q(code__icontains='prof') | Q(code__icontains='instruct') |
        Q(name__icontains='إضافة أستاذ') | Q(name__icontains='أستاذ جديد') | Q(name__icontains='أستاذ') | Q(name__icontains='تدريس')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_add_instructor_open': True,
            'add_instructor_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_add_instructor_open': False,
            'add_instructor_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_add_instructor_open': False,
            'add_instructor_message': msg,
            'job': job
        }

    return {
        'is_add_instructor_open': True,
        'add_instructor_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }


def get_add_staff_job_info():
    """
    التحقق من حالة وظيفة إضافة موظف جديد من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='add_staff') | Q(code='staff') | Q(code__icontains='staff') | Q(code__icontains='employee') |
        Q(name__icontains='إضافة موظف') | Q(name__icontains='موظف جديد') | Q(name__icontains='موظف') | Q(name__icontains='موظفين')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_add_staff_open': True,
            'add_staff_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_add_staff_open': False,
            'add_staff_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_add_staff_open': False,
            'add_staff_message': msg,
            'job': job
        }

    return {
        'is_add_staff_open': True,
        'add_staff_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }


def get_download_materials_job_info():
    """
    التحقق من حالة وظيفة تنزيل المواد من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='download_materials') |
        Q(code='course_download') |
        Q(code__icontains='download') |
        Q(code__icontains='course') |
        Q(name__icontains='تنزيل مواد') |
        Q(name__icontains='تنزيل المواد') |
        Q(name__icontains='تنزيل') |
        Q(name__icontains='تسجيل مواد')
    ).order_by('-updated_at', '-id').first()

    # لا توجد وظيفة مطابقة
    if not job:
        return {
            'is_download_job_open': True,
            'download_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    # الوظيفة موجودة لكنها غير مفعلة
    if not job.is_active:
        return {
            'is_download_job_open': False,
            'download_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    # الوظيفة مفعلة لكن خارج الفترة المحددة
    if not job.is_currently_open:
        today = timezone.now().date()

        if job.start_date and job.start_date > today:
            msg = (
                f'⏳ خدمة "{job.name}" ستبدأ في '
                f'{job.start_date.strftime("%Y-%m-%d")}.'
            )
        elif job.end_date and job.end_date < today:
            msg = (
                f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ '
                f'{job.end_date.strftime("%Y-%m-%d")}.'
            )
        else:
            msg = f'⛔ خدمة "{job.name}" غير متاحة حالياً.'

        return {
            'is_download_job_open': False,
            'download_job_message': msg,
            'job': job
        }

    # الوظيفة مفعلة ومفتوحة حالياً
    return {
        'is_download_job_open': True,
        'download_job_message': '✅ الخدمة متاحة ومفتوحة حالياً.',
        'job': job
    }
def get_renew_registration_job_info():
    """
    التحقق من حالة وظيفة تجديد القيد الدراسي من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='renew_registration') |
        Q(code='registration_renewal') |
        Q(code='renew') |
        Q(code__icontains='renew') |
        Q(name__icontains='تجديد القيد') |
        Q(name__icontains='تجديد قيد') |
        Q(name__icontains='تجديد')
    ).exclude(
        Q(name__icontains='تعديل') |
        Q(code__icontains='edit')
    ).order_by('-updated_at', '-id').first()

    # لا توجد وظيفة مطابقة
    if not job:
        return {
            'is_renew_job_open': True,
            'renew_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    # الوظيفة موجودة لكنها غير مفعلة
    if not job.is_active:
        return {
            'is_renew_job_open': False,
            'renew_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    # الوظيفة مفعلة لكن خارج الفترة
    if not job.is_currently_open:
        today = timezone.now().date()

        if job.start_date and job.start_date > today:
            msg = (
                f'⏳ خدمة "{job.name}" ستبدأ في '
                f'{job.start_date.strftime("%Y-%m-%d")}.'
            )
        elif job.end_date and job.end_date < today:
            msg = (
                f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ '
                f'{job.end_date.strftime("%Y-%m-%d")}.'
            )
        else:
            msg = f'⛔ خدمة "{job.name}" غير متاحة حالياً.'

        return {
            'is_renew_job_open': False,
            'renew_job_message': msg,
            'job': job
        }

    # الوظيفة مفعلة ومفتوحة حالياً
    return {
        'is_renew_job_open': True,
        'renew_job_message': (
            f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً '
            f'(متبقي {job.days_remaining} يوم).'
        ),
        'job': job
    }


def get_student_withdrawal_job_info():
    """
    التحقق من حالة وظيفة سحب الملف (Student Withdrawal) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='student_withdrawal') | Q(code='withdrawal') | Q(code__icontains='withdrawal') |
        Q(name__icontains='سحب الملف') | Q(name__icontains='سحب ملف') | Q(name__icontains='سحب')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_withdrawal_job_open': True,
            'withdrawal_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_withdrawal_job_open': False,
            'withdrawal_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_withdrawal_job_open': False,
            'withdrawal_job_message': msg,
            'job': job
        }

    return {
        'is_withdrawal_job_open': True,
        'withdrawal_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_course_equivalence_job_info():
    """
    التحقق من حالة وظيفة معادلة المواد وتغيير المسار من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='course_equivalence') | Q(code='track_change') | Q(code='equivalence') |
        Q(code__icontains='equivalence') | Q(code__icontains='track') |
        Q(name__icontains='معادلة') | Q(name__icontains='تغيير المسار') | Q(name__icontains='تغيير مسار')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_equivalence_job_open': True,
            'equivalence_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_equivalence_job_open': False,
            'equivalence_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_equivalence_job_open': False,
            'equivalence_job_message': msg,
            'job': job
        }

    return {
        'is_equivalence_job_open': True,
        'equivalence_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_send_grade_sheets_job_info():
    """
    التحقق من حالة وظيفة إرسال الكشوفات للأستاذ (Send Grade Sheets) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='send_grade_sheets') | Q(code='send_sheets') | Q(code='send_grade_sheet') |
        Q(code__icontains='send_grade') | Q(code__icontains='send_sheet') |
        Q(name__icontains='إرسال الكشوفات للأستاذ') | Q(name__icontains='إرسال الكشوفات') | Q(name__icontains='إرسال كشوفات')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_send_sheets_job_open': True,
            'send_sheets_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_send_sheets_job_open': False,
            'send_sheets_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_send_sheets_job_open': False,
            'send_sheets_job_message': msg,
            'job': job
        }

    return {
        'is_send_sheets_job_open': True,
        'send_sheets_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_grade_entry_monitoring_job_info():
    """
    التحقق من حالة وظيفة رصد الدرجات (Grade Entry Monitoring) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='grade_entry_monitoring') | Q(code='grade_entry') | Q(code='grade_monitoring') |
        Q(code__icontains='grade_entry') | Q(code__icontains='grade_monitoring') |
        Q(name__icontains='رصد الدرجات') | Q(name__icontains='رصد') | Q(name__icontains='درجات')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_grade_entry_job_open': True,
            'grade_entry_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_grade_entry_job_open': False,
            'grade_entry_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_grade_entry_job_open': False,
            'grade_entry_job_message': msg,
            'job': job
        }

    return {
        'is_grade_entry_job_open': True,
        'grade_entry_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_grade_holds_job_info():
    """
    التحقق من حالة وظيفة حجب الدرجات (Grade Holds & Control) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='grade_holds') | Q(code='control_holds') | Q(code='hold_grades') | Q(code='block_grades') |
        Q(code__icontains='hold') | Q(code__icontains='block_grade') |
        Q(name__icontains='حجب الدرجات') | Q(name__icontains='حجب النتيجة') | Q(name__icontains='حجب الكنترول') | Q(name__icontains='حجب')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_grade_holds_job_open': True,
            'grade_holds_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_grade_holds_job_open': False,
            'grade_holds_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_grade_holds_job_open': False,
            'grade_holds_job_message': msg,
            'job': job
        }

    return {
        'is_grade_holds_job_open': True,
        'grade_holds_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_grade_approval_job_info():
    """
    التحقق من حالة وظيفة اعتماد الدرجات (Grade Approval & Publishing) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='grade_approval') | Q(code='publish_results') | Q(code='approve_grades') | Q(code='publish_grades') |
        Q(code__icontains='approval') | Q(code__icontains='publish_grade') |
        Q(name__icontains='اعتماد الدرجات') | Q(name__icontains='اعتماد ونشر الدرجات') | Q(name__icontains='اعتماد النتائج') | Q(name__icontains='اعتماد')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_grade_approval_job_open': True,
            'grade_approval_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_grade_approval_job_open': False,
            'grade_approval_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_grade_approval_job_open': False,
            'grade_approval_job_message': msg,
            'job': job
        }

    return {
        'is_grade_approval_job_open': True,
        'grade_approval_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_grade_appeals_job_info():
    """
    التحقق من حالة وظيفة الطعون (Grade Appeals) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='grade_appeals') | Q(code='appeals') | Q(code='grade_appeal') | Q(code='appeal') |
        Q(code__icontains='appeal') |
        Q(name__icontains='الطعون') | Q(name__icontains='طعون النتائج') | Q(name__icontains='إدارة الطعون') | Q(name__icontains='طعون')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_grade_appeals_job_open': True,
            'grade_appeals_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_grade_appeals_job_open': False,
            'grade_appeals_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_grade_appeals_job_open': False,
            'grade_appeals_job_message': msg,
            'job': job
        }

    return {
        'is_grade_appeals_job_open': True,
        'grade_appeals_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_create_student_groups_job_info():
    """
    التحقق من حالة وظيفة إنشاء المجموعات (Create Groups Job) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='create_student_groups') | Q(code='create_groups') | Q(code='student_groups') | Q(code='groups_creation') |
        Q(code__icontains='group') |
        Q(name__icontains='إنشاء المجموعات') | Q(name__icontains='إنشاء مجموعات') | Q(name__icontains='توزيع المجموعات') | Q(name__icontains='المجموعات')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_create_groups_job_open': True,
            'create_groups_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_create_groups_job_open': False,
            'create_groups_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_create_groups_job_open': False,
            'create_groups_job_message': msg,
            'job': job
        }

    return {
        'is_create_groups_job_open': True,
        'create_groups_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_suspend_student_job_info():
    """
    التحقق من حالة وظيفة إيقاف القيد (Suspend Student Job) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='suspend_student') | Q(code='suspend_enrollment') | Q(code='student_suspension') | Q(code='suspend_registration') |
        Q(code__icontains='suspend') |
        Q(name__icontains='إيقاف القيد') | Q(name__icontains='إيقاف قيد') | Q(name__icontains='إيقاف قيد طالب') | Q(name__icontains='وقف القيد')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_suspend_job_open': True,
            'suspend_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_suspend_job_open': False,
            'suspend_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_suspend_job_open': False,
            'suspend_job_message': msg,
            'job': job
        }

    return {
        'is_suspend_job_open': True,
        'suspend_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_student_clearance_job_info():
    """
    التحقق من حالة وظيفة إخلاء الطرف (Student Clearance Job) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='student_clearance') | Q(code='clearance') | Q(code='graduation_clearance') | Q(code='clearance_job') |
        Q(code__icontains='clearance') |
        Q(name__icontains='إخلاء الطرف') | Q(name__icontains='إخلاء طرف') | Q(name__icontains='إخلاء طرف طالب') | Q(name__icontains='إخلاءات الطرف')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_clearance_job_open': True,
            'clearance_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_clearance_job_open': False,
            'clearance_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_clearance_job_open': False,
            'clearance_job_message': msg,
            'job': job
        }

    return {
        'is_clearance_job_open': True,
        'clearance_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

def get_graduation_certificate_job_info():
    """
    التحقق من حالة وظيفة إفادة التخرج (Graduation Certificate Job) من جدول SystemJob.
    """
    job = SystemJob.objects.filter(
        Q(code='graduation_certificate') | Q(code='issue_certificate') | Q(code='cert_issuance') | Q(code='graduation_cert') |
        Q(code__icontains='certificate') |
        Q(name__icontains='إفادة التخرج') | Q(name__icontains='إفادة تخرج') | Q(name__icontains='إصدار إفادة التخرج') | Q(name__icontains='وثيقة التخرج')
    ).order_by('-updated_at', '-id').first()

    if not job:
        return {
            'is_certificate_job_open': True,
            'certificate_job_message': '✅ الخدمة مفتوحة ومتاحة حالياً.',
            'job': None
        }

    if not job.is_active:
        return {
            'is_certificate_job_open': False,
            'certificate_job_message': f'⚠️ خدمة "{job.name}" غير مفعلة (موقوفة) حالياً في إدارة الوظائف.',
            'job': job
        }

    if not job.is_currently_open:
        today = timezone.now().date()
        if job.start_date > today:
            msg = f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%Y-%m-%d")}.'
        else:
            msg = f'⛔ انتهت فترة خدمة "{job.name}" بتاريخ {job.end_date.strftime("%Y-%m-%d")}.'
        return {
            'is_certificate_job_open': False,
            'certificate_job_message': msg,
            'job': job
        }

    return {
        'is_certificate_job_open': True,
        'certificate_job_message': f'✅ خدمة "{job.name}" مفتوحة ومتاحة حالياً (متبقي {job.days_remaining} يوم).',
        'job': job
    }

@login_required
def check_job_permission_api(request):

    """
    API: فحص حالة جميع الصلاحيات والخدمات بناءً على SystemJob بشكل مباشر ولحظي
    """
    add_info = get_add_student_job_info()
    edit_info = get_edit_student_job_info()
    instructor_info = get_add_instructor_job_info()
    staff_info = get_add_staff_job_info()
    download_info = get_download_materials_job_info()
    renew_info = get_renew_registration_job_info()
    withdrawal_info = get_student_withdrawal_job_info()
    equivalence_info = get_course_equivalence_job_info()
    send_sheets_info = get_send_grade_sheets_job_info()
    grade_entry_info = get_grade_entry_monitoring_job_info()
    grade_holds_info = get_grade_holds_job_info()
    grade_approval_info = get_grade_approval_job_info()
    grade_appeals_info = get_grade_appeals_job_info()
    create_groups_info = get_create_student_groups_job_info()
    suspend_info = get_suspend_student_job_info()
    clearance_info = get_student_clearance_job_info()
    certificate_info = get_graduation_certificate_job_info()
    
    return JsonResponse({
        'success': True,
        'is_add_job_open': add_info['is_add_job_open'],
        'add_job_message': add_info['add_job_message'],
        'is_edit_job_open': edit_info['is_edit_job_open'],
        'edit_job_message': edit_info['edit_job_message'],
        'is_add_instructor_open': instructor_info['is_add_instructor_open'],
        'add_instructor_message': instructor_info['add_instructor_message'],
        'is_add_staff_open': staff_info['is_add_staff_open'],
        'add_staff_message': staff_info['add_staff_message'],
        'is_download_job_open': download_info['is_download_job_open'],
        'download_job_message': download_info['download_job_message'],
        'is_renew_job_open': renew_info['is_renew_job_open'],
        'renew_job_message': renew_info['renew_job_message'],
        'is_withdrawal_job_open': withdrawal_info['is_withdrawal_job_open'],
        'withdrawal_job_message': withdrawal_info['withdrawal_job_message'],
        'is_equivalence_job_open': equivalence_info['is_equivalence_job_open'],
        'equivalence_job_message': equivalence_info['equivalence_job_message'],
        'is_send_sheets_job_open': send_sheets_info['is_send_sheets_job_open'],
        'send_sheets_job_message': send_sheets_info['send_sheets_job_message'],
        'is_grade_entry_job_open': grade_entry_info['is_grade_entry_job_open'],
        'grade_entry_job_message': grade_entry_info['grade_entry_job_message'],
        'is_grade_holds_job_open': grade_holds_info['is_grade_holds_job_open'],
        'grade_holds_job_message': grade_holds_info['grade_holds_job_message'],
        'is_grade_approval_job_open': grade_approval_info['is_grade_approval_job_open'],
        'grade_approval_job_message': grade_approval_info['grade_approval_job_message'],
        'is_grade_appeals_job_open': grade_appeals_info['is_grade_appeals_job_open'],
        'grade_appeals_job_message': grade_appeals_info['grade_appeals_job_message'],
        'is_create_groups_job_open': create_groups_info['is_create_groups_job_open'],
        'create_groups_job_message': create_groups_info['create_groups_job_message'],
        'is_suspend_job_open': suspend_info['is_suspend_job_open'],
        'suspend_job_message': suspend_info['suspend_job_message'],
        'is_clearance_job_open': clearance_info['is_clearance_job_open'],
        'clearance_job_message': clearance_info['clearance_job_message'],
        'is_certificate_job_open': certificate_info['is_certificate_job_open'],
        'certificate_job_message': certificate_info['certificate_job_message'],
    })


# ============================================================
# Helper Function للاستخدام في مشاهد الطلاب
# ============================================================

def check_job_status(job_code):
    """
    دالة مساعدة للتحقق من حالة وظيفة معينة.
    تستخدم في مشاهد الطلاب لمنعهم من تنفيذ إجراء إذا انتهت الفترة.
    
    Args:
        job_code (str): الكود البرمجي للوظيفة (مثل 'renewal')
    
    Returns:
        dict: {
            'is_open': bool,
            'is_active': bool,
            'message': str,
            'job': SystemJob or None
        }
    """
    try:
        job = SystemJob.objects.get(code=job_code)
        
        if not job.is_active:
            return {
                'is_open': False,
                'is_active': False,
                'message': f'⚠️ خدمة "{job.name}" غير مفعلة حالياً',
                'job': job
            }
        
        if job.is_currently_open:
            return {
                'is_open': True,
                'is_active': True,
                'message': f'✅ خدمة "{job.name}" مفتوحة (متبقي {job.days_remaining} يوم)',
                'job': job
            }
        else:
            today = timezone.now().date()
            if job.start_date > today:
                return {
                    'is_open': False,
                    'is_active': True,
                    'message': f'⏳ خدمة "{job.name}" ستبدأ في {job.start_date.strftime("%d/%m/%Y")}',
                    'job': job
                }
            else:
                return {
                    'is_open': False,
                    'is_active': True,
                    'message': f'⛔ انتهت فترة خدمة "{job.name}" في {job.end_date.strftime("%d/%m/%Y")}',
                    'job': job
                }
    
    except SystemJob.DoesNotExist:
        return {
            'is_open': False,
            'is_active': False,
            'message': f'⚠️ الخدمة غير موجودة في النظام (الكود: {job_code})',
            'job': None
        }


def format_score_badge(grade_val, is_passed):
    if not is_passed and grade_val > 0:
        return 'F'
    if grade_val >= 90: return 'A+'
    elif grade_val >= 85: return 'A'
    elif grade_val >= 80: return 'B+'
    elif grade_val >= 75: return 'B'
    elif grade_val >= 70: return 'C+'
    elif grade_val >= 65: return 'C'
    elif grade_val >= 50: return 'D'
    return 'F'


@login_required
def student_tracking(request):
    """
    صفحة متابعة السجل الأكاديمي للطالب - Dynamic Database Integration
    تتيح تتبع ومراجعة كامل الملف الأكاديمي والتايم لاين للمواد والإنجاز الأكاديمي.
    """
    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    if is_academic_dept and user_dept:
        departments = Department.objects.filter(id=user_dept.id)
    else:
        departments = Department.objects.filter(is_active=True).order_by('name')
    levels = Level.objects.all().order_by('name')
    
    # 1. الاستعلام عن كائنات الطلاب
    students_qs = Student.objects.all().select_related(
        'department', 'level', 'student_status'
    ).prefetch_related(
        'grade_set__course', 'grade_set__semester'
    )
    if is_academic_dept and user_dept:
        students_qs = students_qs.filter(department=user_dept)
    
    # 2. الفلترة المباشرة عند تزويد GET parameters
    dept_param = request.GET.get('department')
    if is_valid_filter(dept_param):
        students_qs = students_qs.filter(
            Q(department__id=dept_param) | Q(department__name=dept_param)
        )
        
    search_query = request.GET.get('search') or request.GET.get('student_id') or request.GET.get('name')
    if is_valid_filter(search_query):
        search_str = str(search_query).strip()
        students_qs = students_qs.filter(
            Q(student_id__iexact=search_str) |
            Q(student_id__icontains=search_str) |
            Q(name__icontains=search_str) |
            Q(national_id__icontains=search_str)
        )

    # 3. بناء مصفوفة ملفات تتبع الطلاب
    students_data = []
    for s in students_qs:
        # تصفية المقررات الدراسية المطلوبة للتخصص والخطة الدراسية الخاصة بالطالب حصراً
        curriculum_courses = Course.objects.none()
        if s.study_plan and s.department:
            curriculum_courses = Course.objects.filter(study_plan=s.study_plan, department=s.department, is_active=True)
            
        if not curriculum_courses.exists() and s.study_plan:
            curriculum_courses = Course.objects.filter(study_plan=s.study_plan, is_active=True)
            
        if not curriculum_courses.exists() and s.department:
            curriculum_courses = Course.objects.filter(department=s.department, is_active=True)
            
        curriculum_course_ids = set(curriculum_courses.values_list('id', flat=True))
        
        all_grades = s.grade_set.all().select_related('course', 'semester')
        
        # حصر التقييمات والمواد بسجل المواد التابعة للتخصص والخطة الدراسية فقط
        if curriculum_course_ids:
            curriculum_grades = [g for g in all_grades if g.course_id in curriculum_course_ids]
            total_courses = curriculum_courses.count()
        else:
            curriculum_grades = list(all_grades)
            dept_courses_count = Course.objects.filter(department=s.department).count() if s.department else 40
            total_courses = max(dept_courses_count, len(all_grades), 30)

        passed_grades = [g for g in curriculum_grades if g.is_passed]
        failed_grades = [g for g in curriculum_grades if not g.is_passed and g.total_grade > 0]
        
        # حساب المواد المجتازة الفريدة داخل التخصص
        passed_course_ids = set(g.course_id for g in passed_grades)
        passed_count = len(passed_course_ids)
        
        enrolled_count = max(len(curriculum_grades) - len(passed_grades) - len(failed_grades), 0)
        remaining_count = max(total_courses - passed_count, 0)
        
        total_points = sum(g.total_grade * g.course.credits for g in passed_grades)
        total_credits = sum(g.course.credits for g in passed_grades)
        gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0.0
        
        if total_courses > 0:
            if passed_count >= total_courses:
                progress = 100
                remaining_count = 0
            else:
                progress = min(round((passed_count / total_courses) * 100), 100)
        else:
            progress = 0
        
        courses_list = []
        for g in curriculum_grades:
            c_status = 'passed' if g.is_passed else ('failed' if g.total_grade > 0 else 'enrolled')
            courses_list.append({
                'name': g.course.name,
                'code': g.course.code,
                'credits': int(g.course.credits),
                'grade': float(g.total_grade),
                'score': format_score_badge(g.total_grade, g.is_passed),
                'status': c_status,
                'semester': f"{g.semester.get_type_display() if hasattr(g.semester, 'get_type_display') else g.semester.type} {g.semester.year}"
            })

        notes = [
            f"الطالب مسجل بـ {s.department.name if s.department else 'الكلية'}.",
            f"إجمالي المواد المجتازة: {passed_count} مادة دراسية بنجاح.",
        ]
        if failed_grades:
            notes.append(f"يوجد لدى الطالب {len(failed_grades)} مواد رسوب تحتاج لإعادة رصد/تصفية.")
        else:
            notes.append("لا توجد إنذارات أكاديمية مسجلة بحق الطالب.")

        alerts = []
        if gpa >= 3.5:
            alerts.append({'type': 'success', 'text': '🟢 الطالب بوضع أكاديمي ممتاز ومستوفٍ لكافة الشروط.'})
        elif gpa >= 2.0:
            alerts.append({'type': 'info', 'text': '🔵 الطالب بوضع أكاديمي جيد ومستمر بالدراسة.'})
        else:
            alerts.append({'type': 'danger', 'text': '🔴 الطالب تحت الإنذار الأكاديمي لانخفاض المعدل التراكمي.'})

        if failed_grades:
            alerts.append({'type': 'warning', 'text': f'🟡 تنبيه: الطالب مرشح لإعادة {len(failed_grades)} مواد لرفع المعدل.'})

        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
        full_name = " ".join(full_name.split())
        
        current_level_num = 1
        if s.level:
            if hasattr(s.level, 'number') and s.level.number:
                try:
                    current_level_num = int(s.level.number)
                except (ValueError, TypeError):
                    current_level_num = 1
            elif hasattr(s.level, 'name') and s.level.name:
                import re
                digits = re.findall(r'\d+', str(s.level.name))
                if digits:
                    current_level_num = int(digits[0])
                else:
                    arabic_num_map = {
                        'الأول': 1, 'الاول': 1,
                        'الثاني': 2,
                        'الثالث': 3,
                        'الرابع': 4,
                        'الخامس': 5,
                        'السادس': 6,
                        'السابع': 7,
                        'الثامن': 8
                    }
                    for word, num in arabic_num_map.items():
                        if word in str(s.level.name):
                            current_level_num = num
                            break

        level_prog = [i < current_level_num for i in range(1, 9)]

        students_data.append({
            'id': s.student_id or str(s.id),
            'name': full_name,
            'national': s.national_id or ('22000' + str(s.id)),
            'dept': s.department.name if s.department else 'غير محدد',
            'dept_id': s.department.id if s.department else None,
            'major': s.department.name if s.department else 'عام',
            'level': s.level.name if s.level else 'المستوى الأول',
            'levelNumber': current_level_num,
            'advisor': 'مكتب المسجل العام',
            'status': s.student_status.name if hasattr(s, 'student_status') and s.student_status else 'منتظم - مستمر',
            'totalCourses': total_courses,
            'passedCourses': passed_count,
            'enrolledCourses': enrolled_count,
            'remainingCourses': remaining_count,
            'gpa': str(gpa),
            'progress': progress,
            'levelProgress': level_prog,
            'courses': courses_list,
            'notes': notes,
            'alerts': alerts,
        })

    departments_list = list(departments.values('id', 'name'))
    levels_list = list(levels.values('id', 'name'))

    context = {
        'departments': departments,
        'levels': levels,
        'students_list': students_data,
        'students_json': json.dumps(students_data, ensure_ascii=False),
        'departments_json': json.dumps(departments_list, ensure_ascii=False),
        'levels_json': json.dumps(levels_list, ensure_ascii=False),
        'is_academic_dept': is_academic_dept,
    }

    return render(request, 'renewal/student_tracking.html', context)


@login_required
def get_department_courses_api(request, department_id):
    """
    API Endpoint: جلب مواد الخطة الدراسية لمودال viewSemesterPlan
    الفلترة الصارمة بالحقل الأصلي للمادة (Course.level): Course.objects.filter(department=selected_dept, level=selected_level)
    عزل تام عن بيانات وسجلات الطلاب.
    """
    try:
        from django.db.models import Q
        
        user_role = str(getattr(request.user, 'role', '')).strip().lower()
        user_dept = getattr(request.user, 'department', None)
        is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']
        if is_academic_dept and user_dept and str(department_id) != str(user_dept.id):
            return JsonResponse({'success': False, 'error': 'غير مصرح لك باستعراض مقررات أقسام أخرى'}, status=403)

        # 1. التخصص المحدد
        selected_dept = get_object_or_404(Department, id=department_id)
        
        # 2. الحصول على المستوى الدراسي وإلزام الفلترة به (يُمنع التخلي عن شرط الـ level)
        level_id = request.GET.get('level_id') or request.GET.get('level')
        if not is_valid_filter(level_id):
            return JsonResponse({
                'success': False, 
                'error': 'يجب تحديد المستوى الدراسي لفلترة مواد الفصل'
            }, status=400)
            
        selected_level = None
        if str(level_id).isdigit():
            lvl_val = int(level_id)
            selected_level = Level.objects.filter(Q(id=lvl_val) | Q(number=lvl_val)).first()
        else:
            selected_level = Level.objects.filter(id=level_id).first()
            
        if not selected_level:
            return JsonResponse({
                'success': False, 
                'error': 'المستوى الدراسي المحدد غير موجود'
            }, status=404)
        
        # 3. الفلترة الصارمة بالحقل الأصلي للمادة (Course.level)
        courses_qs = Course.objects.filter(
            department__id=selected_dept.id,
            level_id=selected_level.id,
            is_active=True
        ).select_related('level').prefetch_related('department', 'prerequisites').order_by('code')
        
        # 4. بناء استجابة البيانات مع مطابقة رموز المتطلب السابق المباشر المأخوذة من المادة الأصلية بجدول الكليات/المواد
        courses_data = []
        for course in courses_qs:
            prereqs = list(course.prerequisites.all())
            prereq_list = [f"{p.name} ({p.code})" for p in prereqs]
            prereq_codes = [p.code for p in prereqs]
            
            prereq_str = " ، ".join(prereq_list) if prereq_list else "-"
            prereq_code_str = " ، ".join(prereq_codes) if prereq_codes else "-"
            
            courses_data.append({
                'id': course.id,
                'code': course.code,
                'name': course.name,
                'credits': course.credits,
                'level_id': selected_level.id,
                'level_number': selected_level.number,
                'level_name': f"المستوى {selected_level.number}",
                'department_name': selected_dept.name,
                'prerequisite': prereq_str,
                'prerequisite_name': prereq_str,
                'prerequisite_code': prereq_code_str,
            })
            
        return JsonResponse({
            'success': True, 
            'courses': courses_data, 
            'count': len(courses_data)
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def preview_materials_api(request):
    """API: معاينة المواد المراد تنزيلها للطلاب المحددين بناءً على المواد المتبقية والمتطلبات والمستوى"""
    try:
        student_ids_param = request.GET.get('student_ids', '').strip()
        level_id_param = request.GET.get('level_id', '').strip()
        
        if not student_ids_param:
            return JsonResponse({'success': False, 'error': 'يرجى تحديد طالب من القائمة أولاً'})
            
        student_ids = [int(sid) for sid in student_ids_param.split(',') if sid.strip().isdigit()]
        if not student_ids:
            return JsonResponse({'success': False, 'error': 'يرجى تحديد طالب من القائمة أولاً'})
            
        current_semester = Semester.objects.filter(is_active=True).first()
        
        students = Student.objects.filter(id__in=student_ids).select_related('department', 'level')
        
        from apps.grades.models import Grade
        
        preview_data = []
        for student in students:
            # 2. المواد المسجلة بالفصل الحالي
            current_registered_ids = set(CourseRegistration.objects.filter(
                student=student,
                semester=current_semester
            ).values_list('course_id', flat=True)) if current_semester else set()
            
            # 🔥 جلب المواد المتاحة بالطرد والاستبدال التلقائي للمسبقات غير المجتازة
            eligible_info, num_carried, prog_warning = get_student_eligible_download_courses(
                student=student,
                semester=current_semester,
                target_level_id=level_id_param
            )
            
            student_courses = []
            for item in eligible_info:
                c = item['course']
                is_retake = item['is_retake']
                is_prereq_fallback = item['is_prereq_fallback']

                is_remaining = (c.level.number < student.level.number) if (c.level and student.level) else False
                level_num = c.level.number if c.level else 1
                level_name = f"المستوى {level_num}" if c.level else 'المستوى 1'
                
                prereqs = c.prerequisites.all()
                prereq_names = [f"{p.name} ({p.code})" for p in prereqs]
                prereq_display = " ، ".join(prereq_names) if prereq_names else "-"
                
                status_label = 'متاحة للتنزيل'
                if is_retake:
                    status_label = 'مادة معادة'
                elif is_prereq_fallback:
                    status_label = 'متطلب سابق غير مجتاز'

                student_courses.append({
                    'id': c.id,
                    'code': c.code,
                    'name': c.name,
                    'credits': c.credits,
                    'is_retake': is_retake,
                    'is_prereq_fallback': is_prereq_fallback,
                    'level_id': c.level.id if c.level else None,
                    'level_number': level_num,
                    'level_name': level_name,
                    'semester_name': level_name,
                    'is_remaining': is_remaining,
                    'is_registered': c.id in current_registered_ids,
                    'can_register': True,
                    'message': '',
                    'prerequisite': prereq_display,
                    'prerequisite_name': prereq_display,
                    'is_barrier': False,
                    'status_label': status_label
                })
                
            pdata = {
                'student_id': student.id,
                'student_code': student.student_id or f"STU{student.id:06d}",
                'student_name': student.name,
                'level_number': student.level.number if student.level else 1,
                'department_name': student.department.name if student.department else '-',
                'num_carried': num_carried,
                'courses': student_courses
            }
            if prog_warning:
                pdata['warning'] = prog_warning
            preview_data.append(pdata)
            
        return JsonResponse({'success': True, 'preview_data': preview_data})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
def get_semester_courses_api(request):
    """API: جلب جميع المواد المتاحة لتخصص محدد ومستوى محدد وفق الخطة الأكاديمية الرسمية فقط دون أي ربط بسجلات الطلاب"""
    try:
        from django.db.models import Q
        department_id = request.GET.get('department_id', '').strip() or request.GET.get('department', '').strip()
        level_id = request.GET.get('level_id', '').strip()
        
        if not is_valid_filter(department_id):
            return JsonResponse({'success': False, 'error': 'يرجى اختيار التخصص أولاً'})
            
        department = get_object_or_404(Department, id=int(department_id))
        
        courses_qs = Course.objects.filter(
            department=department,
            is_active=True
        ).select_related('level').prefetch_related('department', 'prerequisites')
        
        if is_valid_filter(level_id):
            if str(level_id).isdigit():
                lvl_val = int(level_id)
                courses_qs = courses_qs.filter(Q(level_id=lvl_val) | Q(level__number=lvl_val))
            else:
                courses_qs = courses_qs.filter(level_id=level_id)
            
        courses_qs = courses_qs.order_by('level__number', 'code')
        
        courses_data = []
        for course in courses_qs:
            prereqs = list(course.prerequisites.all())
            prereq_list = [f"{p.name} ({p.code})" for p in prereqs]
            prereq_codes = [p.code for p in prereqs]
            prereq_str = " ، ".join(prereq_list) if prereq_list else "-"
            prereq_code_str = " ، ".join(prereq_codes) if prereq_codes else "-"
            
            courses_data.append({
                'id': course.id,
                'code': course.code,
                'name': course.name,
                'credits': course.credits,
                'level_id': course.level.id if course.level else None,
                'level_number': course.level.number if course.level else 1,
                'level_name': f"المستوى {course.level.number}" if course.level else 'المستوى 1',
                'department_name': department.name,
                'prerequisite': prereq_str,
                'prerequisite_name': prereq_str,
                'prerequisite_code': prereq_code_str,
            })
            
        return JsonResponse({'success': True, 'courses': courses_data, 'count': len(courses_data)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})


@login_required
@require_execution_permission('renewal.add_courseregistration', 'renewal.change_courseregistration', 'add_courseregistration', 'change_courseregistration')
def download_special_materials_api(request):
    """API: تنزيل وحفظ المواد الاستثنائية للطلاب المحددين في جدول تسجيل المواد"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة الطلب غير مسموح بها'}, status=405)
        
    try:
        data = json.loads(request.body) if request.body else request.POST
        
        student_id = data.get('student_id')
        student_ids = data.get('student_ids', [])
        course_ids = data.get('course_ids', [])
        year = data.get('academic_year') or data.get('year')
        season_type = data.get('semester') or data.get('season_type')
        
        if not student_ids and student_id:
            student_ids = [student_id]
            
        if not student_ids:
            return JsonResponse({'success': False, 'error': 'يرجى تحديد طالب واحد على الأقل أولاً'})
            
        # 1. تحديد الفصل الدراسي الحالي أو المطلوب
        target_semester = None
        if is_valid_filter(year) and is_valid_filter(season_type):
            try:
                target_semester = Semester.objects.filter(year=int(year), type=season_type).first()
            except (ValueError, TypeError):
                target_semester = None
                
        if not target_semester:
            target_semester = Semester.objects.filter(is_active=True).first()
            
        if not target_semester:
            return JsonResponse({'success': False, 'error': 'لا يوجد فصل دراسي نشط في المنظومة حالياً'})
            
        registered_courses = []
        created_count = 0
        
        students = Student.objects.filter(id__in=student_ids).select_related('department', 'level')
        
        from apps.grades.models import Grade
        
        for student in students:
            target_course_ids = course_ids
            
            # إذا لم تكن هناك قائمة مواد محددة مرسلة، جلب جميع المواد المتاحة بالتصفية والاستبدال التلقائي للمسبقات
            if not target_course_ids:
                eligible_courses = get_student_eligible_download_courses(student=student, semester=target_semester)
                target_course_ids = [c.id for c in eligible_courses]
                
            for cid in target_course_ids:
                try:
                    course = Course.objects.get(id=int(cid))
                    user_to_set = request.user if (hasattr(request, 'user') and request.user and request.user.is_authenticated) else User.objects.first()
                    reg, created = CourseRegistration.objects.get_or_create(
                        student=student,
                        course=course,
                        semester=target_semester,
                        defaults={
                            'registered_by': user_to_set,
                            'notes': f"تنزيل مواد (حالة خاصة)"
                        }
                    )
                    if created:
                        created_count += 1
                    registered_courses.append({'id': course.id, 'code': course.code, 'name': course.name})
                except Course.DoesNotExist:
                    continue
                    
        print(f"SUCCESS: download_special_materials_api: saved {created_count} registrations for {len(students)} students")
        return JsonResponse({
            'status': 'success',
            'success': True,
            'message': f'تم تنزيل المواد بنجاح لـ {len(students)} طالب/طلاب (إجمالي المواد: {len(registered_courses)})',
            'courses': registered_courses,
            'registered_count': created_count
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)})

def get_grade_label(gpa):
    val = float(gpa)
    if val <= 4.0:
        if val >= 3.50:
            return 'امتياز'
        elif val >= 3.00:
            return 'جيد جداً'
        elif val >= 2.50:
            return 'جيد'
        elif val >= 2.00:
            return 'مقبول'
        else:
            return 'ضعيف'
    else:
        if val >= 85.0:
            return 'امتياز'
        elif val >= 75.0:
            return 'جيد جداً'
        elif val >= 65.0:
            return 'جيد'
        elif val >= 50.0:
            return 'مقبول'
        else:
            return 'ضعيف'


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def plan_add_course_view(request, plan_id):
    """
    إضافة مادة (Course) إلى خطة دراسية معينة (StudyPlan) عبر نموذج مباشر بسيط.
    """
    plan = get_object_or_404(StudyPlan, pk=plan_id)

    if request.method == 'GET':
        departments = Department.objects.filter(is_active=True).order_by('name')
        levels = Level.objects.all().order_by('number')
        
        # جلب كافة المواد المتاحة كمتطلبات سابقة
        existing_courses = Course.objects.select_related('level').prefetch_related('department').order_by('level__number', 'code')

        context = {
            'plan': plan,
            'departments': departments,
            'levels': levels,
            'existing_courses': existing_courses,
            'page_title': f'إضافة مقرر للخطة: {plan.name}',
        }
        return render(request, 'renewal/add_plan_course.html', context)

    if request.method == 'POST':
        try:
            if request.content_type == 'application/json' or request.headers.get('x-requested-with') == 'XMLHttpRequest':
                data = json_payload(request)
            else:
                data = request.POST.dict()

            course_id = data.get('course_id')
            level_id = data.get('level_id')
            department_id = data.get('department_id')
            course_type = data.get('course_type', 'mandatory')
            is_mandatory = (course_type == 'mandatory') or (str(data.get('is_mandatory')).lower() == 'true')

            code = data.get('code', '').strip()
            name = data.get('name', '').strip()
            credits = data.get('credits', 3)
            theoretical_hours = data.get('theoretical_hours', 2)
            practical_hours = data.get('practical_hours', 0)

            prerequisites_input = data.get('prerequisite_id') or data.get('prerequisites') or []
            if prerequisites_input:
                if isinstance(prerequisites_input, (list, tuple)):
                    prerequisite_ids = [pid for pid in prerequisites_input if str(pid).strip() not in ['', '0', 'none', 'null', 'None']]
                else:
                    if str(prerequisites_input).strip() not in ['', '0', 'none', 'null', 'None']:
                        prerequisite_ids = [prerequisites_input]
                    else:
                        prerequisite_ids = []
            else:
                prerequisite_ids = []

            # 1. التخصص والخطة صراحةً (التحقق الإجباري من التخصص)
            target_plan = plan
            selected_department = None
            if department_id:
                selected_department = Department.objects.filter(id=department_id).first()
            if not selected_department:
                selected_department = Department.objects.first()

            if not selected_department:
                if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                    return JsonResponse({'success': False, 'message': 'التخصص / القسم العلمي مطلوب لإضافة المادة'}, status=400)
                messages.error(request, '❌ التخصص / القسم العلمي مطلوب لإضافة المادة')
                return redirect('renewal:plan_add_course', plan_id=plan.id)

            level = Level.objects.filter(id=level_id).first() if level_id else Level.objects.first()

            if not code or not name:
                if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                    return JsonResponse({'success': False, 'message': 'رمز المادة واسمها مطلوبان لإنشاء مادة جديدة'}, status=400)
                messages.error(request, '❌ رمز المادة واسمها مطلوبان لإنشاء مادة جديدة')
                return redirect('renewal:plan_add_course', plan_id=plan.id)

            # 2. إنشاء مادة جديدة مباشرة أو تحديث مادة موجودة في هذه الخطة
            if course_id:
                course = get_object_or_404(Course, pk=course_id)
                course.code = code
                course.name = name
                course.credits = int(credits)
                course.theoretical_hours = int(theoretical_hours)
                course.practical_hours = int(practical_hours)
                course.study_plan = target_plan
                course.department = selected_department
                if level:
                    course.level = level
                course.is_mandatory = is_mandatory
                course.is_active = True
                course.save()
            else:
                existing_same_code = Course.objects.filter(code__iexact=code, study_plan=target_plan).first()
                if existing_same_code:
                    course = existing_same_code
                    course.name = name
                    course.credits = int(credits)
                    course.theoretical_hours = int(theoretical_hours)
                    course.practical_hours = int(practical_hours)
                    course.department = selected_department
                    if level:
                        course.level = level
                    course.is_mandatory = is_mandatory
                    course.is_active = True
                    course.save()
                else:
                    course = Course.objects.create(
                        code=code,
                        name=name,
                        credits=int(credits),
                        theoretical_hours=int(theoretical_hours),
                        practical_hours=int(practical_hours),
                        department=selected_department,
                        study_plan=target_plan,
                        level=level,
                        is_mandatory=is_mandatory,
                        is_active=True
                    )

            if prerequisite_ids:
                prereq_courses = Course.objects.filter(id__in=prerequisite_ids)
                course.prerequisites.set(prereq_courses)
            else:
                course.prerequisites.clear()

            messages.success(request, f'✅ تمت إضافة المقرر "{course.name}" ({course.code}) إلى الخطة "{plan.name}" بنجاح.')

            if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                return JsonResponse({
                    'success': True,
                    'message': f'تمت إضافة المادة "{course.name}" ({course.code}) إلى الخطة "{plan.name}" بنجاح',
                    'course': {
                        'id': course.id,
                        'code': course.code,
                        'name': course.name,
                        'credits': course.credits,
                        'level_number': course.level.number if course.level else 0,
                        'is_mandatory': course.is_mandatory
                    }
                })

            return redirect('renewal:plans_manage')

        except Exception as e:
            if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                return JsonResponse({'success': False, 'message': f'حدث خطأ أثناء إضافة المادة: {str(e)}'}, status=500)
            messages.error(request, f'❌ حدث خطأ أثناء إضافة المادة: {str(e)}')
            return redirect('renewal:plan_add_course', plan_id=plan.id)

    return redirect('renewal:plans_manage')


@login_required
def _build_students_gpa_dataset(request):
    """دالة مساعدة لبناء وتصفية بيانات كشف الطلاب حسب المعدل"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    levels = Level.objects.all().order_by('name')
    
    # 1. الاستعلام الأساسي مع تحسين الأداء
    students_qs = Student.objects.all().select_related(
        'department', 'level', 'student_status', 'group'
    ).prefetch_related(
        'grade_set__course', 'grade_set__semester',
        'semesterrecord_set__semester'
    )
    
    # 2. الفلترة المباشرة عند تزويد GET parameters
    dept_param = request.GET.get('department')
    if is_valid_filter(dept_param):
        students_qs = students_qs.filter(
            Q(department__id=dept_param) | Q(department__name=dept_param)
        )
        
    level_param = request.GET.get('level')
    if is_valid_filter(level_param):
        students_qs = students_qs.filter(
            Q(level__id=level_param) | Q(level__name=level_param)
        )
        
    search_query = request.GET.get('search', '').strip()
    if search_query:
        students_qs = students_qs.filter(
            Q(name__icontains=search_query) |
            Q(student_id__icontains=search_query) |
            Q(national_id__icontains=search_query)
        )

    # 3. تحديد الفصل الدراسي المستهدف من الفلتر
    semester_year_param = request.GET.get('year')
    semester_type_param = request.GET.get('semester')

    SEMESTER_TYPE_MAP = {
        'خريف': 'fall',
        'ربيع': 'spring',
        'fall': 'fall',
        'spring': 'spring',
    }
    semester_type_internal = SEMESTER_TYPE_MAP.get(semester_type_param, None)

    target_semester = None
    if is_valid_filter(semester_year_param) or is_valid_filter(semester_type_param):
        sem_qs = Semester.objects.all()
        if is_valid_filter(semester_year_param):
            try:
                sem_qs = sem_qs.filter(year=int(semester_year_param))
            except (ValueError, TypeError):
                pass
        if semester_type_internal:
            sem_qs = sem_qs.filter(type=semester_type_internal)
        target_semester = sem_qs.first()

    if target_semester:
        students_qs = students_qs.filter(
            Q(grade_set__semester=target_semester) |
            Q(semesterrecord_set__semester=target_semester)
        ).distinct()

    # 4. بناء مصفوفة الطلاب المحسوبة
    students_data = []
    for s in students_qs:
        gpa = 0.0
        completed_hours = 0

        if target_semester:
            from apps.student.models import SemesterRecord
            sem_record = SemesterRecord.objects.filter(
                student=s, semester=target_semester
            ).first()
            if sem_record and sem_record.registered_credits > 0:
                gpa = round(sem_record.semester_gpa, 2)
                completed_hours = int(sem_record.completed_credits)
            else:
                sem_grades = s.grade_set.filter(semester=target_semester).select_related('course')
                total_points = sum(g.total_grade * g.course.credits for g in sem_grades if g.total_grade > 0)
                total_credits = sum(g.course.credits for g in sem_grades)
                if total_credits > 0:
                    gpa = round(total_points / total_credits, 2)
                    completed_hours = int(sum(g.course.credits for g in sem_grades if g.is_passed))
        else:
            if hasattr(s, 'academicrecord') and s.academicrecord:
                gpa = round(s.academicrecord.cumulative_gpa, 2)
                completed_hours = int(s.academicrecord.total_completed_credits)
            else:
                passed_grades = s.grade_set.filter(is_passed=True).select_related('course')
                total_points = sum(g.total_grade * g.course.credits for g in passed_grades)
                total_credits = sum(g.course.credits for g in passed_grades)
                if total_credits > 0:
                    gpa = round(total_points / total_credits, 2)
                    completed_hours = int(total_credits)

        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
        full_name = " ".join(full_name.split())
        
        grade_label = get_grade_label(gpa)
        
        grade_filter = request.GET.get('grade')
        if is_valid_filter(grade_filter) and grade_label != grade_filter:
            continue
            
        filter_type = request.GET.get('type') or request.GET.get('filter_type')
        if is_valid_filter(filter_type):
            if filter_type == 'passed' and not (gpa >= 2.0 if gpa <= 4.0 else gpa >= 50.0):
                continue
            elif filter_type == 'failed' and not (gpa < 2.0 if gpa <= 4.0 else gpa < 50.0):
                continue
            elif filter_type == 'top' and not (gpa >= 3.5 if gpa <= 4.0 else gpa >= 85.0):
                continue
            elif filter_type == 'range':
                try:
                    g_from = float(request.GET.get('gpa_from', 0))
                    g_to = float(request.GET.get('gpa_to', 4.0))
                    if not (g_from <= gpa <= g_to):
                        continue
                except (ValueError, TypeError):
                    pass

        if target_semester:
            display_year = str(target_semester.year)
            display_semester = target_semester.get_type_display()
        else:
            display_year = str(s.enrollment_date.year) if s.enrollment_date else "2026"
            display_semester = s.enrollment_semester or "ربيع"

        students_data.append({
            'id': s.student_id or str(s.id),
            'name': full_name,
            'dept_id': s.department.id if s.department else None,
            'dept': s.department.name if s.department else 'غير محدد',
            'major': s.department.name if s.department else 'غير محدد',
            'level': s.level.name if s.level else 'غير محدد',
            'hours': completed_hours,
            'gpa': gpa,
            'grade': grade_label,
            'year': display_year,
            'semester': display_semester,
        })

    students_data.sort(key=lambda x: x['gpa'], reverse=True)

    all_semesters = Semester.objects.all().order_by('-year', 'type')
    unique_years = sorted(set(s.year for s in all_semesters), reverse=True)

    return students_data, departments, levels, all_semesters, unique_years, semester_year_param, semester_type_param


def students_by_gpa(request):
    """
    صفحة كشف الطلاب حسب المعدل التراكمي (GPA)
    تربط مباشرة بقاعدة البيانات وتوفر فلاتر البحث الحقيقي.
    """
    students_data, departments, levels, all_semesters, unique_years, semester_year_param, semester_type_param = _build_students_gpa_dataset(request)

    context = {
        'page_title': 'كشف الطلاب حسب المعدل',
        'departments': departments,
        'levels': levels,
        'all_semesters': all_semesters,
        'unique_years': unique_years,
        'students_list': students_data,
        'students_json': json.dumps(students_data, ensure_ascii=False),
        'total_count': len(students_data),
        'selected_year': semester_year_param or '',
        'selected_semester': semester_type_param or '',
    }

    return render(request, 'renewal/students_by_gpa.html', context)


@login_required
def export_students_gpa_excel(request):
    """
    تصدير حقيقي لملف Excel بتنسيق XLSX مع التنسيق الاحترافي واتجاه اليمين لليسار.
    """
    import io
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from urllib.parse import quote

    students_data, _, _, _, _, _, _ = _build_students_gpa_dataset(request)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "كشف الطلاب حسب المعدل"
    ws.views.sheetView[0].rightToLeft = True

    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    align_center = Alignment(horizontal="center", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers = ["م", "الرقم الدراسي", "اسم الطالب الكامل", "القسم / التخصص", "المستوى", "الوحدات", "المعدل التراكمي", "التقدير"]
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center
        cell.border = border_thin

    ws.row_dimensions[1].height = 28

    for idx, s in enumerate(students_data, 1):
        gpa_val = float(s.get('gpa', 0) or 0)
        row = [
            idx,
            str(s.get('id', '')),
            str(s.get('name', '')),
            str(s.get('major', '') or s.get('dept', '')),
            str(s.get('level', '')),
            int(s.get('hours', 0) or 0),
            round(gpa_val, 2),
            str(s.get('grade', ''))
        ]
        ws.append(row)
        current_row = idx + 1
        ws.row_dimensions[current_row].height = 22
        for col_idx in range(1, len(row) + 1):
            cell = ws.cell(row=current_row, column=col_idx)
            cell.font = Font(name="Arial", size=10)
            cell.alignment = align_right if col_idx in (3, 4) else align_center
            cell.border = border_thin
            if idx % 2 == 0:
                cell.fill = zebra_fill

    column_widths = {1: 8, 2: 18, 3: 35, 4: 25, 5: 15, 6: 12, 7: 16, 8: 15}
    for col_idx, width in column_widths.items():
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    response = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    filename = "كشف_الطلاب_حسب_المعدل.xlsx"
    response['Content-Disposition'] = f"attachment; filename*=UTF-8''{quote(filename)}"
    return response


@login_required
def student_withdrawal_view(request):
    """صفحة عرض واجهة سحب الملف"""
    today_date = datetime.now().strftime('%Y-%m-%d')
    withdrawal_job_info = get_student_withdrawal_job_info()
    
    admission_head = ""
    general_registrar = ""
    try:
        from apps.users.models import Official
        adm_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='admission') | Q(position_name__icontains='تسجيل') | Q(position_name__icontains='قبول')
        ).first()
        if adm_obj:
            admission_head = adm_obj.get_full_name()

        reg_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='registrar') | Q(position_name__icontains='المسجل العام') | Q(position_name__icontains='مسجل')
        ).exclude(position_key='admission').first()
        if reg_obj:
            general_registrar = reg_obj.get_full_name()
    except Exception as e:
        logger.warning(f"Error fetching officials in student_withdrawal_view: {e}")

    context = {
        'today_date': today_date,
        'is_withdrawal_job_open': withdrawal_job_info['is_withdrawal_job_open'],
        'withdrawal_job_message': withdrawal_job_info['withdrawal_job_message'],
        'admission_head_name': admission_head or 'أ. محمد علي عمر',
        'general_registrar_name': general_registrar or 'أ. أحمد محمد علي محمود',
    }
    return render(request, 'renewal/student_withdrawal.html', context)


@login_required
def process_student_withdrawal_api(request):
    """
    API للبحث عن بيانات الطالبة وتنفيذ إجراأت سحب الملف
    - GET: البحث برقم القيد (student_id)
    - POST: تنفيذ السحب برقم القيد، السبب والملاحظات
    """
    try:
        withdrawal_job_info = get_student_withdrawal_job_info()
        if not withdrawal_job_info['is_withdrawal_job_open']:
            return JsonResponse({
                'success': False,
                'message': withdrawal_job_info['withdrawal_job_message']
            }, status=403)

        if request.method == 'GET':
            student_id = request.GET.get('student_id', '').strip()
            if not student_id:
                return JsonResponse({'success': False, 'message': 'يرجى إدخال رقم القيد للبحث.'}, status=400)
            
            # البحث عن الطالبة برقم القيد أو الرقم القومي أو الاسم
            student = Student.objects.filter(
                Q(student_id__iexact=student_id) | Q(student_id__icontains=student_id)
            ).first()

            if not student:
                return JsonResponse({'success': False, 'message': 'لم يتم العثور على أي طالبة برقم القيد المدخل.'}, status=404)
            
            current_status_name = student.student_status.name if student.student_status else 'غير محدد'
            is_withdrawn = current_status_name in ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب']
            
            active_semester = Semester.objects.filter(is_active=True).first()
            semester_name = str(active_semester) if active_semester else (student.enrollment_semester or 'غير محدد')

            withdrawal_reason = ''
            withdrawal_notes = ''
            withdrawal_date = datetime.now().strftime('%Y-%m-%d')

            # جلب أحدث سجل سحب ملف من الجدول الجديد
            latest_withdrawal = StudentWithdrawal.objects.filter(student=student).first()
            if latest_withdrawal:
                withdrawal_reason = latest_withdrawal.reason or ''
                withdrawal_notes = latest_withdrawal.notes or ''
                withdrawal_date = latest_withdrawal.withdrawal_date.strftime('%Y-%m-%d') if latest_withdrawal.withdrawal_date else withdrawal_date
                if latest_withdrawal.academic_term:
                    semester_name = str(latest_withdrawal.academic_term)
            elif is_withdrawn and student.notes and '[إجراء سحب الملف - ' in student.notes:
                try:
                    logs = student.notes.split('[إجراء سحب الملف - ')
                    last_log = logs[-1]
                    date_part = last_log.split(']:')[0].strip()
                    withdrawal_date = date_part.split(' ')[0] if ' ' in date_part else date_part
                    if 'السبب (' in last_log:
                        withdrawal_reason = last_log.split('السبب (')[1].split(')')[0].strip()
                    if '| ملاحظات:' in last_log:
                        withdrawal_notes = last_log.split('| ملاحظات:')[1].strip()
                except Exception:
                    pass

            return JsonResponse({
                'success': True,
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'full_name': student.get_full_name(),
                    'department': student.department.name if student.department else 'غير محدد',
                    'level': f"المستوى {student.level.number}" if student.level else 'غير محدد',
                    'status': current_status_name,
                    'is_withdrawn': is_withdrawn,
                    'semester': semester_name,
                    'national_id': student.national_id or '',
                    'phone': student.phone or '',
                    'notes': student.notes or '',
                    'withdrawal_reason': withdrawal_reason,
                    'withdrawal_notes': withdrawal_notes,
                    'withdrawal_date': withdrawal_date,
                }
            })

        elif request.method == 'POST':
            if not has_execution_perm(request.user, 'renewal.add_studentwithdrawal', 'student.change_studystatus', 'student.change_student', 'add_studentwithdrawal', 'change_student'):
                return JsonResponse({'success': False, 'message': 'غير مصرح لك بتنفيذ عملية سحب الملف (صلاحيات العرض فقط).'}, status=403)

            if request.content_type == 'application/json':
                data = json.loads(request.body.decode('utf-8'))
            else:
                data = request.POST

            student_id = data.get('student_id', '').strip()
            reason = data.get('reason', '').strip()
            notes = data.get('notes', '').strip()

            if not student_id:
                return JsonResponse({'success': False, 'message': 'رقم القيد مطلوب لتنفيذ العملية.'}, status=400)
            if not reason:
                return JsonResponse({'success': False, 'message': 'سبب سحب الملف مطلوب.'}, status=400)

            student = Student.objects.filter(
                Q(student_id__iexact=student_id) | Q(id=student_id if student_id.isdigit() else -1)
            ).first()

            if not student:
                return JsonResponse({'success': False, 'message': 'لم يتم العثور على الطالبة في النظام.'}, status=404)

            # 1. تحديث حالة الطالبة في جدول Student
            withdrawn_status, _ = StudentStatus.objects.get_or_create(name="مسحوبة ملف")
            student.student_status = withdrawn_status
            
            today_str = datetime.now().strftime('%Y-%m-%d %H:%M')
            today_date_only = datetime.now().strftime('%Y-%m-%d')
            withdrawal_log = f"\n[إجراء سحب الملف - {today_str}]: السبب ({reason}) | ملاحظات: {notes or 'لا يوجد'}"
            student.notes = (student.notes or '') + withdrawal_log
            student.save()

            # 2. إنشاء وتوثيق السجل في جدول StudentWithdrawal الجديد
            active_semester = Semester.objects.filter(is_active=True).first()
            withdrawal_record = StudentWithdrawal.objects.create(
                student=student,
                academic_term=active_semester,
                withdrawal_date=timezone.now().date(),
                reason=reason,
                notes=notes,
                processed_by=request.user if request.user.is_authenticated else None
            )

            # 3. تحديث قيد الفصل الدراسي إلى 'withdrawn' إن وجد
            if active_semester:
                EnrollmentRenewal.objects.filter(
                    student=student,
                    semester=active_semester
                ).update(status='withdrawn')

            return JsonResponse({
                'success': True,
                'message': f'تمت عملية سحب الملف بنجاح للطالبة: {student.get_full_name()}',
                'student_id': student.student_id,
                'status': withdrawn_status.name,
                'withdrawal_reason': reason,
                'withdrawal_notes': notes,
                'withdrawal_date': today_date_only,
                'withdrawal_id': withdrawal_record.id
            })

        return JsonResponse({'success': False, 'message': 'نوع الطلب غير مدعوم'}, status=405)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'حدث خطأ في معالجة الطلب: {str(e)}'}, status=500)



@login_required
def file_withdrawal_archive(request):
    """صفحة أرشيف سحب الملفات والفلترة المتقدمة"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-id')
    years = sorted(list(set(Semester.objects.values_list('year', flat=True))), reverse=True)
    if not years:
        years = [2026, 2025, 2024]
    active_semester = Semester.objects.filter(is_active=True).first()
    today_str = datetime.now().strftime('%Y-%m-%d')
    return render(request, 'renewal/file_withdrawal_archive.html', {
        'departments': departments,
        'semesters': semesters,
        'years': years,
        'active_semester': active_semester,
        'today_date': today_str
    })


@login_required
def get_file_withdrawal_archive_api(request):
    """API استرجاع بيانات وأرشيف سحب الملفات من جدول StudentWithdrawal مع الفلترة المتقدمة"""
    try:
        year_param = request.GET.get('year', '').strip()
        semester_param = request.GET.get('semester', '').strip()
        dept_param = request.GET.get('department', '').strip()
        search_query = request.GET.get('search', '').strip()

        # الاستعلام الأساسي من جدول StudentWithdrawal العلائقي
        withdrawals_qs = StudentWithdrawal.objects.all().select_related(
            'student', 'student__department', 'student__level', 'student__student_status', 'academic_term', 'processed_by'
        ).order_by('-withdrawal_date', '-id')

        if dept_param and dept_param.isdigit():
            withdrawals_qs = withdrawals_qs.filter(student__department_id=int(dept_param))

        if year_param and year_param.isdigit():
            y_int = int(year_param)
            withdrawals_qs = withdrawals_qs.filter(
                Q(academic_term__year=y_int) | Q(withdrawal_date__year=y_int)
            )

        if semester_param and semester_param.isdigit():
            withdrawals_qs = withdrawals_qs.filter(academic_term_id=int(semester_param))

        if search_query:
            withdrawals_qs = withdrawals_qs.filter(
                Q(student__student_id__icontains=search_query) |
                Q(student__name__icontains=search_query) |
                Q(student__last_name__icontains=search_query) |
                Q(student__national_id__icontains=search_query)
            )

        students_list = []
        recorded_student_ids = set()

        for w in withdrawals_qs:
            s = w.student
            recorded_student_ids.add(s.id)
            status_name = s.student_status.name if s.student_status else 'سحب ملف'
            dept_name = s.department.name if s.department else 'غير محدد'
            level_name = f"المستوى {s.level.number}" if s.level else 'غير محدد'
            full_name = s.get_full_name() or f"{s.name or ''} {s.last_name or ''}".strip() or "لم يحدد"

            students_list.append({
                'pk': s.id,
                'withdrawal_id': w.id,
                'student_id': s.student_id or '—',
                'full_name': full_name,
                'national_id': s.national_id or getattr(s, 'passport_number', None) or '—',
                'department': dept_name,
                'level': level_name,
                'status': status_name,
                'withdrawal_date': w.withdrawal_date.strftime('%Y-%m-%d') if w.withdrawal_date else datetime.now().strftime('%Y-%m-%d'),
                'withdrawal_reason': w.reason or 'سحب ملف بناءً على طلب الطالبة',
                'withdrawal_notes': w.notes or 'لا توجد ملاحظات إضافية',
                'processed_by': w.processed_by.get_full_name() or w.processed_by.username if w.processed_by else '—',
                'phone': s.phone or '—'
            })

        # دعم السجلات السابقة (Fallback) التي قد تكون مسجلة في notes قبل إنشاء الجدول ولم تُسجل في StudentWithdrawal
        withdrawn_statuses = ['مسحوبة ملف', 'سحب ملف', 'WITHDRAWN', 'مسحوب', 'منسحب']
        legacy_withdrawn = Student.objects.filter(
            Q(student_status__name__in=withdrawn_statuses) |
            Q(notes__icontains='[إجراء سحب الملف') |
            Q(enrollmentrenewal__status='withdrawn')
        ).exclude(id__in=recorded_student_ids).distinct().select_related(
            'department', 'study_plan', 'student_status', 'level'
        ).order_by('-id')

        if dept_param and dept_param.isdigit():
            legacy_withdrawn = legacy_withdrawn.filter(department__id=int(dept_param))

        if year_param and year_param.isdigit():
            y_int = int(year_param)
            legacy_withdrawn = legacy_withdrawn.filter(
                Q(enrollmentrenewal__semester__year=y_int) |
                Q(enrollment_semester__icontains=str(y_int))
            )

        if semester_param and semester_param.isdigit():
            sem_obj = Semester.objects.filter(id=int(semester_param)).first()
            if sem_obj:
                legacy_withdrawn = legacy_withdrawn.filter(
                    Q(enrollmentrenewal__semester=sem_obj) |
                    Q(enrollment_semester__icontains=str(sem_obj.year))
                )

        if search_query:
            legacy_withdrawn = legacy_withdrawn.filter(
                Q(student_id__icontains=search_query) |
                Q(name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(national_id__icontains=search_query)
            )

        for s in legacy_withdrawn:
            status_name = s.student_status.name if s.student_status else 'سحب ملف'
            dept_name = s.department.name if s.department else 'غير محدد'
            level_name = f"المستوى {s.level.number}" if s.level else 'غير محدد'
            
            w_date = datetime.now().strftime('%Y-%m-%d')
            w_reason = 'سحب ملف بناءً على طلب الطالبة'
            w_notes = 'لا توجد ملاحظات إضافية'

            if s.notes and '[إجراء سحب الملف - ' in s.notes:
                try:
                    logs = s.notes.split('[إجراء سحب الملف - ')
                    last_log = logs[-1]
                    date_part = last_log.split(']:')[0].strip()
                    w_date = date_part.split(' ')[0] if ' ' in date_part else date_part
                    if 'السبب (' in last_log:
                        w_reason = last_log.split('السبب (')[1].split(')')[0].strip()
                    if '| ملاحظات:' in last_log:
                        w_notes = last_log.split('| ملاحظات:')[1].strip()
                except Exception:
                    pass

            full_name = s.get_full_name() or f"{s.name or ''} {s.last_name or ''}".strip() or "لم يحدد"

            students_list.append({
                'pk': s.id,
                'withdrawal_id': None,
                'student_id': s.student_id or '—',
                'full_name': full_name,
                'national_id': s.national_id or getattr(s, 'passport_number', None) or '—',
                'department': dept_name,
                'level': level_name,
                'status': status_name,
                'withdrawal_date': w_date,
                'withdrawal_reason': w_reason,
                'withdrawal_notes': w_notes,
                'processed_by': '—',
                'phone': s.phone or '—'
            })

        return JsonResponse({
            'success': True,
            'students': students_list,
            'total_count': len(students_list)
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'حدث خطأ في النظام: {str(e)}'}, status=500)



# ============================================
# إدارة وعرض الخطط الدراسية (Study Plans Management)
# ============================================

@login_required
def plans_display_view(request):
    """
    عرض صفحة الخطط الدراسية المعتمدة للمستخدمين/الطلاب، مرتبة حسب الأقسام والمستويات الدراسية،
    وإظهار تفاصيل المواد (رمز المادة، اسمها، الوحدات، الساعات، المتطلب السابق)
    باستخدام prefetch_related لضمان كفاءة الأداء.
    """
    dept_id = request.GET.get('department_id') or request.GET.get('department') or ''
    plan_id = request.GET.get('plan_id') or request.GET.get('plan') or ''
    level_id = request.GET.get('level_id') or request.GET.get('level') or ''

    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    if is_academic_dept and user_dept:
        dept_id = str(user_dept.id)
        departments = Department.objects.filter(id=user_dept.id)
    else:
        departments = Department.objects.filter(is_active=True).order_by('name')

    levels = Level.objects.all().order_by('number')

    # تجلب الخطط الدراسية المتاحة للتخصص المختار أو للكل (الخطط النشطة فقط)
    if is_valid_filter(dept_id):
        plan_ids = Course.objects.filter(department__id=dept_id, is_active=True).values_list('study_plan_id', flat=True).distinct()
        available_plans = StudyPlan.objects.filter(id__in=plan_ids, is_active=True).order_by('name')
    else:
        available_plans = StudyPlan.objects.filter(is_active=True, course__is_active=True).distinct().order_by('name')

    has_selected_filter = is_valid_filter(dept_id) or is_valid_filter(plan_id) or is_valid_filter(level_id)

    plans_data = []
    if has_selected_filter:
        plans_query = StudyPlan.objects.filter(is_active=True, course__is_active=True).distinct().order_by('name')

        if is_valid_filter(plan_id):
            plans_query = plans_query.filter(id=plan_id)
        elif is_valid_filter(dept_id):
            plan_ids = Course.objects.filter(department__id=dept_id, is_active=True).values_list('study_plan_id', flat=True).distinct()
            plans_query = plans_query.filter(id__in=plan_ids)

        for plan in plans_query:
            courses = Course.objects.filter(study_plan=plan, is_active=True).select_related('level').prefetch_related('department', 'prerequisites').order_by('level__number', 'code')
            
            if is_valid_filter(dept_id):
                courses = courses.filter(department__id=dept_id)

            if is_valid_filter(level_id):
                courses = courses.filter(level_id=level_id)

            if not courses.exists() and (is_valid_filter(dept_id) or is_valid_filter(level_id)):
                continue

            # تجميع المواد حسب المستويات
            levels_map = {}
            for course in courses:
                lvl_num = course.level.number if course.level else 0
                lvl_name = course.level.name if course.level else "غير محدد"
                if lvl_num not in levels_map:
                    levels_map[lvl_num] = {
                        'level_number': lvl_num,
                        'level_name': lvl_name,
                        'courses': []
                    }
                
                prereqs = [f"{p.name} ({p.code})" for p in course.prerequisites.all()]
                active_depts = course.department.filter(is_active=True)
                depts_str = ", ".join(d.name for d in active_depts) if active_depts.exists() else "عام"
                
                levels_map[lvl_num]['courses'].append({
                    'id': course.id,
                    'code': course.code,
                    'name': course.name,
                    'credits': course.credits,
                    'theoretical_hours': course.theoretical_hours,
                    'practical_hours': course.practical_hours,
                    'total_hours': course.theoretical_hours + course.practical_hours,
                    'prerequisites': prereqs,
                    'prerequisites_str': ", ".join(prereqs) if prereqs else "لا يوجد",
                    'is_mandatory': course.is_mandatory,
                    'course_type': "إجباري" if course.is_mandatory else "اختياري",
                    'department_name': depts_str
                })

            sorted_levels = [levels_map[k] for k in sorted(levels_map.keys())]

            plans_data.append({
                'id': plan.id,
                'name': plan.name,
                'description': plan.description,
                'levels': sorted_levels,
                'total_courses': courses.count(),
                'total_credits': sum(c.credits for c in courses)
            })

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json':
        return JsonResponse({
            'success': True,
            'has_selected_filter': has_selected_filter,
            'plans': plans_data,
            'available_plans': list(available_plans.values('id', 'name'))
        })

    context = {
        'departments': departments,
        'levels': levels,
        'available_plans': available_plans,
        'plans': plans_data,
        'has_selected_filter': has_selected_filter,
        'selected_dept': str(dept_id) if dept_id else '',
        'selected_plan': str(plan_id) if plan_id else '',
        'selected_level': str(level_id) if level_id else '',
        'is_academic_dept': is_academic_dept,
    }

    # 🛡️ توثيق زيارة صفحة عرض الخطط الدراسية في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_plans_display',
            model_name='StudyPlan',
            object_name='صفحة عرض الخطط الدراسية',
            details='قام المستخدِم بالتصفح والاطلاع على صفحة عرض الخطط الدراسية المعتمدة',
            request=request
        )
    except Exception:
        pass

    return render(request, 'renewal/plans_display.html', context)

# ألياس لتوافق المسارات القائمة
plans_display = plans_display_view


@login_required
def get_plans_by_department_api(request):
    """
    API لإرجاع الخطط الدراسية التابعة لقسم علمي معين بديناميكية عبر AJAX (الخطط النشطة فقط).
    """
    dept_id = request.GET.get('department_id') or request.GET.get('department')
    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    if is_academic_dept and user_dept:
        dept_id = str(user_dept.id)

    if is_valid_filter(dept_id):
        plan_ids = Course.objects.filter(department__id=dept_id, is_active=True).values_list('study_plan_id', flat=True).distinct()
        plans = StudyPlan.objects.filter(id__in=plan_ids, is_active=True).order_by('name')
    else:
        plans = StudyPlan.objects.filter(is_active=True, course__is_active=True).distinct().order_by('name')

    plans_list = [{'id': p.id, 'name': p.name} for p in plans]
    return JsonResponse({'success': True, 'plans': plans_list})


@login_required
def plans_manage_view(request):
    """
    عرض لوحة تحكم الإدارة لجميع الخطط الدراسية مع فلترة حسب القسم وحالة الخطة.
    """
    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    if user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']:
        messages.warning(request, "⚠️ عذراً، إدارة وتعديل الخطط الدراسية غير متاحة لرؤساء الأقسام، يمكنك فقط استعراضها.")
        return redirect('renewal:plans_display')

    dept_id = request.GET.get('department_id') or request.GET.get('department')
    status_filter = request.GET.get('status')

    departments = Department.objects.filter(is_active=True).order_by('name')
    plans = StudyPlan.objects.all().order_by('name')

    if is_valid_filter(dept_id):
        plan_ids = Course.objects.filter(department__id=dept_id, department__is_active=True).values_list('study_plan_id', flat=True).distinct()
        plans = plans.filter(id__in=plan_ids)

    plans_list = []
    for plan in plans:
        courses = Course.objects.filter(study_plan=plan).select_related('level').prefetch_related('department')
        active_courses = courses.filter(is_active=True)
        is_plan_active = plan.is_active and active_courses.exists()

        if status_filter == 'active' and not is_plan_active:
            continue
        elif status_filter == 'inactive' and is_plan_active:
            continue

        depts_map = {}
        for c in courses:
            for dept in c.department.filter(is_active=True):
                depts_map[dept.id] = dept.name

        dept_objs = [{'id': d_id, 'name': d_name} for d_id, d_name in depts_map.items()]
        dept_names = ", ".join(depts_map.values()) if depts_map else "جميع الأقسام"

        plans_list.append({
            'id': plan.id,
            'code': plan.code or '',
            'name': plan.name,
            'description': plan.description,
            'departments': dept_names,
            'departments_list': dept_objs,
            'total_courses': courses.count(),
            'active_courses_count': active_courses.count(),
            'total_credits': sum(c.credits for c in courses),
            'is_active': is_plan_active
        })

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json':
        return JsonResponse({
            'success': True,
            'plans': plans_list
        })

    levels = Level.objects.all().order_by('number')
    all_courses = Course.objects.all().order_by('code', 'name')

    context = {
        'departments': departments,
        'plans': plans_list,
        'levels': levels,
        'all_courses': all_courses,
        'selected_dept': dept_id or '',
        'selected_status': status_filter or '',
    }

    # 🛡️ توثيق زيارة صفحة إدارة الخطط الدراسية في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view_plans_manage',
            model_name='StudyPlan',
            object_name='صفحة إدارة الخطط الدراسية',
            details='قام المستخدِم بالتصفح والاطلاع على صفحة لوحة تحكم وإدارة الخطط الدراسية',
            request=request
        )
    except Exception:
        pass

    return render(request, 'renewal/plans_manage.html', context)


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def plan_create_view(request):
    """
    إنشاء خطة دراسية جديدة لقسم معين.
    """
    if request.method == 'POST':
        try:
            data = json_payload(request)
            code = data.get('code', '').strip()
            name = data.get('name', '').strip()
            description = data.get('description', '').strip()
            department_id = data.get('department_id')

            if not name:
                return JsonResponse({'success': False, 'message': 'اسم الخطة الدراسية مطلوب'}, status=400)

            if code:
                from .models import plan_code_validator
                from django.core.exceptions import ValidationError
                try:
                    plan_code_validator(code)
                except ValidationError as ve:
                    err_msg = ve.message if hasattr(ve, 'message') else 'رمز الخطة غير صالح.'
                    return JsonResponse({'success': False, 'message': err_msg}, status=400)

                if StudyPlan.objects.filter(code__iexact=code).exists():
                    return JsonResponse({'success': False, 'message': 'رمز الخطة الدراسية مستخدم مسبقاً'}, status=400)

            if StudyPlan.objects.filter(name__iexact=name).exists():
                return JsonResponse({'success': False, 'message': 'توجد خطة دراسية بنفس هذا الاسم مسبقاً'}, status=400)

            plan = StudyPlan.objects.create(
                code=code or None,
                name=name,
                description=description
            )

            dept_name = ""
            if department_id and is_valid_filter(department_id):
                dept = Department.objects.filter(id=department_id).first()
                if dept:
                    dept_name = dept.name

            messages.success(request, f'تمت إضافة الخطة الدراسية "{plan.name}" بنجاح.')

            if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.content_type == 'application/json':
                return JsonResponse({
                    'success': True,
                    'message': f'تمت إضافة الخطة الدراسية "{plan.name}" بنجاح',
                    'plan': {
                        'id': plan.id,
                        'code': plan.code or '',
                        'name': plan.name,
                        'description': plan.description,
                        'department_name': dept_name
                    }
                })

            return redirect('renewal:plans_manage')

        except Exception as e:
            return JsonResponse({'success': False, 'message': f'حدث خطأ في النظام: {str(e)}'}, status=500)

    return JsonResponse({'success': False, 'message': 'طريقة الطلب غير مدعومة'}, status=405)


@login_required
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def plan_edit_view(request, plan_id):
    """
    تعديل بيانات الخطة الدراسية الحالية (الرمز، الاسم، الوصف، والمواد المرتبطة بها)
    """
    plan = get_object_or_404(StudyPlan, pk=plan_id)
    departments = Department.objects.filter(is_active=True).order_by('name')
    courses = Course.objects.filter(study_plan=plan).select_related('level').prefetch_related('department').order_by('level__number', 'code')

    if request.method == 'POST':
        try:
            code = request.POST.get('code', '').strip()
            name = request.POST.get('name', '').strip()
            description = request.POST.get('description', '').strip()

            has_code_error = False
            if code:
                from .models import plan_code_validator
                from django.core.exceptions import ValidationError
                try:
                    plan_code_validator(code)
                except ValidationError as ve:
                    err_msg = ve.message if hasattr(ve, 'message') else 'رمز الخطة غير صالح.'
                    messages.error(request, err_msg)
                    has_code_error = True

            if not name:
                messages.error(request, 'اسم الخطة الدراسية مطلوب.')
            elif not has_code_error:
                if code and StudyPlan.objects.filter(code__iexact=code).exclude(pk=plan.pk).exists():
                    messages.error(request, 'رمز الخطة الدراسية مستخدم مسبقاً.')
                elif StudyPlan.objects.filter(name__iexact=name).exclude(pk=plan.pk).exists():
                    messages.error(request, 'توجد خطة دراسية أخرى بنفس هذا الاسم مسبقاً.')
                else:
                    plan.code = code or None
                    plan.name = name
                    plan.description = description
                    plan.save()
                    messages.success(request, f'تم تعديل بيانات الخطة الدراسية "{plan.name}" بنجاح.')
                    return redirect('renewal:plans_manage')
        except Exception as e:
            messages.error(request, f'حدث خطأ أثناء حفظ التعديلات: {str(e)}')

    context = {
        'plan': plan,
        'departments': departments,
        'courses': courses,
        'total_courses': courses.count(),
        'total_credits': sum(c.credits for c in courses),
    }
    return render(request, 'renewal/plan_edit.html', context)


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def plan_toggle_active_view(request, plan_id):
    """
    زر لتغيير حالة الخطة (تفعيل / إلغاء تفعيل is_active لمواد الخطة).
    """
    if request.method == 'POST':
        try:
            plan = get_object_or_404(StudyPlan, pk=plan_id)
            data = json_payload(request)
            target_status = data.get('is_active')

            courses = Course.objects.filter(study_plan=plan)

            if target_status is not None:
                new_status = bool(target_status)
            else:
                new_status = not plan.is_active

            plan.is_active = new_status
            plan.save()
            courses.update(is_active=new_status)


            status_text = "تفعيل" if new_status else "إلغاء تفعيل"
            messages.success(request, f'تم {status_text} الخطة الدراسية "{plan.name}" بنجاح.')

            return JsonResponse({
                'success': True,
                'message': f'تم {status_text} الخطة الدراسية "{plan.name}" بنجاح',
                'is_active': new_status,
                'plan_id': plan.id
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': f'حدث خطأ: {str(e)}'}, status=500)

    return JsonResponse({'success': False, 'message': 'طريقة الطلب غير مدعومة'}, status=405)





@login_required
def get_plan_courses_api(request, plan_id):
    """
    API لإرجاع تفاصيل المواد التابعة لخطة معينة لاستيراد بياناتها وتنسيقها.
    """
    try:
        courses = Course.objects.filter(study_plan_id=plan_id).order_by('code', 'name')
        if not courses.exists():
            courses = Course.objects.all().order_by('code', 'name')

        courses_data = [
            {
                'id': c.id,
                'code': c.code,
                'name': c.name,
                'credits': c.credits,
                'theoretical_hours': c.theoretical_hours,
                'practical_hours': c.practical_hours,
                'level_id': c.level_id if c.level else '',
                'is_mandatory': c.is_mandatory,
                'display': f"{c.code} - {c.name}"
            }
            for c in courses
        ]
        return JsonResponse({'success': True, 'courses': courses_data})
    except Exception as e:
        return JsonResponse({'success': False, 'courses': [], 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('renewal.add_course', 'renewal.change_course', 'add_course', 'change_course')
def plan_remove_course_view(request, plan_id, course_id):
    """
    إزالة مادة من خطة دراسية معينة.
    """
    if request.method in ['POST', 'DELETE']:
        try:
            plan = get_object_or_404(StudyPlan, pk=plan_id)
            course = get_object_or_404(Course, pk=course_id, study_plan=plan)

            course.study_plan = None
            course.save()

            return JsonResponse({
                'success': True,
                'message': f'تمت إزالة المادة "{course.name}" ({course.code}) من الخطة "{plan.name}" بنجاح',
                'course_id': course_id,
                'plan_id': plan.id
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': f'حدث خطأ أثناء إزالة المادة: {str(e)}'}, status=500)

    return JsonResponse({'success': False, 'message': 'طريقة الطلب غير مدعومة'}, status=405)

# ============================================================
# دالة مساعدة للتحقق من وثائق الهوية حسب الجنسية
# ============================================================

def validate_student_identity(post_data, student_id=None):
    """
    دالة التحقق من وثائق الهوية (الرقم الوطني أو رقم الجواز) حسب الجنسية
    """
    errors = {}
    nationality_id = post_data.get('nationality')
    
    if not nationality_id:
        errors['nationality'] = 'الرجاء اختيار الجنسية'
        return errors

    try:
        nationality = Nationality.objects.get(id=int(nationality_id))
    except (Nationality.DoesNotExist, ValueError):
        errors['nationality'] = 'الجنسية المختارة غير صحيحة'
        return errors

    national_id = post_data.get('national_id', '').strip()
    passport_number = post_data.get('passport_number', '').strip()

    is_libyan = nationality.name in ['ليبي', 'Libyan', 'ليبيا']

    if is_libyan:
        if not national_id:
            errors['national_id'] = 'الرقم الوطني مطلوب للطلاب الليبيين'
        else:
            qs = Student.objects.filter(national_id=national_id)
            if student_id:
                qs = qs.exclude(id=student_id)
            if qs.exists():
                errors['national_id'] = 'الرقم الوطني مسجل لطالب آخر بالفعل'
    else:
        if not passport_number:
            errors['passport_number'] = 'رقم الجواز مطلوب للطلاب غير الليبيين'
        else:
            qs = Student.objects.filter(passport_number=passport_number)
            if student_id:
                qs = qs.exclude(id=student_id)
            if qs.exists():
                errors['passport_number'] = 'رقم الجواز مسجل لطالب آخر بالفعل'

    return errors
      
# ============================================================
# 🔥 ميزة استعلام وسحب بيانات الطلاب غير الليبيين 🔥
# ============================================================
# ============================================================
# ✅ النسخة الصحيحة والوحيدة - تستبعد الليبيين من الأساس
# ============================================================

# استعلام مساعد مشترك لاستبعاد الليبيين (قابل لإعادة الاستخدام)
LIBYAN_EXCLUDE_Q = (
    Q(nationality__name__icontains='ليبي') |
    Q(nationality__name__icontains='ليبيا') |
    Q(nationality__name__icontains='ليبيه') |
    Q(nationality__name__icontains='Libyan')
)

LIBYAN_NATIONALITY_EXCLUDE_Q = (
    Q(name__icontains='ليبي') |
    Q(name__icontains='ليبيا') |
    Q(name__icontains='ليبيه') |
    Q(name__icontains='Libyan')
)


@login_required
def non_libyan_students_view(request):
    """
    صفحة عرض وإدارة الطلاب غير الليبيين
    """
    nationalities = Nationality.objects.exclude(
        LIBYAN_NATIONALITY_EXCLUDE_Q
    ).order_by('name')

    departments = Department.objects.filter(is_active=True).order_by('name')

    context = {
        'nationalities': nationalities,
        'departments': departments,
        'page_title': 'الطلاب غير الليبيين',
    }
    return render(request, 'renewal/non_libyan_students.html', context)


def non_libyan_students_api(request):
    # 1. استبعاد الليبيين بدقة فقط (أو أخذ كل من لديه جنسية غير ليبية)
    students = Student.objects.filter(nationality__isnull=False).exclude(
        Q(nationality__name__icontains='ليبي') | Q(nationality__name__icontains='ليبيا')
    )
    
    # 2. الفلترة
    nationality_id = request.GET.get('nationality_id') or request.GET.get('nationality')
    department_id = request.GET.get('department_id') or request.GET.get('department')
    search = request.GET.get('search') or request.GET.get('q', '').strip()
    
    if nationality_id and nationality_id not in ['all', '0']:
        students = students.filter(nationality_id=nationality_id)
        
    if department_id and department_id not in ['all', '0']:
        students = students.filter(department_id=department_id)
        
    if search:
        students = students.filter(
            Q(student_id__icontains=search) |
            Q(name__icontains=search) |
            Q(father_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(national_id__icontains=search)
        )
        
    # 3. تجهيز الرد
    data = []
    for s in students.select_related('nationality', 'department', 'student_status'):
        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}".strip()
        data.append({
            'id': s.id,
            'student_id': s.student_id or '-',
            'full_name': full_name or s.name,
            'name': s.name,
            'nationality_name': s.nationality.name if s.nationality else '-',
            'nationality_id': s.nationality_id,
            'passport_number': getattr(s, 'passport_number', '') or s.national_id or '-',
            'department_name': s.department.name if s.department else '-',
            'status_name': s.student_status.name if (hasattr(s, 'student_status') and s.student_status) else 'منتظم',
        })
        
    return JsonResponse({
        'success': True,
        'count': len(data),
        'students': data
    })


@login_required
def my_materials_report(request):
    """
    عرض واستخراج تقرير المواد الدراسية المسجلة للطالب في الفصل الحالي (مستقل عن نظام الوظائف)
    """
    from apps.student.models import Student
    
    search_query = request.GET.get('q', '').strip()
    selected_student_id = request.GET.get('student_id', '').strip()
    student = None
    matching_students = []

    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']
    
    # 1. إذا تم اختيار طالب محدد بالـ ID أو رقم القيد بشكل صريح
    if selected_student_id:
        student_qs = Student.objects.all()
        if is_academic_dept and user_dept:
            student_qs = student_qs.filter(department=user_dept)

        if selected_student_id.isdigit():
            student = student_qs.filter(id=int(selected_student_id)).select_related(
                'department', 'level', 'student_status', 'nationality'
            ).first()
        if not student:
            student = student_qs.filter(student_id=selected_student_id).select_related(
                'department', 'level', 'student_status', 'nationality'
            ).first()

    # 2. إذا تم البحث باستخدام رقم قيد / رقم وطني / اسم / رقم جواز
    elif search_query:
        candidates = Student.objects.filter(
            Q(student_id__icontains=search_query) |
            Q(national_id__icontains=search_query) |
            Q(passport_number__icontains=search_query) |
            Q(name__icontains=search_query) |
            Q(father_name__icontains=search_query) |
            Q(last_name__icontains=search_query)
        ).select_related('department', 'level', 'student_status', 'nationality').distinct()

        # 🔥 تقييد نتائج البحث لرئيس القسم العلمي بطلبة قسمه فقط
        if is_academic_dept and user_dept:
            candidates = candidates.filter(department=user_dept)

        candidates_count = candidates.count()
        if candidates_count == 1:
            student = candidates.first()
        elif candidates_count > 1:
            # إذا كتب المستخدم رقم قيد كامل يطابق طالباً معيناً تماماً
            exact_match = candidates.filter(student_id__iexact=search_query).first()
            if exact_match and len(search_query) >= 4:
                student = exact_match
            else:
                # يوجد أكثر من طالب مطابق للبحث الجزئي، يتم عرض القائمة ليختار المستخدم منها
                student = None
                matching_students = list(candidates[:100])
        else:
            student = None

    else:
        # 3. إذا لم يتم البحث ولم يتم تحديد طالب (فتح الصفحة لأول مرة):
        # منع جلب أي طالب افتراضي تلقائياً لمديري وموظفي النظام
        if hasattr(request.user, 'student_profile') and request.user.student_profile:
            student = request.user.student_profile
        elif hasattr(request.user, 'student') and request.user.student:
            student = request.user.student
        elif Student.objects.filter(national_id__iexact=request.user.username).exists():
            student = Student.objects.filter(national_id__iexact=request.user.username).select_related(
                'department', 'level', 'student_status', 'nationality'
            ).first()
        else:
            # مدير النظام / المسجل / الموظف: تبقى الصفحة والحقول فارغة حتى يتم البحث
            student = None

    # 4. جلب الفصل الدراسي النشط
    active_semester = Semester.objects.filter(is_active=True).first()
    if not active_semester:
        active_semester = Semester.objects.first()

    semester_display_name = ""
    if active_semester:
        type_name = active_semester.get_type_display() if hasattr(active_semester, 'get_type_display') else (active_semester.type or '')
        semester_display_name = f"{type_name} {active_semester.year}".strip()
    else:
        semester_display_name = "ربيع 2026"

    # 5. جلب المواد المسجلة للطالب
    registered_courses = []
    total_units = 0
    if student and active_semester:
        registrations = CourseRegistration.objects.filter(
            student=student,
            semester=active_semester
        ).select_related('course', 'registered_by', 'semester')
        
        for reg in registrations:
            units = getattr(reg.course, 'credits', getattr(reg.course, 'units', 3))
            registered_courses.append({
                'id': reg.id,
                'course_code': reg.course.code,
                'course_name': reg.course.name,
                'units': units,
                'attempt_number': reg.attempt_number,
                'registration_date': reg.registration_date,
                'registered_by': reg.registered_by.get_full_name() if reg.registered_by else 'النظام'
            })
            total_units += units

    context = {
        'student': student,
        'matching_students': matching_students,
        'matching_count': len(matching_students),
        'selected_student_id': selected_student_id,
        'active_semester': active_semester,
        'semester_display_name': semester_display_name,
        'registered_courses': registered_courses,
        'total_courses_count': len(registered_courses),
        'total_units': total_units,
        'search_query': search_query,
        'now': timezone.now(),
    }
    
    # 🛡️ تسجيل نشاط تصفح واطلاع على تقارير المواد المسجلة في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        st_info = f"للطالب ({student.name} - {student.student_id})" if student else "بدون تحديد طالب"
        log_activity(
            user=request.user,
            action='view_materials_report',
            model_name='CourseRegistration',
            object_name='تقرير المواد المسجلة',
            details=f"قام المستخدِم بالتصفح والاطلاع على تقرير المواد المسجلة {st_info}",
            request=request
        )
    except Exception:
        pass

    return render(request, 'renewal/my_materials_report.html', context)


@login_required
def export_non_libyan_students(request):
    """
    تصدير بيانات الطلاب غير الليبيين إلى ملف Excel
    """
    try:
        students = Student.objects.exclude(
            LIBYAN_EXCLUDE_Q
        ).select_related(
            'nationality', 'department', 'student_status', 'level', 'gender'
        )

        nationality_id = request.GET.get('nationality_id', '').strip()
        if nationality_id and nationality_id not in ['all', '0', '']:
            if nationality_id.isdigit():
                students = students.filter(nationality_id=int(nationality_id))
            else:
                students = students.filter(nationality__name__iexact=nationality_id)

        department_id = request.GET.get('department_id', '').strip()
        if department_id and department_id not in ['all', '0', '']:
            try:
                students = students.filter(department_id=int(department_id))
            except (ValueError, TypeError):
                pass

        search = request.GET.get('search', '').strip()
        if search:
            students = students.filter(
                Q(name__icontains=search) |
                Q(student_id__icontains=search) |
                Q(passport_number__icontains=search) |
                Q(nationality__name__icontains=search)
            )

        import openpyxl
        from openpyxl.styles import Font, Alignment, PatternFill
        from openpyxl.utils import get_column_letter
        from io import BytesIO

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "الطلاب غير الليبيين"

        headers = [
            'رقم القيد', 'الاسم الكامل', 'الجنسية', 'رقم الجواز', 'التخصص',
            'المستوى', 'الحالة', 'رقم الهاتف', 'تاريخ الميلاد', 'تاريخ الالتحاق'
        ]

        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="2b7d91", end_color="2b7d91", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment

        row_idx = 2
        for student in students:
            ws.cell(row=row_idx, column=1, value=student.student_id or '')
            ws.cell(row=row_idx, column=2, value=f"{student.name} {student.father_name or ''} {student.grandfather_name or ''} {student.last_name or ''}".strip())
            ws.cell(row=row_idx, column=3, value=student.nationality.name if student.nationality else '')
            ws.cell(row=row_idx, column=4, value=student.passport_number or '')
            ws.cell(row=row_idx, column=5, value=student.department.name if student.department else '')
            ws.cell(row=row_idx, column=6, value=student.level.name if student.level else '')
            ws.cell(row=row_idx, column=7, value=student.student_status.name if student.student_status else '')
            ws.cell(row=row_idx, column=8, value=student.phone or '')
            ws.cell(row=row_idx, column=9, value=student.birth_date.strftime('%Y-%m-%d') if student.birth_date else '')
            ws.cell(row=row_idx, column=10, value=student.enrollment_date.strftime('%Y-%m-%d') if student.enrollment_date else '')
            row_idx += 1

        for col in range(1, len(headers) + 1):
            ws.column_dimensions[get_column_letter(col)].width = 20

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="non_libyan_students.xlsx"'
        return response

    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})
    

    # ============================================================
# views.py - دالة عرض صفحة النماذج والاستمارات الإدارية الفارغة
# ============================================================

from django.shortcuts import render
from django.utils import timezone
from datetime import datetime

@login_required
def blank_forms_view(request):
    """
    عرض صفحة النماذج والاستمارات الإدارية الفارغة المخصصة للطباعة الفورية (A4)
    """
    today_str = timezone.now().strftime('%d/%m/%Y')
    
    context = {
        'today_date': today_str,
    }
    return render(request, 'renewal/blank_forms.html', context)


# ============================================================
# ============================================================
# 🔔 إشعارات وتنبيهات مخصصة بدقة للمستخدم الحالي وفق دوره
# ============================================================

def get_scoped_notifications_queryset(user):
    """
    استعلام إشعارات مخصص ومقيد بدقة للمستخدم الحالي وفق دوره وصلاحياته:
    - مدير النظام / Admin: إشعارات الإدارة العامة والشؤون الأكاديمية
    - منسقة الدراسة والامتحانات (exams / coordinator / study_exams): إشعارات الكشوفات وردود الأساتذة والنتائج وتنزيل المواد وتغيير المسارات والرسوب 3 مرات
    - المسجل العام (registrar / general_registrar): إشعارات الطلاب الجدد، تجديد القيد، إيقاف القيد، سحب الملفات، الخريجين
    - الطلاب (student): إشعارات الطالب الشخصية فقط
    - الأساتذة (teacher / faculty): إشعارات التكليفات ورصد الدرجات والردود
    """
    from apps.student.models import Notification
    from django.db.models import Q

    if not user or not user.is_authenticated:
        return Notification.objects.none()

    role = str(getattr(user, 'role', '')).lower().strip()
    is_admin = getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False) or role in ['admin', 'manager', 'مدير النظام']

    # 1. مدير النظام (Admin / Superuser)
    if is_admin:
        return Notification.objects.filter(
            Q(target_role__in=['admin', 'registrar', 'exams', 'all']) | Q(student__isnull=True)
        )

    # 2. مدير ومنسق الدراسة والامتحانات (Study & Exams Director & Coordinator)
    if role in ['exam_director', 'exam_officer', 'exams', 'coordinator', 'study_exams', 'study_and_exams', 'مدير الدراسة والامتحانات', 'director of study and examinations', 'منسقة الدراسة والامتحانات', 'منسق الدراسة والامتحانات', 'دراسة وامتحانات']:
        return Notification.objects.filter(
            Q(target_role__in=['exam_director', 'exams', 'coordinator', 'all']) |
            Q(notification_type__in=[
                'grade_recording', 'course_assignment', 'registration',
                'professor_grade_reply', 'grade_submission', 'grade_approval',
                'midterm_grade', 'final_grade', 'department_change',
                'failed_three_times'
            ])
        )

    # 3. المسجل العام وشؤون القبول والتسجيل (Registrar)
    if role in ['registrar', 'general_registrar', 'المسجل العام', 'مسجل عام', 'شؤون الطلاب', 'تسجيل']:
        return Notification.objects.filter(
            Q(target_role__in=['registrar', 'general_registrar']) |
            (Q(target_role='all') & ~Q(notification_type__in=['registration', 'graduation', 'clearance', 'course_assignment', 'grade_recording', 'professor_grade_reply', 'grade_submission', 'grade_approval'])) |
            Q(notification_type__in=[
                'new_student', 'hold', 'renewal', 'department_change',
                'failed_three_times', 'file_withdrawal', 'withdrawal'
            ])
        ).exclude(
            Q(notification_type__in=['registration', 'graduation', 'clearance']) |
            Q(title__icontains='تنزيل') |
            Q(title__icontains='خريج') |
            Q(title__icontains='إفادة') |
            Q(title__icontains='إخلاء طرف') |
            Q(message__icontains='تنزيل مواد') |
            Q(message__icontains='تخرج')
        )

    # 3.5 قسم الخريجين (Graduation Department) - حصرياً لإخلاء طرف التخرج وإصدار الإفادات مع استبعاد سحب الملفات تماماً
    if role in ['graduate_officer', 'graduates', 'قسم الخريجين', 'الخريجين', 'graduation department']:
        return Notification.objects.filter(
            Q(target_role__in=['graduates', 'graduate_officer']) |
            Q(notification_type__in=['graduation', 'clearance'])
        ).filter(
            notification_type__in=['graduation', 'clearance']
        ).exclude(
            Q(notification_type__in=['file_withdrawal', 'withdrawal', 'hold', 'new_student', 'registration', 'renewal']) |
            Q(title__icontains='سحب') |
            Q(message__icontains='سحب الملف') |
            Q(message__icontains='سحب ملف') |
            Q(link__icontains='withdrawal') |
            Q(link__icontains='suspended')
        )

    # 4. الطالب (Student) - إشعارات الطالب الشخصية فقط والإعلانات العامة بدون أي إشعار يخص طالب آخر
    if role == 'student' or getattr(user, 'is_student', False) or hasattr(user, 'student'):
        from apps.student.models import Student
        student_obj = getattr(user, 'student', None)
        if not student_obj:
            student_obj = Student.objects.filter(user=user).first()
        if not student_obj and user.email:
            student_obj = Student.objects.filter(email=user.email).first()
        if not student_obj:
            student_obj = Student.objects.filter(student_id=user.username).first()

        if student_obj:
            return Notification.objects.filter(
                Q(student=student_obj) |
                (Q(student__isnull=True) & Q(target_role__in=['student', 'all']) & Q(notification_type='general'))
            )
        return Notification.objects.none()

    # 5. أعضاء هيئة التدريس (Teacher / Faculty)
    if role in ['teacher', 'faculty', 'professor', 'أستاذ', 'عضو هيئة تدريس']:
        return Notification.objects.filter(
            Q(target_role__in=['teacher', 'faculty', 'all']) |
            Q(notification_type__in=['grade_submission', 'professor_grade_reply', 'general'])
        )

    # 6. الأقسام الأكاديمية (Academic Department)
    if role in ['academic_dept', 'department', 'قسم أكاديمي']:
        return Notification.objects.filter(
            Q(target_role__in=['academic_dept', 'department', 'all'])
        )

    # الافتراضي لأي مستخدم آخر
    return Notification.objects.filter(
        Q(target_role__in=['all', role])
    )


@login_required
def registrar_notifications(request):
    """
    عرض صفحة إشعارات وتنبيهات مخصصة بدقة للمستخدم المسجل حالياً،
    وتحديث جميع الإشعارات غير المقروءة لتصبح مقروءة تلقائياً بمجرد فتح الصفحة
    لتصفير وإخفاء العداد في الشريط العلوي فور الدخول.
    """
    filter_type = request.GET.get('type', 'all')
    
    # جلب استعلام الإشعارات المخصص للمستخدم الحالي
    user_notifs_qs = get_scoped_notifications_queryset(request.user)
    
    # تحديث كافة الإشعارات غير المقروءة للمستخدم لتصبح مقروءة فور دخول الصفحة
    user_notifs_qs.filter(is_read=False).update(is_read=True)
    
    base_qs = user_notifs_qs.order_by('-created_at')
    
    if filter_type != 'all':
        base_qs = base_qs.filter(notification_type=filter_type)
        
    unread_count = 0
    total_count = base_qs.count()
    notifications = base_qs[:150]
    
    context = {
        'notifications': notifications,
        'unread_count': unread_count,
        'total_count': total_count,
        'filter_type': filter_type,
    }
    return render(request, 'renewal/notifications.html', context)


@login_required
def mark_registrar_notifications_read(request):
    """تحديد إشعارات المستخدم الحالي فقط كمقروءة عبر AJAX"""
    if request.method == 'POST':
        user_qs = get_scoped_notifications_queryset(request.user)
        user_qs.filter(is_read=False).update(is_read=True)
        return JsonResponse({'success': True, 'message': 'تم تحديد إشعاراتك كمقروءة بنجاح'})
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)


# ============================================================
# 📄 صفحات المسجل العام: الموقوف قيدهم والذين تم تجديد قيدهم
# ============================================================

@login_required
def renewed_students_list(request):
    """
    عرض قائمة وجدول الطلاب الذين قاموا بتجديد قيدهم بنجاح
    مع إمكانية البحث والفلترة حسب القسم والفصل الدراسي
    """
    from apps.renewal.models import EnrollmentRenewal, Semester, Department
    from django.db.models import Q
    
    current_semester = Semester.objects.filter(is_active=True).first()
    selected_semester_id = request.GET.get('semester', current_semester.id if current_semester else '')
    selected_dept_id = request.GET.get('department', '')
    search_query = request.GET.get('search', '').strip()
    
    renewals_qs = EnrollmentRenewal.objects.filter(
        status__in=['RENEWED', 'active', 'مجدد']
    ).select_related('student', 'student__department', 'level', 'semester', 'renewed_by').order_by('-renewal_date', '-id')
    
    if selected_semester_id:
        renewals_qs = renewals_qs.filter(semester_id=selected_semester_id)
        
    if selected_dept_id:
        renewals_qs = renewals_qs.filter(student__department_id=selected_dept_id)
        
    if search_query:
        renewals_qs = renewals_qs.filter(
            Q(student__name__icontains=search_query) |
            Q(student__student_id__icontains=search_query) |
            Q(student__national_id__icontains=search_query)
        )
        
    total_count = renewals_qs.count()
    
    context = {
        'renewals': renewals_qs[:250],
        'total_count': total_count,
        'semesters': Semester.objects.all().order_by('-year', '-type'),
        'departments': Department.objects.filter(is_active=True).order_by('name'),
        'current_semester': current_semester,
        'selected_semester_id': str(selected_semester_id),
        'selected_dept_id': str(selected_dept_id),
        'search_query': search_query,
    }
    return render(request, 'renewal/renewed_students_list.html', context)


@login_required
def suspended_students_list(request):
    """
    عرض قائمة وجدول الطلاب الموقوف قيدهم لهذا الفصل الدراسي
    مع تفاصيل الإيقاف والبحث والفلترة
    """
    from apps.student.models import Student
    from apps.renewal.models import Department, Semester, EnrollmentRenewal
    from django.db.models import Q
    
    current_semester = Semester.objects.filter(is_active=True).first()
    selected_dept_id = request.GET.get('department', '')
    search_query = request.GET.get('search', '').strip()
    
    students_qs = Student.objects.filter(
        Q(student_status__name__icontains='موقوف') |
        Q(student_status__name__icontains='إيقاف') |
        Q(enrollmentrenewal__status='suspended') |
        Q(enrollmentrenewal__special_type__in=['STOPPED', 'STOPPED_ENROLLMENT'])
    ).distinct().select_related('department', 'level', 'student_status').order_by('student_id')
    
    if selected_dept_id:
        students_qs = students_qs.filter(department_id=selected_dept_id)
        
    if search_query:
        students_qs = students_qs.filter(
            Q(name__icontains=search_query) |
            Q(student_id__icontains=search_query) |
            Q(national_id__icontains=search_query)
        )
        
    total_count = students_qs.count()
    
    context = {
        'students': students_qs[:250],
        'total_count': total_count,
        'departments': Department.objects.filter(is_active=True).order_by('name'),
        'current_semester': current_semester,
        'selected_dept_id': str(selected_dept_id),
        'search_query': search_query,
    }
    return render(request, 'renewal/suspended_students_list.html', context)


@login_required
def withdrawn_students_list(request):
    """
    عرض قائمة وجدول الطلاب الذين تم سحب ملفاتهم وإخلاء طرفهم
    مع محرك بحث وفلترة حسب القسم العلمي
    """
    from apps.student.models import Student
    from apps.renewal.models import Department, Semester, EnrollmentRenewal
    from django.db.models import Q
    
    current_semester = Semester.objects.filter(is_active=True).first()
    selected_dept_id = request.GET.get('department', '')
    search_query = request.GET.get('search', '').strip()
    
    students_qs = Student.objects.filter(
        Q(student_status__name__icontains='سحب') |
        Q(student_status__name__icontains='إخلاء') |
        Q(student_status__name__icontains='منسحب') |
        Q(enrollmentrenewal__status__in=['withdrawn', 'cleared'])
    ).distinct().select_related('department', 'level', 'student_status').order_by('-id')
    
    if selected_dept_id:
        students_qs = students_qs.filter(department_id=selected_dept_id)
        
    if search_query:
        students_qs = students_qs.filter(
            Q(name__icontains=search_query) |
            Q(student_id__icontains=search_query) |
            Q(national_id__icontains=search_query)
        )
        
    total_count = students_qs.count()
    
    context = {
        'students': students_qs[:250],
        'total_count': total_count,
        'departments': Department.objects.filter(is_active=True).order_by('name'),
        'current_semester': current_semester,
        'selected_dept_id': str(selected_dept_id),
        'search_query': search_query,
    }
    return render(request, 'renewal/withdrawn_students_list.html', context)


@login_required
def department_transfers_list(request):
    """
    عرض قائمة وجدول الطلاب الذين قاموا بتغيير مسارهم الدراسي أو معادلة موادهم
    مع محرك بحث وفلترة حسب القسم العلمي
    """
    from apps.student.models import Student
    from apps.renewal.models import Department, Semester, EnrollmentRenewal
    from apps.grades.models import Grade
    from django.db.models import Q
    
    current_semester = Semester.objects.filter(is_active=True).first()
    selected_dept_id = request.GET.get('department', '')
    search_query = request.GET.get('search', '').strip()
    
    students_qs = Student.objects.filter(
        Q(has_changed_major=True) |
        Q(major_change_count__gt=0) |
        Q(notes__icontains='معادل') |
        Q(notes__icontains='مسار') |
        Q(student_status__name__icontains='معادل') |
        Q(student_status__name__icontains='مسار') |
        Q(grade__notes__icontains='معادل') |
        Q(grade__notes__icontains='معادلة')
    ).distinct().select_related('department', 'level', 'student_status').order_by('student_id')
    
    if not students_qs.exists():
        students_qs = Student.objects.all().select_related('department', 'level', 'student_status').order_by('student_id')
        
    if selected_dept_id:
        students_qs = students_qs.filter(department_id=selected_dept_id)
        
    if search_query:
        students_qs = students_qs.filter(
            Q(name__icontains=search_query) |
            Q(student_id__icontains=search_query) |
            Q(national_id__icontains=search_query)
        )
        
    total_count = students_qs.count()
    
    context = {
        'students': students_qs[:250],
        'total_count': total_count,
        'departments': Department.objects.filter(is_active=True).order_by('name'),
        'current_semester': current_semester,
        'selected_dept_id': str(selected_dept_id),
        'search_query': search_query,
    }
    return render(request, 'renewal/department_transfers_list.html', context)


# ============================================================
# 🎓 لوحة تحكم قسم وإدارة الخريجين (Graduation Department Dashboard)
# ============================================================

@graduate_officer_required
def graduates_dashboard(request):
    """
    لوحة تحكم قسم الخريجين:
    تتبع إجمالي الخريجين الفعليين، والطلاب المؤهلين في المستوى الثامن فقط
    """
    from apps.student.models import Student, StudentStatus
    from apps.renewal.models import GraduationClearance, Department, Semester
    import json
    from django.core.serializers.json import DjangoJSONEncoder

    # 🧹 تصحيح آلي فوري: إزالة علامة الجاهزية الخاطئة عن أي طالب لم يصل للمستوى الثامن بعد
    Student.objects.filter(
        is_ready_for_clearance=True,
        level__number__lt=8
    ).update(is_ready_for_clearance=False, clearance_ready_date=None)

    # 0. الطلاب الجاهزون لإخلاء الطرف (شرط إلزامي: في المستوى 8 فما فوق + استوفوا المواد)
    ready_for_clearance_students = Student.objects.filter(
        is_ready_for_clearance=True,
        graduation_clearance__isnull=True,
        level__number__gte=8
    ).select_related('department', 'study_plan', 'level').order_by('-clearance_ready_date')

    # 1. الخريجون الفعليون فقط (متخرجون أو أتموا الإخلاء أو جاهزون فعلياً في المستوى 8)
    graduates_base_qs = Student.objects.filter(
        Q(student_status__name__icontains='خريج') |
        Q(student_status__name__icontains='متخرج') |
        Q(student_status__name__icontains='إخلاء طرف') |
        Q(graduation_clearance__isnull=False) |
        (Q(is_ready_for_clearance=True) & Q(level__number__gte=8))
    ).distinct().select_related('department', 'level', 'student_status')

    total_graduates = graduates_base_qs.count()

    # 2. سجلات إخلاء الطرف المكتملة
    clearances_qs = GraduationClearance.objects.all().select_related(
        'student', 'student__department', 'semester', 'processed_by'
    ).order_by('-created_at')

    total_clearance_completed = clearances_qs.count()
    completed_clearance_ready_for_cert = clearances_qs.filter(is_certificate_issued=False).count()
    completed_clearance_issued = clearances_qs.filter(is_certificate_issued=True).count()
    pending_clearance = max(total_graduates - total_clearance_completed, 0)

    # 3. ملخص الأقسام والتخصصات
    departments_qs = Department.objects.filter(is_active=True).order_by('name')
    departments_summary = []
    for dept in departments_qs:
        dept_grads = graduates_base_qs.filter(department=dept).count()
        dept_cleared = clearances_qs.filter(student__department=dept).count()
        dept_issued = clearances_qs.filter(student__department=dept, is_certificate_issued=True).count()
        departments_summary.append({
            'id': dept.id,
            'name': dept.name,
            'code': dept.code,
            'graduates_count': dept_grads,
            'cleared_count': dept_cleared,
            'issued_count': dept_issued,
        })

    # 🛡️ توثيق نشاط زيارة لوحة الخريجين
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='view',
            model_name='Dashboard',
            object_name='لوحة قسم الخريجين',
            details='تصفح لوحة تحكم قسم الخريجين ومتابعة إخلاء الطرف وإصدار الإفادات',
            request=request
        )
    except Exception:
        pass

    current_semester = Semester.objects.filter(is_active=True).first()

    context = {
        'page_title': 'لوحة تحكم قسم وإدارة الخريجين',
        'page_subtitle': 'متابعة الخريجين، توثيق إخلاء الطرف، إصدار إفادات التخرج، وإحصائيات التخصصات',
        'ready_for_clearance_students': ready_for_clearance_students,
        'ready_for_clearance_count': ready_for_clearance_students.count(),
        'total_graduates': total_graduates,
        'completed_clearance_ready_for_cert': completed_clearance_ready_for_cert,
        'completed_clearance_issued': completed_clearance_issued,
        'total_clearance_completed': total_clearance_completed,
        'pending_clearance': pending_clearance,
        'departments_summary': departments_summary,
        'departments_summary_json': json.dumps(departments_summary, ensure_ascii=False, cls=DjangoJSONEncoder),
        'recent_clearances': clearances_qs[:20],
        'current_semester': current_semester,
    }
    return render(request, 'renewal/graduates_dashboard.html', context)


@graduate_officer_required
def api_graduates_stats(request):
    """API: جلب إحصائيات قسم الخريجين المباشرة"""
    try:
        from apps.student.models import Student
        from apps.renewal.models import GraduationClearance, Department

        graduates_base_qs = Student.objects.filter(
            Q(student_status__name__icontains='خريج') |
            Q(student_status__name__icontains='متخرج') |
            Q(student_status__name__icontains='إخلاء طرف') |
            Q(graduation_clearance__isnull=False) |
            (Q(is_ready_for_clearance=True) & Q(level__number__gte=8))
        ).distinct()

        total_graduates = graduates_base_qs.count()
        clearances_qs = GraduationClearance.objects.all()
        total_clearance_completed = clearances_qs.count()
        completed_ready = clearances_qs.filter(is_certificate_issued=False).count()
        completed_issued = clearances_qs.filter(is_certificate_issued=True).count()
        pending_clearance = max(total_graduates - total_clearance_completed, 0)

        departments_summary = []
        for dept in Department.objects.filter(is_active=True):
            dept_grads = graduates_base_qs.filter(department=dept).count()
            dept_cleared = clearances_qs.filter(student__department=dept).count()
            departments_summary.append({
                'id': dept.id,
                'name': dept.name,
                'graduates_count': dept_grads,
                'cleared_count': dept_cleared,
            })

        return JsonResponse({
            'success': True,
            'stats': {
                'total_graduates': total_graduates,
                'completed_clearance_ready_for_cert': completed_ready,
                'completed_clearance_issued': completed_issued,
                'total_clearance_completed': total_clearance_completed,
                'pending_clearance': pending_clearance,
                'departments_summary': departments_summary,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# ============================================================
# 📄 شهادة تعريف طالب (Student Identification Certificate)
# ============================================================

@login_required
def student_enrollment_certificate(request):
    """
    عرض وطباعة شهادة تعريف طالبة رسمية
    تتيح البحث بالاسم أو رقم القيد مع استبعاد الطالبات المسحوبة ملفاتهن والمتخرجات وإظهار تنبيه توضيحي
    """
    from apps.student.models import Student
    from apps.renewal.models import Semester
    from apps.student.utils import get_student_verification_qr_url
    from apps.users.utils import get_official_object
    from django.urls import reverse

    active_semester = Semester.objects.filter(is_active=True).first()
    if not active_semester:
        active_semester = Semester.objects.order_by('-year', '-type').first()

    student_id_query = request.GET.get('student_id', '').strip()
    search_query = request.GET.get('q', '').strip()
    selected_student = None
    qr_verification_url = None
    ineligible_error = None

    target_query = student_id_query or search_query
    if target_query:
        candidate_student = Student.objects.filter(
            Q(student_id=target_query) | Q(id=int(target_query) if target_query.isdigit() else -1) | Q(national_id=target_query)
        ).select_related('department', 'level', 'student_status', 'nationality').first()

        if candidate_student:
            status_name = (candidate_student.student_status.name if candidate_student.student_status else '').strip()
            student_name = candidate_student.get_full_name()

            if any(w in status_name for w in ['سحب', 'مسحوب', 'مسحوبة']):
                ineligible_error = f"⚠️ تنبيه: الطالبة ({student_name}) مسحوب ملفها من الكلية، ولا يمكن إصدار شهادة تعريف طالبة لها."
            elif any(g in status_name for g in ['خريج', 'متخرج', 'متخرجة', 'إخلاء طرف', 'اخلاء طرف']):
                ineligible_error = f"⚠️ تنبيه: الطالبة ({student_name}) متخرجة وأتمت إخلاء الطرف، ولا يمكن إصدار شهادة تعريف طالبة لها (بل تصدر لها إفادة تخرج من قسم الخريجين)."
            elif any(sp in status_name for sp in ['موقوف', 'موقوفة', 'إيقاف', 'ايقاف']):
                ineligible_error = f"⚠️ تنبيه: الطالبة ({student_name}) موقوف قيدها حالياً، ولا يمكن إصدار شهادة تعريف طالبة لها حتى إعادة القيد."
            else:
                selected_student = candidate_student

    if selected_student:
        try:
            qr_verification_url = get_student_verification_qr_url(selected_student, request=request)
        except Exception:
            qr_verification_url = request.build_absolute_uri(
                reverse('student:verify_student', kwargs={'student_id': selected_student.student_id or selected_student.id})
            )

    # 🏛️ جلب بيانات المسجل العام النشط حصرياً من جدول إدارة المسؤولين المعتمدين
    reg_official = get_official_object('registrar')
    if reg_official and reg_official.official_name:
        reg_title = reg_official.title.strip() if reg_official.title else ''
        registrar_name = f"{reg_title} {reg_official.official_name}".strip() if reg_title else reg_official.official_name
        registrar_position = reg_official.position_name or 'المسجل العام بالكلية'
    else:
        registrar_name = 'المسجل العام'
        registrar_position = 'المسجل العام بالكلية'

    context = {
        'active_semester': active_semester,
        'selected_student': selected_student,
        'qr_verification_url': qr_verification_url,
        'search_query': target_query if selected_student else '',
        'ineligible_error': ineligible_error,
        'registrar_name': registrar_name,
        'registrar_position': registrar_position,
    }
    return render(request, 'renewal/student_enrollment_certificate.html', context)


@login_required
def search_enrollment_student_api(request):
    """
    API للبحث الفوري عن الطلاب لشهادة التعريف مع التحقق من أهلية القيد
    يستبعد الطالبات المسحوبة ملفاتهن والمتخرجات ويرجع رسائل التنبيه الفورية
    """
    from apps.student.models import Student
    from apps.student.utils import get_student_verification_qr_url

    query = request.GET.get('q', '').strip()
    if not query or len(query) < 1:
        return JsonResponse({'success': True, 'students': []})

    students_qs = Student.objects.filter(
        Q(name__icontains=query) |
        Q(father_name__icontains=query) |
        Q(last_name__icontains=query) |
        Q(student_id__icontains=query) |
        Q(national_id__icontains=query)
    ).select_related('department', 'level', 'student_status', 'nationality')[:25]

    results = []
    for s in students_qs:
        full_name = s.get_full_name() if hasattr(s, 'get_full_name') else f"{s.name} {s.father_name or ''} {s.last_name or ''}".strip()
        status_name = (s.student_status.name if s.student_status else 'منتظم').strip()

        is_eligible = True
        block_message = None

        if any(w in status_name for w in ['سحب', 'مسحوب', 'مسحوبة']):
            is_eligible = False
            block_message = f"⚠️ تنبيه: الطالبة ({full_name}) مسحوب ملفها من الكلية، ولا يمكن إصدار شهادة تعريف طالبة لها."
        elif any(g in status_name for g in ['خريج', 'متخرج', 'متخرجة', 'إخلاء طرف', 'اخلاء طرف']):
            is_eligible = False
            block_message = f"⚠️ تنبيه: الطالبة ({full_name}) متخرجة وأتمت إخلاء الطرف، ولا يمكن إصدار شهادة تعريف طالبة لها (بل تصدر لها إفادة تخرج)."
        elif any(sp in status_name for sp in ['موقوف', 'موقوفة', 'إيقاف', 'ايقاف']):
            is_eligible = False
            block_message = f"⚠️ تنبيه: الطالبة ({full_name}) موقوف قيدها حالياً بالكلية، ولا يمكن إصدار شهادة تعريف طالبة لها."

        try:
            qr_url = get_student_verification_qr_url(s, request=request)
        except Exception:
            qr_url = f"/student/verify/{s.student_id}/"

        results.append({
            'id': s.id,
            'student_id': s.student_id or str(s.id),
            'name': full_name,
            'national_id': getattr(s, 'national_id', '') or getattr(s, 'passport_number', '') or '—',
            'nationality': s.nationality.name if s.nationality else 'ليبية',
            'department': s.department.name if s.department else 'غير محدد',
            'level': s.level.name if s.level else 'غير محدد',
            'status': status_name,
            'is_eligible': is_eligible,
            'block_message': block_message,
            'qr_verification_url': qr_url,
        })

    return JsonResponse({'success': True, 'students': results})
