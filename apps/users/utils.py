# apps/users/utils.py
from django.db import models
from datetime import datetime, date

# ============================================================
# 1. دوال سجلات التدقيق والأحداث (Audit Log & Activity Log)
# ============================================================

EMPTY_VALUES = {
    '', 'none', 'null', 'nil', 'undefined', 'فارغ', '-', '--', '---',
    'none -> none', 'فارغ -> فارغ', 'لا يوجد', 'غير محدد', 'n/a', 'nan'
}

def is_empty_val(val):
    if val is None:
        return True
    s = str(val).strip().lower()
    return not s or s in EMPTY_VALUES


IGNORED_FIELDS = {
    'qr_code', 'qr_code_data', 'qr_code_url', 'رمز qr', 'رمز الاستجابة السريعة',
    'رمز qr والتشفير', 'qr',
    'updated_at', 'created_at', 'updated_by', 'created_by', 'last_modified', 'modified_at',
    'last_login', 'date_joined', 'timestamp',
    'آخر تحديث', 'تاريخ التحديث', 'تاريخ الإضافة', 'تاريخ التعديل', 'تاريخ آخر تعديل',
    'تاريخ الإجراء', 'المستخدم المعدل', 'المعدل بواسطة', 'تاريخ الإنشاء', 'تاريخ التغيير'
}

AUTO_TIMESTAMP_KEYWORDS = [
    'qr_code', 'رمز qr', 'updated_at', 'created_at', 'updated_by', 'created_by',
    'last_modified', 'modified_at', 'last_login', 'date_joined',
    'تاريخ التحديث', 'آخر تحديث', 'تاريخ التعديل', 'تاريخ الإضافة', 'تاريخ الإنشاء',
    'تاريخ التغيير', 'تاريخ الإجراء'
]

def is_ignored_field(field_name):
    if not field_name:
        return True
    s = str(field_name).strip().lower()
    if s in IGNORED_FIELDS:
        return True
    return any(kw in s for kw in AUTO_TIMESTAMP_KEYWORDS)


def extract_changed_fields(arg1, arg2=None):
    """
    دالة استخراج وتصفية الحقول المعدلة (Changed Fields Extraction Function).
    تتجاهل القيم الفارغة، None، 'فارغ'، '-' وتستخرج القيم الحقيقية الفعلية قبل وبعد التعديل فقط.
    """
    cleaned_changes = {}

    if not arg1:
        return cleaned_changes

    # الحالة الأولى: إذا تم تمرير دكشنري الفروقات المسجل مسبقاً (dict of {field: {'old': ..., 'new': ...}})
    if arg2 is None and isinstance(arg1, dict):
        for field, vals in arg1.items():
            if is_ignored_field(field):
                continue

            if isinstance(vals, dict):
                old_val = vals.get('old')
                new_val = vals.get('new')
            elif isinstance(vals, (list, tuple)) and len(vals) == 2:
                old_val, new_val = vals[0], vals[1]
            else:
                continue

            if is_empty_val(old_val) or is_empty_val(new_val):
                continue

            str_old = str(old_val).strip()
            str_new = str(new_val).strip()

            if str_old == str_new or str_old.lower() == str_new.lower():
                continue

            cleaned_changes[field] = {
                'old': str_old,
                'new': str_new
            }
        return cleaned_changes

    # الحالة الثانية: إذا تم تمرير كائني أو دكشنريين البيانات القديمة والجديدة (old_dict, new_dict)
    old_dict = arg1 if isinstance(arg1, dict) else get_model_snapshot(arg1)
    new_dict = arg2 if isinstance(arg2, dict) else get_model_snapshot(arg2)

    if not isinstance(old_dict, dict) or not isinstance(new_dict, dict):
        return cleaned_changes

    for k, old_val in old_dict.items():
        if is_ignored_field(k):
            continue

        if k not in new_dict:
            continue
        new_val = new_dict.get(k)

        if is_empty_val(old_val) or is_empty_val(new_val):
            continue

        str_old = str(old_val).strip()
        str_new = str(new_val).strip()

        if str_old == str_new or str_old.lower() == str_new.lower():
            continue

        cleaned_changes[k] = {
            'old': str_old,
            'new': str_new
        }

    return cleaned_changes


