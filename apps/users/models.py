from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models

class User(AbstractUser):
    username_validator = RegexValidator(
        regex=r'^[\w.@+\-\s]+$',
        message='أدخل اسم مستخدم صالحاً. قد يحتوي هذا الحقل على أحرف، أرقام، مسافات، ورموز @/./+/-/_ فقط.'
    )
    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[username_validator],
        verbose_name="اسم المستخدم",
        help_text="مطلوب. 150 حرفاً أو أقل. الأحرف والأرقام والمسافات والرموز @/./+/-/_ فقط."
    )
    
    ROLE_CHOICES = [
        ('admin', 'مدير النظام'),
        ('general_registrar', 'مسجل عام'),
        ('registrar', 'موظف تسجيل وقبول'),
        ('exam_director', 'مدير الدراسة والامتحانات'),
        ('exam_officer', 'موظف دراسة وامتحانات'),
        ('graduate_officer', 'قسم الخريجين'),
        ('academic_dept', 'رئيس / قسم علمي'),
        ('student', 'طالب'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student', verbose_name="الدور") # لو ماخددتش دور يقعد طالب
    phone = models.CharField(max_length=20, blank=True, verbose_name="رقم الهاتف")
    department = models.ForeignKey(
        'renewal.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="القسم العلمي التابع له"
    )
    
    @property
    def is_student(self):
        """التحقق مما إذا كان المستخدم طالباً"""
        if self.is_superuser or self.is_staff:
            return False
        return self.role in ['student', 'طالب'] or hasattr(self, 'student')

    @property
    def is_staff_member(self):
        """التحقق مما إذا كان المستخدم من الكادر الإداري أو الأكاديمي"""
        if self.is_superuser or self.is_staff:
            return True
        return self.role in [
            'admin', 'general_registrar', 'registrar', 'exam_director',
            'exam_officer', 'graduate_officer', 'academic_dept', 'موظف', 'أستاذ'
        ]

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
    
    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمين"


class AuditLog(models.Model):
    """سجل أرشيف التعديلات والحذف"""
    
    ACTION_CHOICES = [
        ('update', 'تعديل'),
        ('delete', 'حذف'),
    ]
    
    # معلومات عامة
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, verbose_name="المستخدم")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name="نوع الإجراء")
    model_name = models.CharField(max_length=100, verbose_name="الجدول")
    object_id = models.CharField(max_length=50, verbose_name="رقم العنصر")
    object_repr = models.CharField(max_length=200, verbose_name="اسم العنصر")
    
    # معلومات التغيير (للتعديل)
    changed_fields = models.JSONField(default=dict, blank=True, verbose_name="الحقول المتغيرة")
    # مثال: {"first_name": {"old": "أحمد", "new": "محمد"}}
    
    # معلومات الحذف (للمحذوفات)
    deleted_data = models.JSONField(default=dict, blank=True, verbose_name="البيانات المحذوفة")
    
    # معلومات إضافية
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="عنوان IP")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإجراء")
    # أضيفي هذا الحقل في class AuditLog
    created_data = models.JSONField(default=dict, blank=True, verbose_name="البيانات المضافة")
    class Meta:
        verbose_name = "سجل تدقيق"
        verbose_name_plural = "سجلات التدقيق"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user} - {self.get_action_display()} - {self.model_name} - {self.object_repr}"

    @property
    def filtered_changed_fields(self):
        """إرجاع الحقول المتغيرة بعد تصفية القيم الفارغة وNone وكلمة فارغ"""
        from apps.users.utils import extract_changed_fields
        return extract_changed_fields(self.changed_fields)

    
class ActivityLog(models.Model):
    """سجل الأحداث - يسجل كل الإجراءات في النظام"""
    
    ACTION_CHOICES = [
        ('login', 'تسجيل دخول'),
        ('logout', 'تسجيل خروج'),
        ('create', 'إنشاء'),
        ('update', 'تعديل'),
        ('delete', 'حذف'),
        ('renew', 'تجديد قيد'),
        ('download', 'تنزيل مواد'),
        ('grade', 'رصد درجة'),
    ]
    
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, verbose_name="المستخدم")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name="الإجراء")
    model_name = models.CharField(max_length=100, blank=True, verbose_name="الجدول")
    object_name = models.CharField(max_length=200, blank=True, verbose_name="اسم العنصر")
    details = models.TextField(blank=True, verbose_name="التفاصيل")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="عنوان IP")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="التاريخ والوقت")
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "سجل حدث"
        verbose_name_plural = "سجل الأحداث"
    
    def __str__(self):
        return f"{self.user} - {self.get_action_display()} - {self.created_at}"


class Official(models.Model):
    """موديل إدارة المسؤولين المعتمدين في النظام والتقارير والإفادات والشهادات"""
    POSITION_KEYS = [
        ('dean', 'العميد / عميد الكلية'),
        ('registrar', 'المسجل العام'),
        ('admission', 'قسم التسجيل والقبول'),
        ('exams_coordinator', 'منسق/ة الدراسة والامتحانات'),
        ('exams_head', 'رئيس قسم الدراسة والامتحانات'),
        ('exams', 'قسم الدراسة والامتحانات'),
        ('graduates', 'قسم الخريجين'),
        ('vice_dean', 'وكيل الشؤون العلمية'),
        ('admin_affairs', 'مدير الشؤون الإدارية'),
        ('department_head', 'رئيس قسم علمي'),
        ('department_coordinator', 'منسق قسم علمي'),
        ('other', 'منصب آخر'),
    ]

    position_key = models.CharField(max_length=50, choices=POSITION_KEYS, default='other', verbose_name="رمز/مفتاح المنصب")
    position_name = models.CharField(max_length=150, verbose_name="اسم المنصب/الوظيفة")
    official_name = models.CharField(max_length=150, verbose_name="اسم المسؤول")
    title = models.CharField(max_length=50, blank=True, default="", verbose_name="الصفة/اللقب")
    is_active = models.BooleanField(default=True, verbose_name="نشط/حالي")
    start_date = models.DateField(null=True, blank=True, verbose_name="تاريخ بداية التكليف")
    notes = models.TextField(blank=True, default="", verbose_name="ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإضافة")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        ordering = ['-is_active', 'position_name']
        verbose_name = "مسؤول معتمد"
        verbose_name_plural = "المسؤولين المعتمدين"

    def __str__(self):
        status_str = "حالي" if self.is_active else "سابق"
        return f"{self.position_name}: {self.get_full_name()} ({status_str})"

    def get_full_name(self):
        if self.title:
            return f"{self.title} {self.official_name}".strip()
        return self.official_name


def get_official(position_key_or_name, default="", department=None):
    """دالة مساعدة لجلب اسم المسؤول الحالي لطباعته في النماذج والإفادات والشهادات والكشوفات"""
    from apps.users.utils import get_official as _get_official
    return _get_official(position_key_or_name, default=default, department=department)


def get_official_object(position_key_or_name, department=None):
    """دالة مساعدة لجلب كائن المسؤول (Official) الحالي"""
    from apps.users.utils import get_official_object as _get_official_object
    return _get_official_object(position_key_or_name, department=department)