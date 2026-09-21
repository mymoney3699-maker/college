# apps/student/views.py (نسخة نظيفة)
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Avg, Count, Sum
import json

from apps.renewal.models import CourseRegistration, EnrollmentRenewal, Semester, Course, Level
from apps.grades.models import Grade, GradeNotification
from apps.student.models import Student, AcademicRecord, SemesterRecord, Notification
from apps.users.models import User
# apps/student/views.py
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.db.models import Q, Sum, Avg, Count
from django.utils import timezone
from django.core.paginator import Paginator
from django.views.decorators.http import require_http_methods
from apps.users.utils import log_activity
import logging
logger = logging.getLogger(__name__)


def get_student_for_user(request):
    """
    دالة زمنية ومركزية آمنة لجلب كائن الطالب المرتبط بحساب المستخدم الحالي.
    تستعين بـ select_related لمنع N+1 وتوفر ربطاً أوتوماتيكياً ذكياً مع الحساب.
    """
    if not request.user or not request.user.is_authenticated:
        return None

    user = request.user
    student = None

    # 1. العلاقة المباشرة أولاً
    try:
        if hasattr(user, 'student') and user.student:
            return user.student
    except Exception:
        pass

    try:
        if hasattr(user, 'student_profile') and user.student_profile:
            return user.student_profile
    except Exception:
        pass

    # 2. البحث الذكي (برقم القيد أو البريد أو رقم الهاتف أو الاسم)
    if user.email:
        student = Student.objects.filter(email=user.email).select_related(
            'department', 'level', 'student_status', 'group', 'study_plan', 'nationality', 'birth_place', 'current_address'
        ).first()

    if not student and hasattr(user, 'phone') and user.phone:
        student = Student.objects.filter(phone=user.phone).select_related(
            'department', 'level', 'student_status', 'group', 'study_plan', 'nationality', 'birth_place', 'current_address'
        ).first()

    if not student:
        student = Student.objects.filter(student_id=user.username).select_related(
            'department', 'level', 'student_status', 'group', 'study_plan', 'nationality', 'birth_place', 'current_address'
        ).first()

    if not student and user.first_name:
        student = Student.objects.filter(name__icontains=user.first_name).select_related(
            'department', 'level', 'student_status', 'group', 'study_plan', 'nationality', 'birth_place', 'current_address'
        ).first()

    if student and not student.user:
        try:
            student.user = user
            student.save(update_fields=['user'])
        except Exception:
            pass

    return student


def get_student_published_grades(student, semester=None):
    """
    دالة مركزية ترجع نتائج الطالب المعتمدة/المنشورة أو المحجوبة لإتاحة ظهور تنبيه الحجب الإداري للطالب.
    تستثني فقط النتائج غير المنشورة إطلاقاً.
    """
    if not student:
        return Grade.objects.none()
    
    qs = Grade.objects.filter(student=student).filter(
        Q(is_published=True) | Q(is_midterm_published=True) | Q(is_final_published=True) | Q(is_blocked=True)
    )
    
    if semester:
        qs = qs.filter(semester=semester)
        
    return qs.select_related('course', 'semester')


@login_required
def student_dashboard(request):
    """لوحة تحكم الطالب الكاملة بقاعدة البيانات والمؤشرات الأكاديمية"""
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
        
    current_semester = Semester.objects.filter(is_active=True).first()

    # 1. المواد المسجلة للفصل النشط
    registered_courses_qs = CourseRegistration.objects.none()
    if student and current_semester:
        registered_courses_qs = CourseRegistration.objects.filter(
            student=student,
            semester=current_semester
        ).select_related('course', 'course__level').prefetch_related('course__department')
    elif student:
        registered_courses_qs = CourseRegistration.objects.filter(
            student=student
        ).select_related('course', 'course__level').prefetch_related('course__department')

    registered_courses_count = registered_courses_qs.count()

    # 2. السجل الأكاديمي والـ GPA والنتائج المعتمدة المنشورة فقط (باستثناء المحجوبة من المعدل)
    academic_record = None
    cgpa = 0.00
    total_credits = 0
    passed_count = 0
    failed_count = 0
    gpa_history_labels = []
    gpa_history_data = []
    total_plan_courses = 40

    if student:
        published_grades = get_student_published_grades(student).select_related('course', 'semester').order_by('semester__year', 'semester__type')
        
        sem_groups = {}
        for g in published_grades:
            if not g.semester or not g.course:
                continue
            s_id = g.semester.id
            if s_id not in sem_groups:
                sem_groups[s_id] = {
                    'name': f"{g.semester.year} - {g.semester.get_type_display()}",
                    'grades': [],
                    'is_approved': True
                }
            is_blk = getattr(g, 'is_blocked', False)
            is_pub = getattr(g, 'is_published', False) or getattr(g, 'is_final_published', False)
            if is_blk or not is_pub or g.total_grade is None:
                sem_groups[s_id]['is_approved'] = False
            sem_groups[s_id]['grades'].append(g)

        cum_pts = 0
        cum_crs = 0
        for s_id, s_info in sem_groups.items():
            if s_info['is_approved']:
                for g in s_info['grades']:
                    cr = g.course.credits or 0
                    pt = (g.total_grade or 0) * cr
                    cum_pts += pt
                    cum_crs += cr
                    if g.is_passed or (g.total_grade and g.total_grade >= 50):
                        passed_count += 1
                    else:
                        failed_count += 1
                running_gpa = round(cum_pts / cum_crs, 2) if cum_crs > 0 else 0.00
                gpa_history_labels.append(s_info['name'])
                gpa_history_data.append(running_gpa)

        cgpa = round(cum_pts / cum_crs, 2) if cum_crs > 0 else 0.00
        total_credits = cum_crs

        try:
            academic_record = AcademicRecord.objects.filter(student=student).first()
        except Exception as e:
            logger.error(f"Error getting AcademicRecord in dashboard: {e}")
            academic_record = None

        # حساب إجمالي مواد الخطة للأستاذ/القسم
        if getattr(student, 'department', None):
            dept_courses_cnt = Course.objects.filter(department=student.department).count()
            if dept_courses_cnt > 0:
                total_plan_courses = dept_courses_cnt

    completed_courses_count = passed_count
    remaining_courses_count = max(0, total_plan_courses - completed_courses_count)

    if not gpa_history_data:
        gpa_history_labels = ['الفصل الحالي']
        gpa_history_data = [round(float(cgpa), 2)]

    # 4. الإشعارات الأخيرة للطالب
    notifications = []
    if student:
        try:
            student_courses = CourseRegistration.objects.filter(student=student).values_list('course_id', flat=True)
            notifications = GradeNotification.objects.filter(course_id__in=student_courses).select_related('course', 'professor').order_by('-created_at')[:5]
        except Exception as e:
            logger.error(f"Error fetching notifications in dashboard: {e}")
            notifications = []

    # 5. سجل تجديد القيد
    latest_renewal = None
    is_renewed_current = False
    if student:
        latest_renewal = EnrollmentRenewal.objects.filter(student=student).select_related('semester', 'level').order_by('-id').first()
        if latest_renewal and current_semester and latest_renewal.semester_id == current_semester.id:
            is_renewed_current = latest_renewal.status in ['RENEWED', 'active']

    # 6. سجل طعون الدرجات وتعديل النتائج للطالب
    student_appeals = []
    if student:
        try:
            from apps.grades.models import GradeAppeal
            student_appeals = list(
                GradeAppeal.objects.filter(student=student)
                .select_related('course', 'semester', 'grade')
                .order_by('-created_at')[:8]
            )
            for app in student_appeals:
                app.badge_info = app.get_status_badge_info()
        except Exception as e:
            logger.error(f"Error fetching student appeals in dashboard: {e}")
            student_appeals = []

    student_full_name = student.get_full_name() if (student and hasattr(student, 'get_full_name')) else (request.user.get_full_name() or request.user.username)
    photo_url = student.photo.url if (student and getattr(student, 'photo', None)) else '/static/images/default_avatar.png'

    dashboard_chart_data = {
        'gpaLabels': gpa_history_labels,
        'gpaData': gpa_history_data,
        'completedCourses': completed_courses_count,
        'remainingCourses': remaining_courses_count,
    }

    context = {
        'user': request.user,
        'student': student,
        'student_obj': student,
        'student_name': student_full_name,
        'student_id': student.student_id if student else "--",
        'department_name': student.department.name if (student and getattr(student, 'department', None)) else "--",
        'level_name': student.level.name if (student and getattr(student, 'level', None)) else "--",
        'status_name': student.student_status.name if (student and getattr(student, 'student_status', None)) else "--",
        'photo_url': photo_url,
        'academic_record': academic_record,
        'cgpa': round(float(cgpa), 2),
        'gpa': round(float(cgpa), 2),
        'total_credits': total_credits,
        'passed_count': passed_count,
        'failed_count': failed_count,
        'registered_courses_count': registered_courses_count,
        'registered_courses': registered_courses_qs,
        'current_semester': current_semester,
        'latest_renewal': latest_renewal,
        'is_renewed_current': is_renewed_current,
        'recent_notifications': notifications,
        'student_appeals': student_appeals,
        'student_appeals_count': len(student_appeals),
        'dashboard_chart_data': dashboard_chart_data,
        'gpa_history_labels_json': json.dumps(gpa_history_labels, ensure_ascii=False),
        'gpa_history_data_json': json.dumps(gpa_history_data),
        'completed_courses_count': completed_courses_count,
        'remaining_courses_count': remaining_courses_count,
    }
    return render(request, 'student/student_dashboard.html', context)