def get_model_snapshot(obj):
    """
    إنشاء لقطة (Snapshot) دقيقة لبيانات الكائن قبل أو بعد التعديل.
    تُرجع دكشنري مفصل بأسماء الحقول وقيمها المقروءة.
    """
    if not obj:
        return {}

    if isinstance(obj, dict):
        cleaned = {}
        for k, v in obj.items():
            if is_ignored_field(k):
                continue
            if v is None:
                cleaned[k] = ""
            elif isinstance(v, (datetime, date)):
                cleaned[k] = v.strftime('%Y-%m-%d %H:%M:%S') if isinstance(v, datetime) else v.strftime('%Y-%m-%d')
            else:
                cleaned[k] = str(v).strip()
        return cleaned

    opts = getattr(obj, '_meta', None)
    if not opts:
        return {}

    snapshot = {}
    for f in opts.concrete_fields:
        if f.primary_key or getattr(f, 'auto_now', False) or getattr(f, 'auto_now_add', False):
            continue
        fname = f.name
        verbose = str(f.verbose_name or fname)
        if is_ignored_field(fname) or is_ignored_field(verbose):
            continue

        try:
            val = getattr(obj, fname, None)
            if val is None:
                display_val = ""
            elif f.is_relation and val:
                display_val = str(val)
            elif hasattr(obj, f'get_{fname}_display') and callable(getattr(obj, f'get_{fname}_display')):
                display_val = str(getattr(obj, f'get_{fname}_display')())
            elif isinstance(val, bool):
                display_val = "نعم" if val else "لا"
            elif isinstance(val, (datetime, date)):
                display_val = val.strftime('%Y-%m-%d %H:%M:%S') if isinstance(val, datetime) else val.strftime('%Y-%m-%d')
            else:
                display_val = str(val).strip()
        except Exception:
            display_val = ""

        snapshot[verbose] = display_val

    return snapshot


def get_object_repr(obj):
    """استخراج تمثيل واضح ومعبر للكائن يشمل رقم القيد والاسم للطلاب والعمليات المرتبطة"""
    if not obj:
        return ""
    try:
        model_name = obj.__class__.__name__
        if model_name == 'Student':
            stu_id = getattr(obj, 'student_id', '')
            name = obj.get_full_name() if hasattr(obj, 'get_full_name') else getattr(obj, 'name', '')
            if stu_id and name:
                return f"{stu_id} - {name}"
            return str(obj)[:200]
        
        # إذا كان الكائن يرتبط بطالب (مثل تجديد القيد، رصد الدرجات، سحب الملف، الخ)
        if hasattr(obj, 'student') and obj.student:
            stu = obj.student
            stu_id = getattr(stu, 'student_id', '')
            name = stu.get_full_name() if hasattr(stu, 'get_full_name') else getattr(stu, 'name', '')
            if stu_id and name:
                return f"{stu_id} - {name}"
    except Exception:
        pass
    return str(obj)[:200]


def log_create(user, obj, request=None, details=None):
    """تسجيل عملية إنشاء عنصر في سجل التدقيق والأحداث الموحد"""
    try:
        from apps.users.models import AuditLog, ActivityLog
        user_obj = user if (user and getattr(user, 'is_authenticated', False)) else None
        ip = request.META.get('REMOTE_ADDR') if request else None
        model_name = obj.__class__.__name__
        obj_id = str(getattr(obj, 'pk', getattr(obj, 'id', '')))
        obj_repr = get_object_repr(obj)
        
        AuditLog.objects.create(
            user=user_obj,
            action='create',
            model_name=model_name,
            object_id=obj_id,
            object_repr=obj_repr,
            created_data=get_model_snapshot(obj),
            ip_address=ip
        )
        ActivityLog.objects.create(
            user=user_obj,
            action='create',
            model_name=model_name,
            object_name=obj_repr,
            details=details or f"إضافة {model_name} جديد في النظام ({obj_repr})",
            ip_address=ip
        )
    except Exception as e:
        print(f"⚠️ Log create error: {e}")


