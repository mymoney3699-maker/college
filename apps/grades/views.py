from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.db.models import Q, Sum, Avg, Count
import json
import logging
logger = logging.getLogger(__name__)

from django.core.mail import send_mail
from django.conf import settings
from apps.users.utils import log_activity
from apps.users.permissions import (
    role_required, admin_required, exam_director_required,
    registrar_required, graduate_officer_required,
    academic_dept_required, student_required, staff_required,
    has_execution_perm, require_execution_permission
)

from apps.renewal.models import Department, Semester, Course, Level, Group, CourseRegistration, CourseEquivalence
from apps.student.models import Student, StudentStatus
from .models import Grade, GradeConfiguration, GradeNotification, GradeHistory, GradeAppeal


def send_student_grade_email(student, course, semester, midterm_grade, final_grade, total_grade, is_passed, action_type="رصد"):
    """
    دالة مساعدة لإرسال إيميل تنبيه للطالب عند رصد/تحديث/اعتماد درجاته.
    تتم عملية الإرسال داخل try...except لضمان عدم توقف عملية حفظ الدرجة عند حدوث خطأ بالبريد.
    """
    try:
        student_email = getattr(student, 'email', None)
        if not student_email and hasattr(student, 'user') and student.user:
            student_email = student.user.email
            
        if not student_email or not str(student_email).strip():
            print(f"ℹ️ الطالب {student.name} ({student.student_id}) ليس لديه بريد إلكتروني مسجل، تم تجاوز الإرسال.")
            return False

        student_email = str(student_email).strip()
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)
        
        subject = f"تنبيه {action_type} درجات - مادة {course.name}"
        status_text = "ناجح" if is_passed else "راسب"
        semester_name = f"{semester.year} - {semester.get_type_display() if hasattr(semester, 'get_type_display') else semester.type}"
        
        body = f"""السلام عليكم ورحمة الله وبركاته،

الطالب/ة: {student.name}
رقم القيد: {student.student_id or ''}

نحيطكم علماً بأنه تم {action_type} درجاتكم الخاصة بمادة ({course.code} - {course.name}) للفصل الدراسي ({semester_name}):

• درجة الامتحان النصفي (40): {midterm_grade}
• درجة الامتحان النهائي (60): {final_grade}
• المجموع النهائي (100): {total_grade}
• النتيجة: {status_text}

نتمنى لكم دوام التوفيق والنجاح.
منظومة كلية طرابلس الأكاديمية"""

        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[student_email],
            fail_silently=False,
        )
        print(f"[EMAIL] [نجاح الإرسال] تم إرسال بريد إلكتروني بنجاح إلى الطالب {student.name} ({student_email}) لمادة {course.name}")
        return True
    except Exception as e:
        print(f"[WARN] [تحذير البريد] تعذر إرسال بريد للطالب {getattr(student, 'name', '')}: {e}")
        return False


def send_grade_submission_alert_to_college(course, semester, user, period="midterm", students_count=0, group=None, department=None, action_name="رصد واستيراد كشف الدرجات"):
    """
    إرسال إشعار بريد إلكتروني رسمي إلى بريد الكلية المعتمد وإدارة الدراسة والامتحانات 
    عند قيام أستاذ/مستخدم برصد أو استيراد أو اعتماد كشف درجات الطلاب.
    """
    try:
        official_email = getattr(settings, 'COLLEGE_OFFICIAL_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', 'mymoney3699@gmail.com')
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)

        if not official_email:
            return False

        period_display = "امتحان النصفي (40 درجة)" if period == 'midterm' else "امتحان النهائي (60 درجة)"
        crs_name = f"{course.code} - {course.name}" if course else "مادة غير محددة"
        sem_name = f"{semester.year} ({semester.get_type_display()})" if semester and hasattr(semester, 'get_type_display') else (str(semester) if semester else "الفصل الحالي")
        user_name = user.get_full_name() or user.username if user else "أستاذ المادة"
        group_name = group.name if group else (getattr(course, 'student_group_name', 'كافة المجموعات') if course else '—')
        dept_name = department.name if department else (course.department.first().name if course and hasattr(course, 'department') and course.department.exists() else '—')

        subject = f"[NOTIF] [إشعار اعتماد ورصد درجات] مادة: {crs_name} | {sem_name}"

        body = f"""السلام عليكم ورحمة الله وبركاته،

تحية طيبة لإدارة كلية طرابلس وقسم الدراسة والامتحانات،

نحيطكم علماً بأنه تم تنفيذ عملية ({action_name}) في المنظومة الأكاديمية بنجاح وفق التفاصيل التالية:

• القائم بالعملية / أستاذ المادة: {user_name} ({getattr(user, 'email', '')})
• المادة الدراسية: {crs_name}
• القسم الأكاديمي: {dept_name}
• المجموعة / الشعبة: {group_name}
• الفصل الدراسي: {sem_name}
• نوع التقييم: {period_display}
• عدد الطلاب المسجلين بالكشف: {students_count} طالب/ة
• تاريخ ووقت العملية: {timezone.now().strftime('%Y-%m-%d %H:%M')}

يرجى متابعة النتائج واعتمادها عبر لوحة تحكم منسقة الدراسة والامتحانات والكنترول.

مع التحية والتقدير،
المنظومة الإلكترونية - كلية طرابلس للعلوم والتقنية
"""

        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[official_email],
            fail_silently=True,
        )
        print(f"[EMAIL] [إشعار الكلية] تم إرسال إشعار رصد الدرجات بنجاح إلى البريد الرسمي: {official_email} لمادة {crs_name}")

        # [NOTIF] توليد إشعار فوري داخل المنظومة في مركز الإشعارات لقسم الدراسة والامتحانات والمسجل
        try:
            from apps.student.models import Notification
            Notification.objects.create(
                title=f"رد واستلام كشف درجات: {user_name}",
                message=f"قام الأستاذ ({user_name}) بالرد على بريد الكلية وإرسال كشف درجات مادة ({crs_name}) للفصل ({sem_name}) لـ ({students_count}) طالب/ة.",
                notification_type='professor_grade_reply',
                icon='mark_email_read',
                target_role='exams',
                link='/grades/grade-entry/',
                is_read=False
            )
        except Exception as notif_err:
            print(f"[WARN] In-app notification creation error: {notif_err}")

        return True
    except Exception as e:
        print(f"[WARN] [إشعار الكلية] خطأ أثناء إرسال إشعار رصد الدرجات: {e}")
        return False


@login_required
def grade_entry(request):
    """صفحة تسجيل الدرجات"""
    from apps.renewal.views import get_send_grade_sheets_job_info, get_grade_entry_monitoring_job_info

    send_sheets_info = get_send_grade_sheets_job_info()
    grade_entry_info = get_grade_entry_monitoring_job_info()

    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    courses = Course.objects.filter(is_active=True).order_by('code')
    levels = Level.objects.all().order_by('number')
    groups = Group.objects.all().select_related('department', 'level')
    
    context = {
        'departments': departments,
        'semesters': semesters,
        'courses': courses,
        'levels': levels,
        'groups': groups,
        'is_send_sheets_job_open': send_sheets_info['is_send_sheets_job_open'],
        'send_sheets_job_message': send_sheets_info['send_sheets_job_message'],
        'is_grade_entry_job_open': grade_entry_info['is_grade_entry_job_open'],
        'grade_entry_job_message': grade_entry_info['grade_entry_job_message'],
    }
    return render(request, 'grades/grade_entry.html', context)


# ================================================================
# APIs لتسجيل الدرجات
# ================================================================
def is_valid_filter(val):
    if val is None:
        return False
    val_str = str(val).strip().lower()
    return val_str not in ['', 'all', 'null', 'undefined', 'none', 'every', 'كل المستويات']

# apps/grades/views.py - تعديل دالة get_filters_api