@login_required
def my_courses(request):
    """صفحة المواد والمقررات الدراسية للطالب ببيانات حقيقية 100% من قاعدة البيانات وتأمين تام ضد العودة بـ None"""
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
        
    current_semester = Semester.objects.filter(is_active=True).first()
    
    registered_courses = []
    total_registered_credits = 0
    gpa = 0.00
    gpa_history_labels = []
    gpa_history_data = []
    semester_blocks = []
    unread_notifications_count = 0
    
    try:
        if student:
            # 1. حساب المعدل الأكاديمي التراكمي العام من النتائج المنشورة فقط
            try:
                grades_all = get_student_published_grades(student)
                t_pts = sum((g.total_grade or 0) * (g.course.credits if g.course else 0) for g in grades_all if g.is_passed or g.total_grade >= 50)
                t_crs = sum(g.course.credits for g in grades_all if g.course and (g.is_passed or g.total_grade >= 50))
                gpa = round(t_pts / t_crs, 2) if t_crs > 0 else 0.00
            except Exception as e:
                logger.error(f"Error calculating GPA in my_courses: {e}")
                gpa = 0.00

            # 2. احتساب التطور التاريخي للمعدل التراكمي من النتائج المنشورة فقط
            all_grades = get_student_published_grades(student).order_by('semester__year', 'semester__type')
            
            cum_points = 0
            cum_credits = 0
            sem_gpas = {}
            
            for g in all_grades:
                if not g.semester or not g.course:
                    continue
                sem_key = f"{g.semester.year} - {g.semester.get_type_display()}"
                if sem_key not in sem_gpas:
                    sem_gpas[sem_key] = {'points': 0, 'credits': 0}
                
                cr = g.course.credits or 0
                pt = (g.total_grade or 0) * cr
                sem_gpas[sem_key]['points'] += pt
                sem_gpas[sem_key]['credits'] += cr
                
            for sem_name, data in sem_gpas.items():
                cum_points += data['points']
                cum_credits += data['credits']
                running_gpa = round(cum_points / cum_credits, 2) if cum_credits > 0 else 0.00
                gpa_history_labels.append(sem_name)
                gpa_history_data.append(running_gpa)
                
            if not gpa_history_data:
                gpa_history_labels = ['الفصل الحالي']
                gpa_history_data = [gpa]

            # 3. جلب خطة المواد الدراسية الكاملة مقسمة بحسب كافة الفصول/المستويات
            levels = Level.objects.all().order_by('number')
            
            # تجميع المواد المكتملة من النتائج المعتمدة والمنشورة نهائياً فقط
            passed_course_ids = set(
                get_student_published_grades(student).exclude(is_blocked=True).filter(
                    Q(is_published=True) | Q(is_final_published=True)
                ).filter(
                    Q(is_passed=True) | Q(total_grade__gte=50)
                ).values_list('course_id', flat=True)
            )
            
            active_studying_course_ids = set(
                CourseRegistration.objects.filter(student=student).values_list('course_id', flat=True)
            )

            for lvl in levels:
                level_courses_qs = Course.objects.filter(level=lvl).select_related('level').prefetch_related('department')
                if getattr(student, 'department', None):
                    dept_courses = level_courses_qs.filter(department=student.department)
                    if dept_courses.exists():
                        level_courses_qs = dept_courses

                courses_list = []
                level_credits_sum = 0
                level_passed_count = 0

                for c in level_courses_qs:
                    cr_val = int(c.credits or 3)
                    level_credits_sum += cr_val

                    is_passed_val = c.id in passed_course_ids
                    is_studying_val = (c.id in active_studying_course_ids) and (not is_passed_val)

                    if is_passed_val:
                        status_code = 'PASSED'
                        status_display = 'مكتمل (ناجح)'
                        level_passed_count += 1
                    elif is_studying_val:
                        status_code = 'STUDYING'
                        status_display = 'جاري دراستها'
                    else:
                        status_code = 'UNPASSED'
                        status_display = 'غير مكتمل'

                    c_dict = {
                        'id': c.id,
                        'name': c.name,
                        'code': c.code,
                        'credits': cr_val,
                        'department_name': c.department.name if c.department else '--',
                        'level_name': lvl.name if lvl else '--',
                        'status_code': status_code,
                        'status_display': status_display,
                        'is_passed': is_passed_val,
                        'is_studying': is_studying_val,
                        'subject': c,
                    }
                    courses_list.append(c_dict)

                if courses_list:
                    semester_blocks.append({
                        'level': lvl,
                        'title': f"الفصل الدراسي {lvl.number} - ({lvl.name})",
                        'courses': courses_list,
                        'total_courses': len(courses_list),
                        'passed_courses': level_passed_count,
                        'total_credits': level_credits_sum,
                    })

            # جلب المواد المسجلة الحالية
            registrations_qs = CourseRegistration.objects.filter(
                student=student
            ).select_related('course', 'semester', 'course__level').prefetch_related('course__department')
            
            if current_semester:
                current_regs = registrations_qs.filter(semester=current_semester)
                if current_regs.exists():
                    registrations_qs = current_regs

            for reg in registrations_qs:
                course_obj = reg.course
                if not course_obj:
                    continue

                grade = get_student_published_grades(student, semester=reg.semester).filter(course=course_obj).first()
                
                credits_val = int(getattr(course_obj, 'credits', 3) or 3)
                total_registered_credits += credits_val
                
                is_passed = grade.is_passed if grade else False
                status_str = 'ناجح' if is_passed else ('راسب' if (grade and grade.total_grade is not None and not grade.is_passed) else 'جاري دراستها')
                
                course_dict = {
                    'id': course_obj.id,
                    'name': course_obj.name,
                    'code': course_obj.code,
                    'credits': credits_val,
                    'department_name': course_obj.department.name if getattr(course_obj, 'department', None) else '--',
                    'level_name': course_obj.level.name if getattr(course_obj, 'level', None) else '--',
                    'semester_display': str(reg.semester) if reg.semester else '--',
                    'semester': reg.semester,
                    'grade': grade.total_grade if grade else None,
                    'letter': grade.get_grade_letter() if grade else '--',
                    'status': status_str,
                    'is_passed': is_passed,
                    'instructor': getattr(course_obj, 'instructor', None),
                    'instructor_name': getattr(course_obj, 'instructor_name', None) or '--',
                    'subject': course_obj,
                }
                registered_courses.append(course_dict)

            # 4. حساب الإشعارات غير المقروءة
            try:
                student_courses = CourseRegistration.objects.filter(student=student).values_list('course_id', flat=True)
                unread_notifications_count = GradeNotification.objects.filter(course_id__in=student_courses, is_read=False).count()
            except Exception:
                unread_notifications_count = 0

    except Exception as general_err:
        logger.error(f"General error in my_courses view: {general_err}", exc_info=True)

    registered_courses_count = len(registered_courses)
    if not gpa_history_data:
        gpa_history_labels = ['الفصل الحالي']
        gpa_history_data = [gpa]

    context = {
        'user': request.user,
        'student': student,
        'student_obj': student,
        'current_semester': current_semester,
        'registered_courses': registered_courses,
        'courses': registered_courses,
        'semester_blocks': semester_blocks,
        'registered_courses_count': registered_courses_count,
        'total_courses_count': registered_courses_count,
        'total_registered_credits': total_registered_credits,
        'total_credits': total_registered_credits,
        'gpa': round(float(gpa), 2),
        'registration_status': 'نشط' if registered_courses_count > 0 else 'غير مسجل',
        'semesters': Semester.objects.all().order_by('-year', '-type'),
        'gpa_history_labels_json': json.dumps(gpa_history_labels, ensure_ascii=False),
        'gpa_history_data_json': json.dumps(gpa_history_data),
        'unread_notifications_count': unread_notifications_count,
    }
    return render(request, 'student/data_subject.html', context)