def log_update(user, obj, old_data=None, new_data=None, request=None, details=None):
    """تسجيل عملية تعديل عنصر في سجل التدقيق والأحداث الموحد مع تصفية الحقول الفارغة والمتشابهة"""
    try:
        from apps.users.models import AuditLog, ActivityLog
        user_obj = user if (user and getattr(user, 'is_authenticated', False)) else None
        ip = request.META.get('REMOTE_ADDR') if request else None
        model_name = obj.__class__.__name__
        obj_id = str(getattr(obj, 'pk', getattr(obj, 'id', '')))
        obj_repr = get_object_repr(obj)

        changes = extract_changed_fields(old_data, new_data)

        AuditLog.objects.create(
            user=user_obj,
            action='update',
            model_name=model_name,
            object_id=obj_id,
            object_repr=obj_repr,
            changed_fields=changes,
            ip_address=ip
        )
        ActivityLog.objects.create(
            user=user_obj,
            action='update',
            model_name=model_name,
            object_name=obj_repr,
            details=details or f"تعديل بيانات {model_name} ({obj_repr})",
            ip_address=ip
        )
    except Exception as e:
        print(f"⚠️ Log update error: {e}")


def log_delete(user, obj, request=None, details=None):
    """تسجيل عملية حذف عنصر في سجل التدقيق والأحداث الموحد"""
    try:
        from apps.users.models import AuditLog, ActivityLog
        user_obj = user if (user and getattr(user, 'is_authenticated', False)) else None
        ip = request.META.get('REMOTE_ADDR') if request else None
        model_name = obj.__class__.__name__
        obj_id = str(getattr(obj, 'pk', getattr(obj, 'id', '')))
        obj_repr = get_object_repr(obj)

        AuditLog.objects.create(
            user=user_obj,
            action='delete',
            model_name=model_name,
            object_id=obj_id,
            object_repr=obj_repr,
            ip_address=ip
        )
        ActivityLog.objects.create(
            user=user_obj,
            action='delete',
            model_name=model_name,
            object_name=obj_repr,
            details=details or f"حذف {model_name} من النظام ({obj_repr})",
            ip_address=ip
        )
    except Exception as e:
        print(f"⚠️ Log delete error: {e}")


def log_activity(user, action, model_name="", object_name="", details="", request=None, **kwargs):
    """تسجيل نشاط عام في سجل الأحداث بشكل متوافق وموثوق 100%"""
    try:
        from apps.users.models import ActivityLog
        user_obj = user if (user and getattr(user, 'is_authenticated', False)) else None
        ip = request.META.get('REMOTE_ADDR') if request else None
        
        act_key = str(action or 'update').strip()
        details_str = str(details or '').strip()
        
        # إذا تم تمرير جملة طويلة في خانة action بدون تحديد تفاصيل منفصلة
        if len(act_key) > 35 and not details_str:
            details_str = act_key
            act_key = 'update'

        ActivityLog.objects.create(
            user=user_obj,
            action=act_key,
            model_name=str(model_name or ''),
            object_name=str(object_name or ''),
            details=details_str or act_key,
            ip_address=ip
        )
    except Exception as e:
        print(f"⚠️ Log activity error: {e}")


# ============================================================
# 2. دوال إدارة المسؤولين المعتمدين (Official Helpers)
# ============================================================

POSITION_MAPPINGS = {
    'dean': ['dean', 'عميد الكلية', 'العميد', 'عميد'],
    'registrar': ['registrar', 'المسجل العام', 'مسجل عام', 'المسجل العام بالكلية', 'المسجل'],
    'admission': ['admission', 'قسم التسجيل والقبول', 'رئيس قسم التسجيل والقبول', 'التسجيل والقبول', 'القبول والتسجيل'],
    'exams_coordinator': [
        'exams_coordinator', 'منسق الدراسة والامتحانات', 'منسقة دراسة والامتحانات',
        'منسقة الدراسة والامتحانات', 'منسق دراسة والامتحانات', 'منسق شؤون الدراسة والامتحانات',
        'منسق الامتحانات', 'منسق دراسة'
    ],
    'exams_head': [
        'exams_head', 'exams', 'قسم الدراسة والامتحانات', 'رئيس قسم الدراسة والامتحانات',
        'رئيس قسم شؤون الدراسة والامتحانات', 'مدير شؤون الدراسة والامتحانات', 'الدراسة والامتحانات'
    ],
    'department_coordinator': [
        'department_coordinator', 'منسق القسم', 'منسق القسم العلمي', 'منسقة القسم'
    ],
    'department_head': [
        'department_head', 'رئيس القسم', 'رئيس القسم العلمي'
    ],
    'graduates': ['graduates', 'قسم الخريجين', 'مسؤول قسم الخريجين', 'الخريجين'],
    'vice_dean': ['vice_dean', 'وكيل الشؤون العلمية', 'الوكيل العلمي'],
    'admin_affairs': ['admin_affairs', 'مدير الشؤون الإدارية', 'الشؤون الإدارية'],
}

