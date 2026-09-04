# apps/faculty/views.py
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.core.serializers.json import DjangoJSONEncoder
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Count, Sum, Avg
import json

from apps.renewal.models import Course, Level, Group, Department, Semester, Specialization
from apps.student.models import Student
from apps.faculty.models import Professor, CourseAssignment, AttendanceRecord, DepartmentStaff
from apps.users.permissions import (
    role_required, admin_required, exam_director_required,
    registrar_required, academic_dept_required, staff_required
)


# ============================================================
# 1. دوال الصفحات (Page Views)
# ============================================================

# apps/faculty/views.py - دالة sections

from apps.users.utils import log_activity, log_create, log_update, log_delete

@login_required
def sections(request):
    """
    صفحة إدارة الأقسام - تجهيز البيانات للـ Frontend
    """
    courses_qs = Course.objects.filter(is_active=True).prefetch_related('department').select_related('level')
    courses = []
    for c in courses_qs:
        dept_ids = list(c.department.values_list('id', flat=True))
        courses.append({
            'id': c.id,
            'name': c.name,
            'code': c.code,
            'level_id': c.level_id,
            'level_number': c.level.number if c.level else None,
            'department_id': dept_ids[0] if dept_ids else None,
            'department_ids': dept_ids,
        })
    levels = Level.objects.all().order_by('number').values('id', 'number', 'name')
    
    active_semester = Semester.objects.filter(is_active=True).first()
    active_year = str(active_semester.year) if active_semester else ''
    active_semester_type = active_semester.type if active_semester else ''

    # 🔥 جلب كل المجموعات مع ربطها بالأقسام والمستويات والسنة الدراسية والفصل
    groups = Group.objects.all().values('id', 'name', 'department_id', 'level_id', 'academic_year', 'semester')
    
    departments = Department.objects.filter(is_active=True).values('id', 'name', 'code')
    
    from apps.renewal.views import get_add_instructor_job_info, get_add_staff_job_info
    instructor_info = get_add_instructor_job_info()
    staff_info = get_add_staff_job_info()

    # 🛡️ توثيق زيارة صفحة إدارة الأقسام الأكاديمية
    try:
        log_activity(
            user=request.user,
            action='view_sections',
            model_name='Department',
            object_name='إدارة الأقسام الأكاديمية',
            details='قام المستخدِم بتصفح واستعراض صفحة إدارة الأقسام الأكاديمية والأساتذة والموظفين',
            request=request
        )
    except Exception:
        pass

    context = {
        'courses_data': json.dumps(list(courses), cls=DjangoJSONEncoder),
        'levels_data': json.dumps(list(levels), cls=DjangoJSONEncoder),
        'groups_data': json.dumps(list(groups), cls=DjangoJSONEncoder),
        'departments_data': json.dumps(list(departments), cls=DjangoJSONEncoder),
        'active_academic_year': active_year,
        'active_semester_type': active_semester_type,
        'is_add_instructor_open': instructor_info['is_add_instructor_open'],
        'add_instructor_message': instructor_info['add_instructor_message'],
        'is_add_staff_open': staff_info['is_add_staff_open'],
        'add_staff_message': staff_info['add_staff_message'],
    }
    
    return render(request, 'faculty/Sections.html', context)


@login_required
def grade_entry(request):
    return render(request, 'grades/grade_entry.html')


@login_required
def attendance_report(request):
    return render(request, 'faculty/attendance_sheet.html')


@login_required
def group_reports(request):
    return render(request, 'faculty/Sections.html')


@login_required
def profile_page(request):
    return render(request, 'faculty/profile.html')


@login_required
def general_department(request):
    return render(request, 'faculty/general.html')


@login_required
def programming_department(request):
    return render(request, 'faculty/programming.html')


@login_required
def business_department(request):
    return render(request, 'faculty/business.html')


@login_required
def accounting_department(request):
    return render(request, 'faculty/accounting.html')


@login_required
def finance_department(request):
    return render(request, 'faculty/finance.html')


@login_required
def arts_department(request):
    return render(request, 'faculty/arts.html')


@login_required
def optics_department(request):
    return render(request, 'faculty/optics.html')


@login_required
def fashion_department(request):
    return render(request, 'faculty/fashion.html')


@login_required
def student_form_print(request):
    """
    نموذج تسجيل طالب للطباعة - Student Registration Form
    جلب اسم موظف التسجيل الحالي والمسؤولين المعتمدين من الجلسة وقاعدة البيانات ديناميكياً
    """
    from apps.users.models import get_official, get_official_object

    user = request.user
    user_full_name = ""
    if user and user.is_authenticated:
        user_full_name = user.get_full_name().strip()
        if not user_full_name:
            user_full_name = user.username

    # جلب المسؤولين المعتمدين من جدول إدارة المسؤولين (Official)
    admission_official = get_official_object('admission')
    admission_official_name = get_official('admission', default='')

    registrar_official = get_official_object('registrar')
    registrar_official_name = get_official('registrar', default='')

    context = {
        'employee_name': user_full_name,
        'user_full_name': user_full_name,
        'admission_official': admission_official,
        'admission_official_name': admission_official_name,
        'registrar_official': registrar_official,
        'registrar_official_name': registrar_official_name,
    }
    return render(request, 'faculty/student_form_print.html', context)


def is_valid_filter(val):
    if val is None:
        return False
    val_str = str(val).strip().lower()
    return val_str not in ['', 'all', 'null', 'undefined', 'none', 'every', 'كل الأقسام', 'الكل', '-- الكل --']


@login_required
def attendance_sheet(request):
    """
    صفحة كشف حضور وغياب الطلاب - Dynamic Database Integration
    ترتيب الطلاب أَبَجَدِيّاً المباشر بحسب الاسم الكامل، وربط كليات ومجموعات ومواد قاعدة البيانات.
    """
    departments = Department.objects.filter(is_active=True).order_by('name')
    groups = Group.objects.all().order_by('name')
    courses = Course.objects.all().order_by('name')
    semesters = Semester.objects.all().order_by('-year', '-type')
    levels = Level.objects.all().order_by('name')
    
    # 1. الاستعلام الأبجدي عن الطلاب بحسب الاسم الكامل
    students_qs = Student.objects.all().select_related(
        'department', 'group', 'level'
    ).order_by('name')
    
    # 2. الفلترة المباشرة عند التمرير بـ GET
    dept_param = request.GET.get('department')
    if is_valid_filter(dept_param):
        students_qs = students_qs.filter(
            Q(department__id=dept_param) | Q(department__name=dept_param)
        )
        
    group_param = request.GET.get('group')
    if is_valid_filter(group_param):
        students_qs = students_qs.filter(
            Q(group__id=group_param) | Q(group__name=group_param)
        )

    # 3. بناء مصفوفات البيانات
    students_data = []
    students_by_group = {}
    
    for s in students_qs:
        full_name = f"{s.name} {s.father_name or ''} {s.grandfather_name or ''} {s.last_name or ''}"
        full_name = " ".join(full_name.split())
        
        grp_name = s.group.name if s.group else "المجموعة الأولى"
        dept_name = s.department.name if s.department else "عام"
        
        st_obj = {
            'id': s.student_id or str(s.id),
            'name': full_name,
            'dept': dept_name,
            'dept_id': s.department.id if s.department else None,
            'group': grp_name,
            'group_id': s.group.id if s.group else None,
            'level': s.level.name if s.level else "الأول",
        }
        
        students_data.append(st_obj)
        
        if grp_name not in students_by_group:
            students_by_group[grp_name] = []
        students_by_group[grp_name].append(st_obj)

    departments_list = list(departments.values('id', 'name'))
    groups_list = list(groups.values('id', 'name'))
    courses_list = list(courses.values('id', 'code', 'name'))
    semesters_list = list(semesters.values('id', 'year', 'type'))

    context = {
        'departments': departments,
        'groups': groups,
        'courses': courses,
        'semesters': semesters,
        'levels': levels,
        'students_list': students_data,
        'students_by_group_json': json.dumps(students_by_group, ensure_ascii=False),
        'students_json': json.dumps(students_data, ensure_ascii=False),
        'departments_json': json.dumps(departments_list, ensure_ascii=False),
        'groups_json': json.dumps(groups_list, ensure_ascii=False),
        'courses_json': json.dumps(courses_list, ensure_ascii=False),
        'semesters_json': json.dumps(semesters_list, ensure_ascii=False),
    }

    return render(request, 'faculty/attendance_sheet.html', context)