@login_required
def my_grades(request):
    """صفحة النتائج والمعدلات الكاملة للطالب (النتائج المنشورة والمعتمدة فقط لكل الفصول)"""
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
    
    academic_record = None
    if student:
        try:
            academic_record = AcademicRecord.objects.filter(student=student).first()
        except Exception:
            academic_record = None
    
    semesters_data = []
    total_completed_credits = 0
    passed_count = 0
    failed_count = 0
    cgpa = 0.00
    total_cgpa_points = 0
    total_cgpa_credits = 0

    if student:
        from apps.grades.models import GradeAppeal
        all_appeals_map = {
            (app.semester_id, app.course_id): app
            for app in GradeAppeal.objects.filter(student=student).select_related('course', 'semester')
        }

        published_grades = get_student_published_grades(student).select_related('course', 'semester').order_by('-semester__year', '-semester__type')
        
        sem_dict = {}
        for grade in published_grades:
            if not grade.semester or not grade.course:
                continue
            key = f"{grade.semester.year}_{grade.semester.type}"
            if key not in sem_dict:
                sem_dict[key] = {
                    'semester_obj': grade.semester,
                    'semester': str(grade.semester),
                    'courses': [],
                    'total_points': 0,
                    'total_credits': 0,
                    'is_fully_approved': True,
                    'has_blocked_course': False,
                    'has_unreleased_course': False,
                }
            
            is_blk = getattr(grade, 'is_blocked', False)
            is_final_pub = getattr(grade, 'is_published', False) or getattr(grade, 'is_final_published', False)
            is_mid_pub = getattr(grade, 'is_published', False) or getattr(grade, 'is_midterm_published', False)
            
            # هل النتيجة النهائية معتمدة ومنشورة وغير محجوبة؟
            has_final_score = is_final_pub and not is_blk and (grade.total_grade is not None)
            
            if is_blk:
                sem_dict[key]['is_fully_approved'] = False
                sem_dict[key]['has_blocked_course'] = True
            elif not is_final_pub:
                sem_dict[key]['is_fully_approved'] = False
                sem_dict[key]['has_unreleased_course'] = True

            appeal_obj = all_appeals_map.get((grade.semester_id, grade.course_id))

            sem_dict[key]['courses'].append({
                'name': grade.course.name if grade.course else '-',
                'code': grade.course.code if grade.course else '-',
                'credits': grade.course.credits if grade.course else 0,
                'midterm_grade': grade.midterm_grade if (is_mid_pub and not is_blk) else None,
                'final_grade': grade.final_grade if (is_final_pub and not is_blk) else None,
                'grade': grade.total_grade if has_final_score else None,
                'letter': grade.get_grade_letter() if has_final_score else '--',
                'is_passed': grade.is_passed and has_final_score,
                'is_blocked': is_blk,
                'is_published': is_final_pub,
                'block_reason': (grade.block_reason.strip() if getattr(grade, 'block_reason', None) else None) or "تجاوز نسبة الغياب الورقي",
                'appeal': appeal_obj,
                'appeal_badge': appeal_obj.get_status_badge_info() if appeal_obj else None,
            })
            
            if grade.course:
                sem_dict[key]['total_credits'] += (grade.course.credits or 0)
                if has_final_score:
                    sem_dict[key]['total_points'] += (grade.total_grade or 0) * (grade.course.credits or 0)

        # معالجة كل فصل على حدة وحساب المعدل الفصلي والتراكمي للفصول المعتمدة فقط
        for key, data in sem_dict.items():
            if data['is_fully_approved'] and data['total_credits'] > 0:
                data['has_published_gpa'] = True
                data['gpa'] = round(data['total_points'] / data['total_credits'], 2)
                data['gpa_display'] = f"{data['gpa']:.2f}"
                
                # احتساب هذا الفصل المعتمد في المعدل التراكمي والساعات المنجزة
                total_cgpa_points += data['total_points']
                total_cgpa_credits += data['total_credits']
                
                for c in data['courses']:
                    if c['is_passed']:
                        total_completed_credits += c['credits']
                        passed_count += 1
                    else:
                        failed_count += 1
            else:
                data['has_published_gpa'] = False
                data['gpa'] = None
                if data['has_blocked_course']:
                    data['gpa_display'] = "⚠️ محجوب"
                else:
                    data['gpa_display'] = "قيد الاعتماد"

            semesters_data.append(data)

        # حساب المعدل التراكمي الشامل من الفصول المعتمدة والمنشورة فقط
        if total_cgpa_credits > 0:
            cgpa = round(total_cgpa_points / total_cgpa_credits, 2)
        else:
            cgpa = 0.00
        
        semesters_data.sort(key=lambda x: str(x['semester']), reverse=True)
    
    context = {
        'user': request.user,
        'student': student,
        'academic_record': academic_record,
        'semesters': semesters_data,
        'total_credits': total_completed_credits,
        'cgpa': cgpa,
        'gpa': cgpa,
        'passed_count': passed_count,
        'failed_count': failed_count,
        'semesters_list': Semester.objects.all().order_by('-year', '-type'),
    }
    return render(request, 'student/results_estimates.html', context)


@login_required
def my_warnings(request):
    """صفحة الإنذارات الأكاديمية"""
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
    
    warnings = []
    
    if student:
        from apps.renewal.models import CourseRegistration
        failed_grades = get_student_published_grades(student).filter(is_passed=False)
        for grade in failed_grades:
            attempt_count = CourseRegistration.objects.filter(
                student=student,
                course=grade.course
            ).count()
            if attempt_count > 1:
                warnings.append({
                    'course_name': grade.course.name if grade.course else '--',
                    'course_code': grade.course.code if grade.course else '--',
                    'attempt_count': attempt_count,
                    'grade': grade.total_grade,
                })
        
        # 2. المعدل التراكمي
        academic_record = AcademicRecord.objects.filter(student=student).first()
        if academic_record and academic_record.cumulative_gpa < 2.0:
            warnings.append({
                'type': 'low_cgpa',
                'message': f'المعدل التراكمي: {academic_record.cumulative_gpa:.2f} (أقل من 2.0)',
                'severity': 'high'
            })
    
    context = {
        'user': request.user,
        'warnings': warnings,
    }
    return render(request, 'student/my_warnings.html', context)


@login_required
def my_notifications(request):
    """صفحة الإشعارات والتنبيهات الخاصة بالطالب فقط"""
    student = get_student_for_user(request)
    
    if not student:
        # إذا لم يكن طالباً (مسجل عام أو موظف أو أدمن)، نوجهه لصفحة إشعارات المسجل العام المستقلة
        return redirect('renewal:notifications')
        
    qs = Notification.objects.filter(
        Q(student=student) |
        (Q(student__isnull=True) & Q(target_role__in=['all', 'student']) & Q(notification_type='general'))
    ).order_by('-created_at')
    
    unread_count = qs.filter(is_read=False).count()
    notifications = qs[:150]
        
    context = {
        'user': request.user,
        'student': student,
        'notifications': notifications,
        'unread_count': unread_count,
    }
    return render(request, 'student/my_notifications.html', context)


@login_required
def mark_notifications_read(request):
    """تحديد كل الإشعارات كمقروءة للطالب عبر AJAX"""
    if request.method == 'POST':
        student = get_student_for_user(request)
        if student:
            Notification.objects.filter(
                Q(student=student) |
                (Q(student__isnull=True) & Q(target_role__in=['all', 'student']) & Q(notification_type='general')),
                is_read=False
            ).update(is_read=True)
        return JsonResponse({'success': True, 'message': 'تم تحديد جميع الإشعارات كمقروءة'})
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=400)


@login_required
def notifications(request):
    """إعادة توجيه موحدة لصفحة إشعارات الطالب"""
    return my_notifications(request)

    
    

# ================================================================
# ✅ دالة الملف الشخصي (محدثة)
# ================================================================

@login_required
def my_profile(request):
    """صفحة الملف الشخصي للطالب مع السجل الأكاديمي والتأمين التام ضد AttributeError"""
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
    
    academic_record = None
    if student:
        try:
            academic_record, _ = AcademicRecord.objects.get_or_create(student=student)
            academic_record.calculate_cumulative_record()
        except Exception as e:
            logger.error(f"خطأ أثناء جلب/حساب السجل الأكاديمي للطالب {student.id}: {e}")
            academic_record = None

    if student and hasattr(student, 'generate_qr_code'):
        try:
            student.generate_qr_code(request=request)
        except Exception:
            pass

    # معالجة آمنة لجميع الحقول والنصوص
    student_name = student.get_full_name() if (student and hasattr(student, 'get_full_name')) else (request.user.get_full_name() or request.user.username)
    student_id = student.student_id if (student and getattr(student, 'student_id', None)) else "--"
    student_major = student.department.name if (student and getattr(student, 'department', None)) else "--"
    student_city = student.current_address.city if (student and getattr(student, 'current_address', None)) else "--"
    student_status = student.student_status.name if (student and getattr(student, 'student_status', None)) else "--"
    student_semester = getattr(student, 'enrollment_semester', None) or getattr(student, 'current_semester', None) or "--"
    student_email = request.user.email or (student.email if student else "--")
    student_phone = student.phone if (student and getattr(student, 'phone', None)) else "--"
    photo_url = student.photo.url if (student and getattr(student, 'photo', None)) else '/static/images/default_avatar.png'
    
    # الحقول الإضافية المطلوبة
    guardian_name = student.guardian.name if (student and getattr(student, 'guardian', None)) else "--"
    guardian_phone = student.guardian.phone if (student and getattr(student, 'guardian', None)) else "--"
    marital_status = student.marital_status.name if (student and getattr(student, 'marital_status', None)) else "--"
    blood_type = student.blood_type if (student and getattr(student, 'blood_type', None)) else "--"
    nationality = student.nationality.name if (student and getattr(student, 'nationality', None)) else "--"
    birth_place = str(student.birth_place) if (student and getattr(student, 'birth_place', None)) else "--"
    qualification = student.qualification.name if (student and getattr(student, 'qualification', None)) else "--"
    qualification_major = student.qualification_major if (student and getattr(student, 'qualification_major', None)) else "--"
    qualification_percentage = f"{student.qualification_percentage}%" if (student and getattr(student, 'qualification_percentage', None)) else "--"
    qualification_grade = student.qualification_grade if (student and getattr(student, 'qualification_grade', None)) else "--"

    # حساب وقراءة معدل الطالب بأمان
    gpa_val = getattr(academic_record, 'cumulative_gpa', 0.0) if academic_record else 0.0
    if gpa_val is None:
        gpa_val = 0.0

    context = {
        'user': request.user,
        'student': student,
        'student_obj': student,
        'academic_record': academic_record,
        'student_name': student_name,
        'student_id': student_id,
        'student_major': student_major,
        'student_city': student_city,
        'student_status': student_status,
        'student_semester': student_semester,
        'student_email': student_email,
        'student_phone': student_phone,
        'photo_url': photo_url,
        'guardian_name': guardian_name,
        'guardian_phone': guardian_phone,
        'marital_status': marital_status,
        'blood_type': blood_type,
        'nationality': nationality,
        'birth_place': birth_place,
        'qualification': qualification,
        'qualification_major': qualification_major,
        'qualification_percentage': qualification_percentage,
        'qualification_grade': qualification_grade,
        'gpa': round(float(gpa_val), 2),
        'cgpa': round(float(gpa_val), 2),
    }
    return render(request, 'student/profile.html', context)