def get_official(position_key_or_name, default="", department=None):
    """
    دالة برمجية مساعدة لجلب اسم المسؤول الحالي لطباعته مباشرة في التقارير والنماذج والكشوفات وإفادات التخرج.
    تضمن التفرقة الدقيقة بين منسق الدراسة والامتحانات ورئيس القسم العام ومنسقي الأقسام الأكاديمية.
    """
    try:
        from apps.users.models import Official
        key_clean = str(position_key_or_name).strip().lower()

        # 1. إذا تم تمرير قسم، نبحث أولاً عن منسق/مسؤول ذلك القسم في موظفي الأقسام إن وُجد
        if department:
            try:
                from apps.faculty.models import DepartmentStaff
                dept_id = department.id if hasattr(department, 'id') else department
                staff_qs = DepartmentStaff.objects.filter(department_id=dept_id, is_active=True)
                if 'منسق' in key_clean or 'coordinator' in key_clean:
                    staff = staff_qs.filter(models.Q(role__icontains='منسق') | models.Q(role__icontains='منسقة')).first()
                    if staff:
                        return f"أ. {staff.full_name}".strip()
                elif 'رئيس' in key_clean or 'head' in key_clean:
                    staff = staff_qs.filter(models.Q(role__icontains='رئيس')).first()
                    if staff:
                        return f"أ. {staff.full_name}".strip()
            except Exception:
                pass

        # 2. في حالة طلب منسق/منسقة الدراسة والامتحانات تحديداً
        is_coordinator_query = any(k in key_clean for k in ['منسق', 'منسقة', 'coordinator'])
        if is_coordinator_query:
            coord_obj = Official.objects.filter(is_active=True).filter(
                models.Q(position_key='exams_coordinator') |
                (models.Q(position_name__icontains='منسق') | models.Q(position_name__icontains='منسقة'))
            ).order_by('-updated_at').first()
            if coord_obj:
                return coord_obj.get_full_name()

        # 3. في حالة طلب رئيس قسم الدراسة والامتحانات تحديداً
        is_exams_head_query = ('رئيس' in key_clean or 'قسم' in key_clean) and any(k in key_clean for k in ['دراس', 'امتحان', 'exams']) and not is_coordinator_query
        if is_exams_head_query:
            head_obj = Official.objects.filter(is_active=True).filter(
                models.Q(position_key='exams_head') | models.Q(position_key='exams') |
                (models.Q(position_name__icontains='قسم الدراسة') | models.Q(position_name__icontains='رئيس قسم'))
            ).exclude(
                models.Q(position_name__icontains='منسق') | models.Q(position_name__icontains='منسقة')
            ).order_by('-updated_at').first()
            if head_obj:
                return head_obj.get_full_name()

        # 4. البحث العام بالقواميس
        search_terms = POSITION_MAPPINGS.get(key_clean, [position_key_or_name])
        q_obj = models.Q(position_key__in=search_terms) | models.Q(position_name__in=search_terms)
        for term in search_terms:
            q_obj |= models.Q(position_name__icontains=term)
            q_obj |= models.Q(position_key__icontains=term)

        official = Official.objects.filter(is_active=True).filter(q_obj).order_by('-updated_at').first()
        if official:
            return official.get_full_name()
    except Exception:
        pass
    return default


def get_official_object(position_key_or_name, department=None):
    """
    دالة مساعدة لجلب كائن المسؤول (Official) الحالي.
    """
    try:
        from apps.users.models import Official
        key_clean = str(position_key_or_name).strip().lower()
        search_terms = POSITION_MAPPINGS.get(key_clean, [position_key_or_name])
        
        q_obj = models.Q(position_key__in=search_terms) | models.Q(position_name__in=search_terms)
        for term in search_terms:
            q_obj |= models.Q(position_name__icontains=term)
            q_obj |= models.Q(position_key__icontains=term)

        return Official.objects.filter(is_active=True).filter(q_obj).order_by('-updated_at').first()
    except Exception:
        return None