@login_required
@csrf_exempt
def save_attendance_api(request):
    """API: حفظ وتحديث سجلات الحضور والغياب في قاعدة البيانات"""
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'طريقة الطلب غير مدعومة'}, status=405)
        
    try:
        data = json.loads(request.body)
        records = data.get('records', [])
        course_id = data.get('course_id')
        group_id = data.get('group_id')
        dept_id = data.get('department_id')
        day_num = int(data.get('day_number', 1))
        
        course = Course.objects.filter(id=course_id).first() if course_id else None
        group = Group.objects.filter(id=group_id).first() if group_id else None
        dept = Department.objects.filter(id=dept_id).first() if dept_id else None
        
        saved_count = 0
        for rec in records:
            st_id = rec.get('student_id')
            status = rec.get('status', 'present')
            student = Student.objects.filter(Q(student_id=st_id) | Q(id=st_id)).first()
            if student:
                AttendanceRecord.objects.update_or_create(
                    student=student,
                    day_number=day_num,
                    defaults={
                        'course': course,
                        'group': group,
                        'department': dept,
                        'status': status,
                    }
                )
                saved_count += 1
                
        return JsonResponse({
            'status': 'success',
            'message': f'تم حفظ سجل الحضور والغياب لـ {saved_count} طالب بنجاح.',
            'saved_count': saved_count
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
def exam_attendance_form(request):
    return render(request, 'faculty/exam_attendance_form.html')


@login_required
def department_view(request, dept_name):
    """عرض صفحة القسم حسب الاسم"""
    template_map = {
        'general': 'faculty/general.html',
        'programming': 'faculty/programming.html',
        'business': 'faculty/business.html',
        'accounting': 'faculty/accounting.html',
        'finance': 'faculty/finance.html',
        'arts': 'faculty/arts.html',
        'optics': 'faculty/optics.html',
        'fashion': 'faculty/fashion.html',
    }
    
    template = template_map.get(dept_name, 'faculty/general.html')
    return render(request, template, {'department': dept_name})


# ============================================================
# 2. دوال API (للـ Alpine.js)
# ============================================================

def get_department_staff_list(department):
    """
    جلب قائمة الموظفين للقسم مع إدراج رئيس القسم العلمي تلقائياً وبدون تكرار
    """
    from apps.users.models import User
    
    staff_data = []
    
    # 1. جلب رئيس القسم العلمي المسمى في جدول المستخدمين (User)
    dept_head_user = User.objects.filter(
        department=department,
        role='academic_dept'
    ).first()
    
    head_email = (dept_head_user.email or '').strip().lower() if (dept_head_user and dept_head_user.email) else ''
    head_name = (dept_head_user.get_full_name() or dept_head_user.username).strip() if dept_head_user else ''
    
    head_included = False
    
    # 2. جلب الموظفين من جدول DepartmentStaff
    staff_members = DepartmentStaff.objects.filter(department=department)
    
    for st in staff_members:
        st_name = (st.full_name or '').strip()
        st_email = (st.email or '').strip().lower()
        
        is_head_role = 'رئيس' in (st.role or '')
        
        # التثبت من تطابق بيانات الموظف مع رئيس القسم المسمى
        if dept_head_user and (
            (head_email and st_email == head_email) or
            (head_name and st_name == head_name) or
            is_head_role
        ):
            is_head_role = True
            head_included = True
            
        staff_data.append({
            'id': st.id,
            'name': st.full_name,
            'email': st.email or '',
            'role': st.role if not is_head_role else (st.role if 'رئيس' in st.role else 'رئيس القسم العلمي'),
            'is_head': is_head_role,
            'disabled': not st.is_active
        })
        
    # 3. إذا كان هناك رئيس قسم مسمى في User ولم يسبق إدراجه في DepartmentStaff، نضيفه تلقائياً كأول عنصر
    if dept_head_user and not head_included:
        staff_data.insert(0, {
            'id': f"user_head_{dept_head_user.id}",
            'name': head_name,
            'email': dept_head_user.email or '',
            'role': 'رئيس القسم العلمي',
            'is_head': True,
            'disabled': not dept_head_user.is_active
        })
        
    return staff_data


@login_required
def get_departments_api(request):
    """
    API: جلب جميع الأقسام مع الأساتذة والمواد المسندة والموظفين (شاملة رئيس القسم)
    """
    try:
        current_semester = Semester.objects.filter(is_active=True).first()
        departments = Department.objects.filter(is_active=True)
        
        data = {}
        for dept in departments:
            # جلب الأساتذة في هذا القسم (كلهم، مع تحديد الحالة)
            professors = Professor.objects.filter(
                department=dept
            ).prefetch_related(
                'courseassignment_set__course',
                'courseassignment_set__level',
                'courseassignment_set__student_group'
            )
            prof_data = []
            for prof in professors:
                assignments = prof.courseassignment_set.filter(is_active=True)
                if current_semester:
                    assignments = assignments.filter(semester=current_semester)
                else:
                    assignments = assignments.none()
                subjects = []
                for assignment in assignments:
                    subjects.append({
                        'course_id': assignment.course.id,
                        'course_name': assignment.course.name,
                        'course_code': assignment.course.code,
                        'level_id': assignment.level.id if assignment.level else 0,
                        'level_number': assignment.level.number if assignment.level else 0,
                        'group_id': assignment.student_group.id if assignment.student_group else 0,
                        'group_name': assignment.student_group.name if assignment.student_group else '-',
                    })
                
                prof_data.append({
                    'id': prof.id,
                    'name': prof.full_name,
                    'email': prof.email,
                    'subjects': subjects,
                    'disabled': not prof.is_active
                })
            
            # جلب الموظفين التابعين للقسم مع رئيس القسم تلقائياً
            staff_data = get_department_staff_list(dept)
            
            data[str(dept.id)] = {
                'id': dept.id,
                'name': dept.name,
                'code': dept.code,
                'professors': prof_data,
                'staff': staff_data
            }
        
        return JsonResponse({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=400)


@login_required
def get_department_data_api(request, dept_id):
    """
    API: جلب بيانات قسم محدد (الأساتذة والمواد المسندة والموظفين شاملة رئيس القسم)
    """
    try:
        current_semester = Semester.objects.filter(is_active=True).first() or Semester.objects.first()
        department = get_object_or_404(Department, id=dept_id)
        
        # جلب الأساتذة في هذا القسم مع موادهم المسندة (بما في ذلك المعطلين)
        professors = Professor.objects.filter(
            department=department
        ).prefetch_related(
            'courseassignment_set__course',
            'courseassignment_set__level',
            'courseassignment_set__student_group'
        )
        
        prof_data = []
        for prof in professors:
            assignments = prof.courseassignment_set.filter(is_active=True)
            if current_semester:
                assignments = assignments.filter(semester=current_semester)
            subjects = []
            for assignment in assignments:
                subjects.append({
                    'course_id': assignment.course.id,
                    'course_name': assignment.course.name,
                    'course_code': assignment.course.code,
                    'level_id': assignment.level.id if assignment.level else 0,
                    'level_number': assignment.level.number if assignment.level else 0,
                    'group_id': assignment.student_group.id if assignment.student_group else 0,
                    'group_name': assignment.student_group.name if assignment.student_group else '-',
                })
            
            prof_data.append({
                'id': prof.id,
                'name': prof.full_name,
                'email': prof.email,
                'subjects': subjects,
                'disabled': not prof.is_active
            })

        # جلب الموظفين مع رئيس القسم تلقائياً وبدون تكرار
        staff_data = get_department_staff_list(department)
        
        return JsonResponse({
            'status': 'success',
            'success': True,
            'department': {
                'id': department.id,
                'name': department.name,
                'code': department.code,
                'professors': prof_data,
                'staff': staff_data
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'success': False,
            'message': str(e)
        }, status=400)


# apps/faculty/views.py - تعديل دالة save_professor_api

# apps/faculty/views.py - تعديل دالة save_professor_api

@login_required
@csrf_exempt
def save_professor_api(request):
    """
    API: حفظ أستاذ جديد أو تحديث موجود مع إسناد المواد
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'}, status=405)
    
    try:
        data = json.loads(request.body)
        professor_id = data.get('id')
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        department_id = data.get('department_id')
        subjects = data.get('subjects', [])
        
        # التحقق من البيانات
        if not name:
            return JsonResponse({'success': False, 'message': 'الاسم مطلوب'})
        
        department = get_object_or_404(Department, id=department_id)
        
        # 🛑 حظر إضافة أساتذة جدد إذا كان القسم غير مفعّل أو الصلاحية موقوفة
        if not professor_id:
            from apps.renewal.views import get_add_instructor_job_info
            instructor_info = get_add_instructor_job_info()
            if not instructor_info['is_add_instructor_open']:
                return JsonResponse({'success': False, 'message': instructor_info['add_instructor_message'] or 'عذراً، خدمة إضافة أستاذ جديد غير مفعلة حالياً في إدارة الوظائف.'})

        if not department.is_active and not professor_id:
            return JsonResponse({'success': False, 'message': f'عذراً، قسم ({department.name}) غير مفعّل حالياً ولا يمكن إضافة أساتذة جدد له.'})
        
        # ============================================================
        # 1. حفظ أو تحديث الأستاذ
        # ============================================================
        if professor_id:
            professor = get_object_or_404(Professor, id=professor_id)
            professor.full_name = name
            professor.email = email
            professor.department = department
            professor.save()
            print(f"✅ تم تحديث الأستاذ: {professor.full_name} (ID: {professor.id})")
        else:
            professor = Professor.objects.create(
                full_name=name,
                email=email,
                department=department,
                is_active=True
            )
            print(f"✅ تم إنشاء أستاذ جديد: {professor.full_name} (ID: {professor.id})")
        
        # ============================================================
        # 2. معالجة التكليفات - 🔥 إزالة الحذف التلقائي
        # ============================================================
        
        # جلب الفصل الدراسي النشط
        current_semester = Semester.objects.filter(is_active=True).first()
        if not current_semester:
            current_semester = Semester.objects.first()
        
        if not current_semester:
            return JsonResponse({
                'success': False, 
                'message': 'لا يوجد فصل دراسي نشط أو معرّف في النظام'
            })
        
        # ============================================================
        # 3. حالة التحديث: نضيف فقط المواد الجديدة (لا نحذف القديم)
        # ============================================================
        if professor_id:
            # 🔥 لا نحذف التكليفات القديمة
            # نضيف فقط المواد الجديدة التي تم اختيارها
            added_count = 0
            for subject in subjects:
                course_id = subject.get('course_id')
                level_id = subject.get('level_id')
                group_id = subject.get('group_id')
                
                if course_id:
                    if not level_id:
                        c_temp = Course.objects.filter(id=course_id).first()
                        level_id = c_temp.level_id if (c_temp and c_temp.level_id) else (Level.objects.first().id if Level.objects.exists() else None)
                    if not group_id:
                        g_temp = Group.objects.first()
                        group_id = g_temp.id if g_temp else None

                if course_id and level_id and group_id:
                    try:
                        # التحقق من عدم وجود تكليف مكرر
                        existing = CourseAssignment.objects.filter(
                            professor=professor,
                            course_id=course_id,
                            student_group_id=group_id,
                            semester=current_semester
                        ).first()
                        
                        if not existing:
                            course = Course.objects.get(id=course_id, is_active=True)
                            level = Level.objects.get(id=level_id)
                            group = Group.objects.get(id=group_id)
                            
                            CourseAssignment.objects.create(
                                professor=professor,
                                course=course,
                                department=department,
                                level=level,
                                student_group=group,
                                semester=current_semester,
                                is_active=True
                            )
                            added_count += 1
                            print(f"✅ تم إضافة تكليف جديد: {course.name} للأستاذ {professor.full_name}")
                        else:
                            print(f"ℹ️ التكليف موجود مسبقاً: {course.name} - {group.name}")
                            
                    except Course.DoesNotExist:
                        print(f"⚠️ المادة {course_id} غير موجودة")
                    except Level.DoesNotExist:
                        print(f"⚠️ المستوى {level_id} غير موجود")
                    except Group.DoesNotExist:
                        print(f"⚠️ المجموعة {group_id} غير موجودة")
                    except Exception as e:
                        print(f"❌ خطأ في إضافة التكليف: {str(e)}")
            
            if added_count > 0:
                print(f"✅ تم إضافة {added_count} تكليفات جديدة للأستاذ {professor.full_name}")
            else:
                print(f"ℹ️ لا توجد مواد جديدة للإضافة للأستاذ {professor.full_name}")
        
        # ============================================================
        # 4. حالة الإنشاء: نضيف جميع المواد
        # ============================================================
        else:
            created_count = 0
            for subject in subjects:
                course_id = subject.get('course_id')
                level_id = subject.get('level_id')
                group_id = subject.get('group_id')
                
                if course_id:
                    if not level_id:
                        c_temp = Course.objects.filter(id=course_id).first()
                        level_id = c_temp.level_id if (c_temp and c_temp.level_id) else (Level.objects.first().id if Level.objects.exists() else None)
                    if not group_id:
                        g_temp = Group.objects.first()
                        group_id = g_temp.id if g_temp else None

                if course_id and level_id and group_id:
                    try:
                        course = Course.objects.get(id=course_id, is_active=True)
                        level = Level.objects.get(id=level_id)
                        group = Group.objects.get(id=group_id)
                        
                        CourseAssignment.objects.create(
                            professor=professor,
                            course=course,
                            department=department,
                            level=level,
                            student_group=group,
                            semester=current_semester,
                            is_active=True
                        )
                        created_count += 1
                        print(f"✅ تم إسناد {course.name} للأستاذ {professor.full_name}")
                        
                    except Course.DoesNotExist:
                        print(f"⚠️ المادة {course_id} غير موجودة")
                    except Level.DoesNotExist:
                        print(f"⚠️ المستوى {level_id} غير موجود")
                    except Group.DoesNotExist:
                        print(f"⚠️ المجموعة {group_id} غير موجودة")
                    except Exception as e:
                        print(f"❌ خطأ في إسناد المادة: {str(e)}")
            
            print(f"✅ تم إنشاء {created_count} تكليف للأستاذ الجديد {professor.full_name}")
        
        # 🛡️ توثيق إضافة/تعديل الأستاذ في سجل الأحداث
        try:
            act_type = 'update' if professor_id else 'create'
            act_details = f"تعديل بيانات الأستاذ ({professor.full_name}) في قسم {department.name}" if professor_id else f"إضافة أستاذ جديد ({professor.full_name}) إلى قسم {department.name}"
            log_activity(
                user=request.user,
                action=act_type,
                model_name='Professor',
                object_name=professor.full_name,
                details=act_details,
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': f'تم الحفظ بنجاح',
            'professor_id': professor.id
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'بيانات غير صالحة'}, status=400)
    except Exception as e:
        print(f"❌ خطأ في save_professor_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
@csrf_exempt
def toggle_professor_api(request, prof_id):
    """
    API: تعطيل أو تفعيل أستاذ
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'status': 'error', 'message': 'طريقة غير مسموحة'}, status=405)
    
    try:
        prof_id_clean = int(str(prof_id).replace('prof_', '').strip())
        professor = get_object_or_404(Professor, id=prof_id_clean)
        professor.is_active = not professor.is_active
        professor.save()
        
        # تعطيل/تفعيل الإسنادات أيضاً
        CourseAssignment.objects.filter(professor=professor).update(is_active=professor.is_active)
        
        status = 'تم تفعيل حساب الأستاذ' if professor.is_active else 'تم تعطيل حساب الأستاذ'
        
        # 🛡️ توثيق تغيير الحالة في سجل النشاطات
        try:
            log_activity(
                user=request.user,
                action='update',
                model_name='Professor',
                object_name=professor.full_name,
                details=f"{status} ({professor.full_name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'status': 'success',
            'message': f'{status} بنجاح',
            'is_active': professor.is_active
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'status': 'error', 'message': str(e)}, status=400)
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
def get_courses_by_department_api(request, dept_id):
    """
    API: جلب المواد حسب القسم
    """
    try:
        department = get_object_or_404(Department, id=dept_id)
        
        courses = Course.objects.filter(
            department=department,
            is_active=True
        ).values('id', 'name', 'code', 'credits')
        
        return JsonResponse({
            'success': True,
            'courses': list(courses)
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=400)


@login_required
def get_levels_api(request):
    """
    API: جلب جميع المستويات الأكاديمية
    """
    try:
        levels = Level.objects.all().values('id', 'number', 'name')
        return JsonResponse({
            'success': True,
            'levels': list(levels)
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=400)


@login_required
def get_groups_api(request):
    """API: جلب المجموعات مع بيانات القسم والمستوى والسنة المفعلة"""
    try:
        groups = Group.objects.all().values('id', 'name', 'department_id', 'level_id', 'academic_year', 'semester')
        return JsonResponse({
            'success': True,
            'groups': list(groups)
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=400)


# apps/faculty/views.py - إضافة دوال جديدة في نهاية الملف

# ============================================================
# 3. دوال API لإدارة تكليفات الأساتذة (المتقدمة)
# ============================================================

@login_required
def get_professor_details_api(request, prof_id):
    """
    API: جلب تفاصيل أستاذ مع جميع تكليفاته الحالية
    """
    try:
        professor = get_object_or_404(Professor, id=prof_id)
        
        # جلب جميع التكليفات النشطة للأستاذ
        assignments = CourseAssignment.objects.filter(
            professor=professor,
            is_active=True
        ).select_related('course', 'level', 'student_group', 'semester', 'department')
        
        # تجهيز قائمة التكليفات
        assigned_courses = []
        for assignment in assignments:
            assigned_courses.append({
                'assignment_id': assignment.id,
                'course_id': assignment.course.id,
                'course_name': assignment.course.name,
                'course_code': assignment.course.code,
                'level_id': assignment.level.id,
                'level_name': f"المستوى {assignment.level.number}",
                'level_number': assignment.level.number,
                'group_id': assignment.student_group.id,
                'group_name': assignment.student_group.name,
                'semester_id': assignment.semester.id,
                'semester_name': str(assignment.semester),
                'department_id': assignment.department.id,
                'department_name': assignment.department.name,
            })
        
        return JsonResponse({
            'success': True,
            'professor': {
                'id': professor.id,
                'professor_id': professor.professor_id,
                'name': professor.full_name,
                'email': professor.email,
                'phone': professor.phone or '',
                'department_id': professor.department.id,
                'department_name': professor.department.name,
                'is_active': professor.is_active,
                'assigned_courses': assigned_courses,
            }
        })
        
    except Exception as e:
        print(f"❌ خطأ في get_professor_details_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
@csrf_exempt
def delete_assignment_api(request):
    """
    API: حذف تكليف مادة محدد لأستاذ
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'}, status=405)
    
    try:
        data = json.loads(request.body)
        assignment_id = data.get('assignment_id')
        
        if not assignment_id:
            return JsonResponse({'success': False, 'message': 'معرف التكليف مطلوب'})
        
        assignment = get_object_or_404(CourseAssignment, id=assignment_id)
        
        # حفظ معلومات للتسجيل
        professor_name = assignment.professor.full_name
        course_name = assignment.course.name
        group_name = assignment.student_group.name
        
        # حذف التكليف
        assignment.delete()
        
        # 🛡️ توثيق حذف التكليف في سجل الأحداث
        try:
            log_activity(
                user=request.user,
                action='delete',
                model_name='CourseAssignment',
                object_name=f"{course_name} - {professor_name}",
                details=f"حذف وإلغاء إسناد مادة ({course_name}) للمجموعة ({group_name}) للأستاذ ({professor_name})",
                request=request
            )
        except Exception:
            pass

        print(f"🗑️ تم حذف تكليف المادة {course_name} (المجموعة {group_name}) للأستاذ {professor_name}")
        
        return JsonResponse({
            'success': True,
            'message': f'✅ تم حذف تكليف المادة {course_name} بنجاح',
            'deleted_assignment_id': assignment_id
        })
        
    except CourseAssignment.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'التكليف غير موجود'}, status=404)
    except Exception as e:
        print(f"❌ خطأ في delete_assignment_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
@csrf_exempt
def add_assignment_api(request):
    """
    API: إضافة/إسناد مادة جديد لأستاذ (بدون حذف التكليفات السابقة)
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'success': False, 'message': 'طريقة غير مسموحة'}, status=405)
    
    try:
        data = json.loads(request.body)
        professor_id = data.get('professor_id') or data.get('instructor_id') or data.get('professor')
        course_id = data.get('course_id') or data.get('course')
        department_id = data.get('department_id') or data.get('department')
        level_id = data.get('level_id') or data.get('level')
        group_id = data.get('group_id') or data.get('group') or data.get('student_group_id')
        
        # التحقق من البيانات المطلوبة
        if not professor_id:
            return JsonResponse({'status': 'error', 'success': False, 'message': 'معرف الأستاذ مطلوب'})
        if not course_id:
            return JsonResponse({'status': 'error', 'success': False, 'message': 'المادة مطلوبة'})
        
        professor = get_object_or_404(Professor, id=int(professor_id))
        course = get_object_or_404(Course, id=int(course_id), is_active=True)
        
        from apps.renewal.views import is_valid_filter
        department = professor.department
        if department_id and is_valid_filter(department_id):
            dept_obj = Department.objects.filter(id=int(department_id)).first()
            if dept_obj:
                department = dept_obj
        
        # التحديد التلقائي للمستوى إذا لم يُرسل
        if level_id and is_valid_filter(level_id):
            level = Level.objects.filter(id=int(level_id)).first() or course.level or Level.objects.first()
        elif course.level:
            level = course.level
        else:
            level = Level.objects.filter(number=1).first() or Level.objects.first()
            
        # التحديد التلقائي للمجموعة إذا لم تُرْسَل
        if group_id and is_valid_filter(group_id):
            group = Group.objects.filter(id=int(group_id)).first() or Group.objects.filter(department=department).first() or Group.objects.first()
        else:
            group = Group.objects.filter(department=department).first() or Group.objects.first()
        
        # جلب الفصل الدراسي النشط
        current_semester = Semester.objects.filter(is_active=True).first() or Semester.objects.first()
        
        if not current_semester:
            return JsonResponse({
                'status': 'error',
                'success': False, 
                'message': 'لا يوجد فصل دراسي نشط أو معرّف في النظام'
            })
        
        # إنشاء أو جلب التكليف (منع التكرار)
        assignment, created = CourseAssignment.objects.get_or_create(
            professor=professor,
            course=course,
            student_group=group,
            semester=current_semester,
            defaults={
                'department': department,
                'level': level,
                'is_active': True
            }
        )
        
        if not created and not assignment.is_active:
            assignment.is_active = True
            assignment.save()
            
        print(f"✅ تم إسناد المادة بنجاح: {course.name} (المجموعة {group.name if group else '-'}) للأستاذ {professor.full_name}")
        
        # 🛡️ توثيق إسناد المادة للأستاذ في سجل الأحداث
        try:
            log_activity(
                user=request.user,
                action='create',
                model_name='CourseAssignment',
                object_name=f"{course.name} - {professor.full_name}",
                details=f"إسناد مادة ({course.name}) للمجموعة ({group.name if group else '-'}) للأستاذ ({professor.full_name}) في قسم ({department.name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'status': 'success',
            'success': True,
            'message': 'تم إسناد المادة بنجاح',
            'assignment': {
                'assignment_id': assignment.id,
                'course_id': course.id,
                'course_name': course.name,
                'course_code': course.code,
                'level_id': level.id if level else 0,
                'level_name': f"المستوى {level.number}" if level else '-',
                'group_id': group.id if group else 0,
                'group_name': group.name if group else '-',
            }
        })
        
    except Exception as e:
        print(f"❌ خطأ في add_assignment_api: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'success': False, 'message': str(e)}, status=400)


# ============================================================
# 4. دوال API لإدارة الموظفين (Staff Management)
# ============================================================

@login_required
@csrf_exempt
def save_staff_api(request):
    """
    API: حفظ موظف جديد أو تحديث موظف حالي / رئيس قسم (مع منع التكرار)
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'طريقة غير مسموحة'}, status=405)
    
    try:
        data = json.loads(request.body)
        staff_id = data.get('id')
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        role = data.get('role', '').strip()
        department_id = data.get('department_id')
        
        if not name:
            return JsonResponse({'success': False, 'message': 'اسم الموظف مطلوب'})
        if not role:
            return JsonResponse({'success': False, 'message': 'المسمى الوظيفي مطلوب'})
        if not department_id:
            return JsonResponse({'success': False, 'message': 'القسم مطلوب'})
            
        department = get_object_or_404(Department, id=department_id)
        from apps.users.models import User
        
        # 🛑 حظر إضافة موظفين جدد إذا كان القسم غير مفعّل أو الصلاحية موقوفة
        if not staff_id:
            from apps.renewal.views import get_add_staff_job_info
            staff_info = get_add_staff_job_info()
            if not staff_info['is_add_staff_open']:
                return JsonResponse({'success': False, 'message': staff_info['add_staff_message'] or 'عذراً، خدمة إضافة موظف جديد غير مفعلة حالياً في إدارة الوظائف.'})

        if not department.is_active and not staff_id:
            return JsonResponse({'success': False, 'message': f'عذراً، قسم ({department.name}) غير مفعّل حالياً ولا يمكن إضافة موظفين جدد له.'})
        
        # 1. حالة تعديل رئيس قسم ينتمي لجدول User
        if staff_id and str(staff_id).startswith('user_head_'):
            user_pk = int(str(staff_id).replace('user_head_', ''))
            head_user = get_object_or_404(User, id=user_pk)
            name_parts = name.split(' ', 1)
            head_user.first_name = name_parts[0]
            head_user.last_name = name_parts[1] if len(name_parts) > 1 else ''
            if email:
                head_user.email = email
            head_user.save()
            return JsonResponse({
                'success': True,
                'message': f'تم تحديث بيانات رئيس القسم {head_user.get_full_name()} بنجاح'
            })

        # 2. حالة التعديل على موظف عاديا
        if staff_id:
            staff_member = get_object_or_404(DepartmentStaff, id=staff_id)
            staff_member.full_name = name
            staff_member.email = email
            staff_member.role = role
            staff_member.department = department
            staff_member.save()
            msg = f'تم تحديث بيانات الموظف {staff_member.full_name} بنجاح'
        else:
            # 3. حالة إضافة موظف جديد: التثبت أولاً لمنع تكرار رئيس القسم أو الموظف الموجود
            dept_head_user = User.objects.filter(department=department, role='academic_dept').first()
            if dept_head_user:
                head_name = (dept_head_user.get_full_name() or dept_head_user.username).strip()
                head_email = (dept_head_user.email or '').strip().lower()
                if (email and email.strip().lower() == head_email) or (name == head_name):
                    return JsonResponse({
                        'success': False,
                        'message': 'هذا الشخص مدرج بالفعل كرئيس للقسم العلمي في النظام، ولا يمكن تكرار إضافته.'
                    })

            # منع تكرار نفس الاسم في نفس القسم
            existing_staff = DepartmentStaff.objects.filter(department=department, full_name__iexact=name).first()
            if existing_staff:
                return JsonResponse({
                    'success': False,
                    'message': f'الموظف "{name}" مسجل بالفعل في هذا القسم.'
                })

            staff_member = DepartmentStaff.objects.create(
                full_name=name,
                email=email,
                role=role,
                department=department,
                is_active=True
            )
            msg = f'تم إضافة الموظف {staff_member.full_name} بنجاح'
            
        # 🛡️ توثيق حفظ/تعديل الموظف في سجل الأحداث
        try:
            act_type = 'update' if staff_id else 'create'
            log_activity(
                user=request.user,
                action=act_type,
                model_name='DepartmentStaff',
                object_name=name,
                details=f"{msg} بدور ({role}) في قسم ({department.name})",
                request=request
            )
        except Exception:
            pass

        return JsonResponse({
            'success': True,
            'message': msg
        })
    except Exception as e:
        print(f"❌ خطأ في save_staff_api: {str(e)}")
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


@login_required
@csrf_exempt
def toggle_staff_api(request, staff_id):
    """
    API: تعطيل أو تفعيل موظف أو رئيس قسم في القسم
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'status': 'error', 'message': 'طريقة غير مسموحة'}, status=405)
    
    try:
        from apps.users.models import User
        staff_id_str = str(staff_id).strip()
        
        # 1. حالة رئيس قسم مسجل في User
        if staff_id_str.startswith('user_head_'):
            user_pk = int(staff_id_str.replace('user_head_', ''))
            head_user = get_object_or_404(User, id=user_pk)
            head_user.is_active = not head_user.is_active
            head_user.save()
            status_msg = 'تم تفعيل حساب رئيس القسم' if head_user.is_active else 'تم تعطيل حساب رئيس القسم'
            
            try:
                log_activity(
                    user=request.user,
                    action='update',
                    model_name='User',
                    object_name=head_user.get_full_name(),
                    details=f"{status_msg} ({head_user.get_full_name()})",
                    request=request
                )
            except Exception:
                pass

            return JsonResponse({
                'success': True,
                'status': 'success',
                'message': f'{status_msg} بنجاح',
                'is_active': head_user.is_active
            })

        # 2. فحص جدول DepartmentStaff
        staff_member = None
        if staff_id_str.isdigit():
            staff_member = DepartmentStaff.objects.filter(id=int(staff_id_str)).first()
            
        if staff_member:
            staff_member.is_active = not staff_member.is_active
            staff_member.save()
            status_msg = 'تم تفعيل حساب الموظف' if staff_member.is_active else 'تم تعطيل حساب الموظف'
            
            try:
                log_activity(
                    user=request.user,
                    action='update',
                    model_name='DepartmentStaff',
                    object_name=staff_member.full_name,
                    details=f"{status_msg} ({staff_member.full_name})",
                    request=request
                )
            except Exception:
                pass

            return JsonResponse({
                'success': True,
                'status': 'success',
                'message': f'{status_msg} بنجاح',
                'is_active': staff_member.is_active
            })

        # 3. فحص جدول User إن كان حساب مستخدم
        if staff_id_str.isdigit():
            user_member = User.objects.filter(id=int(staff_id_str)).first()
            if user_member:
                user_member.is_active = not user_member.is_active
                user_member.save()
                status_msg = 'تم تفعيل حساب المستخدم' if user_member.is_active else 'تم تعطيل حساب المستخدم'
                return JsonResponse({
                    'success': True,
                    'status': 'success',
                    'message': f'{status_msg} بنجاح',
                    'is_active': user_member.is_active
                })

        return JsonResponse({
            'success': False,
            'status': 'error',
            'message': 'لم يتم العثور على الموظف أو المستخدم المطلوب'
        }, status=404)

    except Exception as e:
        print(f"❌ خطأ في toggle_staff_api: {str(e)}")
        return JsonResponse({'success': False, 'status': 'error', 'message': str(e)}, status=400)


def get_dashboard_dynamic_signatures(request):
    """
    جلب التوقيعات والمسؤولين المعتمدين ديناميكياً من قاعدة البيانات
    بناءً على الأدوار الرسمية والمستخدم الحالي والمناصب المعتمدة في جدولي Official و User
    """
    from apps.users.models import User, Official, get_official
    from django.db.models import Q

    # 1. عميد الكلية (Dean)
    dean_name = get_official('dean', default='')
    if not dean_name or 'عميد الكلية' in dean_name:
        dean_official = Official.objects.filter(is_active=True).filter(
            Q(position_key='dean') | Q(position_name__icontains='عميد')
        ).order_by('-updated_at').first()
        if dean_official:
            dean_name = dean_official.get_full_name()
    if not dean_name:
        admin_user = User.objects.filter(role='admin', is_active=True).first() or User.objects.filter(is_superuser=True, is_active=True).first()
        if admin_user:
            dean_name = admin_user.get_full_name() or admin_user.username
    if not dean_name:
        dean_name = 'أ.د. عميد الكلية'

    # 2. المسجل العام (General Registrar)
    gen_reg_name = get_official('registrar', default='')
    if not gen_reg_name or 'المسجل العام' in gen_reg_name:
        reg_official = Official.objects.filter(is_active=True).filter(
            Q(position_key='registrar') | Q(position_name__icontains='المسجل العام')
        ).order_by('-updated_at').first()
        if reg_official:
            gen_reg_name = reg_official.get_full_name()
    if not gen_reg_name:
        gen_reg_user = User.objects.filter(role='general_registrar', is_active=True).first()
        if gen_reg_user:
            gen_reg_name = gen_reg_user.get_full_name() or gen_reg_user.username
    if not gen_reg_name:
        gen_reg_name = 'أ. المسجل العام'

    # 3. مدير إدارة الدراسة والامتحانات (Exam Director)
    director_name = get_official('exams_head', default='')
    if not director_name or 'مدير' in director_name or 'رئيس' in director_name:
        dir_official = Official.objects.filter(is_active=True).filter(
            Q(position_key='exams_head') | Q(position_key='exams') | Q(position_name__icontains='مدير') | Q(position_name__icontains='رئيس قسم الدراسة')
        ).exclude(
            Q(position_name__icontains='منسق') | Q(position_name__icontains='منسقة')
        ).order_by('-updated_at').first()
        if dir_official:
            director_name = dir_official.get_full_name()
    if not director_name:
        dir_user = User.objects.filter(role='exam_director', is_active=True).first()
        if dir_user:
            director_name = dir_user.get_full_name() or dir_user.username
    if not director_name:
        director_name = 'أ. مدير إدارة الدراسة والامتحانات'

    # 4. منسق / موظف الدراسة والامتحانات (Coordinator / Exam Officer)
    coord_name = get_official('exams_coordinator', default='')
    if not coord_name or 'منسق' in coord_name:
        coord_official = Official.objects.filter(is_active=True).filter(
            Q(position_key='exams_coordinator') | Q(position_name__icontains='منسق') | Q(position_name__icontains='منسقة')
        ).order_by('-updated_at').first()
        if coord_official:
            coord_name = coord_official.get_full_name()
    if not coord_name:
        coord_user = User.objects.filter(role='exam_officer', is_active=True).first()
        if coord_user:
            coord_name = coord_user.get_full_name() or coord_user.username
    if not coord_name:
        coord_name = 'أ. منسق الدراسة والامتحانات'

    # 5. مسؤول / موظف التسجيل والقبول (Admission Officer)
    admission_name = get_official('admission', default='')
    if not admission_name or 'مسؤول' in admission_name:
        adm_official = Official.objects.filter(is_active=True).filter(
            Q(position_key='admission') | Q(position_name__icontains='التسجيل والقبول') | Q(position_name__icontains='القبول والتسجيل')
        ).order_by('-updated_at').first()
        if adm_official:
            admission_name = adm_official.get_full_name()
    if not admission_name:
        reg_user = User.objects.filter(role='registrar', is_active=True).first()
        if reg_user:
            admission_name = reg_user.get_full_name() or reg_user.username
    if not admission_name:
        admission_name = 'أ. مسؤول التسجيل والقبول'

    # 6. المستخدم الحالي الذي قام بالطباعة والإعداد
    current_user_name = 'المسؤول المناوب'
    current_user_role = 'المستخدم الحالي'
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        current_user_name = request.user.get_full_name() or request.user.username
        if hasattr(request.user, 'get_role_display'):
            current_user_role = request.user.get_role_display()

    return {
        'dean_name': dean_name,
        'gen_reg_name': gen_reg_name,
        'director_name': director_name,
        'coord_name': coord_name,
        'admission_name': admission_name,
        'current_user_name': current_user_name,
        'current_user_role': current_user_role,
    }


# ============================================================
# 📊 لوحة تحكم مدير إدارة الدراسة والامتحانات (Exam Director Dashboard)
# ============================================================

@staff_required
def exam_director_dashboard(request):
    """
    لوحة تحكم مدير إدارة الدراسة والامتحانات
    تتضمن: مؤشرات النجاح والرسوب للعام الدراسي، أداء التخصصات، الرسوم البيانية للكنترول، ودليل الأساتذة
    """
    from apps.grades.models import Grade
    from apps.renewal.models import Department, Semester, Specialization, Course
    from apps.faculty.models import Professor, CourseAssignment
    from apps.student.models import Student
    
    total_students = Student.objects.count()
    current_semester = Semester.objects.filter(is_active=True).first()
    
    # استعلام الدرجات للعام الحالي / الفصل النشط
    grades_base_qs = Grade.objects.all()
    if current_semester:
        sem_grades = Grade.objects.filter(semester=current_semester)
        if sem_grades.exists():
            grades_base_qs = sem_grades
        elif Grade.objects.filter(semester__year=current_semester.year).exists():
            grades_base_qs = Grade.objects.filter(semester__year=current_semester.year)

    total_evaluated_grades = grades_base_qs.count()
    overall_passed_count = grades_base_qs.filter(is_passed=True).count()
    overall_failed_count = grades_base_qs.filter(is_passed=False).count()
    
    overall_pass_rate = round((overall_passed_count / total_evaluated_grades * 100), 1) if total_evaluated_grades > 0 else 0
    overall_fail_rate = round((overall_failed_count / total_evaluated_grades * 100), 1) if total_evaluated_grades > 0 else 0

    departments_qs = Department.objects.filter(is_active=True).annotate(
        student_count=Count('student')
    ).order_by('-student_count')
    
    specializations_count = Specialization.objects.count() if Specialization.objects.exists() else departments_qs.count()
    departments_count = departments_qs.count()
    
    departments_stats = []
    depts_with_grades = []

    for dept in departments_qs:
        percentage = round((dept.student_count / total_students * 100), 1) if total_students > 0 else 0
        dept_grades = grades_base_qs.filter(student__department=dept)
        dept_grades_count = dept_grades.count()
        dept_passed = dept_grades.filter(is_passed=True).count()
        dept_failed = dept_grades.filter(is_passed=False).count()
        
        dept_pass_rate = round((dept_passed / dept_grades_count * 100), 1) if dept_grades_count > 0 else 0
        dept_fail_rate = round((dept_failed / dept_grades_count * 100), 1) if dept_grades_count > 0 else 0

        dept_data = {
            'id': dept.id,
            'name': dept.name,
            'code': dept.code,
            'count': dept.student_count,
            'percentage': percentage,
            'total_grades': dept_grades_count,
            'passed_count': dept_passed,
            'failed_count': dept_failed,
            'pass_rate': dept_pass_rate,
            'fail_rate': dept_fail_rate,
        }
        departments_stats.append(dept_data)
        if dept_grades_count > 0:
            depts_with_grades.append(dept_data)

    if depts_with_grades:
        highest_success_dept = max(depts_with_grades, key=lambda d: (d['pass_rate'], d['passed_count']))
        highest_failure_dept = max(depts_with_grades, key=lambda d: (d['fail_rate'], d['failed_count']))
    elif departments_stats:
        highest_success_dept = departments_stats[0]
        highest_failure_dept = departments_stats[-1]
    else:
        highest_success_dept = {'name': 'لا توجد بيانات', 'pass_rate': 0, 'passed_count': 0}
        highest_failure_dept = {'name': 'لا توجد بيانات', 'fail_rate': 0, 'failed_count': 0}

    total_professors = Professor.objects.count()
    active_professors = Professor.objects.filter(is_active=True).count()
    total_courses = Course.objects.filter(is_active=True).count()
    total_assignments = CourseAssignment.objects.filter(is_active=True).count()

    professors_qs = Professor.objects.all().select_related('department', 'specialization').prefetch_related(
        'courseassignment_set__course',
        'courseassignment_set__student_group',
        'courseassignment_set__semester'
    ).order_by('full_name')

    professors_list = []
    for prof in professors_qs:
        courses_dict = {}
        for ca in prof.courseassignment_set.filter(is_active=True):
            if not ca.course:
                continue
            c_id = ca.course.id
            if c_id not in courses_dict:
                courses_dict[c_id] = {
                    'id': ca.course.id,
                    'code': ca.course.code,
                    'name': ca.course.name,
                    'credits': ca.course.credits,
                    'groups': [],
                    'semesters': [],
                }
            if ca.student_group and ca.student_group.name not in courses_dict[c_id]['groups']:
                courses_dict[c_id]['groups'].append(ca.student_group.name)
            if ca.semester and str(ca.semester) not in courses_dict[c_id]['semesters']:
                courses_dict[c_id]['semesters'].append(str(ca.semester))

        courses_taught = list(courses_dict.values())

        professors_list.append({
            'id': prof.id,
            'professor_id': prof.professor_id or f"P{prof.id:04d}",
            'full_name': prof.full_name,
            'email': prof.email,
            'phone': prof.phone or '—',
            'department_id': prof.department.id if prof.department else None,
            'department_name': prof.department.name if prof.department else 'غير محدد',
            'specialization_name': prof.specialization.name if prof.specialization else (prof.department.name if prof.department else 'غير محدد'),
            'is_active': prof.is_active,
            'hire_date': prof.hire_date.strftime('%Y-%m-%d') if prof.hire_date else '—',
            'courses_taught': courses_taught,
            'courses_count': len(courses_taught),
        })

    try:
        log_activity(
            user=request.user,
            action='view_exam_director_dashboard',
            model_name='Dashboard',
            object_name='لوحة مدير إدارة الدراسة والامتحانات',
            details='قام مدير الدراسة والامتحانات بتصفح لوحة تحكم الكنترول ونسب النجاح والرسوب',
            request=request
        )
    except Exception:
        pass

    pass_fail_analytics = {
        'total_evaluated': total_evaluated_grades,
        'passed_count': overall_passed_count,
        'failed_count': overall_failed_count,
        'pass_rate': overall_pass_rate,
        'fail_rate': overall_fail_rate,
        'highest_success_dept': highest_success_dept,
        'highest_failure_dept': highest_failure_dept,
    }

    signatures = get_dashboard_dynamic_signatures(request)

    context = {
        'page_title': 'لوحة مدير إدارة الدراسة والامتحانات',
        'page_subtitle': 'مؤشرات نسب النجاح والرسوب للعام الدراسي، أداء التخصصات، ودليل أعضاء هيئة التدريس',
        'total_students': total_students,
        'specializations_count': specializations_count,
        'departments_count': departments_count,
        'total_professors': total_professors,
        'active_professors': active_professors,
        'total_courses': total_courses,
        'total_assignments': total_assignments,
        'current_semester': current_semester,
        'departments_stats': departments_stats,
        'departments_stats_json': json.dumps(departments_stats, ensure_ascii=False, cls=DjangoJSONEncoder),
        'pass_fail_analytics': pass_fail_analytics,
        'pass_fail_json': json.dumps(pass_fail_analytics, ensure_ascii=False, cls=DjangoJSONEncoder),
        'professors_list': professors_list,
        'professors_json': json.dumps(professors_list, ensure_ascii=False, cls=DjangoJSONEncoder),
        'departments': list(departments_qs.values('id', 'name', 'code')),
        'signatures': signatures,
    }
    return render(request, 'faculty/exam_director_dashboard.html', context)


# ============================================================
# 🖨️ تقارير الطباعة الخاصة بلوحة التحكم (Statistical & Standard Reports)
# متاحة لجميع الأدوار الإدارية والأكاديمية المصرحة
# ============================================================

@staff_required
def dashboard_statistical_report(request):
    """
    عرض وطباعة التقرير الإحصائي الشامل لمؤشرات النجاح والرسوب
    متاح لـ: مدير النظام، المنسق، المسجل العام، موظفي التسجيل، رؤساء الأقسام، ومدير الدراسة والامتحانات
    """
    from apps.grades.models import Grade
    from apps.renewal.models import Department, Semester, Specialization
    from apps.student.models import Student
    from apps.renewal.utils import get_system_date
    import random

    now = get_system_date(request)
    total_students = Student.objects.count()
    current_semester = Semester.objects.filter(is_active=True).first()

    grades_base_qs = Grade.objects.all()
    if current_semester:
        sem_grades = Grade.objects.filter(semester=current_semester)
        if sem_grades.exists():
            grades_base_qs = sem_grades
        elif Grade.objects.filter(semester__year=current_semester.year).exists():
            grades_base_qs = Grade.objects.filter(semester__year=current_semester.year)

    total_evaluated_grades = grades_base_qs.count()
    overall_passed_count = grades_base_qs.filter(is_passed=True).count()
    overall_failed_count = grades_base_qs.filter(is_passed=False).count()

    overall_pass_rate = round((overall_passed_count / total_evaluated_grades * 100), 1) if total_evaluated_grades > 0 else 0
    overall_fail_rate = round((overall_failed_count / total_evaluated_grades * 100), 1) if total_evaluated_grades > 0 else 0

    departments_qs = Department.objects.filter(is_active=True).annotate(
        student_count=Count('student')
    ).order_by('-student_count')

    departments_stats = []
    depts_with_grades = []

    for dept in departments_qs:
        percentage = round((dept.student_count / total_students * 100), 1) if total_students > 0 else 0
        dept_grades = grades_base_qs.filter(student__department=dept)
        dept_grades_count = dept_grades.count()
        dept_passed = dept_grades.filter(is_passed=True).count()
        dept_failed = dept_grades.filter(is_passed=False).count()

        dept_pass_rate = round((dept_passed / dept_grades_count * 100), 1) if dept_grades_count > 0 else 0
        dept_fail_rate = round((dept_failed / dept_grades_count * 100), 1) if dept_grades_count > 0 else 0

        dept_data = {
            'id': dept.id,
            'name': dept.name,
            'code': dept.code,
            'count': dept.student_count,
            'percentage': percentage,
            'total_grades': dept_grades_count,
            'passed_count': dept_passed,
            'failed_count': dept_failed,
            'pass_rate': dept_pass_rate,
            'fail_rate': dept_fail_rate,
        }
        departments_stats.append(dept_data)
        if dept_grades_count > 0:
            depts_with_grades.append(dept_data)

    if depts_with_grades:
        highest_success_dept = max(depts_with_grades, key=lambda d: (d['pass_rate'], d['passed_count']))
        highest_failure_dept = max(depts_with_grades, key=lambda d: (d['fail_rate'], d['failed_count']))
    elif departments_stats:
        highest_success_dept = departments_stats[0]
        highest_failure_dept = departments_stats[-1]
    else:
        highest_success_dept = {'name': 'لا توجد بيانات', 'pass_rate': 0, 'passed_count': 0}
        highest_failure_dept = {'name': 'لا توجد بيانات', 'fail_rate': 0, 'failed_count': 0}

    pass_fail_analytics = {
        'total_evaluated': total_evaluated_grades,
        'passed_count': overall_passed_count,
        'failed_count': overall_failed_count,
        'pass_rate': overall_pass_rate,
        'fail_rate': overall_fail_rate,
        'highest_success_dept': highest_success_dept,
        'highest_failure_dept': highest_failure_dept,
    }

    signatures = get_dashboard_dynamic_signatures(request)

    context = {
        'report_date': now.strftime('%Y/%m/%d'),
        'report_datetime': now.strftime('%Y/%m/%d - %H:%M'),
        'report_year': str(now.year),
        'report_num': f"{now.month:02d}{random.randint(100, 999)}",
        'current_semester': current_semester,
        'total_students': total_students,
        'pass_fail_analytics': pass_fail_analytics,
        'departments_stats': departments_stats,
        'signatures': signatures,
    }
    return render(request, 'faculty/dashboard_statistical_report.html', context)


@staff_required
def dashboard_standard_report(request):
    """
    عرض وطباعة التقرير العادي الشامل لأعضاء هيئة التدريس والأقسام
    متاح لـ: مدير النظام، المنسق، المسجل العام، موظفي التسجيل، رؤساء الأقسام، ومدير الدراسة والامتحانات
    """
    from apps.renewal.models import Department, Semester, Course
    from apps.faculty.models import Professor, CourseAssignment
    from apps.student.models import Student
    from apps.renewal.utils import get_system_date
    import random

    now = get_system_date(request)
    total_students = Student.objects.count()
    current_semester = Semester.objects.filter(is_active=True).first()
    total_professors = Professor.objects.count()
    active_professors = Professor.objects.filter(is_active=True).count()
    total_courses = Course.objects.filter(is_active=True).count()
    total_assignments = CourseAssignment.objects.filter(is_active=True).count()

    departments_qs = Department.objects.filter(is_active=True).annotate(
        student_count=Count('student')
    ).order_by('-student_count')

    departments_stats = []
    for dept in departments_qs:
        percentage = round((dept.student_count / total_students * 100), 1) if total_students > 0 else 0
        departments_stats.append({
            'name': dept.name,
            'code': dept.code,
            'count': dept.student_count,
            'percentage': percentage,
        })

    professors_qs = Professor.objects.all().select_related('department', 'specialization').prefetch_related(
        'courseassignment_set__course',
        'courseassignment_set__student_group',
        'courseassignment_set__semester'
    ).order_by('full_name')

    professors_list = []
    for prof in professors_qs:
        courses_dict = {}
        for ca in prof.courseassignment_set.filter(is_active=True):
            if not ca.course:
                continue
            c_id = ca.course.id
            if c_id not in courses_dict:
                courses_dict[c_id] = {
                    'code': ca.course.code,
                    'name': ca.course.name,
                    'groups': [],
                }
            if ca.student_group and ca.student_group.name not in courses_dict[c_id]['groups']:
                courses_dict[c_id]['groups'].append(ca.student_group.name)

        courses_taught = list(courses_dict.values())
        professors_list.append({
            'professor_id': prof.professor_id or f"P{prof.id:04d}",
            'full_name': prof.full_name,
            'email': prof.email,
            'phone': prof.phone or '—',
            'department_name': prof.department.name if prof.department else 'غير محدد',
            'courses_taught': courses_taught,
            'courses_count': len(courses_taught),
        })

    signatures = get_dashboard_dynamic_signatures(request)

    context = {
        'report_date': now.strftime('%Y/%m/%d'),
        'report_datetime': now.strftime('%Y/%m/%d - %H:%M'),
        'report_year': str(now.year),
        'report_num': f"{now.month:02d}{random.randint(100, 999)}",
        'current_semester': current_semester,
        'total_students': total_students,
        'total_professors': total_professors,
        'active_professors': active_professors,
        'total_courses': total_courses,
        'total_assignments': total_assignments,
        'departments_count': departments_qs.count(),
        'departments_stats': departments_stats,
        'professors_list': professors_list,
        'signatures': signatures,
    }
    return render(request, 'faculty/dashboard_standard_report.html', context)


# ============================================================
# 📋 لوحة تحكم منسق وموظف الدراسة والامتحانات (Coordinator Dashboard)
# ============================================================

@staff_required
def coordinator_dashboard(request):
    """
    لوحة تحكم منسق وموظف الدراسة والامتحانات
    تتضمن: إحصائيات المجموعات، الأساتذة، المقررات الدراسية، توزيع الطلاب، ودليل الأساتذة
    """
    from apps.renewal.models import Group, Course, CourseRegistration, Department, Semester, Specialization
    from apps.faculty.models import Professor, CourseAssignment
    from apps.student.models import Student
    
    # 1. إحصائيات منسق وموظف الدراسة والامتحانات الأساسية
    total_students = Student.objects.count()
    total_groups = Group.objects.count()
    total_professors = Professor.objects.count()
    active_professors = Professor.objects.filter(is_active=True).count()
    total_courses = Course.objects.filter(is_active=True).count()
    total_registrations = CourseRegistration.objects.count()
    total_assignments = CourseAssignment.objects.filter(is_active=True).count()
    current_semester = Semester.objects.filter(is_active=True).first()

    # 2. توزيع المجموعات والأساتذة والطلاب حسب الأقسام
    departments_qs = Department.objects.filter(is_active=True).annotate(
        student_count=Count('student')
    ).order_by('-student_count')
    
    specializations_count = Specialization.objects.count() if Specialization.objects.exists() else departments_qs.count()
    departments_count = departments_qs.count()
    
    departments_stats = []
    for dept in departments_qs:
        percentage = round((dept.student_count / total_students * 100), 1) if total_students > 0 else 0
        dept_profs = Professor.objects.filter(department=dept).count()
        dept_groups = Group.objects.filter(department=dept).count()
        dept_courses = Course.objects.filter(department=dept).count()
        dept_regs = CourseRegistration.objects.filter(student__department=dept).count()

        dept_data = {
            'id': dept.id,
            'name': dept.name,
            'code': dept.code,
            'count': dept.student_count,
            'percentage': percentage,
            'prof_count': dept_profs,
            'group_count': dept_groups,
            'course_count': dept_courses,
            'reg_count': dept_regs,
        }
        departments_stats.append(dept_data)

    # 3. دليل وبيانات الأساتذة والمواد المسندة
    professors_qs = Professor.objects.all().select_related('department', 'specialization').prefetch_related(
        'courseassignment_set__course',
        'courseassignment_set__student_group',
        'courseassignment_set__semester'
    ).order_by('full_name')

    professors_list = []
    for prof in professors_qs:
        courses_dict = {}
        for ca in prof.courseassignment_set.filter(is_active=True):
            if not ca.course:
                continue
            c_id = ca.course.id
            if c_id not in courses_dict:
                courses_dict[c_id] = {
                    'id': ca.course.id,
                    'code': ca.course.code,
                    'name': ca.course.name,
                    'credits': ca.course.credits,
                    'groups': [],
                    'semesters': [],
                }
            if ca.student_group and ca.student_group.name not in courses_dict[c_id]['groups']:
                courses_dict[c_id]['groups'].append(ca.student_group.name)
            if ca.semester and str(ca.semester) not in courses_dict[c_id]['semesters']:
                courses_dict[c_id]['semesters'].append(str(ca.semester))

        courses_taught = list(courses_dict.values())

        professors_list.append({
            'id': prof.id,
            'professor_id': prof.professor_id or f"P{prof.id:04d}",
            'full_name': prof.full_name,
            'email': prof.email,
            'phone': prof.phone or '—',
            'department_id': prof.department.id if prof.department else None,
            'department_name': prof.department.name if prof.department else 'غير محدد',
            'specialization_name': prof.specialization.name if prof.specialization else (prof.department.name if prof.department else 'غير محدد'),
            'is_active': prof.is_active,
            'hire_date': prof.hire_date.strftime('%Y-%m-%d') if prof.hire_date else '—',
            'courses_taught': courses_taught,
            'courses_count': len(courses_taught),
        })

    # 🛡️ توثيق نشاط زيارة لوحة إدارة الدراسة والامتحانات
    try:
        log_activity(
            user=request.user,
            action='view_coordinator_dashboard',
            model_name='Dashboard',
            object_name='لوحة منسق الدراسة والامتحانات',
            details='قام المستخدِم بتصفح لوحة تحكم منسق الدراسة والامتحانات ومؤشرات المجموعات والأساتذة',
            request=request
        )
    except Exception:
        pass

    signatures = get_dashboard_dynamic_signatures(request)

    context = {
        'page_title': 'لوحة منسق الدراسة والامتحانات',
        'page_subtitle': 'إحصائيات المجموعات الدراسية، أعضاء هيئة التدريس، المقررات وتوزيع الشعب الأكاديمية',
        'total_groups': total_groups,
        'total_professors': total_professors,
        'active_professors': active_professors,
        'total_courses': total_courses,
        'total_students': total_students,
        'total_registrations': total_registrations,
        'total_assignments': total_assignments,
        'specializations_count': specializations_count,
        'departments_count': departments_count,
        'current_semester': current_semester,
        'departments_stats': departments_stats,
        'departments_stats_json': json.dumps(departments_stats, ensure_ascii=False, cls=DjangoJSONEncoder),
        'professors_list': professors_list,
        'professors_json': json.dumps(professors_list, ensure_ascii=False, cls=DjangoJSONEncoder),
        'departments': list(departments_qs.values('id', 'name', 'code')),
        'signatures': signatures,
    }
    return render(request, 'faculty/coordinator_dashboard.html', context)


@exam_director_required
def api_coordinator_stats(request):
    """API: جلب إحصائيات إدارة الدراسة والامتحانات والنجاح/الرسوب الحية"""
    try:
        from apps.grades.models import Grade
        total_students = Student.objects.count()
        current_semester = Semester.objects.filter(is_active=True).first()
        
        grades_base_qs = Grade.objects.all()
        if current_semester:
            sem_grades = Grade.objects.filter(semester=current_semester)
            if sem_grades.exists():
                grades_base_qs = sem_grades

        total_evaluated_grades = grades_base_qs.count()
        overall_passed_count = grades_base_qs.filter(is_passed=True).count()
        overall_failed_count = grades_base_qs.filter(is_passed=False).count()
        overall_pass_rate = round((overall_passed_count / total_evaluated_grades * 100), 1) if total_evaluated_grades > 0 else 0
        overall_fail_rate = round((overall_failed_count / total_evaluated_grades * 100), 1) if total_evaluated_grades > 0 else 0

        departments_qs = Department.objects.filter(is_active=True).annotate(
            student_count=Count('student')
        ).order_by('-student_count')
        
        specializations_count = Specialization.objects.count() if Specialization.objects.exists() else departments_qs.count()
        total_professors = Professor.objects.count()
        active_professors = Professor.objects.filter(is_active=True).count()
        total_courses = Course.objects.filter(is_active=True).count()

        departments_data = []
        depts_with_grades = []
        for d in departments_qs:
            pct = round((d.student_count / total_students * 100), 1) if total_students > 0 else 0
            dept_grades = grades_base_qs.filter(student__department=d)
            d_total = dept_grades.count()
            d_passed = dept_grades.filter(is_passed=True).count()
            d_failed = dept_grades.filter(is_passed=False).count()
            d_p_rate = round((d_passed / d_total * 100), 1) if d_total > 0 else 0
            d_f_rate = round((d_failed / d_total * 100), 1) if d_total > 0 else 0

            d_item = {
                'id': d.id,
                'name': d.name,
                'code': d.code,
                'count': d.student_count,
                'percentage': pct,
                'total_grades': d_total,
                'passed_count': d_passed,
                'failed_count': d_failed,
                'pass_rate': d_p_rate,
                'fail_rate': d_f_rate,
            }
            departments_data.append(d_item)
            if d_total > 0:
                depts_with_grades.append(d_item)

        highest_success = max(depts_with_grades, key=lambda x: x['pass_rate']) if depts_with_grades else None
        highest_failure = max(depts_with_grades, key=lambda x: x['fail_rate']) if depts_with_grades else None

        return JsonResponse({
            'success': True,
            'stats': {
                'total_students': total_students,
                'total_specializations': specializations_count,
                'total_departments': departments_qs.count(),
                'total_professors': total_professors,
                'active_professors': active_professors,
                'total_courses': total_courses,
                'total_evaluated': total_evaluated_grades,
                'overall_passed': overall_passed_count,
                'overall_failed': overall_failed_count,
                'overall_pass_rate': overall_pass_rate,
                'overall_fail_rate': overall_fail_rate,
                'highest_success_dept': highest_success,
                'highest_failure_dept': highest_failure,
                'departments': departments_data,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@exam_director_required
def api_professors_directory(request):
    """API: جلب دليل الأساتذة مع المواد التي يدرسونها والأقسام"""
    try:
        dept_id = request.GET.get('department_id')
        search_query = request.GET.get('search', '').strip()

        qs = Professor.objects.all().select_related('department', 'specialization').prefetch_related(
            'courseassignment_set__course',
            'courseassignment_set__student_group',
            'courseassignment_set__semester'
        )

        if dept_id and dept_id.isdigit():
            qs = qs.filter(department_id=int(dept_id))

        if search_query:
            qs = qs.filter(
                Q(full_name__icontains=search_query) |
                Q(professor_id__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(courseassignment__course__name__icontains=search_query) |
                Q(courseassignment__course__code__icontains=search_query)
            ).distinct()

        professors_list = []
        for prof in qs.order_by('full_name'):
            courses_dict = {}
            for ca in prof.courseassignment_set.filter(is_active=True):
                if not ca.course:
                    continue
                c_id = ca.course.id
                if c_id not in courses_dict:
                    courses_dict[c_id] = {
                        'id': ca.course.id,
                        'code': ca.course.code,
                        'name': ca.course.name,
                        'credits': ca.course.credits,
                        'groups': [],
                        'semesters': []
                    }
                if ca.student_group and ca.student_group.name not in courses_dict[c_id]['groups']:
                    courses_dict[c_id]['groups'].append(ca.student_group.name)
                if ca.semester and str(ca.semester) not in courses_dict[c_id]['semesters']:
                    courses_dict[c_id]['semesters'].append(str(ca.semester))

            courses_taught = list(courses_dict.values())

            professors_list.append({
                'id': prof.id,
                'professor_id': prof.professor_id or f"P{prof.id:04d}",
                'full_name': prof.full_name,
                'email': prof.email,
                'phone': prof.phone or '—',
                'department_id': prof.department.id if prof.department else None,
                'department_name': prof.department.name if prof.department else 'غير محدد',
                'specialization_name': prof.specialization.name if prof.specialization else (prof.department.name if prof.department else 'غير محدد'),
                'is_active': prof.is_active,
                'hire_date': prof.hire_date.strftime('%Y-%m-%d') if prof.hire_date else '—',
                'courses_taught': courses_taught,
                'courses_count': len(courses_taught),
            })

        return JsonResponse({'success': True, 'professors': professors_list, 'count': len(professors_list)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)