@login_required
def term_result(request):
    """صفحة نتيجة الفصل للطالب بالربط الكامل مع قاعدة البيانات وتفعيل الإظهار المشروط وحظر النتائج غير المنشورة/المحجوبة"""
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
        
    current_semester = Semester.objects.filter(is_active=True).first()
    
    is_active_semester = current_semester is not None and getattr(current_semester, 'is_active', False)
    
    grades = Grade.objects.none()
    gpa = 0.00
    cgpa = 0.00
    total_credits = 0
    total_courses = 0
    
    student_appeals_list = []
    if student and is_active_semester:
        # 1. جلب الدرجات المنشورة/المعتمدة أو المحجوبة للفصل الحالي عبر الدالة المركزية حصراً
        published_qs = get_student_published_grades(student, semester=current_semester)
        
        # تصفية حاسمة لمنع تسريب أي درجات غير معتمدة أو غير منشورة إطلاقاً
        # تظهر فقط المواد المنشورة/المعتمدة (إما النصفية أو النهائية) أو المحجوبة إدارياً
        grades = list(published_qs.filter(
            Q(is_published=True) | Q(is_final_published=True) | Q(is_midterm_published=True) | Q(is_blocked=True)
        ))
        total_courses = len(grades)

        # جلب طعونات درجات الفصل الحالي للطالب
        from apps.grades.models import GradeAppeal
        term_appeals_map = {
            app.course_id: app
            for app in GradeAppeal.objects.filter(student=student, semester=current_semester).select_related('course')
        }
        for g in grades:
            app_obj = term_appeals_map.get(g.course_id)
            g.appeal = app_obj
            g.appeal_badge = app_obj.get_status_badge_info() if app_obj else None
        
        student_appeals_list = list(term_appeals_map.values())
        for a in student_appeals_list:
            a.badge_info = a.get_status_badge_info()
        
        # 2. حساب الساعات المسجلة والنقاط والمعدل الفصلي للمواد المنشورة وغير المحجوبة
        t_points = 0
        t_creds = 0
        all_registered_credits = 0
        
        for g in grades:
            if g.course:
                cr = g.course.credits or 0
                all_registered_credits += cr
                
                is_pub = getattr(g, 'is_published', False) or getattr(g, 'is_final_published', False) or getattr(g, 'is_midterm_published', False)
                if not getattr(g, 'is_blocked', False) and is_pub:
                    gr = g.total_grade or (g.midterm_grade if getattr(g, 'is_midterm_published', False) else 0) or 0
                    t_points += gr * cr
                    t_creds += cr
        
        total_credits = all_registered_credits
        gpa = round((t_points / t_creds), 2) if t_creds > 0 else 0.00
        
        # 3. حساب المعدل التراكمي الشامل
        try:
            pub_all = get_student_published_grades(student).exclude(is_blocked=True).filter(
                Q(is_published=True) | Q(is_final_published=True) | Q(is_midterm_published=True)
            )
            all_pts = sum((g.total_grade or (g.midterm_grade if getattr(g, 'is_midterm_published', False) else 0) or 0) * (g.course.credits if g.course else 0) for g in pub_all)
            all_crs = sum((g.course.credits if g.course else 0) for g in pub_all)
            cgpa = round(all_pts / all_crs, 2) if all_crs > 0 else gpa
        except Exception:
            cgpa = gpa

    student_name = student.get_full_name() if (student and hasattr(student, 'get_full_name')) else (request.user.get_full_name() or request.user.username)
    student_id = getattr(student, 'student_id', None) or (getattr(student, 'id', None) if student else '--')
    student_major = student.department.name if (student and getattr(student, 'department', None)) else 'قسم تقنية المعلومات'

    context = {
        'user': request.user,
        'student': student,
        'student_obj': student,
        'student_name': student_name,
        'student_id': student_id,
        'student_major': student_major,
        'current_semester': current_semester,
        'is_active_semester': is_active_semester,
        'grades': grades,
        'student_appeals_list': student_appeals_list,
        'student_appeals_count': len(student_appeals_list),
        'gpa': gpa,
        'cgpa': cgpa,
        'total_credits': total_credits,
        'total_courses': total_courses,
    }
    return render(request, 'student/term_result.html', context)


@login_required
def subject_inquiry(request):
    """صفحة استعلام عن مواد الفصل"""
    from apps.renewal.models import Semester, Course, Department, Level
    student = get_student_for_user(request)
    active_sem = Semester.objects.filter(is_active=True).first()
    current_season = active_sem.type if active_sem else 'spring'
    current_year = active_sem.year if active_sem else 2026

    user_role = str(getattr(request.user, 'role', '')).strip().lower()
    user_dept = getattr(request.user, 'department', None)
    is_academic_dept = user_role in ['academic_dept', 'department', 'قسم علمي', 'رئيس قسم', 'رئيس / قسم علمي']

    departments = Department.objects.filter(is_active=True).order_by('name')
    courses = Course.objects.filter(is_active=True).select_related('level').prefetch_related('department').order_by('code')

    if is_academic_dept and user_dept:
        departments = Department.objects.filter(id=user_dept.id)
        courses = courses.filter(department=user_dept)

    context = {
        'user': request.user,
        'student': student,
        'semesters': Semester.objects.all().order_by('-year', '-type'),
        'courses': courses,
        'departments': departments,
        'levels': Level.objects.all().order_by('number'),
        'current_season': current_season,
        'current_year': current_year,
        'is_academic_dept': is_academic_dept,
        'user_dept': user_dept,
    }
    return render(request, 'renewal/subject_inquiry.html', context)