def ensure_official_table_exists():
    try:
        from django.db import connection
        vendor = connection.vendor
        with connection.cursor() as cursor:
            if vendor == 'postgresql':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS "users_official" (
                        "id" SERIAL PRIMARY KEY,
                        "position_key" varchar(50) NOT NULL,
                        "position_name" varchar(150) NOT NULL,
                        "official_name" varchar(150) NOT NULL,
                        "title" varchar(50) NOT NULL,
                        "is_active" boolean NOT NULL DEFAULT TRUE,
                        "start_date" date NULL,
                        "notes" text NOT NULL DEFAULT '',
                        "created_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        "updated_at" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                """)
            elif vendor == 'sqlite':
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS "users_official" (
                        "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
                        "position_key" varchar(50) NOT NULL,
                        "position_name" varchar(150) NOT NULL,
                        "official_name" varchar(150) NOT NULL,
                        "title" varchar(50) NOT NULL,
                        "is_active" bool NOT NULL,
                        "start_date" date NULL,
                        "notes" text NOT NULL,
                        "created_at" datetime NOT NULL,
                        "updated_at" datetime NOT NULL
                    );
                """)
            else:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS "users_official" (
                        "id" SERIAL PRIMARY KEY,
                        "position_key" varchar(50) NOT NULL,
                        "position_name" varchar(150) NOT NULL,
                        "official_name" varchar(150) NOT NULL,
                        "title" varchar(50) NOT NULL,
                        "is_active" boolean NOT NULL,
                        "start_date" date NULL,
                        "notes" text NOT NULL,
                        "created_at" timestamp NOT NULL,
                        "updated_at" timestamp NOT NULL
                    );
                """)
    except Exception as e:
        print(f"⚠️ ensure_official_table_exists error: {e}")


def seed_default_officials_if_empty():
    """تعبئة تلقائية للمسؤولين المعتمدين الأساسيين عند تشغيل النظام أول مرة"""
    try:
        ensure_official_table_exists()
        from apps.users.models import Official
        if Official.objects.exists():
            return

        defaults = [
            {
                'position_key': 'dean',
                'position_name': 'عميد الكلية',
                'official_name': 'خالد مسعود علي ميرك',
                'title': 'د.',
                'is_active': True,
                'start_date': '2022-09-01',
                'notes': 'تم تعيينه بقرار مجلس الجامعة'
            },
            {
                'position_key': 'registrar',
                'position_name': 'المسجل العام',
                'official_name': 'احمد محمد علي',
                'title': 'أ.',
                'is_active': True,
                'start_date': '2021-01-15',
                'notes': ''
            },
            {
                'position_key': 'vice_dean',
                'position_name': 'وكيل الشؤون العلمية',
                'official_name': 'سارة عبد الله الفيتوري',
                'title': 'د.',
                'is_active': True,
                'start_date': '2023-03-01',
                'notes': ''
            },
            {
                'position_key': 'admission',
                'position_name': 'قسم التسجيل والقبول',
                'official_name': 'محمد علي عمر',
                'title': 'أ.',
                'is_active': True,
                'start_date': '2020-06-01',
                'notes': ''
            },
            {
                'position_key': 'exams',
                'position_name': 'قسم الدراسة والامتحانات',
                'official_name': 'فاطمة عمران الشريف',
                'title': 'د.',
                'is_active': True,
                'start_date': '2024-01-10',
                'notes': ''
            },
            {
                'position_key': 'graduates',
                'position_name': 'قسم الخريجين',
                'official_name': 'حسن عبد السلام',
                'title': 'أ.',
                'is_active': True,
                'start_date': '2019-09-01',
                'notes': ''
            },
            {
                'position_key': 'admin_affairs',
                'position_name': 'مدير الشؤون الإدارية',
                'official_name': 'نادية رمضان الكيلاني',
                'title': 'أ.',
                'is_active': True,
                'start_date': '2022-11-01',
                'notes': ''
            },
        ]

        for item in defaults:
            s_date = datetime.strptime(item['start_date'], '%Y-%m-%d').date() if item['start_date'] else None
            Official.objects.create(
                position_key=item['position_key'],
                position_name=item['position_name'],
                official_name=item['official_name'],
                title=item['title'],
                is_active=item['is_active'],
                start_date=s_date,
                notes=item['notes']
            )
    except Exception as e:
        print(f"⚠️ Error seeding default officials: {e}")