@login_required
def get_filters_api(request):
    """API: جلب بيانات الفلاتر مع تصفية الأساتذة ديناميكياً والتراجع المرن"""
    try:
        semester_id = request.GET.get('semester_id')
        course_id = request.GET.get('course_id')
        level_id = request.GET.get('level_id')
        group_id = request.GET.get('group_id')
        department_id = request.GET.get('department_id') or request.GET.get('specialty_id')

        print(f"[SEARCH] DEBUG: get_filters_api GET params -> semester_id={semester_id}, course_id={course_id}, level_id={level_id}, group_id={group_id}, department_id={department_id}")

        from apps.faculty.models import Professor, CourseAssignment
        
        # ============================================================
        # 1. جلب الفلاتر الأساسية (الأقسام، الفصول، المواد، المجموعات، المستويات)
        # ============================================================
        
        departments = Department.objects.filter(is_active=True).order_by('name')
        semesters = Semester.objects.all().order_by('-year', '-type')
        
        courses_qs = Course.objects.filter(is_active=True)
        if is_valid_filter(department_id):
            courses_qs = courses_qs.filter(department=department_id)
        if is_valid_filter(level_id):
            courses_qs = courses_qs.filter(level_id=level_id)
        courses = courses_qs.order_by('code')

        groups_qs = Group.objects.all().select_related('department', 'level')
        if is_valid_filter(department_id):
            groups_qs = groups_qs.filter(department_id=department_id)
        if is_valid_filter(level_id):
            groups_qs = groups_qs.filter(level_id=level_id)
        groups = groups_qs.order_by('name')

        levels = Level.objects.all().order_by('number')
        
        # ============================================================
        # 2. جلب الأساتذة (بناءً على التكليفات أو القسم)
        # ============================================================
        
        professors_data = []
        
        if request.user.role == 'teacher':
            professor = Professor.objects.filter(email=request.user.email).first()
            if professor:
                active_semester = Semester.objects.filter(is_active=True).first()
                assignments = CourseAssignment.objects.filter(professor=professor, is_active=True)
                if active_semester:
                    assignments = assignments.filter(semester=active_semester)
                
                if is_valid_filter(course_id):
                    assignments = assignments.filter(course_id=course_id)
                
                professor_ids = assignments.values_list('professor_id', flat=True).distinct()
                professors_qs = Professor.objects.filter(id__in=professor_ids, is_active=True)
                if not professors_qs.exists():
                    professors_qs = Professor.objects.filter(id=professor.id, is_active=True)
                professors_data = [{'id': p.id, 'name': p.full_name, 'email': p.email} for p in professors_qs]
            else:
                professors_data = []
        else:
            # للمدير والمسجل العام
            professors_qs = Professor.objects.none()
            
            if is_valid_filter(course_id):
                assignments_qs = CourseAssignment.objects.filter(
                    course_id=course_id,
                    is_active=True
                )
                if is_valid_filter(semester_id):
                    assignments_qs = assignments_qs.filter(semester_id=semester_id)
                if is_valid_filter(level_id):
                    assignments_qs = assignments_qs.filter(level_id=level_id)
                if is_valid_filter(group_id):
                    assignments_qs = assignments_qs.filter(student_group_id=group_id)
                
                professor_ids = list(assignments_qs.values_list('professor_id', flat=True).distinct())
                professors_qs = Professor.objects.filter(id__in=professor_ids, is_active=True)
                
                # Fallback: إذا لم توجد إسنادات مسبقة للمادة المحددة
                if not professors_qs.exists():
                    if is_valid_filter(department_id):
                        professors_qs = Professor.objects.filter(department_id=department_id, is_active=True)
                    else:
                        c_obj = Course.objects.filter(id=course_id).first()
                        if c_obj and c_obj.department.exists():
                            professors_qs = Professor.objects.filter(department__in=c_obj.department.all(), is_active=True).distinct()
                        else:
                            professors_qs = Professor.objects.filter(is_active=True)
            elif is_valid_filter(department_id):
                professors_qs = Professor.objects.filter(department_id=department_id, is_active=True)
            else:
                professors_qs = Professor.objects.filter(is_active=True)
                
            professors_data = [{'id': p.id, 'name': p.full_name, 'email': p.email} for p in professors_qs]
            print(f"[STATS] تم إرجاع {len(professors_data)} أستاذ")
        
        # ============================================================
        # 3. إرجاع الاستجابة النهائية
        # ============================================================
        
        return JsonResponse({
            'success': True,
            'departments': [{'id': d.id, 'name': d.name} for d in departments],
            'semesters': [{'id': s.id, 'year': s.year, 'type_display': s.get_type_display()} for s in semesters],
            'courses': [{'id': c.id, 'code': c.code, 'name': c.name} for c in courses],
            'groups': [{'id': g.id, 'name': g.name} for g in groups],
            'levels': [{'id': l.id, 'number': l.number, 'name': l.name} for l in levels],
            'professors': professors_data,
        })
        
    except Exception as e:
        print(f"[ERROR] خطأ في get_filters_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})

@login_required
def get_courses_by_level_api(request):
    """API: جلب المواد الدراسية المفلترة حسب التخصص والمستوى"""
    try:
        department_id = request.GET.get('department_id') or request.GET.get('specialty_id')
        level_id = request.GET.get('level_id')
        
        courses_qs = Course.objects.filter(is_active=True)
        if is_valid_filter(department_id):
            courses_qs = courses_qs.filter(department=department_id)
        if is_valid_filter(level_id):
            courses_qs = courses_qs.filter(level_id=level_id)
            
        courses = courses_qs.order_by('code')
        courses_data = [{'id': c.id, 'code': c.code, 'name': c.name} for c in courses]
        
        return JsonResponse({'success': True, 'courses': courses_data})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def get_groups_by_filter_api(request):
    """API: جلب المجموعات الدراسية المفلترة حسب التخصص والمستوى والسميستر والمادة"""
    try:
        department_id = request.GET.get('department_id') or request.GET.get('specialty_id')
        level_id = request.GET.get('level_id')
        semester_id = request.GET.get('semester_id')
        course_id = request.GET.get('course_id')
        
        groups_qs = Group.objects.all().select_related('department', 'level')
        
        if is_valid_filter(department_id):
            groups_qs = groups_qs.filter(department_id=department_id)
        
        if is_valid_filter(level_id):
            groups_qs = groups_qs.filter(level_id=level_id)
        
        if is_valid_filter(course_id) and is_valid_filter(semester_id):
            student_ids = CourseRegistration.objects.filter(
                course_id=int(course_id),
                semester_id=int(semester_id)
            ).values_list('student_id', flat=True).distinct()
            
            if student_ids.exists():
                groups_filtered = groups_qs.filter(student__id__in=student_ids).distinct()
                if groups_filtered.exists():
                    groups_qs = groups_filtered
        
        groups = groups_qs.order_by('name')
        groups_data = [{'id': g.id, 'name': g.name} for g in groups]
        
        return JsonResponse({'success': True, 'groups': groups_data})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def get_students_for_grades_api(request):
    """API: جلب الطلاب لتسجيل الدرجات مرتبين أبجدياً بأرقام القيد"""
    try:
        semester_id = request.GET.get('semester_id')
        course_id = request.GET.get('course_id')
        department_id = request.GET.get('department_id')
        group_id = request.GET.get('group_id')
        level_id = request.GET.get('level_id')
        period = request.GET.get('period', 'midterm')

        from apps.renewal.models import Course, Group, Semester, CourseRegistration
        from apps.student.models import Student
        
        # 4. تحويل المعلمات بشكل آمن لتفادي أخطاء 500
        def safe_int(val):
            if is_valid_filter(val):
                try:
                    return int(val)
                except ValueError:
                    return None
            return None
            
        sem_id = safe_int(semester_id)
        crs_id = safe_int(course_id)
        dep_id = safe_int(department_id)
        grp_id = safe_int(group_id)
        lvl_id = safe_int(level_id)
        
        if not sem_id or not crs_id:
            return JsonResponse({'success': False, 'message': 'الرجاء اختيار الفصل الدراسي والمادة أولاً'})
        
        # تم تجاوز وتجاهل معلمة professor_id تماماً لمنع إخفاء طلاب المجموعة عند تباين إسنادات الأساتذة
        print(f"\n[SEARCH] [GRADES API] Incoming Params -> sem_id={sem_id}, crs_id={crs_id}, dep_id={dep_id}, grp_id={grp_id}, lvl_id={lvl_id} (professor_id is safely bypassed)")
        
        # الاستعلام المباشر والتشخيص المنطقي للطلاب المعتمد حصراً على المادة والمجموعة والفصل
        students_list = []
        if grp_id:
            from django.db.models import Q
            from apps.renewal.models import Group

            # أ. الطلاب المربوطون بالمجموعة عبر FK
            direct_grp_students = Student.objects.filter(Q(group_id=grp_id) | Q(group__id=grp_id))
            print(f"[STATS] [GRADES API] Step 1 - Student.group_id == {grp_id} count: {direct_grp_students.count()}")
            
            # ب. الطلاب عبر العلاقات المتاحة M2M إن وجدت
            m2m_ids = set()
            try:
                g_obj = Group.objects.filter(id=grp_id).first()
                if g_obj:
                    print(f"[STATS] [GRADES API] Group #{grp_id} info: name='{g_obj.name}', dept_id={g_obj.department_id}, level_id={g_obj.level_id}")
                    if hasattr(g_obj, 'students'):
                        m2m_ids = set(g_obj.students.values_list('id', flat=True))
                        print(f"[STATS] [GRADES API] Step 2 - Group.students M2M count: {len(m2m_ids)}")
            except Exception as e:
                print(f"[WARN] [GRADES API] Group lookup error: {e}")

            # ج. التسجيلات المباشرة للمادة والمجموعة في CourseRegistration
            reg_ids = set(CourseRegistration.objects.filter(course_id=crs_id, student__group_id=grp_id).values_list('student_id', flat=True))
            print(f"[STATS] [GRADES API] Step 3 - CourseRegistration (course={crs_id}, group={grp_id}) count: {len(reg_ids)}")

            all_ids = set(direct_grp_students.values_list('id', flat=True)).union(m2m_ids).union(reg_ids)
            print(f"[STATS] [GRADES API] Step 4 - Combined unique Student IDs for group={grp_id}: {len(all_ids)}")

            # Fallback: إذا كانت مجموعة المعرفات فارغة تماماً، تجربة الجلب بقسم ومستوى المجموعة
            if not all_ids:
                print("[WARN] [GRADES API] Combined IDs empty! Executing Group Dept/Level Fallback...")
                g_obj = Group.objects.filter(id=grp_id).first()
                if g_obj:
                    fallback_grp_qs = Student.objects.all()
                    if g_obj.department_id:
                        fallback_grp_qs = fallback_grp_qs.filter(department_id=g_obj.department_id)
                    if g_obj.level_id:
                        fallback_grp_qs = fallback_grp_qs.filter(level_id=g_obj.level_id)
                    all_ids = set(fallback_grp_qs.values_list('id', flat=True))
                    print(f"[STATS] [GRADES API] Fallback Student count by Group Dept/Level: {len(all_ids)}")

            stu_qs = Student.objects.filter(id__in=all_ids).select_related('department', 'level', 'group').order_by('student_id')
            
            # عند اختيار مجموعة محددة (group_id)، يتم إرجاع جميع طلاب المجموعة صراحة ودون التقييد بشرط level_id للطالب
            students_list = list(stu_qs)
            print(f"[STATS] [GRADES API] Step 5 - Final students_list count returned for group={grp_id}: {len(students_list)}")
        else:
            registrations = CourseRegistration.objects.filter(
                course_id=crs_id,
                semester_id=sem_id
            ).select_related('student', 'student__department', 'student__level', 'student__group').order_by('student__student_id')
            
            if dep_id:
                registrations = registrations.filter(student__department_id=dep_id)
            if lvl_id:
                registrations = registrations.filter(student__level_id=lvl_id)
                
            students_list = [reg.student for reg in registrations]
            print(f"[STATS] [GRADES API] Non-group CourseRegistration count: {len(students_list)}")

            if not students_list:
                fallback_qs = Student.objects.all()
                if dep_id:
                    fallback_qs = fallback_qs.filter(department_id=dep_id)
                if lvl_id:
                    fallback_qs = fallback_qs.filter(level_id=lvl_id)
                students_list = list(fallback_qs.select_related('department', 'level', 'group').order_by('student_id'))
                print(f"[STATS] [GRADES API] Non-group Fallback students count: {len(students_list)}")
        
        # جلب الدرجات المسجلة للمادة والفصل الدراسي
        grades_dict = {}
        grades = Grade.objects.filter(
            course_id=crs_id,
            semester_id=sem_id
        )
        for g in grades:
            grades_dict[g.student_id] = {
                'midterm_score': g.midterm_grade,
                'final_score': g.final_grade,
                'total_score': g.total_grade,
                'is_passed': g.is_passed,
                'grade_id': g.id,
                'is_midterm_locked': g.is_midterm_locked,
                'is_final_locked': g.is_final_locked,
                'is_final_entered': g.is_final_entered,
            }
        
        data = []
        for student in students_list:
            grade_info = grades_dict.get(student.id, {})
            
            data.append({
                'id': student.id,
                'student_id': student.student_id or f"STU{student.id:06d}",
                'name': f"{student.name} {getattr(student, 'father_name', '') or ''}".strip(),
                'level_number': student.level.number if student.level else '-',
                'department_name': student.department.name if student.department else '-',
                'group_name': student.group.name if student.group else '-',
                'midterm_score': grade_info.get('midterm_score', 0),
                'final_score': grade_info.get('final_score', 0),
                'total_score': grade_info.get('total_score', 0),
                'is_passed': grade_info.get('is_passed', False),
                'grade_id': grade_info.get('grade_id', None),
                'is_midterm_locked': grade_info.get('is_midterm_locked', False),
                'is_final_locked': grade_info.get('is_final_locked', False),
                'is_final_entered': grade_info.get('is_final_entered', False),
            })
        
        return JsonResponse({
            'success': True,
            'students': data,
            'count': len(data)
        })
    
    except Exception as e:
        print(f"[ERROR] خطأ: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
def save_grades_api(request):
    """API: حظر الحفظ والتعديل اليدوي الفردي للدرجات"""
    return JsonResponse({
        'success': False,
        'error': '[ERROR] الإدخال والتعديل اليدوي للدرجات مقفل في هذه المنظومة! يرجى استخدام خيار "رفع ملف CSV / Excel" حصراً لإدخال وتحديث درجات الطلاب.'
    }, status=403)
    
    try:
        data = json.loads(request.body)
        semester_id = data.get('semester_id')
        course_id = data.get('course_id')
        students_data = data.get('students', [])
        
        if not semester_id or not course_id:
            return JsonResponse({'success': False, 'error': 'بيانات ناقصة'})
        
        # حماية إضافية: إذا كان المستخدم أستاذاً، نتأكد من أن المادة مسندة إليه في هذا الفصل الدراسي
        if request.user.role == 'teacher':
            from apps.faculty.models import Professor, CourseAssignment
            professor = Professor.objects.filter(email=request.user.email).first()
            if not professor or not CourseAssignment.objects.filter(
                professor=professor,
                course_id=course_id,
                semester_id=semester_id,
                is_active=True
            ).exists():
                return JsonResponse({'success': False, 'error': 'عذراً، لست مخولاً بتسجيل درجات هذه المادة/الفصل'})
        
        saved_count = 0
        errors = []
        
        for student_data in students_data:
            student_id = student_data.get('id')
            midterm = float(student_data.get('midterm_grade', 0) or 0)
            final_grade = float(student_data.get('final_grade', 0) or 0)
            practical = float(student_data.get('practical_grade', 0) or 0)
            grade_id = student_data.get('grade_id')
            
            try:
                student = Student.objects.get(id=student_id)
                course = Course.objects.get(id=course_id)
                semester = Semester.objects.get(id=semester_id)
                
                if final_grade < 0 or final_grade > 60:
                    errors.append(f"{student.name}: درجة النهائي يجب أن تكون بين 0 و 60")
                    continue
                if midterm < 0 or midterm > 40:
                    errors.append(f"{student.name}: درجة النصفي يجب أن تكون بين 0 و 40")
                    continue
                
                # جلب السجل الحالي إن وجد للتحقق من القفل
                grade = None
                if grade_id:
                    try:
                        grade = Grade.objects.get(id=grade_id)
                    except Grade.DoesNotExist:
                        pass
                if not grade:
                    grade = Grade.objects.filter(student=student, course=course, semester=semester).first()
                
                if grade:
                    # فحص القفل للمسجلين مسبقاً
                    if grade.is_midterm_locked and midterm != grade.midterm_grade:
                        errors.append(f"{student.name}: درجة النصفي معتمدة ومقفلة ولا يمكن تعديلها")
                        continue
                    if grade.is_final_locked and final_grade != grade.final_grade:
                        errors.append(f"{student.name}: درجة النهائي معتمدة ومقفلة ولا يمكن تعديلها")
                        continue
                    
                    grade.final_grade = final_grade
                    grade.midterm_grade = midterm
                    grade.practical_grade = practical
                    grade.updated_by = request.user
                else:
                    # فحص القفل عند تسجيل درجات لطالب جديد
                    is_mid_locked_global = Grade.objects.filter(semester_id=semester_id, course_id=course_id, is_midterm_locked=True).exists()
                    is_fin_locked_global = Grade.objects.filter(semester_id=semester_id, course_id=course_id, is_final_locked=True).exists()
                    
                    if is_fin_locked_global:
                        errors.append(f"{student.name}: درجات النهائي مقفلة ولا يمكن إضافة درجات جديدة")
                        continue
                    if is_mid_locked_global and midterm > 0:
                        errors.append(f"{student.name}: درجات النصفي مقفلة ولا يمكن إضافة درجة نصفي جديدة")
                        continue
                        
                    grade = Grade(
                        student=student,
                        course=course,
                        semester=semester,
                        final_grade=final_grade,
                        midterm_grade=midterm,
                        practical_grade=practical,
                        registered_by=request.user
                    )
                
                # تعيين الحقل is_final_entered إذا تم رصد درجة النهائي فعلياً
                if final_grade > 0 or grade.is_final_locked:
                    grade.is_final_entered = True
                    
                grade.save()
                saved_count += 1
                
                # إرسال بريد إلكتروني تنبيهي للطالب فور حفظ/تحديث درجاته
                send_student_grade_email(
                    student=student,
                    course=course,
                    semester=semester,
                    midterm_grade=midterm,
                    final_grade=final_grade,
                    total_grade=grade.total_grade,
                    is_passed=grade.is_passed,
                    action_type="رصد وتحديث"
                )
                
            except Student.DoesNotExist:
                errors.append(f"الطالب برقم {student_id} غير موجود")
            except Exception as e:
                errors.append(str(e))
        
        return JsonResponse({
            'success': True,
            'message': f'[OK] تم حفظ {saved_count} درجة',
            'saved_count': saved_count,
            'errors': errors
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


# ================================================================
# عرض النتائج (Show Results)
# ================================================================

@login_required
def show_results(request):
    """صفحة عرض النتائج"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    levels = Level.objects.all().order_by('number')
    courses = Course.objects.filter(is_active=True).order_by('code')
    
    # [SEC] تسجيل نشاط تصفح واستعراض نتائج الطلاب في سجل الأحداث
    try:
        log_activity(
            user=request.user,
            action='view_results',
            model_name='Grade',
            object_name='صفحة استعراض النتائج والكنترول',
            details='قام المستخدِم بتصفح واستعراض نتائج الطلاب في المنظومة',
            request=request
        )
    except Exception as log_err:
        logger.warning(f"[WARN] Error logging show_results activity: {log_err}")

    exams_director_name = "د. فاطمة عمران الشريف"
    try:
        from apps.users.models import Official
        exams_dir = Official.objects.filter(is_active=True).filter(
            Q(position_key__in=['exams_director', 'exams_head', 'exams']) |
            Q(position_name__icontains='مدير الدراسة والامتحانات') |
            Q(position_name__icontains='الدراسة والامتحانات')
        ).exclude(position_key='exams_coordinator').exclude(position_name__icontains='منسق').exclude(position_name__icontains='منسقة').first()
        if exams_dir:
            exams_director_name = exams_dir.get_full_name()
    except Exception as e:
        logger.warning(f"Error fetching exams director for show_results: {e}")

    context = {
        'departments': departments,
        'semesters': semesters,
        'levels': levels,
        'courses': courses,
        'exams_director_name': exams_director_name,
    }
    return render(request, 'grades/show_results.html', context)


@login_required
def get_results_api(request):
    """API: جلب نتائج الطلاب مع المعدل التراكمي"""
    try:
        from django.db.models import Q
        
        grades = Grade.objects.all().select_related(
            'student', 'course', 'semester', 
            'student__department', 'student__level'
        )
        
        major_id = request.GET.get('major_id')
        if major_id and major_id != '':
            grades = grades.filter(student__department_id=major_id)
        
        semester_id = request.GET.get('semester_id')
        if semester_id and semester_id != '':
            grades = grades.filter(semester_id=semester_id)
        
        level_id = request.GET.get('level_id')  # 🔥 إضافة فلترة المستوى
        if level_id and level_id != '':
            grades = grades.filter(student__level_id=level_id)
        
        search = request.GET.get('search', '').strip()
        if search:
            grades = grades.filter(
                Q(student__student_id__icontains=search) |
                Q(student__name__icontains=search)
            )
        
        # ... باقي الكود كما هو
            print(f"[STATS] بعد البحث: {grades.count()}")
        
        # حساب المعدل التراكمي
        student_gpas = {}
        student_ids = grades.values_list('student_id', flat=True).distinct()
        
        for student_id in student_ids:
            student = Student.objects.get(id=student_id)
            student_grades = Grade.objects.filter(student=student, is_passed=True)
            total_points = 0
            total_credits = 0
            for g in student_grades:
                total_points += g.total_grade * g.course.credits
                total_credits += g.course.credits
            student_gpas[student_id] = (total_points / total_credits) if total_credits > 0 else 0
        
        data = []
        for grade in grades:
            student = grade.student
            gpa = student_gpas.get(student.id, 0)
            
            data.append({
                'student_id': student.student_id or '-',
                'student_name': f"{student.name} {student.father_name or ''}",
                'course_name': grade.course.name,
                'course_code': grade.course.code,
                'semester_year': grade.semester.year,
                'semester_type': grade.semester.get_type_display(),
                'midterm_grade': grade.midterm_grade,
                'final_grade': grade.final_grade,
                'total_grade': grade.total_grade,
                'is_passed': grade.is_passed,
                'grade_letter': grade.get_grade_letter() if hasattr(grade, 'get_grade_letter') else '-',
                'department_name': student.department.name if student.department else '-',
                'level_number': student.level.number if student.level else '-',
                'gpa': round(gpa, 2),
            })
        
        return JsonResponse({
            'success': True,
            'results': data,
            'total': len(data)
        })
    
    except Exception as e:
        print(f"[ERROR] خطأ: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


# ================================================================
# كشف الدرجات التراكمي
# ================================================================

def is_valid_filter(val):
    if val is None:
        return False
    val_str = str(val).strip().lower()
    return val_str not in ['', 'all', 'null', 'undefined', 'none', 'every', 'كل الأقسام', 'الكل', '-- الكل --']


def get_transcript_badge_text(grade):
    if not grade.is_passed:
        return 'راسب'
    total = grade.total_grade
    if total >= 85:
        return 'ممتاز'
    elif total >= 75:
        return 'جيد جداً'
    elif total >= 65:
        return 'جيد'
    else:
        return 'مقبول'


@login_required
def cumulative_grades(request):
    """
    صفحة كشف الدرجات التراكمي الشامل
    تجلب كشوفات الدرجات التفصيلية المأخوذة من قاعدة البيانات وتدعم التصفية المباشرة.
    """
    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    if is_academic_dept and user_dept:
        departments = Department.objects.filter(id=user_dept.id)
    else:
        departments = Department.objects.filter(is_active=True).order_by('name')
    semesters_qs = Semester.objects.all().order_by('-year', '-type')
    
    # 1. الاستعلام عن الطلاب مع تحسين الأداء
    students_qs = Student.objects.all().select_related(
    'department', 'level'
).prefetch_related(
    'grade_set__course', 'grade_set__semester'
).order_by('name', 'father_name')
    if is_academic_dept and user_dept:
        students_qs = students_qs.filter(department=user_dept)
    
    # 2. الفلترة المباشرة عند تزويد GET parameters
    dept_param = request.GET.get('department')
    if is_valid_filter(dept_param):
        students_qs = students_qs.filter(
            Q(department__id=dept_param) | Q(department__name=dept_param)
        )
        
    search_query = request.GET.get('search', '').strip()
    if search_query:
        students_qs = students_qs.filter(
            Q(name__icontains=search_query) |
            Q(student_id__icontains=search_query) |
            Q(national_id__icontains=search_query)
        )

    # 3. بناء هيكل سجلات كشوفات الدرجات التراكمية
    students_data = []
    for s in students_qs:
        grades = s.grade_set.all().select_related('course', 'semester')
        if not grades.exists():
            continue
            
        semesters_map = {}
        total_passed_credits = 0
        total_passed_points = 0
        
        for g in grades:
            sem = g.semester
            sem_id = sem.id
            if sem_id not in semesters_map:
                sem_label = f"{sem.get_type_display() if hasattr(sem, 'get_type_display') else sem.type} {sem.year}"
                semesters_map[sem_id] = {
                    'semester_id': sem_id,
                    'semesterName': sem_label,
                    'year': sem.year,
                    'type': sem.type,
                    'courses': [],
                    'total_points': 0,
                    'total_credits': 0,
                }
                
            badge_text = get_transcript_badge_text(g)
            semesters_map[sem_id]['courses'].append({
                'code': g.course.code,
                'name': g.course.name,
                'credits': float(g.course.credits),
                'midterm': float(g.midterm_grade),
                'final': float(g.final_grade),
                'total': float(g.total_grade),
                'grade': badge_text,
            })
            
            semesters_map[sem_id]['total_points'] += g.total_grade * g.course.credits
            semesters_map[sem_id]['total_credits'] += g.course.credits
            
            if g.is_passed:
                total_passed_credits += g.course.credits
                total_passed_points += g.total_grade * g.course.credits

        semesters_list = []
        for sem_id, sem_info in semesters_map.items():
            sem_gpa = round(sem_info['total_points'] / sem_info['total_credits'], 2) if sem_info['total_credits'] > 0 else 0.0
            semesters_list.append({
                'semester_id': sem_info['semester_id'],
                'semesterName': sem_info['semesterName'],
                'year': sem_info['year'],
                'type': sem_info['type'],
                'gpa': sem_gpa,
                'courses': sem_info['courses'],
            })

        cgpa = round(total_passed_points / total_passed_credits, 2) if total_passed_credits > 0 else 0.0
        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
        full_name = " ".join(full_name.split())
        
        reg_num = s.student_id or str(s.id)
        try:
            from apps.student.utils import get_student_verification_qr_url
            verify_url = get_student_verification_qr_url(s, request=request)
        except Exception:
            verify_url = request.build_absolute_uri(reverse('student:verify_student', kwargs={'student_id': reg_num}))

        students_data.append({
            'id': s.id,
            'student_id': s.student_id,
            'reg_num': reg_num,
            'qr_key': getattr(s, 'qr_key', ''),
            'verify_url': verify_url,
            'name': full_name,
            'major': s.department.name if s.department else 'غير محدد',
            'dept_id': s.department.id if s.department else None,
            'level': s.level.name if s.level else 'غير محدد',
            'cgpa': cgpa,
            'total_credits': int(total_passed_credits),
            'semesters': semesters_list,
        })

    departments_list = list(departments.values('id', 'name'))
    semesters_list_json = list(semesters_qs.values('id', 'year', 'type'))

    context = {
        'departments': departments,
        'semesters': semesters_qs,
        'students_list': students_data,
        'students_json': json.dumps(students_data, ensure_ascii=False),
        'semesters_json': json.dumps(semesters_list_json, ensure_ascii=False),
        'departments_json': json.dumps(departments_list, ensure_ascii=False),
        'is_academic_dept': is_academic_dept,
    }
    return render(request, 'grades/cumulative_grades.html', context)


@login_required
def get_student_transcript_api(request):
    """API: جلب كشف الدرجات التراكمي لطالب"""
    try:
        from django.db.models import Q
        
        user_role = str(getattr(request.user, 'role', '')).strip().lower()
        user_dept = getattr(request.user, 'department', None)
        is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

        student_id = request.GET.get('student_id')
        reg_num = request.GET.get('reg_num')
        name = request.GET.get('name')
        
        base_qs = Student.objects.all()
        if is_academic_dept and user_dept:
            base_qs = base_qs.filter(department=user_dept)

        student = None
        if reg_num:
            student = base_qs.filter(student_id=reg_num).first()
        elif name:
            student = base_qs.filter(name__icontains=name).first()
        elif student_id:
            student = base_qs.filter(id=student_id).first()
        
        if not student:
            return JsonResponse({
                'success': False,
                'error': 'لم يتم العثور على الطالب'
            })
        
        grades = Grade.objects.filter(student=student).select_related('course', 'semester')
        
        if not grades.exists():
            return JsonResponse({
                'success': True,
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': f"{student.name} {student.father_name or ''}",
                    'major': str(student.department) if student.department else '-',
                },
                'semesters': [],
                'total_credits': 0,
                'cgpa': 0,
                'passed_count': 0,
                'failed_count': 0
            })
        
        semesters_dict = {}
        total_credits = 0
        total_points = 0
        passed_count = 0
        
        for grade in grades:
            semester_key = f"{grade.semester.year}_{grade.semester.type}"
            if semester_key not in semesters_dict:
                semesters_dict[semester_key] = {
                    'semesterName': f"{grade.semester.get_type_display()} {grade.semester.year}",
                    'gpa': 0,
                    'courses': [],
                    'total_credits': 0,
                    'total_points': 0
                }
            
            points = grade.total_grade * grade.course.credits
            semesters_dict[semester_key]['courses'].append({
                'code': grade.course.code,
                'name': grade.course.name,
                'credits': grade.course.credits,
                'midterm': grade.midterm_grade,
                'final': grade.final_grade,
                'total': grade.total_grade,
                'is_passed': grade.is_passed
            })
            semesters_dict[semester_key]['total_credits'] += grade.course.credits
            semesters_dict[semester_key]['total_points'] += points
            
            total_credits += grade.course.credits
            total_points += points
            if grade.is_passed:
                passed_count += 1
        
        semesters_list = []
        for key, sem in semesters_dict.items():
            gpa = sem['total_points'] / sem['total_credits'] if sem['total_credits'] > 0 else 0
            semesters_list.append({
                'semesterName': sem['semesterName'],
                'gpa': f"{gpa:.2f}",
                'courses': sem['courses']
            })
        
        semesters_list.sort(key=lambda x: x['semesterName'], reverse=True)
        cgpa = total_points / total_credits if total_credits > 0 else 0
        
        return JsonResponse({
            'success': True,
            'student': {
                'id': student.id,
                'student_id': student.student_id,
                'name': f"{student.name} {student.father_name or ''}",
                'major': str(student.department) if student.department else '-',
            },
            'semesters': semesters_list,
            'total_credits': total_credits,
            'cgpa': round(cgpa, 2),
            'passed_count': passed_count,
            'failed_count': grades.count() - passed_count
        })
    
    except Exception as e:
        print(f"[ERROR] خطأ: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'error': str(e)
        })


# ================================================================
# دوال الصفحات الأخرى
# ================================================================

@login_required
def successful_students_report(request):
    """
    تقرير الطلاب الناجحين والمجتازين - Dynamic Database Integration
    جلب الطلاب الناجحين مع كامل تفاصيلهم الأكاديمية والدرجات المجتازة ديناميكياً من قاعدة البيانات.
    """
    # 1. جلب الطلاب الذين لديهم درجات اجتياز من قاعدة البيانات باستخدام select_related للحد من الأستعلامات المتكررة
    students_qs = Student.objects.filter(
    grade__is_passed=False
).select_related(
    'department', 'level', 'user'
).prefetch_related(
    'grade_set__course', 'grade_set__semester'
).distinct().order_by('name', 'father_name')

    students_data = []
    for s in students_qs:
        passed_grades = s.grade_set.filter(is_passed=True).select_related('course', 'semester')
        
        total_points = sum(g.total_grade * g.course.credits for g in passed_grades)
        total_credits = sum(g.course.credits for g in passed_grades)
        
        if total_credits > 0:
            gpa = round(total_points / total_credits, 2)
        elif hasattr(s, 'academicrecord') and s.academicrecord:
            gpa = round(s.academicrecord.cumulative_gpa, 2)
        else:
            gpa = 0.0

        passed_courses = []
        sem_types = set()
        sem_years = set()
        for g in passed_grades:
            sem_types.add(g.semester.type)
            sem_years.add(str(g.semester.year))
            season_label = f"{g.semester.get_type_display() if hasattr(g.semester, 'get_type_display') else g.semester.type} {g.semester.year}"
            passed_courses.append({
                'code': g.course.code,
                'name': g.course.name,
                'credits': float(g.course.credits),
                'season': season_label,
                'total': float(g.total_grade),
            })

        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
        full_name = " ".join(full_name.split())

        latest_grade = passed_grades.first()

        students_data.append({
            'id': s.student_id or str(s.id),
            'name': full_name,
            'major': s.department.name if s.department else 'عام',
            'department_name': s.department.name if s.department else 'عام',
            'currentSemester': s.level.name if s.level else 'غير محدد',
            'semester_type': latest_grade.semester.type if latest_grade else '',
            'semester_types': list(sem_types),
            'semester_year': str(latest_grade.semester.year) if latest_grade else '',
            'semester_years': list(sem_years),
            'gpa': gpa,
            'passedCourses': passed_courses,
        })

    # 2. جلب الأقسام والفصول المتاحة من قاعدة البيانات
    departments = list(Department.objects.filter(is_active=True).values('id', 'name'))
    semesters = list(Semester.objects.values('id', 'year', 'type'))
    for sem in semesters:
        sem['display_name'] = f"{sem['type']} {sem['year']}"

    # جلب أسماء المسؤولين ديناميكياً
    from apps.users.models import get_official
    registrar_official_name = get_official('registrar', default='')
    exams_head_official_name = get_official('exams_head', default='')

    context = {
        'successful_students': students_qs,
        'total_successful_count': len(students_data),
        'students_json': json.dumps(students_data, ensure_ascii=False),
        'semesters_json': json.dumps(semesters, ensure_ascii=False),
        'departments_json': json.dumps(departments, ensure_ascii=False),
        'registrar_official_name': registrar_official_name,
        'exams_head_official_name': exams_head_official_name,
    }

    return render(request, 'grades/successful_students.html', context)


@login_required
def courses_report(request):
    return render(request, 'grades/show_results.html')


@login_required
@csrf_exempt
def import_excel_grades_api(request):
    """API: استيراد درجات من ملف Excel مع فحص مطابقة دقيق"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
    
    try:
        import openpyxl
        
        excel_file = request.FILES.get('excel_file')
        semester_id = request.POST.get('semester_id')
        course_id = request.POST.get('course_id')
        period = request.POST.get('period', 'midterm')
        
        if not excel_file:
            return JsonResponse({'success': False, 'message': 'الرجاء اختيار ملف Excel'})
        
        if not semester_id or not course_id:
            return JsonResponse({'success': False, 'message': 'بيانات الفصل أو المادة ناقصة'})
        
        from apps.student.models import Student
        from django.db.models import Q
        
        file_name = excel_file.name.lower()
        rows_data = []
        
        if file_name.endswith('.csv'):
            import csv
            import io
            file_content = excel_file.read()
            text = None
            for encoding in ['utf-8-sig', 'utf-8', 'cp1256', 'latin-1']:
                try:
                    text = file_content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if text is None:
                text = file_content.decode('utf-8', errors='ignore')
                
            csv_reader = csv.reader(io.StringIO(text))
            for r in csv_reader:
                rows_data.append(r)
        else:
            workbook = openpyxl.load_workbook(excel_file)
            sheet = workbook.active
            for r in sheet.iter_rows(values_only=True):
                rows_data.append(list(r) if r else [])
        
        if not rows_data or len(rows_data) < 2:
            return JsonResponse({'success': False, 'message': '[WARN] الملف فارغ أو لا يحتوي على صفوف بيانات'})
        
        # قراءة الهيدر (الصف الأول) لتحديد مواضع الأعمدة ديناميكياً
        first_row = rows_data[0] if rows_data else []
        header_cells = [str(cell).strip() if cell is not None else "" for cell in first_row]
        
        id_idx = 0
        name_idx = 1
        mid_idx = None
        final_idx = None
        
        for col_i, h in enumerate(header_cells):
            h_clean = h.lower()
            if any(k in h_clean for k in ["رقم القيد", "القيد", "student_id", "id"]):
                id_idx = col_i
            elif any(k in h_clean for k in ["اسم الطالب", "الاسم", "name"]):
                name_idx = col_i
            elif any(k in h_clean for k in ["نصفي", "midterm"]):
                mid_idx = col_i
            elif any(k in h_clean for k in ["نهائي", "final"]):
                final_idx = col_i
                
        if mid_idx is None:
            mid_idx = 3 if len(header_cells) > 3 else 2
        if final_idx is None:
            final_idx = 4 if len(header_cells) > 4 else mid_idx
            
        def safe_float(val):
            if val is None or str(val).strip() == '':
                return 0.0
            val_str = str(val).strip()
            if val_str in ['غائب', 'غ', 'absent', 'abs']:
                return 0.0
            try:
                return float(val_str)
            except ValueError:
                return 0.0

        students_data = []
        not_found_students = []
        locked_students = []
        
        # استخراج ورصد الدرجات والتسجيل التلقائي في المادة
        for row_idx, row in enumerate(rows_data[1:], start=2):
            if not row or len(row) <= id_idx or row[id_idx] is None:
                continue
                
            student_id_str = str(row[id_idx]).strip()
            if not student_id_str:
                continue
                
            excel_name = str(row[name_idx]).strip() if len(row) > name_idx and row[name_idx] is not None else ""
            
            # البحث عن الطالب في قاعدة البيانات
            student = Student.objects.filter(
                Q(student_id=student_id_str) | Q(student_id=f"STU{student_id_str}") | (Q(id=int(student_id_str)) if student_id_str.isdigit() else Q(student_id=student_id_str))
            ).first()
            
            if not student and excel_name:
                student = Student.objects.filter(name__icontains=excel_name).first()
                
            if not student:
                not_found_students.append(f"السطر {row_idx}: رقم القيد '{student_id_str}'")
                continue
                
            # تسجيل المادة للطالب تلقائياً إذا لم تكن مسجلة مسبقاً
            CourseRegistration.objects.get_or_create(
                student=student,
                course_id=course_id,
                semester_id=semester_id,
                defaults={'registered_by': request.user}
            )
            
            # رصد وحفظ الدرجات
            if period == 'midterm':
                score = safe_float(row[mid_idx]) if len(row) > mid_idx else 0.0
                grade, created = Grade.objects.get_or_create(
                    student=student,
                    course_id=course_id,
                    semester_id=semester_id,
                    defaults={
                        'midterm_grade': score,
                        'registered_by': request.user,
                    }
                )
                if not created:
                    if grade.is_midterm_locked:
                        locked_students.append(student.name)
                    else:
                        grade.midterm_grade = score
                        grade.updated_by = request.user
                        grade.save()
            else:
                score_idx = final_idx if (final_idx is not None and len(row) > final_idx) else (mid_idx if (mid_idx is not None and len(row) > mid_idx) else None)
                score = safe_float(row[score_idx]) if (score_idx is not None and len(row) > score_idx) else 0.0

                grade, created = Grade.objects.get_or_create(
                    student=student,
                    course_id=course_id,
                    semester_id=semester_id,
                    defaults={
                        'final_grade': score,
                        'is_final_entered': True,
                        'registered_by': request.user,
                    }
                )
                if not created:
                    if grade.is_final_locked:
                        locked_students.append(student.name)
                    else:
                        grade.final_grade = score
                        grade.is_final_entered = True
                        grade.updated_by = request.user
                        grade.save()
            
            students_data.append({
                'id': student.id,
                'student_id': student.student_id or f"STU{student.id:06d}",
                'name': f"{student.name} {student.father_name or ''}".strip(),
                'level_number': student.level.number if student.level else '-',
                'department_name': student.department.name if student.department else '-',
                'group_name': student.group.name if student.group else '-',
                'midterm_score': grade.midterm_grade,
                'final_score': grade.final_grade,
                'total_score': grade.total_grade,
                'is_passed': grade.is_passed,
                'grade_id': grade.id,
                'is_midterm_locked': grade.is_midterm_locked,
                'is_final_locked': grade.is_final_locked,
                'is_final_entered': grade.is_final_entered,
            })
            
        if not students_data:
            return JsonResponse({
                'success': False,
                'message': '[WARN] لم يتم العثور على أي طالب من أرقام القيد المذكورة في الملف داخل قاعدة البيانات'
            })
            
        students_data.sort(key=lambda x: str(x['student_id']))
        
        # [SEC] توثيق عملية استيراد كشف الدرجات من Excel في سجل الأحداث بالتفصيل
        try:
            crs_obj = Course.objects.filter(id=course_id).first()
            sem_obj = Semester.objects.filter(id=semester_id).first()
            crs_name = crs_obj.name if crs_obj else f"المادة #{course_id}"
            user_disp = f"المستخدِم ({request.user.get_full_name() or request.user.username})"
            log_activity(
                user=request.user,
                action='grades',
                model_name='Grade',
                object_name=f"كشف درجات {crs_name}",
                details=f"قام {user_disp} باستيراد كشف درجات {period} من ملف Excel للمادة ({crs_name}) بالفصل ({sem_obj}) لـ ({len(students_data)}) طالب بنجاح",
                request=request
            )

            # [EMAIL] إرسال إشعار بريد إلكتروني رسمي لإدارة الكلية وقسم الدراسة والامتحانات
            send_grade_submission_alert_to_college(
                course=crs_obj,
                semester=sem_obj,
                user=request.user,
                period=period,
                students_count=len(students_data),
                action_name=f"استيراد وتعبئة كشف درجات {period}"
            )
        except Exception as log_err:
            print(f"[WARN] Log activity / Mail alert error in import_excel: {log_err}")

        return JsonResponse({
            'success': True,
            'students': students_data,
            'message': f'تم استيراد وتعبئة درجات {len(students_data)} طالب بنجاح'
        })
    
    except Exception as e:
        print(f"[ERROR] خطأ في استيراد Excel: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('grades.change_grade', 'grades.add_grade', 'change_grade', 'add_grade')
def approve_and_lock_grades_api(request):
    """API: اعتماد وقفل الدرجات للنصفي والنهائي بشكل مستقل تماماً"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        semester_id = data.get('semester_id')
        course_id = data.get('course_id')
        period = data.get('period', 'midterm')
        
        if not semester_id or not course_id:
            return JsonResponse({'success': False, 'message': 'بيانات ناقصة'})
        
        grades = Grade.objects.filter(semester_id=semester_id, course_id=course_id)
        if not grades.exists():
            return JsonResponse({'success': False, 'message': 'لا توجد درجات مسجلة في المنظومة بهذه المادة لرصدها واعتمادها'})

        crs_obj = Course.objects.filter(id=course_id).first()
        sem_obj = Semester.objects.filter(id=semester_id).first()
        crs_name = crs_obj.name if crs_obj else f"المادة #{course_id}"

        if period == 'midterm':
            grades.update(is_midterm_locked=True)
            for g in grades.select_related('student', 'course', 'semester'):
                send_student_grade_email(
                    student=g.student,
                    course=g.course,
                    semester=g.semester,
                    midterm_grade=g.midterm_grade,
                    final_grade=g.final_grade,
                    total_grade=g.total_grade,
                    is_passed=g.is_passed,
                    action_type="اعتماد وقفل درجة النصفي"
                )
            
            # [SEC] توثيق اعتماد وقفل النصفي في سجل الأحداث وإرسال إشعار بريدي للكلية
            try:
                user_disp = f"المستخدِم ({request.user.get_full_name() or request.user.username})"
                log_activity(
                    user=request.user,
                    action='approve',
                    model_name='Grade',
                    object_name=f"اعتماد نصفي {crs_name}",
                    details=f"قام {user_disp} باعتماد وقفل درجات امتحان النصفي للمادة ({crs_name}) بالفصل ({sem_obj}) لـ ({grades.count()}) طالب",
                    request=request
                )

                send_grade_submission_alert_to_college(
                    course=crs_obj,
                    semester=sem_obj,
                    user=request.user,
                    period='midterm',
                    students_count=grades.count(),
                    action_name="اعتماد وقفل درجات امتحان النصفي"
                )
            except Exception as e:
                print(f"[WARN] Log / Mail error in lock midterm: {e}")

            return JsonResponse({
                'success': True,
                'message': '🔒 تم اعتماد وقفل درجات امتحان النصفي بنجاح!'
            })
        elif period == 'final':
            for g in grades.select_related('student', 'course', 'semester'):
                g.is_final_locked = True
                g.is_final_entered = True
                g.save() # recalculates total_grade & is_passed
                send_student_grade_email(
                    student=g.student,
                    course=g.course,
                    semester=g.semester,
                    midterm_grade=g.midterm_grade,
                    final_grade=g.final_grade,
                    total_grade=g.total_grade,
                    is_passed=g.is_passed,
                    action_type="اعتماد وقفل درجة النهائي"
                )
                
            # [SEC] توثيق اعتماد وقفل النهائي في سجل الأحداث وإرسال إشعار بريدي للكلية
            try:
                user_disp = f"المستخدِم ({request.user.get_full_name() or request.user.username})"
                log_activity(
                    user=request.user,
                    action='approve',
                    model_name='Grade',
                    object_name=f"اعتماد نهائي {crs_name}",
                    details=f"قام {user_disp} باعتماد وقفل درجات النهائي وحساب التقديرات والنتائج للمادة ({crs_name}) بالفصل ({sem_obj}) لـ ({grades.count()}) طالب",
                    request=request
                )

                send_grade_submission_alert_to_college(
                    course=crs_obj,
                    semester=sem_obj,
                    user=request.user,
                    period='final',
                    students_count=grades.count(),
                    action_name="اعتماد وقفل درجات امتحان النهائي وحساب النتائج"
                )
            except Exception as e:
                print(f"[WARN] Log / Mail error in lock final: {e}")

            return JsonResponse({
                'success': True,
                'message': '🔒 تم اعتماد وقفل درجات النهائي وحساب التقديرات والنتائج بنجاح!'
            })
        
        return JsonResponse({'success': False, 'message': 'فترة رصد غير صالحة'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('grades.publish_grades', 'grades.change_grade', 'publish_grades', 'change_grade')
def publish_grades_api(request):
    """API: ترحيل ونشر النتائج لواجهة الطالب"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        semester_id = data.get('semester_id')
        course_id = data.get('course_id')
        
        if not semester_id or not course_id:
            return JsonResponse({'success': False, 'message': 'بيانات ناقصة'})
        
        grades = Grade.objects.filter(semester_id=semester_id, course_id=course_id)
        if not grades.exists():
            return JsonResponse({'success': False, 'message': 'لا توجد درجات مسجلة لترحيلها'})
        
        unlocked_midterm = grades.filter(is_midterm_locked=False).exists()
        unlocked_final = grades.filter(is_final_locked=False).exists()
        
        if unlocked_midterm or unlocked_final:
            return JsonResponse({
                'success': False,
                'message': '[WARN] لا يمكن ترحيل النتائج إلا بعد اعتماد وقفل النصفي والنهائي معاً 🔒'
            })

        # إنشاء سجلات الإشعارات للطالب وإرسال الإيميل
        try:
            from apps.student.models import Notification
            student_ids = list(grades.values_list('student_id', flat=True).distinct())
            notifs = [
                Notification(
                    student_id=s_id,
                    title="اعتماد ونشر النتائج",
                    message="تم اعتماد ونشر نتيجتك الدراسية بنجاح"
                )
                for s_id in student_ids if s_id
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception as e:
            print(f"Error creating notifications: {e}")

        for g in grades.select_related('student', 'course', 'semester'):
            send_student_grade_email(
                student=g.student,
                course=g.course,
                semester=g.semester,
                midterm_grade=g.midterm_grade,
                final_grade=g.final_grade,
                total_grade=g.total_grade,
                is_passed=g.is_passed,
                action_type="نشر وإعلان نتائج"
            )
        
        return JsonResponse({
            'success': True,
            'message': '[START] تم ترحيل ونشر الكشف بنجاح لصفحة عرض النتائج!'
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
def export_excel_grades_api(request):
    """API: تصدير درجات إلى Excel وإرسالها بالبريد"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
    
    try:
        import openpyxl
        from openpyxl.styles import Font, Alignment, PatternFill
        from django.core.mail import EmailMessage
        from io import BytesIO
        
        data = {}
        if request.body:
            try:
                data = json.loads(request.body)
            except Exception:
                data = {}
        
        def get_val(key):
            v = data.get(key)
            if (v is None or v == '') and request.GET:
                v = request.GET.get(key)
            if (v is None or v == '') and request.POST:
                v = request.POST.get(key)
            return v

        semester_id = get_val('semester_id')
        course_id = get_val('course_id')
        group_id = get_val('group_id')
        department_id = get_val('department_id')
        level_id = get_val('level_id')
        period = get_val('period')
        email = get_val('email')

        def safe_int(val):
            if is_valid_filter(val):
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return None
            return None

        sem_id = safe_int(semester_id)
        crs_id = safe_int(course_id)
        grp_id = safe_int(group_id)
        dep_id = safe_int(department_id)
        lvl_id = safe_int(level_id)
        
        if not sem_id or not crs_id:
            return JsonResponse({'success': False, 'message': 'بيانات ناقصة'})
        
        # جلب المادة المحددة للتسمية
        from apps.renewal.models import Course
        course_obj = Course.objects.filter(id=crs_id).first()
        course_name = course_obj.name if course_obj else 'المادة'

        # جلب قائمة الطلاب للتصدير بنفس منطق شاشة العرض لضمان تطابق الأعداد والأسماء
        students_list = []
        if grp_id:
            from django.db.models import Q
            from apps.renewal.models import Group
            direct_grp_students = Student.objects.filter(Q(group_id=grp_id) | Q(group__id=grp_id))
            m2m_ids = set()
            try:
                g_obj = Group.objects.filter(id=grp_id).first()
                if g_obj and hasattr(g_obj, 'students'):
                    m2m_ids = set(g_obj.students.values_list('id', flat=True))
            except Exception:
                pass

            reg_ids = set(CourseRegistration.objects.filter(course_id=crs_id, student__group_id=grp_id).values_list('student_id', flat=True))
            all_ids = set(direct_grp_students.values_list('id', flat=True)).union(m2m_ids).union(reg_ids)

            if not all_ids:
                g_obj = Group.objects.filter(id=grp_id).first()
                if g_obj:
                    fallback_grp_qs = Student.objects.all()
                    if g_obj.department_id:
                        fallback_grp_qs = fallback_grp_qs.filter(department_id=g_obj.department_id)
                    if g_obj.level_id:
                        fallback_grp_qs = fallback_grp_qs.filter(level_id=g_obj.level_id)
                    all_ids = set(fallback_grp_qs.values_list('id', flat=True))

            stu_qs = Student.objects.filter(id__in=all_ids).select_related('department', 'level', 'group').order_by('student_id')
            students_list = list(stu_qs)
        else:
            registrations = CourseRegistration.objects.filter(
                course_id=crs_id,
                semester_id=sem_id
            ).select_related('student', 'course', 'student__department', 'student__level', 'student__group').order_by('student__student_id')
            
            if dep_id:
                registrations = registrations.filter(student__department_id=dep_id)
            if lvl_id:
                registrations = registrations.filter(student__level_id=lvl_id)
            students_list = [reg.student for reg in registrations]

            if not students_list:
                fallback_qs = Student.objects.all()
                if dep_id:
                    fallback_qs = fallback_qs.filter(department_id=dep_id)
                if lvl_id:
                    fallback_qs = fallback_qs.filter(level_id=lvl_id)
                students_list = list(fallback_qs.select_related('department', 'level', 'group').order_by('student_id'))

        # جلب الدرجات الحصرية للفصل الدراسي الحالي لتسريـل وعزل المحاولات السابقة كلياً
        grades_dict = {}
        grades = Grade.objects.filter(
            course_id=crs_id,
            semester_id=sem_id
        )
        for g in grades:
            grades_dict[g.student_id] = {
                'midterm_grade': g.midterm_grade,
                'final_grade': g.final_grade,
                'total_grade': g.total_grade,
                'is_passed': g.is_passed,
            }
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "الدرجات"
        
        period_str = str(period).strip().lower() if period else 'midterm'
        is_midterm_only = (period_str == 'midterm' or period_str == 'نصفي')
        
        if is_midterm_only:
            headers = ['رقم القيد', 'اسم الطالب', 'المادة', 'درجة النصفي (40)']
        else:
            headers = ['رقم القيد', 'اسم الطالب', 'المادة', 'درجة النصفي (40)', 'درجة النهائي (60)']

        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="1e3a5f", end_color="1e3a5f", fill_type="solid")
            cell.alignment = Alignment(horizontal="center")
        
        row = 2
        for student in students_list:
            grade_info = grades_dict.get(student.id, {})
            
            ws.cell(row=row, column=1, value=student.student_id or '')
            ws.cell(row=row, column=2, value=f"{student.name} {getattr(student, 'father_name', '') or ''}".strip())
            ws.cell(row=row, column=3, value=course_name)
            ws.cell(row=row, column=4, value=grade_info.get('midterm_grade', 0))
            
            if not is_midterm_only:
                ws.cell(row=row, column=5, value=grade_info.get('final_grade', 0))
            row += 1
        
        for col in range(1, len(headers) + 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 18
        
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        if email:
            subject = f"كشف درجات - {course_name}"
            body = f"""السلام عليكم،

نرفق لكم كشف الدرجات الخاص بمادة {course_name}.

مع خالص التحية،
نظام كلية طرابلس"""
            
            from django.conf import settings
            from_email = getattr(settings, 'EMAIL_HOST_USER', None) or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
            
            email_message = EmailMessage(subject, body, from_email, [email])
            filename = f"grades_{crs_id}.xlsx"
            email_message.attach(
                filename,
                output.getvalue(),
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            email_message.send()
        
        return JsonResponse({
            'success': True,
            'message': f'[OK] تم تصدير كشف {len(students_list)} طالب وإرساله إلى {email if email else "البريد"}'
        })
    
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] خطأ في التصدير والإرسال: {error_msg}")
        if '535' in error_msg or 'BadCredentials' in error_msg or 'AuthenticationError' in error_msg:
            return JsonResponse({
                'success': False,
                'message': '[ERROR] فشل إرسال البريد: كلمة مرور التطبيق (App Password) لإيميل Gmail غير صحيحة أو منتهية الصلاحية.'
            })
        return JsonResponse({'success': False, 'message': f'فشل إرسال البريد: {error_msg}'})


@login_required
@csrf_exempt
@require_execution_permission('grades.publish_grades', 'grades.change_grade', 'publish_grades', 'change_grade')
def publish_grades_api(request):
    """API: اعتماد ونشر الدرجات في الكنترول لواجهة الطالب"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        semester_id = data.get('semester_id')
        course_id = data.get('course_id')
        period = data.get('period', 'midterm')
        is_published = bool(data.get('is_published', True))
        
        if not semester_id or not course_id:
            return JsonResponse({'success': False, 'message': 'بيانات ناقصة (الفصل والمادة مطلوبان)'})
        
        # تجميع كائنات Grade ذات الصلة
        grades = Grade.objects.filter(semester_id=semester_id, course_id=course_id)
        
        # إنشاء سجلات إن لم تكن موجودة
        if not grades.exists():
            regs = CourseRegistration.objects.filter(semester_id=semester_id, course_id=course_id)
            for reg in regs:
                Grade.objects.get_or_create(
                    student=reg.student,
                    course_id=course_id,
                    semester_id=semester_id,
                    defaults={'registered_by': request.user}
                )
            grades = Grade.objects.filter(semester_id=semester_id, course_id=course_id)
            
        count = grades.count()
        
        if period == 'midterm':
            grades.update(is_midterm_published=is_published, is_published=is_published)
        elif period == 'final':
            grades.update(is_final_published=is_published, is_published=is_published)
        else:
            grades.update(is_published=is_published)
            
        if is_published:
            try:
                from apps.student.models import Notification
                student_ids = list(grades.values_list('student_id', flat=True).distinct())
                notifs = [
                    Notification(
                        student_id=s_id,
                        title="اعتماد ونشر النتائج",
                        message="تم اعتماد ونشر نتيجتك الدراسية بنجاح"
                    )
                    for s_id in student_ids if s_id
                ]
                if notifs:
                    Notification.objects.bulk_create(notifs)
            except Exception as e:
                print(f"Error creating notifications: {e}")

        status_text = "تم اعتماد ونشر نتائج المادة للطلاب بنجاح 🟢" if is_published else "تم إيقاف نشر نتائج المادة وعودتها قيد المراجعة 🟡"
        
        # [SEC] توثيق نشر/إيقاف نشر النتائج في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            crs_obj = Course.objects.filter(id=course_id).first()
            sem_obj = Semester.objects.filter(id=semester_id).first()
            crs_name = crs_obj.name if crs_obj else f"المادة #{course_id}"
            act_str = "نشر وتعميم" if is_published else "إيقاف نشر"
            log_activity(
                user=request.user,
                action='approve',
                model_name='Grade',
                object_name=f"نشر نتائج {crs_name}",
                details=f"قام المستخدِم ({request.user.get_full_name() or request.user.username}) بـ ({act_str}) نتائج فترة ({period}) للمادة ({crs_name}) بالفصل ({sem_obj}) لـ ({count}) طالب",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'is_published': is_published,
            'count': count,
            'message': f"{status_text} ({count} طالب)"
        })
    
    except Exception as e:
        print(f"[ERROR] خطأ في publish_grades_api: {str(e)}")
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def publish_results_page(request):
    """صفحة اعتماد ونشر نتائج الكنترول"""
    from apps.renewal.views import get_grade_approval_job_info
    approval_job_info = get_grade_approval_job_info()
    is_grade_approval_job_open = approval_job_info['is_grade_approval_job_open']
    grade_approval_job_message = approval_job_info['grade_approval_job_message']

    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    levels = Level.objects.all().order_by('number')
    
    context = {
        'departments': departments,
        'semesters': semesters,
        'levels': levels,
        'is_grade_approval_job_open': is_grade_approval_job_open,
        'grade_approval_job_message': grade_approval_job_message,
    }
    return render(request, 'grades/publish_results.html', context)


@login_required
def get_courses_publish_status_api(request):
    """API: جلب حالة نشر نتائج المواد وإحصائيات الرصد في الكنترول"""
    try:
        from django.db.models import Count, Q
        
        semester_id = request.GET.get('semester_id')
        department_id = request.GET.get('department_id')
        period = request.GET.get('period', 'midterm')
        search = request.GET.get('search', '').strip()
        
        def safe_int(val):
            if is_valid_filter(val):
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return None
            return None
            
        sem_id = safe_int(semester_id)
        dep_id = safe_int(department_id)
        
        courses_qs = Course.objects.all().select_related('level').prefetch_related('department')
        
        if dep_id:
            dept_course_ids = set(CourseRegistration.objects.filter(student__department_id=dep_id).values_list('course_id', flat=True)) | \
                              set(Grade.objects.filter(student__department_id=dep_id).values_list('course_id', flat=True))
            courses_qs = courses_qs.filter(Q(department__id=dep_id) | Q(id__in=dept_course_ids)).distinct()
            
        if search:
            search_norm = search.replace('إ', 'ا').replace('أ', 'ا').replace('آ', 'ا')
            courses_qs = courses_qs.filter(
                Q(code__icontains=search) | Q(name__icontains=search) |
                Q(code__icontains=search_norm) | Q(name__icontains=search_norm)
            )
            
        courses_qs = courses_qs.order_by('code')
        
        courses_data = []
        for crs in courses_qs:
            reg_qs = CourseRegistration.objects.filter(course=crs)
            grade_qs = Grade.objects.filter(course=crs)
            
            if sem_id:
                reg_qs = reg_qs.filter(semester_id=sem_id)
                grade_qs = grade_qs.filter(semester_id=sem_id)
                
            if dep_id:
                reg_qs = reg_qs.filter(student__department_id=dep_id)
                grade_qs = grade_qs.filter(student__department_id=dep_id)
                
            reg_student_ids = set(reg_qs.values_list('student_id', flat=True))
            grade_student_ids = set(grade_qs.values_list('student_id', flat=True))
            all_student_ids = reg_student_ids | grade_student_ids
            total_students = len(all_student_ids)
            
            if total_students == 0 and sem_id is not None and not search:
                continue
                
            if period == 'midterm':
                graded_count = grade_qs.filter(midterm_grade__gt=0).count()
                is_pub = grade_qs.filter(Q(is_midterm_published=True) | Q(is_published=True)).exists() if grade_qs.exists() else False
            else:
                graded_count = grade_qs.filter(Q(final_grade__gt=0) | Q(is_final_entered=True)).count()
                is_pub = grade_qs.filter(Q(is_final_published=True) | Q(is_published=True)).exists() if grade_qs.exists() else False
                
            blocked_count = grade_qs.filter(is_blocked=True).count()
            
            # تحديد التخصص / القسم الفعلي للمادة أو الطلاب المسجلين
            course_depts = list(crs.department.values_list('name', flat=True))
            if dep_id:
                sel_dept = Department.objects.filter(id=dep_id).first()
                dept_name = sel_dept.name if sel_dept else '-'
            elif course_depts:
                if len(course_depts) == 1:
                    dept_name = course_depts[0]
                elif len(course_depts) <= 2:
                    dept_name = "، ".join(course_depts)
                else:
                    dept_name = f"{course_depts[0]} (+{len(course_depts)-1})"
            elif all_student_ids:
                from apps.student.models import Student
                stu_depts = list(Student.objects.filter(id__in=all_student_ids).values_list('department__name', flat=True).distinct())
                stu_depts = [d for d in stu_depts if d]
                if len(stu_depts) == 1:
                    dept_name = stu_depts[0]
                elif stu_depts:
                    dept_name = "، ".join(stu_depts[:2])
                else:
                    dept_name = 'عام'
            else:
                dept_name = 'عام'

            full_depts = "، ".join(course_depts) if course_depts else dept_name
            
            courses_data.append({
                'course_id': crs.id,
                'course_code': crs.code,
                'course_name': crs.name,
                'department_name': dept_name,
                'department_full': full_depts,
                'level_number': crs.level.number if crs.level else '-',
                'total_students': total_students,
                'graded_count': graded_count,
                'blocked_count': blocked_count,
                'is_published': is_pub,
            })
            
        return JsonResponse({
            'success': True,
            'courses': courses_data,
            'count': len(courses_data)
        })
        
    except Exception as e:
        print(f"[ERROR] خطأ في get_courses_publish_status_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def check_lock_status_api(request):
    """API: التحقق من حالة القفل"""
    try:
        semester_id = request.GET.get('semester_id')
        course_id = request.GET.get('course_id')
        period = request.GET.get('period', 'midterm')
        
        if not semester_id or not course_id:
            return JsonResponse({'success': False, 'message': 'بيانات ناقصة'})
            
        is_locked = False
        if period == 'midterm':
            is_locked = Grade.objects.filter(semester_id=semester_id, course_id=course_id, is_midterm_locked=True).exists()
        elif period == 'final':
            is_locked = Grade.objects.filter(semester_id=semester_id, course_id=course_id, is_final_locked=True).exists()
            
        return JsonResponse({
            'success': True,
            'is_locked': is_locked
        })
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def academic_status(request):
    """عرض الحالات الأكاديمية وقيد الطلاب - يعتمد على كل السجلات المتاحة"""

    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    if is_academic_dept and user_dept:
        departments = Department.objects.filter(id=user_dept.id)
    else:
        departments = Department.objects.filter(is_active=True).order_by('name')
    semesters_qs = Semester.objects.all().order_by('-year', '-type')
    student_statuses = StudentStatus.objects.all().order_by('id')

    # ① جلب جميع الطلاب بدون أي تقييد بسنة أو فصل
    students_qs = Student.objects.all().select_related(
        'department', 'level', 'student_status'
    ).order_by('name', 'father_name')
    if is_academic_dept and user_dept:
        students_qs = students_qs.filter(department=user_dept)

    # ② بناء خريطة: student_id → آخر EnrollmentRenewal
    from apps.renewal.models import EnrollmentRenewal
    
    all_renewals = (
        EnrollmentRenewal.objects
        .select_related('semester', 'student')
        .order_by('student_id', '-semester__year', '-semester__type')
    )
    
    # نحتفظ بآخر تجديد لكل طالب فقط
    renewal_map = {}
    for renewal in all_renewals:
        sid = renewal.student_id
        if sid not in renewal_map:
            renewal_map[sid] = renewal

    # ③ بناء خريطة احتياطية: student_id → آخر CourseRegistration
    all_regs = (
        CourseRegistration.objects
        .select_related('semester', 'student')
        .order_by('student_id', '-semester__year', '-semester__type')
    )
    
    reg_map = {}
    for reg in all_regs:
        sid = reg.student_id
        if sid not in reg_map:
            reg_map[sid] = reg

    # ④ بناء قائمة بيانات الطلاب
    students_data = []
    for s in students_qs:

        # أولاً: نحاول الحصول على الفصل من EnrollmentRenewal
        semester_type    = ''
        semester_year    = ''
        semester_display = 'غير محدد'

        source_sem = None

        if s.id in renewal_map:
            source_sem = renewal_map[s.id].semester
        elif s.id in reg_map:
            source_sem = reg_map[s.id].semester

        if source_sem:
            semester_type = source_sem.type
            semester_year = str(source_sem.year)
            try:
                semester_display = f"{source_sem.get_type_display()} {source_sem.year}"
            except Exception:
                semester_display = f"{source_sem.type} {source_sem.year}"
        elif s.enrollment_semester or s.current_semester:
            sem_name = s.current_semester or s.enrollment_semester
            semester_display = str(sem_name)
            if 'ربيع' in sem_name:
                semester_type = 'spring'
            elif 'خريف' in sem_name:
                semester_type = 'fall'
            if s.enrollment_date:
                semester_year = str(s.enrollment_date.year)

        # حالة الطالب من student_status FK
        raw_status = s.student_status.name if s.student_status else 'منتظم'

        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}".strip()
        full_name = " ".join(full_name.split())

        students_data.append({
            'id':              s.student_id or str(s.id),
            'name':            full_name,
            'major':           s.department.name if s.department else 'غير محدد',
            'department_name': s.department.name if s.department else 'غير محدد',
            'dept_id':         s.department.id  if s.department else None,
            'level':           s.level.name     if s.level      else 'غير محدد',
            'semester':        semester_display,
            'season':          semester_display,
            'semester_type':   semester_type,   # "fall" / "spring" — للفلترة في JS
            'semester_year':   semester_year,   # "2024" / "2025" / ... — للفلترة في JS
            'status':          raw_status,
        })

    # ⑤ بيانات الفلاتر (الأقسام والفصول والحالات)
    departments_list = list(departments.values('id', 'name'))

    semesters_list = []
    for sem in semesters_qs:
        try:
            display = sem.get_type_display()
        except Exception:
            display = sem.type
        semesters_list.append({
            'id':           sem.id,
            'year':         sem.year,
            'type':         sem.type,
            'display_name': f"{display} {sem.year}",
        })

    statuses_list = list(student_statuses.values('id', 'name'))

    context = {
        'students_json':    json.dumps(students_data,    ensure_ascii=False),
        'semesters_json':   json.dumps(semesters_list,   ensure_ascii=False),
        'departments_json': json.dumps(departments_list, ensure_ascii=False),
        'statuses_json':    json.dumps(statuses_list,    ensure_ascii=False),
        'student_statuses': student_statuses,
        'is_academic_dept': is_academic_dept,
    }
    return render(request, 'grades/academic_status.html', context)


@login_required
def failed_students_report(request):
    """
    كشف الطلاب الراسبين والمتعثرين أكاديمياً - Dynamic Database Integration
    جلب الطلاب الراسبين مع كامل تفاصيل المواد الراسبين فيها والمعدلات التراكمية من قاعدة البيانات.
    """
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters_qs = Semester.objects.all().order_by('-year', '-type')
    
    # 1. الاستعلام عن الطلاب الذين لديهم درجات عدم اجتياز (is_passed=False)
    students_qs = Student.objects.filter(
    grade__is_passed=False
).select_related(
    'department', 'level', 'user'
).prefetch_related(
    'grade_set__course', 'grade_set__semester'
).distinct().order_by('name', 'father_name')

    # 2. الفلترة المباشرة عند تزويد GET parameters
    dept_param = request.GET.get('department') or request.GET.get('major')
    if is_valid_filter(dept_param):
        students_qs = students_qs.filter(
            Q(department__id=dept_param) | Q(department__name=dept_param)
        )
        
    search_query = request.GET.get('search') or request.GET.get('student_name')
    if search_query and str(search_query).strip():
        search_str = str(search_query).strip()
        students_qs = students_qs.filter(
            Q(name__icontains=search_str) |
            Q(student_id__icontains=search_str) |
            Q(national_id__icontains=search_str)
        )

    students_data = []
    for s in students_qs:
        all_grades = list(s.grade_set.all().select_related('course', 'semester'))
        if not all_grades:
            continue
            
        total_points = sum(g.total_grade * g.course.credits for g in all_grades if g.is_final_entered or g.is_passed)
        total_credits = sum(g.course.credits for g in all_grades if g.is_final_entered or g.is_passed)
        gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0.0
        
        # 1. تحديد المواد التي اجتازها الطالب بنجاح
        passed_course_ids = {g.course_id for g in all_grades if g.is_passed or (g.is_final_entered and g.total_grade >= 50)}
        
        # 2. تجميع درجات الطالب بحسب المادة
        course_grades_map = {}
        for g in all_grades:
            course_grades_map.setdefault(g.course, []).append(g)
            
        failed_courses = []
        sem_types = set()
        sem_years = set()
        
        for course, c_grades in course_grades_map.items():
            # إذا كان الطالب قد اجتاز المادة في أي فصل دراسي لا تُعتبر مادة متعثرة حالياً
            if course.id in passed_course_ids:
                continue
                
            # حساب عدد مرات الرسوب التاريخية والمحاولات الفعلية للمادة (1، 2، 3، إلخ)
            historical_fails = sum(1 for g in c_grades if not g.is_passed or (g.is_final_entered and g.total_grade < 50))
            max_grade_attempt = max([g.attempt_number or 1 for g in c_grades], default=1)
            reg_qs = CourseRegistration.objects.filter(student=s, course=course)
            reg_count = reg_qs.count()
            max_reg_attempt = reg_qs.aggregate(models.Max('attempt_number'))['attempt_number__max'] or 1
            
            exact_failure_count = max(historical_fails, max_grade_attempt, max_reg_attempt, reg_count, 1)
            
            # جلب آخر محاولة/فصل للمادة
            sorted_c_grades = sorted(
                c_grades, 
                key=lambda x: (x.semester.year, 1 if x.semester.type == 'fall' else 2, x.id), 
                reverse=True
            )
            latest_grade = sorted_c_grades[0]
            
            sem_types.add(latest_grade.semester.type)
            sem_years.add(str(latest_grade.semester.year))
            
            rep_status = Grade.format_repetition_text(exact_failure_count)
            
            failed_courses.append({
                'code': course.code,
                'name': course.name,
                'credits': float(course.credits),
                'season': f"{latest_grade.semester.get_type_display() if hasattr(latest_grade.semester, 'get_type_display') else latest_grade.semester.type} {latest_grade.semester.year}",
                'total': float(latest_grade.total_grade),
                'count': exact_failure_count,
                'attempt_number': exact_failure_count,
                'repetition_status': rep_status,
                'repeat_status': rep_status,
            })
            
        if not failed_courses:
            continue
            
        max_repeat_count = max(c['count'] for c in failed_courses)
        max_repeat_status = Grade.format_repetition_text(max_repeat_count)
        
        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
        full_name = " ".join(full_name.split())
        
        latest_overall_grade = sorted(
            all_grades,
            key=lambda x: (x.semester.year, 1 if x.semester.type == 'fall' else 2, x.id),
            reverse=True
        )[0]
        
        students_data.append({
            'id': s.student_id or str(s.id),
            'name': full_name,
            'major': s.department.name if s.department else 'غير محدد',
            'department_name': s.department.name if s.department else 'غير محدد',
            'dept_id': s.department.id if s.department else None,
            'level': s.level.name if s.level else 'غير محدد',
            'semester_type': latest_overall_grade.semester.type if latest_overall_grade else '',
            'semester_types': list(sem_types),
            'semester_year': str(latest_overall_grade.semester.year) if latest_overall_grade else '',
            'semester_years': list(sem_years),
            'gpa': gpa,
            'repeat': max_repeat_count,
            'max_repeat': max_repeat_count,
            'repeat_status': max_repeat_status,
            'repetition_status': max_repeat_status,
            'failedCourses': failed_courses,
        })

    departments_list = list(departments.values('id', 'name'))
    semesters_list_json = list(semesters_qs.values('id', 'year', 'type'))

    # جلب أسماء المسؤولين ديناميكياً
    from apps.users.models import get_official
    registrar_official_name = get_official('registrar', default='')
    exams_head_official_name = get_official('exams_head', default='')

    context = {
        'departments': departments,
        'semesters': semesters_qs,
        'failed_students': students_qs,
        'total_failed_count': len(students_data),
        'students_json': json.dumps(students_data, ensure_ascii=False),
        'semesters_json': json.dumps(semesters_list_json, ensure_ascii=False),
        'departments_json': json.dumps(departments_list, ensure_ascii=False),
        'registrar_official_name': registrar_official_name,
        'exams_head_official_name': exams_head_official_name,
    }

    return render(request, 'grades/failed_students.html', context)
        
# ================================================================
# API لصفحة عرض النتائج (Show Results)
# ================================================================

@login_required
def get_results_filters_api(request):
    """API: جلب الفلاتر لصفحة عرض النتائج (التخصصات، المواسم، المستويات، المواد)"""
    try:
        departments = Department.objects.filter(is_active=True).order_by('name')
        semesters = Semester.objects.all().order_by('-year', '-type')
        levels = Level.objects.all().order_by('number')
        courses = Course.objects.filter(is_active=True).prefetch_related('department').order_by('code')
        
        courses_list = []
        for c in courses:
            dept_ids = list(c.department.values_list('id', flat=True))
            courses_list.append({
                'id': c.id,
                'code': c.code,
                'name': f"{c.code} - {c.name}",
                'department_ids': dept_ids,
                'level_id': c.level_id,
            })

        return JsonResponse({
            'success': True,
            'departments': [{'id': d.id, 'name': d.name} for d in departments],
            'semesters': [{'id': s.id, 'year': s.year, 'type': s.type} for s in semesters],
            'levels': [{'id': l.id, 'number': l.number, 'name': f"المستوى {l.number}"} for l in levels],
            'courses': courses_list,
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def search_students_api(request):
    """API: البحث عن الطلاب للاقتراحات"""
    try:
        query = request.GET.get('q', '').strip()
        
        if not query:
            return JsonResponse({'success': True, 'students': []})
        
        from django.db.models import Q
        students = Student.objects.filter(
            Q(student_id__icontains=query) |
            Q(name__icontains=query) |
            Q(father_name__icontains=query) |
            Q(grandfather_name__icontains=query) |
            Q(last_name__icontains=query)
        ).select_related('department', 'level', 'student_status')[:25]
        
        data = []
        for s in students:
            st_quad = ' '.join(filter(None, [s.name, s.father_name, s.grandfather_name, s.last_name]))
            data.append({
                'id': s.id,
                'student_id': s.student_id or str(s.id),
                'name': st_quad,
                'full_name': st_quad,
                'quad_name': st_quad,
                'department': s.department.name if s.department else 'عام',
                'level': s.level.name if s.level else 'المستوى الأول',
                'status': s.student_status.name if s.student_status else 'منتظم',
            })

        return JsonResponse({
            'success': True,
            'students': data
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def get_student_results_api(request):
    """API: جلب وتصفية نتائج الطلاب بحسب المعايير (التخصص، الموسم، المستوى، المادة، ورقم القيد)"""
    try:
        from django.db.models import Q
        
        student_id = request.GET.get('student_id', '').strip()
        search_query = request.GET.get('search', '').strip() or student_id
        department_id = request.GET.get('department_id') or request.GET.get('major_id')
        semester_id = request.GET.get('semester_id') or request.GET.get('season_id')
        level_id = request.GET.get('level_id') or request.GET.get('level')
        subject_id = request.GET.get('subject_id') or request.GET.get('course_id')
        
        def safe_int(val):
            if val and str(val).strip().isdigit():
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return None
            return None

        dep_id = safe_int(department_id)
        sem_id = safe_int(semester_id)
        lvl_id = safe_int(level_id)
        sub_id = safe_int(subject_id)

        grades = Grade.objects.all().select_related(
            'student', 'course', 'semester', 
            'student__department', 'student__level',
            'course__level', 'course__study_plan'
        )
        
        if search_query:
            grades = grades.filter(
                Q(student__student_id__icontains=search_query) |
                Q(student__name__icontains=search_query) |
                Q(student__father_name__icontains=search_query) |
                Q(student__grandfather_name__icontains=search_query) |
                Q(student__last_name__icontains=search_query)
            )
            
        if dep_id:
            grades = grades.filter(Q(student__department_id=dep_id) | Q(course__department__id=dep_id)).distinct()
            
        if sem_id:
            grades = grades.filter(semester_id=sem_id)
            
        if lvl_id:
            grades = grades.filter(Q(student__level_id=lvl_id) | Q(course__level_id=lvl_id) | Q(student__level__number=lvl_id))
            
        if sub_id:
            grades = grades.filter(course_id=sub_id)

        grades = grades.order_by('student__student_id', 'course__code')[:300]

        student_info = None
        if search_query:
            single_student = Student.objects.filter(
                Q(student_id=search_query) | Q(name__icontains=search_query)
            ).first()
            if single_student:
                st_quad = ' '.join(filter(None, [
                    single_student.name,
                    single_student.father_name,
                    single_student.grandfather_name,
                    single_student.last_name,
                ]))
                student_info = {
                    'id': single_student.id,
                    'student_id': single_student.student_id,
                    'name': st_quad,
                    'full_name': st_quad,
                    'quad_name': st_quad,
                    'department': single_student.department.name if single_student.department else '-',
                    'level': single_student.level.number if single_student.level else '-',
                }

        results = []
        total_points = 0
        total_credits = 0
        passed_count = 0
        failed_count = 0

        for grade in grades:
            s = grade.student
            is_blocked = getattr(grade, 'is_blocked', False)
            reason_str = getattr(grade, 'block_reason', None) or "تجاوز نسبة الغياب الورقي"
            block_msg = f"[WARN] تم حجب نتيجة هذه المادة ({reason_str}) - يرجى مراجعة قسم الدراسة والامتحانات." if is_blocked else ""
            
            is_pub = getattr(grade, 'is_published', False) or getattr(grade, 'is_midterm_published', False) or getattr(grade, 'is_final_published', False)
            pub_msg = "لم يتم نشر نتائج هذه المادة بعد من قِبل إدارة الكنترول" if not is_pub else ""

            is_hidden = is_blocked or not is_pub

            is_final_entered = getattr(grade, 'is_final_entered', False) or (grade.final_grade is not None and grade.final_grade > 0)

            if not is_hidden and grade.is_passed and is_final_entered:
                total_points += grade.total_grade * grade.course.credits
                total_credits += grade.course.credits
                passed_count += 1
            elif not is_hidden:
                failed_count += 1

            crs_lvl = f"المستوى {grade.course.level.number}" if hasattr(grade.course, 'level') and grade.course.level else (f"المستوى {s.level.number}" if hasattr(s, 'level') and s.level else '-')

            appeal = GradeAppeal.objects.filter(student=s, course=grade.course, semester=grade.semester).first()
            appeal_status = appeal.status if appeal else None
            appeal_msg = ""
            if appeal_status == 'under_review':
                appeal_msg = "⏳ جاري مراجعة الطعن وتعديل الدرجة"
            elif appeal_status == 'completed':
                appeal_msg = "[OK] تم قبول الطعن وتعديل الدرجة"
            elif appeal_status == 'pending':
                appeal_msg = "📝 يوجد طعن مسجل قيد الانتظار"

            s_quad = ' '.join(filter(None, [s.name, s.father_name, s.grandfather_name, s.last_name])) if s else ''

            results.append({
                'grade_id': grade.id,
                'student_id': s.student_id if s else f"STU{s.id:06d}",
                'student_name': s_quad or (s.name if s else '-'),
                'quad_name': s_quad,
                'full_name': s_quad,
                'course_name': grade.course.name if grade.course else '-',
                'course_code': grade.course.code if grade.course else '-',
                'course_level': crs_lvl,
                'year': grade.semester.year,
                'semester_display': grade.semester.get_type_display(),
                'semester_type': grade.semester.type,
                'year_semester': f"{grade.semester.year} - {grade.semester.get_type_display()}",
                'midterm_grade': grade.midterm_grade if (not is_hidden and grade.midterm_grade is not None) else None,
                'final_grade': grade.final_grade if (not is_hidden and is_final_entered) else None,
                'total_grade': grade.total_grade if (not is_hidden and is_final_entered) else None,
                'is_final_entered': is_final_entered,
                'is_passed': False if is_hidden else grade.is_passed,
                'grade_letter': '--' if is_hidden else (grade.get_grade_letter() if hasattr(grade, 'get_grade_letter') else ('ناجح' if grade.is_passed else 'راسب')),
                'credits': grade.course.credits,
                'attempt_number': grade.attempt_number,
                'repetition_status': grade.repetition_status,
                'gpa': round((total_points / total_credits), 2) if total_credits > 0 else 0,
                'is_blocked': is_blocked,
                'block_reason': reason_str if is_blocked else '',
                'block_message': block_msg,
                'is_published': is_pub,
                'publish_message': pub_msg,
                'appeal_status': appeal_status,
                'appeal_message': appeal_msg,
            })

        gpa = round((total_points / total_credits), 2) if total_credits > 0 else 0

        return JsonResponse({
            'success': True,
            'student': student_info,
            'results': results,
            'total': len(results),
            'gpa': gpa,
            'total_credits': total_credits,
            'passed_count': passed_count,
            'failed_count': failed_count,
        })

    except Exception as e:
        print(f"[ERROR] خطأ في get_student_results_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


# ================================================================
# حجب وإدارة نتائج النصفي في الكنترول
# ================================================================

@login_required
def control_holds_page(request):
    """صفحة حجب وإدارة نتائج النصفي في الكنترول"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    courses = Course.objects.filter(is_active=True).order_by('code')
    levels = Level.objects.all().order_by('number')
    groups = Group.objects.all().select_related('department', 'level').order_by('name')
    
    context = {
        'departments': departments,
        'semesters': semesters,
        'courses': courses,
        'levels': levels,
        'groups': groups,
    }
    return render(request, 'grades/control_holds.html', context)


@login_required
def get_control_holds_students_api(request):
    """API: جلب الطلاب والدرجات لصفحة حجب الكنترول"""
    try:
        from django.db.models import Q
        
        semester_id = request.GET.get('semester_id')
        course_id = request.GET.get('course_id')
        department_id = request.GET.get('department_id')
        group_id = request.GET.get('group_id')
        level_id = request.GET.get('level_id')
        search = request.GET.get('search', '').strip()
        
        def safe_int(val):
            if is_valid_filter(val):
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return None
            return None
            
        sem_id = safe_int(semester_id)
        crs_id = safe_int(course_id)
        dep_id = safe_int(department_id)
        grp_id = safe_int(group_id)
        lvl_id = safe_int(level_id)
        
        registrations = CourseRegistration.objects.all().select_related(
            'student', 'course', 'semester', 'student__department', 'student__level', 'student__group'
        )
        
        if sem_id:
            registrations = registrations.filter(semester_id=sem_id)
        if crs_id:
            registrations = registrations.filter(course_id=crs_id)
        if dep_id:
            registrations = registrations.filter(student__department_id=dep_id)
        if grp_id:
            registrations = registrations.filter(student__group_id=grp_id)
        if lvl_id:
            registrations = registrations.filter(student__level_id=lvl_id)
            
        if search:
            registrations = registrations.filter(
                Q(student__student_id__icontains=search) |
                Q(student__name__icontains=search) |
                Q(student__father_name__icontains=search)
            )
            
        registrations = registrations.order_by('student__student_id')[:300]
        
        grades_map = {}
        grade_qs = Grade.objects.all()
        if sem_id:
            grade_qs = grade_qs.filter(semester_id=sem_id)
        if crs_id:
            grade_qs = grade_qs.filter(course_id=crs_id)
            
        for g in grade_qs:
            key = (g.student_id, g.course_id, g.semester_id)
            grades_map[key] = g
            
        students_data = []
        for reg in registrations:
            s = reg.student
            c = reg.course
            sem = reg.semester
            g = grades_map.get((s.id, c.id, sem.id))
            
            is_blocked = g.is_blocked if g else False
            block_reason = (g.block_reason if (g and g.block_reason) else "تجاوز نسبة الغياب الورقي")
            midterm_score = g.midterm_grade if g else 0.0
            grade_id = g.id if g else None
            
            students_data.append({
                'grade_id': grade_id,
                'student_db_id': s.id,
                'student_id': s.student_id or f"STU{s.id:06d}",
                'student_name': f"{s.name} {s.father_name or ''}".strip(),
                'department_name': s.department.name if s.department else '-',
                'level_number': s.level.number if s.level else '-',
                'group_id': s.group.id if s.group else None,
                'group_name': s.group.name if s.group else '-',
                'course_id': c.id,
                'course_code': c.code,
                'course_name': c.name,
                'semester_id': sem.id,
                'midterm_score': midterm_score,
                'is_blocked': is_blocked,
                'block_reason': block_reason,
            })
            
        return JsonResponse({
            'success': True,
            'students': students_data,
            'count': len(students_data)
        })
        
    except Exception as e:
        print(f"[ERROR] خطأ في get_control_holds_students_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('grades.change_grade', 'change_grade')
def toggle_block_grade_api(request):
    """API: تبديل حالة الحجب لدرجة طالب في الكنترول"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
        
    try:
        data = json.loads(request.body)
        student_db_id = data.get('student_db_id') or data.get('student_id')
        course_id = data.get('course_id')
        semester_id = data.get('semester_id')
        grade_id = data.get('grade_id')
        is_blocked = bool(data.get('is_blocked', False))
        block_reason = data.get('block_reason') or "تجاوز نسبة الغياب الورقي"
        
        grade = None
        if grade_id:
            grade = Grade.objects.filter(id=grade_id).first()
            
        if not grade:
            if not student_db_id or not course_id or not semester_id:
                return JsonResponse({'success': False, 'message': 'بيانات ناقصة لتحديد الطالب والمادة'})
                
            student = Student.objects.filter(models.Q(id=student_db_id) | models.Q(student_id=student_db_id)).first()
            if not student:
                return JsonResponse({'success': False, 'message': 'الطالب غير موجود'})
                
            grade, _ = Grade.objects.get_or_create(
                student=student,
                course_id=course_id,
                semester_id=semester_id,
                defaults={
                    'registered_by': request.user,
                }
            )
            
        grade.is_blocked = is_blocked
        grade.block_reason = block_reason.strip() if block_reason else "تجاوز نسبة الغياب الورقي"
        grade.updated_by = request.user
        grade.save()

        # [SEC] تسجيل العملية في سجل الأحداث والتدقيق
        action_type = 'block_result' if grade.is_blocked else 'unblock_result'
        student_name = grade.student.name if (grade.student and hasattr(grade.student, 'name')) else f"الطالب #{student_db_id}"
        course_name = grade.course.name if (grade.course and hasattr(grade.course, 'name')) else f"المادة #{course_id}"
        details_text = f"حجب نتيجة الطالب ({student_name}) في مادة ({course_name}) بسبب: {grade.block_reason}" if grade.is_blocked else f"فك حجب نتيجة الطالب ({student_name}) في مادة ({course_name})"

        try:
            log_activity(
                user=request.user,
                action=action_type,
                model_name='Grade',
                object_name=f"درجة مادة {course_name} - {student_name}",
                details=details_text,
                request=request
            )
        except Exception as log_err:
            print(f"[WARN] Error logging block_result activity: {log_err}")
        
        status_msg = f"تم حجب نتيجة المادة للمعني بنجاح ({grade.block_reason}) 🔒" if grade.is_blocked else "تم فك حجب نتيجة المادة بنجاح [OK]"
        
        return JsonResponse({
            'success': True,
            'grade_id': grade.id,
            'is_blocked': grade.is_blocked,
            'block_reason': grade.block_reason,
            'message': status_msg
        })
        
    except Exception as e:
        print(f"[ERROR] خطأ في toggle_block_grade_api: {str(e)}")
        return JsonResponse({'success': False, 'message': str(e)})


# ================================================================
# منظومة إدارة طعون النتائج وتعديل الدرجات (Grade Appeals)
# ================================================================

@login_required
def grade_appeals_page(request):
    """صفحة إدارة طعون النتائج وتعديل الدرجات"""
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    levels = Level.objects.all().order_by('number')
    courses = Course.objects.filter(is_active=True).order_by('code')
    
    context = {
        'departments': departments,
        'semesters': semesters,
        'levels': levels,
        'courses': courses,
    }
    return render(request, 'grades/grade_appeals.html', context)


@login_required
def get_appeals_api(request):
    """API: جلب وتصفية قائمة طعون النتائج في الكنترول"""
    try:
        from django.db.models import Q
        
        semester_id = request.GET.get('semester_id')
        department_id = request.GET.get('department_id')
        level_id = request.GET.get('level_id')
        course_id = request.GET.get('course_id')
        status = request.GET.get('status', '').strip()
        search = request.GET.get('search', '').strip()
        
        def safe_int(val):
            if is_valid_filter(val):
                try:
                    return int(val)
                except (ValueError, TypeError):
                    return None
            return None

        sem_id = safe_int(semester_id)
        dep_id = safe_int(department_id)
        lvl_id = safe_int(level_id)
        crs_id = safe_int(course_id)

        appeals = GradeAppeal.objects.all().select_related(
            'student', 'course', 'semester', 'student__department', 'student__level', 'reviewed_by', 'grade'
        )

        if sem_id:
            appeals = appeals.filter(semester_id=sem_id)
        if dep_id:
            appeals = appeals.filter(student__department_id=dep_id)
        if lvl_id:
            appeals = appeals.filter(student__level_id=lvl_id)
        if crs_id:
            appeals = appeals.filter(course_id=crs_id)
        if status:
            appeals = appeals.filter(status=status)

        if search:
            appeals = appeals.filter(
                Q(student__student_id__icontains=search) |
                Q(student__name__icontains=search) |
                Q(student__father_name__icontains=search) |
                Q(course__code__icontains=search) |
                Q(course__name__icontains=search)
            )

        appeals = appeals.order_by('-created_at')[:300]

        appeals_data = []
        for app in appeals:
            s = app.student
            c = app.course
            g = app.grade

            appeals_data.append({
                'appeal_id': app.id,
                'student_id': s.student_id or f"STU{s.id:06d}",
                'student_name': f"{s.name} {s.father_name or ''}".strip(),
                'department_name': s.department.name if s.department else '-',
                'level_number': s.level.number if s.level else '-',
                'course_id': c.id,
                'course_code': c.code,
                'course_name': c.name,
                'semester_id': app.semester.id,
                'semester_display': f"{app.semester.year} - {app.semester.get_type_display()}",
                'appeal_type': app.appeal_type,
                'appeal_type_display': app.get_appeal_type_display(),
                'status': app.status,
                'status_display': app.get_status_display(),
                'current_midterm_grade': g.midterm_grade if g else 0.0,
                'current_final_grade': g.final_grade if g else 0.0,
                'old_midterm_grade': app.old_midterm_grade,
                'new_midterm_grade': app.new_midterm_grade,
                'old_final_grade': app.old_final_grade,
                'new_final_grade': app.new_final_grade,
                'notes': app.notes or '',
                'reviewed_by': app.reviewed_by.get_full_name() or app.reviewed_by.username if app.reviewed_by else '-',
                'created_at': app.created_at.strftime('%Y-%m-%d %H:%M'),
            })

        return JsonResponse({
            'success': True,
            'appeals': appeals_data,
            'count': len(appeals_data)
        })
    except Exception as e:
        print(f"[ERROR] خطأ في get_appeals_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('grades.change_gradeappeal', 'grades.change_grade', 'change_gradeappeal', 'change_grade')
def create_appeal_api(request):
    """API: تسجيل طعن ورقي حضوري جديد من الكنترول"""
    try:
        import json
        data = json.loads(request.body.decode('utf-8'))
        
        student_query = data.get('student_id')
        course_id = data.get('course_id')
        semester_id = data.get('semester_id')
        appeal_type = data.get('appeal_type', 'midterm')
        notes = data.get('notes', '')

        if not student_query or not course_id or not semester_id:
            return JsonResponse({'success': False, 'message': 'يرجى تحديد الطالب والمادة والفصل الدراسي'})

        student = Student.objects.filter(
            models.Q(student_id=student_query) | models.Q(id=student_query) | models.Q(name__icontains=student_query)
        ).first()

        if not student:
            return JsonResponse({'success': False, 'message': 'الطالب المطلوب غير موجود'})

        course = Course.objects.filter(id=course_id).first()
        semester = Semester.objects.filter(id=semester_id).first()

        if not course or not semester:
            return JsonResponse({'success': False, 'message': 'المادة أو الفصل الدراسي غير صحيح'})

        grade, _ = Grade.objects.get_or_create(
            student=student,
            course=course,
            semester=semester,
            defaults={'registered_by': request.user}
        )

        appeal, created = GradeAppeal.objects.get_or_create(
            student=student,
            course=course,
            semester=semester,
            defaults={
                'grade': grade,
                'appeal_type': appeal_type,
                'status': 'pending',
                'old_midterm_grade': grade.midterm_grade,
                'old_final_grade': grade.final_grade,
                'notes': notes,
                'reviewed_by': request.user,
            }
        )

        if not created:
            appeal.status = 'pending'
            appeal.appeal_type = appeal_type
            appeal.notes = notes
            appeal.old_midterm_grade = grade.midterm_grade
            appeal.old_final_grade = grade.final_grade
            appeal.reviewed_by = request.user
            appeal.save()

        # [SEC] توثيق تقديم/إثبات طعن جديد في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='create',
                model_name='GradeAppeal',
                object_name=f"طعن الطالب {student.name}",
                details=f"تسجيل وإثبات طعن ورقي جديد للطالب ({student.name}) برقم قيد ({student.student_id}) للمادة ({course.name}) - فترة ({appeal_type})",
                request=request
            )
        except Exception:
            pass

        # [NOTIF] إشعار فوري للطالب بتسجيل الطعن وتوجيهه لكشف الدرجات
        try:
            from apps.student.models import Notification
            Notification.create_notification(
                student=student,
                title=f"📝 تسجيل طعن نتيجة: {course.name}",
                message=f"تم إثبات وتسجيل طعنك في مقرر ({course.name}) لفترة ({appeal.get_appeal_type_display()}) بنجاح، والطلب الآن قيد المراجعة.",
                notification_type='grade_appeal',
                icon='fact_check',
                link='/student/term-result/',
                target_role='student'
            )
        except Exception as notif_err:
            print(f"[WARN] Error creating appeal notification: {notif_err}")

        return JsonResponse({
            'success': True,
            'appeal_id': appeal.id,
            'message': 'تم إثبات وتسجيل الطعن الورقي للطلب بنجاح 📝'
        })
    except Exception as e:
        print(f"[ERROR] خطأ في create_appeal_api: {str(e)}")
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('grades.change_gradeappeal', 'grades.change_grade', 'change_gradeappeal', 'change_grade')
def update_appeal_status_api(request):
    """API: تغيير حالة الطعن (مثلاً: جاري المراجعة والتعديل)"""
    try:
        import json
        data = json.loads(request.body.decode('utf-8'))
        
        appeal_id = data.get('appeal_id')
        new_status = data.get('status')

        if not appeal_id or not new_status:
            return JsonResponse({'success': False, 'message': 'بيانات الطلب غير مكتملة'})

        appeal = GradeAppeal.objects.filter(id=appeal_id).select_related('student', 'course', 'semester').first()
        if not appeal:
            return JsonResponse({'success': False, 'message': 'الطعن غير موجود'})

        appeal.status = new_status
        appeal.reviewed_by = request.user
        appeal.save()

        status_msg_map = {
            'under_review': 'تم قبول الطعن وبدء المراجعة والتعديل ⏳',
            'completed': 'تم قبول الطعن واعتماد تعديل الدرجة بنجاح [OK]',
            'rejected': 'تم رفض الطعن [ERROR]',
            'pending': 'تم إرجاع الطعن إلى قيد الانتظار 📝',
        }

        # [SEC] توثيق تغيير حالة الطعن في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='GradeAppeal',
                object_name=f"طعن #{appeal.id}",
                details=f"تعديل حالة الطعن للطلب (#{appeal.id}) للطالب ({appeal.student.name}) إلى ({new_status})",
                request=request
            )
        except Exception:
            pass

        # [NOTIF] إشعار فوري للطالب بتحديث حالة طعنه مع رابط مباشر لصفحة النتيجة
        try:
            from apps.student.models import Notification
            status_title_map = {
                'under_review': '⏳ قبول وبدء مراجعة وتعديل الطعن',
                'completed': '[OK] تم قبول الطعن واعتماد التعديل',
                'rejected': '[ERROR] مراجعة طعن النتيجة',
                'pending': '📝 متابعة طعن النتيجة',
            }
            status_desc_map = {
                'under_review': f"تم قبول طلب طعنك لمادة ({appeal.course.name}) وبدء إجراءات المراجعة والتعديل لدى الكنترول.",
                'completed': f"تم قبول طعنك لمادة ({appeal.course.name}) وتعديل الدرجة واعتمادها في كشفك بنجاح.",
                'rejected': f"تمت مراجعة طعنك لمادة ({appeal.course.name}) من قبل الكنترول وتثبيت الدرجة الأصلية.",
                'pending': f"طلب طعنك لمادة ({appeal.course.name}) قيد المراجعة والانتظار لدى الكنترول.",
            }
            notif_title = f"{status_title_map.get(new_status, 'تحديث حالة الطعن')}: {appeal.course.name}"
            notif_desc = status_desc_map.get(new_status, f"تم تغيير حالة طعنك لمادة ({appeal.course.name}) إلى ({appeal.get_status_display()}).")
            
            Notification.create_notification(
                student=appeal.student,
                title=notif_title,
                message=notif_desc,
                notification_type='grade_appeal',
                icon='fact_check',
                link='/student/term-result/',
                target_role='student'
            )
        except Exception as notif_err:
            print(f"[WARN] Error creating appeal status notification: {notif_err}")

        return JsonResponse({
            'success': True,
            'status': appeal.status,
            'status_display': appeal.get_status_display(),
            'badge_info': appeal.get_status_badge_info(),
            'message': status_msg_map.get(new_status, 'تم تحديث حالة الطعن بنجاح')
        })
    except Exception as e:
        print(f"[ERROR] خطأ في update_appeal_status_api: {str(e)}")
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
@require_execution_permission('grades.change_gradeappeal', 'grades.change_grade', 'change_gradeappeal', 'change_grade')
def update_appeal_grade_api(request):
    """API: تعديل الدرجة ورصدها وإكمال الطعن (تم تعديل ورصد)"""
    from apps.renewal.views import get_grade_appeals_job_info
    appeals_job_info = get_grade_appeals_job_info()
    if not appeals_job_info['is_grade_appeals_job_open']:
        return JsonResponse({'success': False, 'message': appeals_job_info['grade_appeals_job_message']}, status=403)

    try:
        import json
        data = json.loads(request.body.decode('utf-8'))
        
        appeal_id = data.get('appeal_id')
        new_midterm = data.get('new_midterm_grade')
        new_final = data.get('new_final_grade')
        notes = data.get('notes')

        if not appeal_id:
            return JsonResponse({'success': False, 'message': 'معرف الطعن مطلوب'})

        appeal = GradeAppeal.objects.filter(id=appeal_id).select_related('student', 'course', 'semester').first()
        if not appeal:
            return JsonResponse({'success': False, 'message': 'الطعن غير موجود'})

        grade = appeal.grade
        if not grade:
            grade, _ = Grade.objects.get_or_create(
                student=appeal.student,
                course=appeal.course,
                semester=appeal.semester,
                defaults={'registered_by': request.user}
            )
            appeal.grade = grade

        appeal.old_midterm_grade = grade.midterm_grade
        appeal.old_final_grade = grade.final_grade

        has_grade_change = False
        if new_midterm is not None and new_midterm != '':
            val_m = float(new_midterm)
            grade.midterm_grade = val_m
            appeal.new_midterm_grade = val_m
            grade.is_midterm_published = True
            has_grade_change = True

        if new_final is not None and new_final != '':
            val_f = float(new_final)
            grade.final_grade = val_f
            grade.is_final_entered = True
            grade.is_final_published = True
            appeal.new_final_grade = val_f
            has_grade_change = True

        # التأكد من نشر واعتماد الدرجة فوراً لتظهر للطالب في كشف درجاته وسجله الأكاديمي
        if grade.is_final_entered or grade.is_final_published or grade.is_midterm_published:
            grade.is_published = True

        grade.updated_by = request.user
        grade.calculate_total_grade()
        grade.save()

        appeal.status = 'completed'
        if notes:
            appeal.notes = notes
        appeal.reviewed_by = request.user
        appeal.save()

        # تحديث السجل الفصلي والسجل الأكاديمي التراكمي للطالب فوراً
        try:
            from apps.student.models import SemesterRecord, AcademicRecord
            if grade.student and grade.semester:
                sem_rec, _ = SemesterRecord.objects.get_or_create(
                    student=grade.student,
                    semester=grade.semester
                )
                sem_rec.calculate_semester_record()
                sem_rec.save()

            if grade.student:
                acad_rec, _ = AcademicRecord.objects.get_or_create(
                    student=grade.student
                )
                acad_rec.calculate_cumulative_record()
                acad_rec.save()
        except Exception as rec_err:
            logger.warning(f"Error recalculating academic records after appeal approval: {rec_err}")

        GradeHistory.objects.create(
            grade=grade,
            old_midterm_grade=appeal.old_midterm_grade or 0.0,
            new_midterm_grade=grade.midterm_grade,
            old_final_grade=appeal.old_final_grade or 0.0,
            new_final_grade=grade.final_grade,
            old_practical_grade=grade.practical_grade,
            new_practical_grade=grade.practical_grade,
            changed_by=request.user,
            reason=f"قبول طعن النتيجة ورصد الدرجة المعدلة (#{appeal.id})"
        )

        # [SEC] توثيق البت في الطعن وتعديل الدرجة في سجل الأحداث
        try:
            from apps.users.utils import log_activity
            log_activity(
                user=request.user,
                action='update',
                model_name='GradeAppeal',
                object_name=f"قبول طعن {appeal.student.name}",
                details=f"البت في الطعن (#{appeal.id}) للطالب ({appeal.student.name}) وتعديل الدرجات إلى نصفي: ({grade.midterm_grade})، نهائي: ({grade.final_grade})، المجموع: ({grade.total_grade})",
                request=request
            )
        except Exception:
            pass

        # [NOTIF] إشعار فوري للطالب باعتماد قبول الطعن وتعديل الدرجة مع رابط مباشر لكشف الدرجات
        try:
            from apps.student.models import Notification
            grade_info = f"المجموع: {grade.total_grade} ({grade.get_grade_letter()})"
            Notification.create_notification(
                student=appeal.student,
                title=f"[OK] قبول وتعديل طعن: {appeal.course.name}",
                message=f"تم قبول طعنك في مقرر ({appeal.course.name}) وتعديل ورصد الدرجة في كشفك الأكاديمي بنجاح [{grade_info}].",
                notification_type='grade_appeal',
                icon='fact_check',
                link='/student/term-result/',
                target_role='student'
            )
        except Exception as notif_err:
            print(f"[WARN] Error creating appeal grade completion notification: {notif_err}")

        return JsonResponse({
            'success': True,
            'status': appeal.status,
            'midterm_grade': grade.midterm_grade,
            'final_grade': grade.final_grade,
            'total_grade': grade.total_grade,
            'is_passed': grade.is_passed,
            'letter_grade': grade.get_grade_letter(),
            'message': 'تم حفظ وتعديل الدرجة ورصدها بنجاح 🟢 وتحديث كشف الطالب وسجله الأكاديمي تلقائياً'
        })
    except Exception as e:
        print(f"[ERROR] خطأ في update_appeal_grade_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
def course_equivalence_rules(request):
    """
    صفحة وإدارة قواعد معادلة المواد الدراسية
    تسمح بإضافة وتحديد المواد البديلة/المكافئة وربطها بتخصص المصدر وتخصص الوجهة وعرض الجدول التفاعلي.
    """
    courses = Course.objects.all().order_by('code')
    departments = Department.objects.filter(is_active=True).order_by('name')
    selected_source_dept = request.GET.get('source_department', '')
    selected_target_dept = request.GET.get('target_department', '')
    error_msg = None

    if request.method == 'POST':
        if not has_execution_perm(request.user, 'renewal.add_courseequivalence', 'renewal.change_courseequivalence', 'add_courseequivalence', 'change_courseequivalence'):
            error_msg = '[WARN] غير مصرح لك بإضافة أو تعديل قواعد المعادلة (صلاحيات العرض فقط).'
        else:
            rule_id = request.POST.get('rule_id')
            src_dept_id = request.POST.get('source_department')
            tgt_dept_id = request.POST.get('target_department')
            source_id = request.POST.get('source_course')
            target_id = request.POST.get('target_course')
            notes = request.POST.get('notes', '').strip()

            source_department = Department.objects.filter(id=src_dept_id).first() if src_dept_id else None
            target_department = Department.objects.filter(id=tgt_dept_id).first() if tgt_dept_id else None

            if not source_id or not target_id:
                error_msg = '[WARN] يرجى اختيار المادة الأصلية والمادة المكافئة.'
            elif source_id == target_id and source_department == target_department:
                error_msg = '[WARN] لا يمكن اختيار نفس المادة ونفس التخصص كقاعدة معادلة لنفسها.'
            else:
                source_course = Course.objects.filter(id=source_id).first()
                target_course = Course.objects.filter(id=target_id).first()

                if not source_course or not target_course:
                    error_msg = '[WARN] المادة المختارة غير موجودة في النظام.'
                else:
                    existing_query = CourseEquivalence.objects.filter(
                        source_department=source_department,
                        source_course=source_course,
                        target_department=target_department,
                        target_course=target_course
                    )
                    if rule_id:
                        existing_query = existing_query.exclude(id=rule_id)

                    if existing_query.exists():
                        src_name = source_department.name if source_department else 'عام'
                        tgt_name = target_department.name if target_department else 'عام'
                        error_msg = f'[WARN] قاعدة المعادلة بين {source_course.code} ({src_name}) و {target_course.code} ({tgt_name}) مسجلة مسبقاً.'
                    else:
                        if rule_id:
                            rule = CourseEquivalence.objects.filter(id=rule_id).first()
                            if rule:
                                rule.source_department = source_department
                                rule.source_course = source_course
                                rule.target_department = target_department
                                rule.target_course = target_course
                                rule.notes = notes
                                rule.save()

                                # [SEC] توثيق تعديل قاعدة معادلة في سجل الأحداث
                                try:
                                    from apps.users.utils import log_activity
                                    log_activity(
                                        user=request.user,
                                        action='update',
                                        model_name='CourseEquivalence',
                                        object_name=f"{source_course.code} ⬅️ {target_course.code}",
                                        details=f"تعديل قاعدة المعادلة للمادة ({source_course.name} - {source_department.name if source_department else 'عام'}) بالمادة المكافئة ({target_course.name} - {target_department.name if target_department else 'عام'})",
                                        request=request
                                    )
                                except Exception:
                                    pass

                                messages.success(request, f'[OK] تم تعديل قاعدة المعادلة بنجاح: {source_course.code} ⬅️ {target_course.code}')
                            else:
                                error_msg = '[WARN] لم يتم العثور على قاعدة المعادلة المراد تعديلها.'
                        else:
                            CourseEquivalence.objects.create(
                                source_department=source_department,
                                source_course=source_course,
                                target_department=target_department,
                                target_course=target_course,
                                notes=notes
                            )
                            
                            # [SEC] توثيق إضافة قاعدة معادلة في سجل الأحداث
                            try:
                                from apps.users.utils import log_activity
                                log_activity(
                                    user=request.user,
                                    action='create',
                                    model_name='CourseEquivalence',
                                    object_name=f"{source_course.code} ⬅️ {target_course.code}",
                                    details=f"إضافة قاعدة معادلة جديدة من ({source_course.name} - {source_department.name if source_department else 'عام'}) إلى ({target_course.name} - {target_department.name if target_department else 'عام'})",
                                    request=request
                                )
                            except Exception:
                                pass

                            messages.success(request, f'[OK] تم إضافة قاعدة المعادلة بنجاح: {source_course.code} ⬅️ {target_course.code}')

    rules = CourseEquivalence.objects.select_related('source_department', 'target_department', 'source_course', 'target_course').all().order_by('-created_at')
    if selected_source_dept:
        rules = rules.filter(source_department_id=selected_source_dept)
    if selected_target_dept:
        rules = rules.filter(target_department_id=selected_target_dept)

    context = {
        'courses': courses,
        'departments': departments,
        'selected_source_dept': selected_source_dept,
        'selected_target_dept': selected_target_dept,
        'rules': rules,
        'total_rules': rules.count(),
        'error_msg': error_msg,
    }
    return render(request, 'grades/course_equivalence_rules.html', context)


@login_required
@require_execution_permission('renewal.add_courseequivalence', 'renewal.change_courseequivalence', 'add_courseequivalence', 'change_courseequivalence')
def delete_course_equivalence_rule(request, rule_id):
    """حذف قاعدة معادلة مادة"""
    from django.shortcuts import redirect
    rule = get_object_or_404(CourseEquivalence, id=rule_id)
    source_code = rule.source_course.code
    target_code = rule.target_course.code
    rule.delete()
    
    # [SEC] توثيق حذف قاعدة معادلة في سجل الأحداث
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user,
            action='delete',
            model_name='CourseEquivalence',
            object_name=f"{source_code} ⬅️ {target_code}",
            details=f"حذف قاعدة المعادلة بين المادة ({source_code}) والمادة ({target_code})",
            request=request
        )
    except Exception:
        pass

    messages.success(request, f'🗑️ تم حذف قاعدة المعادلة بين {source_code} و {target_code} بنجاح.')
    return redirect('grades:course_equivalence_rules')


@transaction.atomic
def process_student_track_change(student, target_dept, user):
    """
    دالة آمنة وموحدة لعملية تغيير مسار الطالب وفق الضوابط الأكاديمية:
    1. تصفية وإسقاط جميع تسجيلات المواد القديمة غير المجتازة (CourseRegistration).
    2. حذف وتطهير أي درجات غير معتمدة أو غير مجتازة (is_passed=False) تعود لمواد التخصص القديم.
    3. ترحيل درجات المواد المشتركة والمعادلة بالنص وبنفس الدرجات الحقيقية للطالب إلى التخصص الجديد.
    4. إعادة احتساب السجل الأكاديمي والـ GPA ليقتصر حصراً على خطة التخصص الجديد.
    5. تحديث قيد المرة الواحدة وتوثيق العملية في سجل الأحداث.
    """
    from apps.student.models import AcademicRecord
    old_dept_name = student.department.name if student.department else "غير محدد"
    active_semester = Semester.objects.filter(is_active=True).first()

    # 1. 🧹 تصفية وإسقاط جميع تسجيلات المواد الحالية للطالب في التخصص القديم
    deleted_count, _ = CourseRegistration.objects.filter(student=student).delete()
    
    # 2. 🧹 حذف أي درجات غير مجتازة (is_passed=False) من التخصص القديم حتى لا تلاحق الطالب في تخصصه الجديد
    deleted_grades_count, _ = Grade.objects.filter(student=student, is_passed=False).delete()
    logger.info(f"🧹 تم حذف {deleted_count} تسجيل و {deleted_grades_count} درجة غير مجتازة للطالب {student.student_id}")

    # 3. 🔄 ترحيل درجات المواد المشتركة والمعادلة (المواد المجتازة فقط is_passed=True)
    passed_grades = Grade.objects.filter(student=student, is_passed=True).select_related('course')
    passed_course_ids = [g.course_id for g in passed_grades if g.course]

    mapped_target_course_ids = set()

    # أ) خريطة الرموز المتطابقة بين التخصصين (Same Course Code Mapping)
    target_dept_courses = Course.objects.filter(department=target_dept, is_active=True)
    target_code_map = {c.code.strip().upper(): c for c in target_dept_courses}

    for g in passed_grades:
        if not g.course:
            continue
        old_code = g.course.code.strip().upper()
        if old_code in target_code_map:
            target_course = target_code_map[old_code]
            Grade.objects.update_or_create(
                student=student,
                course=target_course,
                defaults={
                    'semester': g.semester,
                    'midterm_grade': g.midterm_grade,
                    'final_grade': g.final_grade,
                    'total_grade': g.total_grade,
                    'is_passed': True,
                    'notes': f'معادلة آلية - ترحيل درجات سابقة من قسم ({old_dept_name})'
                }
            )
            mapped_target_course_ids.add(target_course.id)

    # ب) قواعد المعادلة الرسمية من CourseEquivalence المخصصة للتخصصات أو العامة
    eq_rules = CourseEquivalence.objects.filter(
        source_course_id__in=passed_course_ids
    ).filter(
        Q(source_department=student.department) | Q(source_department__isnull=True)
    ).filter(
        Q(target_department=target_dept) | Q(target_department__isnull=True)
    ).select_related('source_department', 'target_department', 'source_course', 'target_course')

    for eq in eq_rules:
        src_grade = passed_grades.filter(course_id=eq.source_course_id).first()
        if src_grade:
            Grade.objects.update_or_create(
                student=student,
                course=eq.target_course,
                defaults={
                    'semester': src_grade.semester,
                    'midterm_grade': src_grade.midterm_grade,
                    'final_grade': src_grade.final_grade,
                    'total_grade': src_grade.total_grade,
                    'is_passed': True,
                    'notes': f'معادلة آلية من مادة ({eq.source_course.code}) - قسم ({old_dept_name})'
                }
            )
            mapped_target_course_ids.add(eq.target_course.id)

    # 4. 🎯 تحديث التخصص وقيد تغيير المسار وتوثيق التخصص السابق
    original_dept_tag = f"[PREVIOUS_DEPT:{old_dept_name}]"
    existing_notes = student.notes or ''
    if original_dept_tag not in existing_notes:
        student.notes = f"{existing_notes}\n{original_dept_tag}".strip()

    student.department = target_dept
    student.has_changed_major = True
    student.major_change_count = (getattr(student, 'major_change_count', 0) or 0) + 1
    student.save(update_fields=['department', 'has_changed_major', 'major_change_count', 'notes'])

    # إعادة احتساب السجل الأكاديمي والـ GPA للتخصص الجديد
    academic_rec, _ = AcademicRecord.objects.get_or_create(student=student)
    academic_rec.calculate_cumulative_record()
    academic_rec.save()

    # 5. [SEC] تسجيل في سجل الأنشطة (Audit Log)
    try:
        log_activity(
            user=user,
            action=f"تغيير مسار الطالب {student.name} ({student.student_id}) من قسم ({old_dept_name}) إلى ({target_dept.name}). تم إسقاط تسجيلات القسم القديم ({deleted_count}) وتجهيز ملف الطالب للتخصص الجديد.",
            category="ACADEMIC"
        )
    except Exception:
        pass

    return {
        'success': True,
        'old_dept_name': old_dept_name,
        'target_dept_name': target_dept.name,
        'deleted_count': deleted_count,
        'equivalenced_count': len(mapped_target_course_ids),
    }


@login_required
def course_equivalence_page(request):
    """
    المرحلة الثانية: صفحة تغيير المسار واحتساب معادلة المواد للطالب
    """
    from apps.renewal.views import get_course_equivalence_job_info
    from apps.renewal.models import EnrollmentRenewal
    equivalence_job_info = get_course_equivalence_job_info()
    is_equivalence_job_open = equivalence_job_info['is_equivalence_job_open']
    equivalence_job_message = equivalence_job_info['equivalence_job_message']

    departments = Department.objects.filter(is_active=True).order_by('name')
    active_semester = Semester.objects.filter(is_active=True).first()
    search_query = request.GET.get('search', '').strip()
    selected_student_id = request.GET.get('student_id', '').strip() or request.POST.get('student_id', '').strip()
    new_dept_id = request.GET.get('new_department', '').strip() or request.POST.get('new_department', '').strip() or request.POST.get('target_department', '').strip()

    if not search_query and selected_student_id:
        search_query = selected_student_id

    student = None
    passed_grades = []
    equivalenced_courses = []
    remaining_courses = []
    can_auto_transfer = True
    has_already_changed = False
    level_warning = None
    limit_warning = None
    selected_new_dept = None
    matching_students = []

    # 1. البحث الدقيق أو المرن عن الطالب
    if selected_student_id:
        student = Student.objects.filter(
            Q(student_id=selected_student_id) | (Q(id=int(selected_student_id)) if selected_student_id.isdigit() else Q(id=-1))
        ).select_related('department', 'level', 'group', 'student_status').first()
    elif search_query:
        # فحص إن كان البحث مطابقاً تماماً لرقم قيد كامل
        exact_student = Student.objects.filter(
            Q(student_id__iexact=search_query) | (Q(id=int(search_query)) if (search_query.isdigit() and len(search_query) >= 5) else Q(id=-1))
        ).select_related('department', 'level', 'group', 'student_status').first()

        if exact_student:
            student = exact_student
        else:
            q_filter = (
                Q(student_id__icontains=search_query) | 
                Q(name__icontains=search_query) | 
                Q(father_name__icontains=search_query) | 
                Q(last_name__icontains=search_query)
            )
            candidates = list(Student.objects.filter(q_filter).select_related('department', 'level', 'group', 'student_status')[:30])
            if len(candidates) == 1:
                student = candidates[0]
            elif len(candidates) > 1:
                matching_students = candidates
            else:
                student = None

    student_eligibility = {'is_allowed': True, 'status_category': 'none', 'error_message': None, 'allow_reports': True}
    is_withdrawn = False
    if student:
        if not search_query:
            search_query = student.student_id or str(student.id)
        if not selected_student_id:
            selected_student_id = student.student_id or str(student.id)
        from apps.student.utils import check_student_academic_eligibility
        student_eligibility = check_student_academic_eligibility(student, action_type='major_change')
        st_status_name = student.student_status.name if student.student_status else ""
        if (
            student_eligibility.get('status_category') == 'blocked' or
            not student_eligibility.get('allow_reports', True) or
            any(kw in st_status_name for kw in ['سحب', 'مسحوب', 'إخلاء', 'مفصول'])
        ):
            is_withdrawn = True

    allow_print = bool(student) and (not is_withdrawn) and student_eligibility.get('allow_reports', True)

    # 2. فحص قيد تغيير المسار السابق للطالب
    if student:
        has_already_changed = getattr(student, 'has_changed_major', False) or (getattr(student, 'major_change_count', 0) >= 1)
        if has_already_changed:
            limit_warning = "[WARN] تنبيه: الطالب استنفد الحد المسموح به لتغيير المسار (مسموح بمرة واحدة فقط)."

    # 3. اعتماد تغيير المسار وتحديث سجل الطالب عبر POST
    if request.method == 'POST' and student:
        if not has_execution_perm(request.user, 'renewal.add_courseequivalence', 'renewal.change_courseequivalence', 'add_courseequivalence', 'change_courseequivalence'):
            messages.error(request, '[STOP] غير مصرح لك باعتماد المعادلة وتغيير المسار (صلاحيات العرض فقط).')
        elif not is_equivalence_job_open:
            messages.error(request, equivalence_job_message)
        elif not student_eligibility['is_allowed']:
            messages.error(request, student_eligibility['error_message'])
        else:
            action = request.POST.get('action')
            target_dept_id = request.POST.get('target_department')
            if action == 'confirm_transfer' and target_dept_id:
                if has_already_changed:
                    messages.error(request, "[STOP] عذراً: هذا الطالب قام بتغيير مساره وتخصصه مسبقاً (مسموح بمرة واحدة فقط طوال فترة الدراسة).")
                else:
                    target_dept = Department.objects.filter(id=target_dept_id).first()
                    if target_dept:
                        selected_new_dept = target_dept
                        new_dept_id = str(target_dept.id)
                        try:
                            res = process_student_track_change(student, target_dept, request.user)
                            
                            # [SEC] توثيق تغيير المسار ومعادلة المواد للطالب في سجل الأحداث
                            try:
                                from apps.users.utils import log_activity
                                log_activity(
                                    user=request.user,
                                    action='update',
                                    model_name='Student',
                                    object_name=f"{student.name} ({student.student_id})",
                                    details=f"اعتماد تغيير مسار الطالب ({student.name}) من قسم ({res['old_dept_name']}) إلى ({res['target_dept_name']}). تم إسقاط تسجيلات ومواد القسم القديم بالكامل وتجهيز ملف الطالب للتخصص الجديد.",
                                    request=request
                                )
                            except Exception:
                                pass

                            has_already_changed = True
                            limit_warning = "[WARN] تنبيه: الطالب استنفد الحد المسموح به لتغيير المسار (مسموح بمرة واحدة فقط)."
                            messages.success(
                                request, 
                                f'[OK] تم اعتماد تغيير المسار بنجاح للطالب ({student.student_id}) من قسم ({res["old_dept_name"]}) إلى ({res["target_dept_name"]}). تم إسقاط وحذف تسجيلات مواد التخصص القديم بالكامل، والملف جاهز لتنزيل مواد التخصص الجديد.'
                            )
                        except ValidationError as e:
                            err_msg = e.messages[0] if hasattr(e, 'messages') and e.messages else str(e)
                            messages.error(request, err_msg)
                        except Exception as e:
                            logger.error(f"Error during track change for student {student.student_id}: {e}", exc_info=True)
                            messages.error(request, f"[ERROR] حدث خطأ أثناء اعتماد تغيير المسار: {str(e)}")

    # 4. التحقق الأكاديمي والجدول الزمني للطالب
    if student:
        student_level_name = student.level.name if student.level else "المستوى الأول"
        is_early = any(term in student_level_name for term in ['الأول', 'الثاني', '1', '2', 'First', 'Second'])
        
        if not is_early and student.level and any(term in student_level_name for term in ['الثالث', 'الرابع', '3', '4', 'Third', 'Fourth']):
            can_auto_transfer = False
            level_warning = "[WARN] تنبيه: الطالب في فصل أعلى من الثاني - لا يجوز تغيير المسار أوتوماتيكياً بل يتطلب موافقة مجلس الكلية."
        else:
            can_auto_transfer = True

        # المواد التي نجح فيها الطالب
        passed_grades = Grade.objects.filter(student=student, is_passed=True).select_related('course')
        passed_course_ids = [g.course_id for g in passed_grades]

        # 4. حساب المعادلة الآلية عند اختيار التخصص الجديد (فقط للطلاب المسموح لهم بتغيير المسار)
        if not has_already_changed and student_eligibility['is_allowed']:
            if new_dept_id:
                selected_new_dept = Department.objects.filter(id=new_dept_id).first()

            if selected_new_dept:
                eq_rules = CourseEquivalence.objects.filter(
                    source_course_id__in=passed_course_ids
                ).filter(
                    Q(source_department=student.department) | Q(source_department__isnull=True)
                ).filter(
                    Q(target_department=selected_new_dept) | Q(target_department__isnull=True)
                ).select_related('source_department', 'target_department', 'source_course', 'target_course')

                for eq in eq_rules:
                    equivalenced_courses.append({
                        'source_course': eq.source_course,
                        'target_course': eq.target_course,
                        'notes': eq.notes,
                        'is_equivalenced': True
                    })

                target_courses = Course.objects.filter(department=selected_new_dept).prefetch_related('department').order_by('code')
                eq_target_ids = [eq.target_course_id for eq in eq_rules]

                for c in target_courses:
                    if c.id not in eq_target_ids and c.id not in passed_course_ids:
                        remaining_courses.append(c)

    is_admin_user = request.user.is_authenticated and (
        request.user.is_superuser or 
        request.user.is_staff or 
        getattr(request.user, 'role', '') in ['admin', 'manager']
    )

    # 5. جلب أسماء المسؤولين المعتمدين والنشطين من قاعدة البيانات للتقارير والطباعة
    general_registrar_name = "أ. أحمد محمد علي محمود"
    admission_head_name = "أ. محمد علي عمر"
    exams_head_name = ""
    try:
        from apps.users.models import Official
        reg_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='registrar') | Q(position_name__icontains='المسجل العام') | Q(position_name__icontains='مسجل')
        ).exclude(position_key='admission').first()
        if reg_obj:
            general_registrar_name = reg_obj.get_full_name()

        adm_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='admission') | Q(position_name__icontains='تسجيل') | Q(position_name__icontains='قبول')
        ).first()
        if adm_obj:
            admission_head_name = adm_obj.get_full_name()

        coord_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='exams_coordinator') |
            Q(position_name__icontains='منسق') |
            Q(position_name__icontains='منسقة')
        ).first()
        if coord_obj:
            exams_head_name = coord_obj.get_full_name()
        if not exams_head_name:
            exams_head_name = "أ. لبنى"
    except Exception as e:
        logger.warning(f"Error fetching officials in course_equivalence_page: {e}")
        exams_head_name = "أ. لبنى"

    # تحديد التخصص السابق والتخصص الجديد بدقة تامة للعرض والطباعة
    previous_dept_name = ""
    target_dept_name = ""

    if student:
        if has_already_changed:
            target_dept_name = student.department.name if student.department else "غير محدد"

            if student.notes and '[PREVIOUS_DEPT:' in student.notes:
                try:
                    previous_dept_name = student.notes.split('[PREVIOUS_DEPT:')[1].split(']')[0].strip()
                except Exception:
                    previous_dept_name = ""

            if not previous_dept_name:
                grade_with_note = Grade.objects.filter(student=student, notes__icontains='قسم (').first()
                if grade_with_note and 'قسم (' in grade_with_note.notes:
                    try:
                        previous_dept_name = grade_with_note.notes.split('قسم (')[1].split(')')[0].strip()
                    except Exception:
                        previous_dept_name = ""

            if not previous_dept_name:
                old_enrollment = EnrollmentRenewal.objects.filter(student=student).exclude(department=student.department).first()
                if old_enrollment and getattr(old_enrollment, 'department', None):
                    previous_dept_name = old_enrollment.department.name

            if not previous_dept_name:
                previous_dept_name = "التخصص السابق"
        else:
            previous_dept_name = student.department.name if student.department else "غير محدد"
            target_dept_name = selected_new_dept.name if selected_new_dept else (selected_new_dept.name if selected_new_dept else "")

    context = {
        'departments': departments,
        'search_query': search_query,
        'student': student,
        'matching_students': matching_students,
        'is_withdrawn': is_withdrawn,
        'allow_print': allow_print,
        'previous_dept_name': previous_dept_name,
        'target_dept_name': target_dept_name,
        'student_eligibility': student_eligibility,
        'passed_grades': passed_grades,
        'equivalenced_courses': equivalenced_courses,
        'remaining_courses': remaining_courses,
        'can_auto_transfer': can_auto_transfer,
        'has_already_changed': has_already_changed,
        'level_warning': level_warning,
        'limit_warning': limit_warning,
        'selected_new_dept': selected_new_dept,
        'is_equivalence_job_open': is_equivalence_job_open,
        'equivalence_job_message': equivalence_job_message,
        'is_admin_user': is_admin_user,
        'active_semester': active_semester,
        'general_registrar_name': general_registrar_name,
        'admission_head_name': admission_head_name,
        'exams_head_name': exams_head_name,
    }
    return render(request, 'grades/course_equivalence.html', context)


@login_required
def toggle_equivalence_job_api(request):
    """
    API: تفعيل/إيقاف وظيفة معادلة المواد وتغيير المسار مخصصة للمدراء فقط
    """
    is_admin = request.user.is_authenticated and (
        request.user.is_superuser or 
        request.user.is_staff or 
        getattr(request.user, 'role', '') in ['admin', 'manager']
    )
    if not is_admin:
        return JsonResponse({'success': False, 'error': 'غير مسموح لك بتنفيذ هذا الإجراء (متاح للمدراء فقط)'}, status=403)

    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'طريقة غير مسموحة'}, status=405)

    try:
        from apps.renewal.models import SystemJob
        from apps.renewal.views import get_course_equivalence_job_info

        job = SystemJob.objects.filter(
            Q(code='course_equivalence') | Q(code='track_change') | Q(code='equivalence') |
            Q(code__icontains='equivalence') | Q(code__icontains='track') |
            Q(name__icontains='معادلة') | Q(name__icontains='تغيير المسار') | Q(name__icontains='تغيير مسار')
        ).order_by('-updated_at', '-id').first()

        if not job:
            job = SystemJob.objects.create(
                name='معادلة المواد وتغيير المسار',
                code='course_equivalence',
                start_date=timezone.now().date(),
                duration_days=90,
                is_active=True
            )

        job.is_active = not job.is_active
        job.save()

        equivalence_info = get_course_equivalence_job_info()

        status_msg = f'تم تفعيل خدمة "{job.name}" بنجاح 🟢' if job.is_active else f'تم إيقاف خدمة "{job.name}" بنجاح 🔴'

        return JsonResponse({
            'success': True,
            'message': status_msg,
            'is_active': job.is_active,
            'is_equivalence_job_open': equivalence_info['is_equivalence_job_open'],
            'equivalence_job_message': equivalence_info['equivalence_job_message'],
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': f'حدث خطأ أثناء تحديث حالة الوظيفة: {str(e)}'}, status=500)


@login_required
def equivalent_students(request):
    """
    صفحة استعراض وقوائم الطلبة المعادَلين ومتغيري المسار الأكاديمي مع تفعيل الفلاتر والطباعة والتصدير.
    """
    departments = Department.objects.filter(is_active=True).order_by('name')

    search_query = request.GET.get('search', '').strip()
    from_dept_id = request.GET.get('from_department', '').strip()
    to_dept_id = request.GET.get('to_department', '').strip()
    year_query = request.GET.get('year', '').strip()

    students_qs = Student.objects.all().select_related('department', 'level', 'group').order_by('name')

    if is_valid_filter(from_dept_id):
        students_qs = students_qs.filter(
            Q(department__id=from_dept_id) | Q(department__name=from_dept_id)
        )

    if is_valid_filter(to_dept_id):
        students_qs = students_qs.filter(
            Q(department__id=to_dept_id) | Q(department__name=to_dept_id)
        )

    if search_query:
        q_filter = (
            Q(student_id__icontains=search_query) |
            Q(name__icontains=search_query) |
            Q(father_name__icontains=search_query) |
            Q(grandfather_name__icontains=search_query) |
            Q(last_name__icontains=search_query) |
            Q(national_id__icontains=search_query)
        )
        if search_query.isdigit():
            q_filter |= Q(id=int(search_query))
        students_qs = students_qs.filter(q_filter)

    equivalent_students_list = []
    eq_rules = CourseEquivalence.objects.select_related('source_course', 'target_course').all()
    source_to_target = {eq.source_course_id: eq for eq in eq_rules}

    for s in students_qs:
        passed_grades = Grade.objects.filter(student=s, is_passed=True).select_related('course')
        passed_course_ids = [g.course_id for g in passed_grades]

        exempted_courses = []
        for g in passed_grades:
            if g.course_id in source_to_target:
                eq = source_to_target[g.course_id]
                exempted_courses.append({
                    'source': f"{eq.source_course.code} - {eq.source_course.name}",
                    'source_code': eq.source_course.code,
                    'source_name': eq.source_course.name,
                    'target': f"{eq.target_course.code} - {eq.target_course.name}",
                    'target_code': eq.target_course.code,
                    'target_name': eq.target_course.name,
                    'hours': getattr(eq.target_course, 'credits', 3) or 3,
                    'notes': eq.notes or "معادلة معتمدة"
                })

        remaining_courses = []
        if s.department:
            dept_courses = Course.objects.filter(department=s.department)
            eq_target_ids = [eq.target_course_id for eq in eq_rules if eq.source_course_id in passed_course_ids]
            for c in dept_courses:
                if c.id not in passed_course_ids and c.id not in eq_target_ids:
                    remaining_courses.append({
                        'code': c.code,
                        'name': c.name,
                        'department': c.department.name if c.department else "عام",
                        'credits': getattr(c, 'credits', 3) or 3,
                        'text': f"{c.code} - {c.name}"
                    })

        # استبعاد أي طالب لا يمتلك مواد معفاة مسجلة (إخفاء أصحاب الـ 0 مواد)
        if len(exempted_courses) > 0:
            full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
            full_name = " ".join(full_name.split())

            equivalent_students_list.append({
                'id': s.student_id or str(s.id),
                'student_id': s.student_id or str(s.id),
                'name': full_name,
                'current_dept': s.department.name if s.department else "عام",
                'level': s.level.name if s.level else "المستوى الأول",
                'status': getattr(s.student_status, 'name', 'منتظم') if hasattr(s, 'student_status') and s.student_status else "منتظم",
                'exempted_count': len(exempted_courses),
                'exempted_courses': exempted_courses,
                'exempted_details': exempted_courses,
                'remaining_details': remaining_courses,
                'date': s.created_at.strftime('%Y-%m-%d') if hasattr(s, 'created_at') and s.created_at else "2026-01-15",
            })

    # جلب أسماء المسؤولين النشطين
    general_registrar_name = "أ. أحمد محمد علي محمود"
    admission_head_name = "أ. محمد علي عمر"
    exams_head_name = ""
    try:
        from apps.users.models import Official
        reg_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='registrar') | Q(position_name__icontains='المسجل العام') | Q(position_name__icontains='مسجل')
        ).exclude(position_key='admission').first()
        if reg_obj:
            general_registrar_name = reg_obj.get_full_name()

        adm_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='admission') | Q(position_name__icontains='تسجيل') | Q(position_name__icontains='قبول')
        ).first()
        if adm_obj:
            admission_head_name = adm_obj.get_full_name()

        coord_obj = Official.objects.filter(is_active=True).filter(
            Q(position_key='exams_coordinator') |
            Q(position_name__icontains='منسق') |
            Q(position_name__icontains='منسقة')
        ).first()
        if coord_obj:
            exams_head_name = coord_obj.get_full_name()
        if not exams_head_name:
            exams_head_name = "أ. لبنى"
    except Exception as e:
        logger.warning(f"Error fetching officials in equivalent_students_view: {e}")
        exams_head_name = "أ. لبنى"

    context = {
        'departments': departments,
        'search_query': search_query,
        'from_dept_id': from_dept_id,
        'to_dept_id': to_dept_id,
        'year_query': year_query,
        'students_list': equivalent_students_list,
        'students_json': json.dumps(equivalent_students_list, ensure_ascii=False),
        'total_count': len(equivalent_students_list),
        'general_registrar_name': general_registrar_name,
        'admission_head_name': admission_head_name,
        'exams_head_name': exams_head_name,
    }

    return render(request, 'grades/equivalent_students.html', context)


@login_required
def pending_approvals_page(request):
    """
    صفحة عرض وجدول الطلاب الذين تم رصد درجاتهم / نتائجهم ولم يتم اعتمادها بعد (Pending Academic Approvals)
    """
    departments = Department.objects.filter(is_active=True).order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    
    search_query = request.GET.get('search', '').strip()
    dept_id = request.GET.get('department', '').strip()
    semester_id = request.GET.get('semester', '').strip()
    
    grades_qs = Grade.objects.filter(is_final_locked=False).select_related(
        'student', 'student__department', 'student__level', 'course', 'semester', 'professor', 'registered_by'
    )
    
    # تصفية الدرجات التي تم إدخالها أو رصد أي قيمة لها وتنتظر الاعتماد
    grades_qs = grades_qs.filter(
        Q(is_final_entered=True) | Q(midterm_grade__gt=0) | Q(final_grade__gt=0) | Q(practical_grade__gt=0)
    )
    
    if search_query:
        grades_qs = grades_qs.filter(
            Q(student__student_id__icontains=search_query) |
            Q(student__name__icontains=search_query) |
            Q(course__name__icontains=search_query) |
            Q(course__code__icontains=search_query)
        )
        
    if dept_id and dept_id.isdigit():
        grades_qs = grades_qs.filter(student__department_id=int(dept_id))
        
    if semester_id and semester_id.isdigit():
        grades_qs = grades_qs.filter(semester_id=int(semester_id))
        
    total_count = grades_qs.count()
    grades_list = grades_qs.order_by('-updated_at')[:300]
    
    context = {
        'departments': departments,
        'semesters': semesters,
        'grades_list': grades_list,
        'total_count': total_count,
        'search_query': search_query,
        'selected_dept': dept_id,
        'selected_semester': semester_id,
    }
    return render(request, 'grades/pending_approvals.html', context)


@exam_director_required
def coordinator_dashboard_view(request):
    """
    عرض لوحة منسقة الدراسة والامتحانات عبر تطبيق الدرجات
    """
    from apps.faculty.views import coordinator_dashboard
    return coordinator_dashboard(request)


@csrf_exempt
def professor_grade_email_reply_api(request):
    """
    API / Webhook: معالجة واستقبال إشعارات ردود الأساتذة بالبريد الإلكتروني وتوليد تنبيه بالمنظومة
    يدعم طلبات POST و GET للمحاكاة والتكامل مع خوادم البريد وتطبيقات الطرف الثالث
    """
    try:
        from apps.grades.email_bridge import (
            find_matching_professor_and_course,
            create_professor_grade_reply_notification,
            save_grade_reply_attachment
        )
        
        data = {}
        if request.body:
            try:
                data = json.loads(request.body)
            except Exception:
                data = request.POST.dict() or request.GET.dict()
        else:
            data = request.POST.dict() or request.GET.dict()
        
        sender_email = data.get('email') or data.get('sender_email') or ''
        prof_name = data.get('professor_name') or ''
        course_name = data.get('course_name') or ''
        course_code = data.get('course_code') or ''
        students_count = int(data.get('students_count') or 0)
        attachment_name = data.get('attachment_name') or 'grades_reply.xlsx'
        reply_message = data.get('message') or f"تم الرد وتعبئة كشف درجات مادة {course_name}"

        # التحقق من وجود ملف مرفق في request.FILES
        saved_url = ""
        if request.FILES and 'file' in request.FILES:
            uploaded = request.FILES['file']
            attachment_name = uploaded.name
            saved_url = save_grade_reply_attachment(uploaded.read(), uploaded.name, prof_name)

        prof, course = find_matching_professor_and_course(sender_email, prof_name, course_code, course_name)
        active_semester = Semester.objects.filter(is_active=True).first()

        notif = create_professor_grade_reply_notification(
            professor=prof,
            course=course,
            semester=active_semester,
            attachment_name=attachment_name,
            students_count=students_count,
            reply_body=reply_message,
            saved_file_url=saved_url,
            sender_display=prof_name or sender_email
        )

        return JsonResponse({
            'success': True,
            'message': f'[OK] تم استلام رد الأستاذ ({notif.title}) وتوليد الإشعار الإداري بنجاح',
            'notification_id': notif.id,
            'title': notif.title,
            'link': notif.link
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@login_required
@csrf_exempt
def check_inbox_grade_replies_api(request):
    """
    API: فحص صندوق الوارد (IMAP) لاستقبال ومعالجة ردود كشوف الدرجات الحية من الأساتذة
    """
    from apps.grades.email_bridge import check_imap_inbox_for_grade_replies
    result = check_imap_inbox_for_grade_replies()
    return JsonResponse(result)


@csrf_exempt
def simulate_professor_grade_reply_api(request):
    """
    API: محاكاة استقبال رد أستاذ بكشف درجات محلياً لاختبار الإشعارات (Dev Hook)
    """
    try:
        from apps.grades.email_bridge import simulate_incoming_grade_reply
        data = {}
        if request.body:
            try:
                data = json.loads(request.body)
            except Exception:
                data = request.POST.dict() or request.GET.dict()
        else:
            data = request.POST.dict() or request.GET.dict()

        prof_id = data.get('professor_id')
        course_id = data.get('course_id')
        semester_id = data.get('semester_id')
        students_count = int(data.get('students_count') or 24)
        attachment_name = data.get('attachment_name') or 'grades_sheet_reply.xlsx'
        prof_name = data.get('professor_name')
        course_name = data.get('course_name')

        result = simulate_incoming_grade_reply(
            professor_id=int(prof_id) if prof_id else None,
            course_id=int(course_id) if course_id else None,
            semester_id=int(semester_id) if semester_id else None,
            students_count=students_count,
            attachment_name=attachment_name,
            custom_prof_name=prof_name,
            custom_course_name=course_name
        )
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