@login_required
def get_qr_code_api(request):
    """API: جلب الـ QR Code الجاهز للطالب أو توليده برابط التحقق الموقّع"""
    try:
        student = get_student_for_user(request)
        if not student:
            return JsonResponse({'success': False, 'message': 'الطالب غير موجود'})

        if student.qr_code:
            return JsonResponse({
                'success': True,
                'qr_code': student.qr_code.url
            })
        
        student.generate_qr_code()
        student.save(update_fields=['qr_code', 'qr_code_data'])
        
        return JsonResponse({
            'success': True,
            'qr_code': student.qr_code.url
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@login_required
@csrf_exempt
def change_password_api(request):
    """API: تغيير كلمة المرور"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'})
    
    try:
        data = json.loads(request.body)
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        user = request.user
        if not user.check_password(old_password):
            return JsonResponse({'success': False, 'message': 'كلمة المرور الحالية غير صحيحة'})
        
        if len(new_password) < 6:
            return JsonResponse({'success': False, 'message': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'})
        
        user.set_password(new_password)
        user.save()
        update_session_auth_hash(request, user)
        
        return JsonResponse({'success': True, 'message': '✅ تم تغيير كلمة المرور بنجاح'})
    
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


# apps/student/views.py

@login_required
def personal_info(request):
    """
    صفحة معلومات الطالب الشخصية والجامعية - تعرض البيانات الحقيقية من قاعدة البيانات
    مع ربط أوتوماتيكي ذكي بين المستخدم والطالب والسجل الأكاديمي
    """
    student = get_student_for_user(request)
    if not student and not getattr(request.user, 'is_student', False) and request.user.role != 'student':
        from apps.users.views import get_redirect_url_based_on_role
        return redirect(get_redirect_url_based_on_role(request.user))
    
    academic_record = None
    if student:
        try:
            academic_record, _ = AcademicRecord.objects.get_or_create(student=student)
            academic_record.calculate_cumulative_record()
        except Exception as e:
            logger.error(f"خطأ أثناء جلب/حساب السجل الأكاديمي بالطالب {student.id}: {e}")
            academic_record = None

    if student and hasattr(student, 'generate_qr_code'):
        try:
            student.generate_qr_code(request=request)
        except Exception:
            pass

    # استخراج البيانات بصورة آمنة تمنع أي AttributeError
    student_name = student.get_full_name() if (student and hasattr(student, 'get_full_name')) else (request.user.get_full_name() or request.user.username)
    student_id = student.student_id if (student and getattr(student, 'student_id', None)) else "--"
    student_major = student.department.name if (student and getattr(student, 'department', None)) else "--"
    student_city = student.current_address.city if (student and getattr(student, 'current_address', None)) else "--"
    student_status = student.student_status.name if (student and getattr(student, 'student_status', None)) else "--"
    student_semester = getattr(student, 'enrollment_semester', None) or getattr(student, 'current_semester', None) or "--"
    student_email = request.user.email or (student.email if student else "--")
    student_phone = student.phone if (student and getattr(student, 'phone', None)) else "--"
    photo_url = student.photo.url if (student and getattr(student, 'photo', None)) else '/static/images/default_avatar.png'
    
    gpa_val = getattr(academic_record, 'cumulative_gpa', 0.0) if academic_record else 0.0
    if gpa_val is None:
        gpa_val = 0.0

    context = {
        'user': request.user,
        'student': student,
        'student_obj': student,
        'academic_record': academic_record,
        'student_name': student_name,
        'student_id': student_id,
        'student_major': student_major,
        'student_city': student_city,
        'student_status': student_status,
        'student_semester': student_semester,
        'student_email': student_email,
        'student_phone': student_phone,
        'photo_url': photo_url,
        'gpa': round(float(gpa_val), 2),
        'cgpa': round(float(gpa_val), 2),
    }

    return render(request, 'student/personal_info.html', context)


# apps/student/views.py
# apps/users/views.py
from django.shortcuts import render, redirect, get_object_or_404
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
from .utils import log_activity
from apps.users.models import ActivityLog, AuditLog
from django.contrib.auth.models import Group, Permission


PERMISSION_TRANSLATIONS = {
    # ============================================
    # الصلاحيات الأساسية
    # ============================================
    'add_user': 'إضافة مستخدم',
    'change_user': 'تعديل مستخدم',
    'delete_user': 'حذف مستخدم',
    'view_user': 'عرض مستخدم',
    
    'add_group': 'إضافة مجموعة',
    'change_group': 'تعديل مجموعة',
    'delete_group': 'حذف مجموعة',
    'view_group': 'عرض مجموعة',
    
    'add_permission': 'إضافة صلاحية',
    'change_permission': 'تعديل صلاحية',
    'delete_permission': 'حذف صلاحية',
    'view_permission': 'عرض صلاحية',
    
    # Log Entry (سجل التدقيق)
    'add_logEntry': 'إضافة سجل تدقيق',
    'change_logEntry': 'تعديل سجل تدقيق',
    'delete_logEntry': 'حذف سجل تدقيق',
    'view_logEntry': 'عرض سجل تدقيق',
    
    # Content Type (نوع المحتوى)
    'add_contenttype': 'إضافة نوع محتوى',
    'change_contenttype': 'تعديل نوع محتوى',
    'delete_contenttype': 'حذف نوع محتوى',
    'view_contenttype': 'عرض نوع محتوى',
    
    # Session (جلسة)
    'add_session': 'إضافة جلسة',
    'change_session': 'تعديل جلسة',
    'delete_session': 'حذف جلسة',
    'view_session': 'عرض جلسة',
    
    # عنوان (Address)
    'add_address': 'إضافة عنوان',
    'change_address': 'تعديل عنوان',
    'delete_address': 'حذف عنوان',
    'view_address': 'عرض عنوان',
    
    # فصيلة دم (BloodType)
    'add_bloodtype': 'إضافة فصيلة دم',
    'change_bloodtype': 'تعديل فصيلة دم',
    'delete_bloodtype': 'حذف فصيلة دم',
    'view_bloodtype': 'عرض فصيلة دم',
    

    # جنس (Gender)
    'add_gender': 'إضافة جنس',
    'change_gender': 'تعديل جنس',
    'delete_gender': 'حذف جنس',
    'view_gender': 'عرض جنس',
    
    # الحالة الاجتماعية (MaritalStatus)
    'add_maritalstatus': 'إضافة حالة اجتماعية',
    'change_maritalstatus': 'تعديل حالة اجتماعية',
    'delete_maritalstatus': 'حذف حالة اجتماعية',
    'view_maritalstatus': 'عرض حالة اجتماعية',
    
    # الجنسية (Nationality)
    'add_nationality': 'إضافة جنسية',
    'change_nationality': 'تعديل جنسية',
    'delete_nationality': 'حذف جنسية',
    'view_nationality': 'عرض جنسية',
    
    # مكان الميلاد (PlaceOfBirth)
    'add_placeofbirth': 'إضافة مكان ميلاد',
    'change_placeofbirth': 'تعديل مكان ميلاد',
    'delete_placeofbirth': 'حذف مكان ميلاد',
    'view_placeofbirth': 'عرض مكان ميلاد',
    
    # المؤهل (Qualification)
    'add_qualification': 'إضافة مؤهل',
    'change_qualification': 'تعديل مؤهل',
    'delete_qualification': 'حذف مؤهل',
    'view_qualification': 'عرض مؤهل',
    
    # الطالب (Student)
    'add_student': 'إضافة طالب',
    'change_student': 'تعديل طالب',
    'delete_student': 'حذف طالب',
    'view_student': 'عرض طالب',
    
    # سجل تعديل طالب (StudentEditLog)
    'add_studenteditlog': 'إضافة سجل تعديل',
    'change_studenteditlog': 'تعديل سجل تعديل',
    'delete_studenteditlog': 'حذف سجل تعديل',
    'view_studenteditlog': 'عرض سجل تعديل',
    
    # حالة طالب (StudentStatus)
    'add_studentstatus': 'إضافة حالة طالب',
    'change_studentstatus': 'تعديل حالة طالب',
    'delete_studentstatus': 'حذف حالة طالب',
    'view_studentstatus': 'عرض حالة طالب',
    
    # نوع طالب (StudentType)
    'add_studenttype': 'إضافة نوع طالب',
    'change_studenttype': 'تعديل نوع طالب',
    'delete_studenttype': 'حذف نوع طالب',
    'view_studenttype': 'عرض نوع طالب',
    
    # ولي أمر (Guardian)
    'add_guardian': 'إضافة ولي أمر',
    'change_guardian': 'تعديل ولي أمر',
    'delete_guardian': 'حذف ولي أمر',
    'view_guardian': 'عرض ولي أمر',
    
    # القسم (Department)
    'add_department': 'إضافة قسم',
    'change_department': 'تعديل قسم',
    'delete_department': 'حذف قسم',
    'view_department': 'عرض قسم',
    
    # المستوى (Level)
    'add_level': 'إضافة مستوى',
    'change_level': 'تعديل مستوى',
    'delete_level': 'حذف مستوى',
    'view_level': 'عرض مستوى',
    
    # الخطة الدراسية (StudyPlan)
    'add_studyplan': 'إضافة خطة دراسية',
    'change_studyplan': 'تعديل خطة دراسية',
    'delete_studyplan': 'حذف خطة دراسية',
    'view_studyplan': 'عرض خطة دراسية',
    
    # المادة (Course)
    'add_course': 'إضافة مادة',
    'change_course': 'تعديل مادة',
    'delete_course': 'حذف مادة',
    'view_course': 'عرض مادة',
    
    # الفصل الدراسي (Semester)
    'add_semester': 'إضافة فصل دراسي',
    'change_semester': 'تعديل فصل دراسي',
    'delete_semester': 'حذف فصل دراسي',
    'view_semester': 'عرض فصل دراسي',
    
    # تجديد قيد (EnrollmentRenewal)
    'add_enrollmentrenewal': 'إضافة تجديد قيد',
    'change_enrollmentrenewal': 'تعديل تجديد قيد',
    'delete_enrollmentrenewal': 'حذف تجديد قيد',
    'view_enrollmentrenewal': 'عرض تجديد قيد',
    
    # تنزيل مادة (CourseRegistration)
    'add_courseregistration': 'إضافة تنزيل مادة',
    'change_courseregistration': 'تعديل تنزيل مادة',
    'delete_courseregistration': 'حذف تنزيل مادة',
    'view_courseregistration': 'عرض تنزيل مادة',
    
    # درجة (Grade)
    'add_grade': 'إضافة درجة',
    'change_grade': 'تعديل درجة',
    'delete_grade': 'حذف درجة',
    'view_grade': 'عرض درجة',
    
    # إعدادات الدرجات (GradeConfiguration)
    'add_gradeconfiguration': 'إضافة إعدادات درجات',
    'change_gradeconfiguration': 'تعديل إعدادات درجات',
    'delete_gradeconfiguration': 'حذف إعدادات درجات',
    'view_gradeconfiguration': 'عرض إعدادات درجات',
    
    # السجل الأكاديمي (AcademicRecord)
    'add_academicrecord': 'إضافة سجل أكاديمي',
    'change_academicrecord': 'تعديل سجل أكاديمي',
    'delete_academicrecord': 'حذف سجل أكاديمي',
    'view_academicrecord': 'عرض سجل أكاديمي',
    
    # تاريخ تعديل درجة (GradeHistory)
    'add_gradehistory': 'إضافة تاريخ تعديل درجة',
    'change_gradehistory': 'تعديل تاريخ تعديل درجة',
    'delete_gradehistory': 'حذف تاريخ تعديل درجة',
    'view_gradehistory': 'عرض تاريخ تعديل درجة',
    
    # إشعار درجات (GradeNotification)
    'add_gradenotification': 'إضافة إشعار درجة',
    'change_gradenotification': 'تعديل إشعار درجة',
    'delete_gradenotification': 'حذف إشعار درجة',
    'view_gradenotification': 'عرض إشعار درجة',
    
    # الوظيفة (Job)
    'add_job': 'إضافة وظيفة',
    'change_job': 'تعديل وظيفة',
    'delete_job': 'حذف وظيفة',
    'view_job': 'عرض وظيفة',
    
    # Activity Log (سجل الأحداث)
    'add_activitylog': 'إضافة سجل حدث',
    'change_activitylog': 'تعديل سجل حدث',
    'delete_activitylog': 'حذف سجل حدث',
    'view_activitylog': 'عرض سجل حدث',
    
    # Audit Log (سجل التدقيق)
    'add_auditlog': 'إضافة سجل تدقيق',
    'change_auditlog': 'تعديل سجل تدقيق',
    'delete_auditlog': 'حذف سجل تدقيق',
    'view_auditlog': 'عرض سجل تدقيق',
}

def translate_permission_name(perm_name):
    """ترجمة اسم الصلاحية"""
    return PERMISSION_TRANSLATIONS.get(perm_name, perm_name)

User = get_user_model()


def login_page(request):
    return render(request, 'users/login.html')

def settings_page(request):
    return render(request, 'users/settings.html')

@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.role == 'admin')
def user_permissions(request):
    # 🔥 جلب المستخدمين الذين ليسوا طلاباً أو أساتذة
    users_list = User.objects.exclude(role__in=['student', 'teacher']).order_by('id')
    context = {'users': users_list}
    return render(request, 'users/permissions.html', context)

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

def login_view(request):
    if request.method == 'POST':
        login_input = (request.POST.get('username') or '').strip()
        password = request.POST.get('password') or ''
        
        user = None
        if login_input:
            user = authenticate(request, username=login_input, password=password)
            if user is None:
                User = get_user_model()
                matched_user = User.objects.filter(email__iexact=login_input).first()
                if matched_user:
                    user = authenticate(request, username=matched_user.username, password=password)
            if user is None:
                try:
                    from apps.student.models import Student
                    student_obj = Student.objects.filter(student_id__iexact=login_input).select_related('user').first()
                    if student_obj and student_obj.user:
                        user = authenticate(request, username=student_obj.user.username, password=password)
                except Exception:
                    pass
        
        if user is not None:
            # 1. توليد رمز عشوائي من 6 أرقام
            otp_code = str(random.randint(100000, 999999))
            
            # 2. حفظ الرمز ومعرف المستخدم في الـ Session مؤقتاً
            request.session['otp_user_id'] = user.id
            request.session['otp_code'] = otp_code
            
            # 3. إرسال الرمز إلى إيميل المستخدم
            subject = 'رمز التحقق لتسجيل الدخول - نظام الكلية'
            message = f'مرحباً {user.username}،\n\nرمز التحقق الخاص بك لتسجيل الدخول هو: {otp_code}\nالرمز صالح لفترة قصيرة.'
            try:
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception as e:
                pass
            
            # 4. التوجيه لصفحة إدخال الرمز
            return redirect('users:verify_otp')
        else:
            messages.error(request, 'اسم المستخدم أو كلمة المرور غير صحيحة')
            
    return render(request, 'users/login.html')

def verify_otp(request):
    """
    التحقق من رمز OTP وتوجيه المستخدم حسب دوره
    """
    # التأكد من أن المستخدم مر بمرحلة اسم المستخدم وكلمة المرور أولاً
    user_id = request.session.get('otp_user_id')
    saved_otp = request.session.get('otp_code')
    
    if not user_id or not saved_otp:
        messages.error(request, 'يرجى تسجيل الدخول أولاً')
        return redirect('users:login')
        
    if request.method == 'POST':
        entered_otp = request.POST.get('otp')
        
        # مطابقة الرمز المدخل مع الرمز المحفوظ في الـ Session
        if entered_otp == saved_otp:
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
            # تسجيل الدخول الفعلي في النظام
            login(request, user)
            
            # 🔥 تنظيف الـ Session من بيانات الـ OTP (مع التحقق من وجودها)
            if 'otp_user_id' in request.session:
                del request.session['otp_user_id']
            if 'otp_code' in request.session:
                del request.session['otp_code']
            
            messages.success(request, f'مرحباً {user.username}! تم تسجيل الدخول بنجاح.')
            
            # التوجيه حسب دور المستخدم
            return redirect_user_to_dashboard(user)
        else:
            messages.error(request, 'رمز التحقق غير صحيح، حاول مرة أخرى.')
            
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
        
        # 🔥 حفظ البيانات القديمة
        old_data = {
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': user.phone,
        }
        
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
        
        # 🔥 حفظ البيانات الجديدة
        new_data = {
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': user.phone,
        }
        
        # 🔥 تسجيل التعديل في AuditLog
        from .utils import log_update
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
    """عرض صفحة إدارة المستخدمين مع إرسال المجموعات والصلاحيات لنموذج الإنشاء"""
    users_list = User.objects.all().order_by('-date_joined')
    paginator = Paginator(users_list, 20)
    page_number = request.GET.get('page')
    users = paginator.get_page(page_number)
    
    all_groups = Group.objects.all()
    all_permissions = Permission.objects.all().select_related('content_type').order_by('content_type__model', 'codename')
    
    # 🔥 ترجمة الصلاحيات باستخدام الدالة translate_permission_name
    translated_permissions = []
    for perm in all_permissions:
        translated_permissions.append({
            'id': perm.id,
            'codename': perm.codename,
            'name': translate_permission_name(perm.name),  # 🔥 استخدم الدالة
            'content_type': perm.content_type,
        })
    
    context = {
        'users': users,
        'all_groups': all_groups,
        'all_permissions': translated_permissions,
        'role_choices': User.ROLE_CHOICES
    }
    return render(request, 'users/manage_users.html', context)



@login_required
@user_passes_test(lambda u: u.role == 'admin')
@csrf_exempt
@require_http_methods(["POST"])
def create_user(request):
    try:
        data = json.loads(request.body)
        user = User.objects.create_user(
            username=data.get('username'),
            email=data.get('email'),
            password=data.get('password'),
            role=data.get('role'),
            phone=data.get('phone', '')
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
@user_passes_test(lambda u: u.role == 'admin')
def get_user_permissions(request, user_id):
    try:
        user = get_object_or_404(User, id=user_id)
        user_permissions = list(user.user_permissions.values_list('codename', flat=True))
        from django.contrib.auth.models import Permission
        all_permissions = Permission.objects.all().values('id', 'codename', 'name')
        
        # 🔥 ترجمة أسماء الصلاحيات باستخدام الدالة
        translated_permissions = []
        for perm in all_permissions:
            translated_permissions.append({
                'id': perm['id'],
                'codename': perm['codename'],
                'name': translate_permission_name(perm['name']),  # 🔥 استخدم الدالة
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
        
        if 'role' in data and data['role'] in ['admin', 'registrar', 'exam_officer', 'graduate_officer', 'teacher', 'student']:
            user.role = data['role']
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
        if new_role in ['admin', 'registrar', 'exam_officer', 'graduate_officer', 'teacher', 'student']:
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
        
        # منع تغيير كلمة مرور المشرف الحالي بواسطة مشرف آخر (اختياري)
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
# أرشيف التعديلات والحذف (AuditLog)
# ============================================

@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.role == 'admin')
def audit_log(request):
    """عرض أرشيف التعديلات والحذف"""
    logs_list = AuditLog.objects.all().order_by('-created_at')
    paginator = Paginator(logs_list, 30)
    page_number = request.GET.get('page')
    logs = paginator.get_page(page_number)
    return render(request, 'users/audit_log.html', {'logs': logs})


@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.role == 'admin')
def filter_audit_log(request):
    """فلترة أرشيف التعديلات والحذف"""
    logs_list = AuditLog.objects.all().order_by('-created_at')
    
    action = request.GET.get('action')
    if action:
        logs_list = logs_list.filter(action=action)
    
    model_name = request.GET.get('model_name')
    if model_name:
        logs_list = logs_list.filter(model_name__icontains=model_name)
    
    user = request.GET.get('user')
    if user:
        logs_list = logs_list.filter(user__username__icontains=user)
    
    paginator = Paginator(logs_list, 30)
    page_number = request.GET.get('page')
    logs = paginator.get_page(page_number)
    return render(request, 'users/audit_log.html', {'logs': logs})


# ============================================
# سجل الأحداث (ActivityLog)
# ============================================

@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.role == 'admin')
def activity_log(request):
    """عرض سجل الأحداث"""
    logs_list = ActivityLog.objects.all().order_by('-created_at')
    paginator = Paginator(logs_list, 50)
    page_number = request.GET.get('page')
    logs = paginator.get_page(page_number)
    return render(request, 'users/activity_log.html', {'logs': logs})


@login_required(login_url='/users/login/')
@user_passes_test(lambda u: u.role == 'admin')
def filter_activity_log(request):
    """فلترة سجل الأحداث"""
    logs_list = ActivityLog.objects.all().order_by('-created_at')
    
    action = request.GET.get('action')
    if action:
        logs_list = logs_list.filter(action=action)
    
    date_from = request.GET.get('date_from')
    if date_from:
        logs_list = logs_list.filter(created_at__date__gte=date_from)
    
    date_to = request.GET.get('date_to')
    if date_to:
        logs_list = logs_list.filter(created_at__date__lte=date_to)
    
    user = request.GET.get('user')
    if user:
        logs_list = logs_list.filter(user__username__icontains=user)
    
    paginator = Paginator(logs_list, 50)
    page_number = request.GET.get('page')
    logs = paginator.get_page(page_number)
    return render(request, 'users/activity_log.html', {'logs': logs})

@login_required
@user_passes_test(lambda u: u.role == 'admin')
def admin_dashboard(request):
    """لوحة تحكم المدير"""
    return render(request, 'users/admin_dashboard.html')


@login_required
@user_passes_test(lambda u: u.role == 'admin')
def add_user(request):
    """صفحة إضافة مستخدم جديد"""
    return render(request, 'users/add_user.html')


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
    تحديد مسار التوجيه بناءً على دور المستخدم
    """
    # التحقق من المجموعات
    user_groups = user.groups.all()
    
    # التحقق من الطالب عبر العلاقة
    try:
        if hasattr(user, 'student') and user.student:
            try:
                return reverse('student:dashboard')
            except:
                pass
    except:
        pass
    
    # التحقق من الأستاذ عبر العلاقة
    try:
        if hasattr(user, 'teacher') and user.teacher:
            try:
                return reverse('teacher:dashboard')
            except:
                pass
    except:
        pass
    
    # التحقق من المجموعات
    for group in user_groups:
        group_name = group.name.lower()
        
        # الطلاب
        if group_name in ['student', 'students', 'طالب', 'طلاب']:
            try:
                return reverse('student:dashboard')
            except:
                pass
        
        # الأساتذة
        elif group_name in ['teacher', 'teachers', 'professor', 'أستاذ', 'أساتذة']:
            try:
                return reverse('teacher:dashboard')
            except:
                pass
        
        # الموظفين
        elif group_name in ['staff', 'employee', 'موظف', 'موظفين']:
            try:
                return reverse('staff:dashboard')
            except:
                pass
        
        # مدير النظام
        elif group_name in ['admin', 'administrator', 'مدير', 'مدير النظام']:
            try:
                return reverse('users:admin_dashboard')
            except:
                pass
        
        # المشرفين
        elif group_name in ['supervisor', 'مشرف']:
            try:
                return reverse('supervisor:dashboard')
            except:
                pass
    
    # التحقق من دور المستخدم في حقل role
    if hasattr(user, 'role'):
        role = user.role.lower()
        if role == 'admin':
            try:
                return reverse('users:admin_dashboard')
            except:
                pass
        elif role in ['exam_director', 'مدير الدراسة والامتحانات', 'مدير ادارة الدراسة والامتحانات']:
            try:
                return reverse('faculty:exam_director_dashboard')
            except:
                pass
        elif role in ['exam_officer', 'exams', 'coordinator', 'study_exams', 'study_and_exams', 'منسق', 'منسقة']:
            try:
                return reverse('faculty:coordinator_dashboard')
            except:
                pass
        elif role in ['registrar', 'graduate_officer']:
            try:
                return reverse('staff:dashboard')
            except:
                pass
        elif role == 'teacher':
            try:
                return reverse('teacher:dashboard')
            except:
                pass
        elif role == 'student':
            try:
                return reverse('student:dashboard')
            except:
                pass
    
    # المستخدمين المميزين
    if user.is_superuser or user.is_staff:
        try:
            return reverse('admin:index')
        except:
            pass
    
    # المسار الافتراضي (لوحة التحكم العامة)
    try:
        return reverse('users:dashboard')
    except:
        return '/'


def redirect_user_to_dashboard(user):
    """
    توجيه المستخدم إلى لوحة التحكم المناسبة
    """
    redirect_url = get_redirect_url_based_on_role(user)
    return redirect(redirect_url)


@login_required
def dashboard_redirect(request):
    """
    إعادة توجيه المستخدم إلى لوحة التحكم المناسبة
    """
    return redirect_user_to_dashboard(request.user)



def verify_student(request, student_id):
    """التحقق من توقيع الـ QR الخاص بالطالب وعرض بيانات القيد"""
    import hmac
    from django.conf import settings
    from django.shortcuts import get_object_or_404
    from .models import Student
    
    # البحث عن الطالب برقم القيد (أو ID في حال تمريره)
    student = Student.objects.filter(student_id=student_id).first()
    if not student:
        student = Student.objects.filter(id=int(student_id) if student_id.isdigit() else -1).first()
        
    if not student:
        return render(request, 'student/verify_student.html', {
            'success': False,
            'message': '❌ لم يتم العثور على أي قيد مطابق لرقم الطالب المدخل!'
        }, status=404)

    signature = request.GET.get('signature', '').strip()
    expected_signature = student.generate_secure_token()
    
    # التحقق من التوقيع الرقمي (Signature) أو مفتاح الـ QR (qr_key)
    is_valid_sig = bool(signature and hmac.compare_digest(signature, expected_signature))
    is_valid_key = bool(signature and student.qr_key and hmac.compare_digest(signature, student.qr_key))
    
    # إذا لم يُمرر signature وطلب من داخل المنظومة أو من رابط صحيح للطالب
    if not signature:
        is_valid_sig = True

    if not is_valid_sig and not is_valid_key:
        return render(request, 'student/verify_student.html', {
            'success': False,
            'message': '❌ رمز QR غير صالح أو تم التلاعب بالرابط!'
        }, status=403)

        
    try:
        from apps.users.utils import log_activity
        log_activity(
            user=request.user if hasattr(request, 'user') and request.user.is_authenticated else None,
            action='view',
            model_name='Student',
            object_name=f"{student.student_id} - {student.get_full_name()}",
            details=f"تم مسح واستعراض رمز QR للطالب ({student.name}) عبر التوقيع الرقمي",
            request=request
        )
    except Exception as e:
        print(f"⚠️ خطأ في تسجيل مسح QR في ActivityLog: {e}")

    return render(request, 'student/verify_student.html', {
        'success': True,
        'student': student
    })


def public_qr_student_view(request, qr_key):
    """
    عرض بيانات الطالب العامة عبر مفتاح QR الفريد بدون تسجيل دخول
    الرابط: /student/qr/<qr_key>/
    """
    from django.shortcuts import render
    from .models import Student
    from apps.users.utils import log_activity

    try:
        student = Student.objects.get(qr_key=qr_key)
    except Student.DoesNotExist:
        try:
            log_activity(
                user=request.user if hasattr(request, 'user') and request.user.is_authenticated else None,
                action='view',
                model_name='Student',
                object_name='Invalid QR Key',
                details=f"محاولة مسح/وصول برمز QR غير صحيح أو محرف: ({qr_key})",
                request=request
            )
        except Exception:
            pass
        return render(request, 'student/verify_student.html', {
            'success': False,
            'message': '❌ مفتاح QR غير صحيح أو رمز التحقق غير موجود بالنظام!'
        }, status=404)
    
    try:
        log_activity(
            user=request.user if hasattr(request, 'user') and request.user.is_authenticated else None,
            action='view',
            model_name='Student',
            object_name=f"{student.student_id} - {student.get_full_name()}",
            details=f"تم مسح واستعراض رمز QR للطالب ({student.name}) بالمفتاح الفريد ({qr_key})",
            request=request
        )
    except Exception as e:
        print(f"⚠️ خطأ في تسجيل مسح QR في ActivityLog: {e}")

    return render(request, 'student/verify_student.html', {
        'success': True,
        'student': student
    })

# اسم مستعار للتوافق
student_qr_detail = public_qr_student_view
verify_student_qr = public_qr_student_view

# apps/student/views.py

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def update_profile_api(request):
    """
    API: تحديث بيانات الطالب الشخصية مع دعم الربط التلقائي
    """
    try:
        data = json.loads(request.body)
        
        # جلب الطالب - مع محاولة الربط التلقائي
        student = None
        user = request.user
        
        # 1. محاولة جلب الطالب بالعلاقة المباشرة
        try:
            student = user.student
        except:
            student = None
        
        # 2. إذا لم يوجد، نحاول البحث
        if student is None:
            # البحث بالبريد الإلكتروني
            if user.email:
                student = Student.objects.filter(email=user.email).first()
            
            # البحث برقم الهاتف
            if student is None and hasattr(user, 'phone') and user.phone:
                student = Student.objects.filter(phone=user.phone).first()
            
            # البحث برقم القيد
            if student is None:
                student = Student.objects.filter(student_id=user.username).first()
            
            # إذا وجدنا الطالب، نربطه
            if student:
                student.user = user
                student.save(update_fields=['user'])
                logger.info(f"🔗 تم ربط المستخدم {user.username} بالطالب {student.student_id} عبر API")
        
        # إذا لم نجد طالباً
        if student is None:
            return JsonResponse({'success': False, 'error': 'لم يتم العثور على سجل أكاديمي مرتبط بحسابك'})
        
        # تحديث بيانات المستخدم
        if 'full_name' in data and data['full_name'].strip():
            name_parts = data['full_name'].strip().split(' ', 1)
            user.first_name = name_parts[0]
            user.last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        if 'email' in data and data['email'].strip():
            if User.objects.filter(email=data['email']).exclude(id=user.id).exists():
                return JsonResponse({'success': False, 'error': 'البريد الإلكتروني موجود بالفعل'})
            user.email = data['email'].strip()
            # تحديث البريد الإلكتروني في سجل الطالب أيضاً
            student.email = data['email'].strip()
        
        if 'phone' in data and data['phone'].strip():
            user.phone = data['phone'].strip()
            # تحديث رقم الهاتف في سجل الطالب أيضاً
            student.phone = data['phone'].strip()
        
        user.save()
        
        # تحديث بيانات الطالب
        if 'city' in data and data['city'].strip():
            if hasattr(student, 'city'):
                student.city = data['city'].strip()
            elif hasattr(student, 'current_address') and student.current_address:
                student.current_address.city = data['city'].strip()
                student.current_address.save()
        
        student.save()
        
        # تسجيل النشاط
        log_activity(request.user, 'update', model_name='Student', object_name=student.student_id,
                     details=f'تحديث بيانات الطالب {student.student_id}', request=request)
        
        return JsonResponse({'success': True, 'message': '✅ تم تحديث البيانات بنجاح'})
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'بيانات غير صالحة'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
# apps/student/views.py

@login_required
def debug_student_data(request):
    """
    صفحة للتحقق من بيانات الطالب (للتطوير فقط)
    """
    user = request.user
    student = None
    
    try:
        student = user.student
    except:
        pass
    
    data = {
        'user_id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'has_student': student is not None,
        'student_id': student.student_id if student else None,
        'student_name': student.name if student else None,
        'student_email': student.email if student else None,
        'student_phone': student.phone if student else None,
    }
    
    return JsonResponse(data)


# ================================================================
# REST API Endpoints لـ تطبيق الطالب (PostgreSQL Integration)
# ================================================================

from .serializers import serialize_student_profile, serialize_course_registration, serialize_student_grade

def get_student_from_request(request):
    """دالة مساعدة لجلب الطالب من المستخدم الحالي أو من معامل الاستعلام"""
    if not request.user or not request.user.is_authenticated:
        return None, JsonResponse({'success': False, 'error': 'المستخدم غير مسجل الدخول'}, status=401)
    
    student = getattr(request.user, 'student', None)
    
    if not student and (request.user.is_staff or request.user.is_superuser or request.user.role == 'admin'):
        query_sid = request.GET.get('student_id')
        if query_sid:
            student = Student.objects.filter(
                Q(student_id=query_sid) | Q(id=query_sid)
            ).first()

    if not student:
        return None, JsonResponse({'success': False, 'error': 'ملف الطالب غير موجود'}, status=404)
        
    return student, None


def api_student_profile(request):
    """API: إرجاع ملف الطالب الشخصي بحالة HTTP صريحة (200 OK, 401, 404)"""
    student, error_response = get_student_from_request(request)
    if error_response:
        return error_response

    try:
        # تحديث السجل الأكاديمي تلقائياً قبل إرجاع البيانات
        academic_rec, _ = AcademicRecord.objects.get_or_create(student=student)
        academic_rec.calculate_cumulative_record()
        academic_rec.save()

        profile_data = serialize_student_profile(student)
        return JsonResponse({
            'success': True,
            'profile': profile_data
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


def api_student_courses(request):
    """API: إرجاع قائمة المواد المسجلة للطالب"""
    student, error_response = get_student_from_request(request)
    if error_response:
        return error_response
        
    try:
        semester_id = request.GET.get('semester_id')
        
        registrations = CourseRegistration.objects.filter(student=student).select_related('course', 'semester', 'course__level').prefetch_related('course__department')
        
        if semester_id:
            try:
                registrations = registrations.filter(semester_id=int(semester_id))
            except ValueError:
                return JsonResponse({'success': False, 'error': 'معامل الفصل الدراسي غير صحيح'}, status=400)

        courses_data = [serialize_course_registration(r) for r in registrations if r.course]
        
        return JsonResponse({
            'success': True,
            'count': len(courses_data),
            'courses': courses_data
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


def api_student_grades(request):
    """API: إرجاع كشف درجات الطالب مع الفلترة وتفاصيل الحجب والنشر"""
    student, error_response = get_student_from_request(request)
    if error_response:
        return error_response
        
    try:
        semester_id = request.GET.get('semester_id')
        course_id = request.GET.get('course_id')

        grades_qs = get_student_published_grades(student)
        
        if semester_id:
            try:
                grades_qs = grades_qs.filter(semester_id=int(semester_id))
            except ValueError:
                return JsonResponse({'success': False, 'error': 'معامل الفصل الدراسي غير صحيح'}, status=400)

        if course_id:
            try:
                grades_qs = grades_qs.filter(course_id=int(course_id))
            except ValueError:
                return JsonResponse({'success': False, 'error': 'معامل المادة غير صحيح'}, status=400)

        grades_data = [serialize_student_grade(g) for g in grades_qs if g.course]

        # تجميع وحساب المعدل التراكمي من الفصول المعتمدة والمنشورة فقط
        sem_groups = {}
        for g in grades_qs:
            if not g.semester or not g.course:
                continue
            s_id = g.semester.id
            if s_id not in sem_groups:
                sem_groups[s_id] = {'grades': [], 'is_approved': True}
            is_blk = getattr(g, 'is_blocked', False)
            is_pub = getattr(g, 'is_published', False) or getattr(g, 'is_final_published', False)
            if is_blk or not is_pub:
                sem_groups[s_id]['is_approved'] = False
            sem_groups[s_id]['grades'].append(g)

        total_points = 0
        total_credits = 0
        for s_id, s_data in sem_groups.items():
            if s_data['is_approved']:
                for g in s_data['grades']:
                    total_points += (g.total_grade or 0) * (g.course.credits or 0)
                    total_credits += (g.course.credits or 0)

        gpa = round((total_points / total_credits), 2) if total_credits > 0 else 0.0

        return JsonResponse({
            'success': True,
            'count': len(grades_data),
            'gpa': gpa,
            'grades': grades_data
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


def api_student_summary(request):
    """API: ملخص شامل لداشبورد الطالب (الملف الشخصي + المواد الحالية + كشف الدرجات)"""
    student, error_response = get_student_from_request(request)
    if error_response:
        return error_response
        
    try:
        profile_data = serialize_student_profile(student)
        
        current_semester = Semester.objects.filter(is_active=True).first()
        reg_qs = CourseRegistration.objects.filter(student=student).select_related('course', 'semester')
        if current_semester:
            current_regs = reg_qs.filter(semester=current_semester)
        else:
            current_regs = reg_qs[:10]

        grades_qs = get_student_published_grades(student)

        return JsonResponse({
            'success': True,
            'summary': {
                'profile': profile_data,
                'active_semester': {
                    'id': current_semester.id if current_semester else None,
                    'year': current_semester.year if current_semester else None,
                    'type': current_semester.type if current_semester else None,
                    'display': f"{current_semester.year} - {current_semester.get_type_display()}" if current_semester else '-',
                },
                'registered_courses_count': current_regs.count(),
                'current_courses': [serialize_course_registration(r) for r in current_regs],
                'grades': [serialize_student_grade(g) for g in grades_qs],
            }
        }, status=200)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


def api_student_semesters(request):
    """API: إرجاع قائمة الفصول الدراسية المتاحة للطالب (لدعم الـ dropdown في الواجهة)"""
    if not request.user or not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'غير مسجل الدخول'}, status=401)

    try:
        student = getattr(request.user, 'student', None)

        if student:
            # الفصول التي يوجد فيها درجات معتمدة/محجوبة للطالب
            semester_ids = get_student_published_grades(student).values_list('semester_id', flat=True).distinct()
            semesters = Semester.objects.filter(id__in=semester_ids).order_by('-year', '-type')
        else:
            # للأدمن: كل الفصول
            semesters = Semester.objects.all().order_by('-year', '-type')

        semesters_data = [
            {
                'id': s.id,
                'year': s.year,
                'type': s.type,
                'display': f"{s.year} - {s.get_type_display()}",
                'is_active': s.is_active,
            }
            for s in semesters
        ]

        active = Semester.objects.filter(is_active=True).first()
        return JsonResponse({
            'success': True,
            'semesters': semesters_data,
            'active_semester_id': active.id if active else None,
        }, status=200)

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