def setup_exam_director_role_and_permissions():
    """
    تسجيل وإنشاء مجموعة وصلاحيات دور 'مدير الدراسة والامتحانات' في قاعدة البيانات
    """
    from django.contrib.auth.models import Group, Permission
    from django.contrib.contenttypes.models import ContentType

    group_name = "مدير الدراسة والامتحانات"
    group, created = Group.objects.get_or_create(name=group_name)

    # الموديلات المستهدفة للصلاحيات
    target_models = [
        ('student', 'student'),
        ('student', 'notification'),
        ('grades', 'grade'),
        ('grades', 'gradeconfiguration'),
        ('grades', 'gradeappeal'),
        ('grades', 'gradesheetlock'),
        ('grades', 'courseequivalencerule'),
        ('grades', 'resultpublication'),
        ('faculty', 'professor'),
        ('faculty', 'courseassignment'),
        ('renewal', 'course'),
        ('renewal', 'department'),
        ('renewal', 'semester'),
        ('renewal', 'specialization'),
        ('renewal', 'level'),
        ('renewal', 'group'),
        ('renewal', 'studyplan'),
    ]

    assigned_permissions = []

    for app_label, model_name in target_models:
        try:
            content_type = ContentType.objects.filter(app_label=app_label, model=model_name).first()
            if content_type:
                perms = Permission.objects.filter(content_type=content_type)
                for p in perms:
                    group.permissions.add(p)
                    assigned_permissions.append(f"{app_label}.{p.codename}")
        except Exception as e:
            print(f"[WARN] Error assigning perms for {app_label}.{model_name}: {e}")

    # إنشاء نسخة ثنائية بالاسم الإنجليزي للمطابقة
    alt_group, _ = Group.objects.get_or_create(name="Director of Study and Examinations")
    alt_group.permissions.set(group.permissions.all())

    print(f"[OK] Role & Group '{group_name}' setup successfully with {len(assigned_permissions)} permissions.")
    return {
        'group': group,
        'created': created,
        'permissions_count': len(assigned_permissions),
        'permissions': assigned_permissions
    }


def setup_graduates_department_role_and_permissions():
    """
    تسجيل وإنشاء مجموعة وصلاحيات دور 'قسم الخريجين' في قاعدة البيانات
    """
    from django.contrib.auth.models import Group, Permission
    from django.contrib.contenttypes.models import ContentType

    group_name = "قسم الخريجين"
    group, created = Group.objects.get_or_create(name=group_name)

    # الموديلات المستهدفة لصلاحيات قسم الخريجين
    target_models = [
        ('renewal', 'graduationclearance'),
        ('renewal', 'studentwithdrawal'),
        ('student', 'student'),
        ('student', 'notification'),
        ('grades', 'grade'),
        ('renewal', 'department'),
        ('renewal', 'semester'),
        ('renewal', 'specialization'),
        ('users', 'official'),
    ]

    assigned_permissions = []

    for app_label, model_name in target_models:
        try:
            content_type = ContentType.objects.filter(app_label=app_label, model=model_name).first()
            if content_type:
                perms = Permission.objects.filter(content_type=content_type)
                for p in perms:
                    group.permissions.add(p)
                    assigned_permissions.append(f"{app_label}.{p.codename}")
        except Exception as e:
            print(f"[WARN] Error assigning perms for {app_label}.{model_name}: {e}")

    # إنشاء نسخة بالاسم الإنجليزي للمطابقة
    alt_group, _ = Group.objects.get_or_create(name="Graduation Department")
    alt_group.permissions.set(group.permissions.all())

    print(f"[OK] Role & Group '{group_name}' setup successfully with {len(assigned_permissions)} permissions.")
    return {
        'group': group,
        'created': created,
        'permissions_count': len(assigned_permissions),
        'permissions': assigned_permissions
    }


