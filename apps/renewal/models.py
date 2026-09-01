# apps/renewal/models.py
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.users.models import User

# ============================================
# 1. الجداول الأساسية
# ============================================

class Department(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="اسم القسم")
    code = models.CharField(max_length=20, unique=True, verbose_name="رمز القسم")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    def __str__(self): return self.name
    class Meta:
        verbose_name = "قسم"
        verbose_name_plural = "الأقسام"

# apps/renewal/models.py - تعديل Level

class Level(models.Model):
    """جدول المستويات الدراسية (1 إلى 8)"""
    number = models.IntegerField(unique=True, verbose_name="رقم المستوى")
    name = models.CharField(max_length=50, verbose_name="اسم المستوى")
    
    def __str__(self):
        return f"المستوى {self.number}"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.number < 1 or self.number > 8:
            raise ValidationError({'number': 'المستوى يجب أن يكون بين 1 و 8'})
    
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
    
    class Meta:
        ordering = ['number']
        verbose_name = "مستوى دراسي"
        verbose_name_plural = "المستويات الدراسية"

class Group(models.Model):
    name = models.CharField(max_length=50, verbose_name="اسم المجموعة")
    department = models.ForeignKey(Department, on_delete=models.CASCADE, verbose_name="القسم")
    level = models.ForeignKey(Level, on_delete=models.CASCADE, verbose_name="المستوى", null=True, blank=True)
    academic_year = models.CharField(max_length=20, default='2026', verbose_name="السنة الدراسية")
    semester = models.CharField(max_length=20, default='spring', verbose_name="الفصل الدراسي")
    
    def __str__(self):
        level_name = f" - المستوى {self.level.number}" if self.level else ""
        return f"{self.name} - {self.department.name}{level_name} ({self.academic_year} / {self.semester})"
    
    class Meta:
        unique_together = ['name', 'department', 'level', 'academic_year', 'semester']
        verbose_name = "مجموعة"
        verbose_name_plural = "المجموعات"


from django.core.validators import RegexValidator

plan_code_validator = RegexValidator(
    regex=r'^(?=.*[a-zA-Z\u0600-\u06FF])(?=.*\d)[a-zA-Z0-9\u0600-\u06FF\-_./]{2,20}$',
    message="رمز الخطة يجب أن يتراوح طوله بين 2 إلى 20 خانة، ويحتوي على حرف ورقم على الأقل.",
    code='invalid_plan_code'
)


class StudyPlan(models.Model):
    code = models.CharField(
        max_length=20, 
        unique=True, 
        verbose_name="رمز الخطة", 
        null=True, 
        blank=True,
        validators=[plan_code_validator]
    )
    name = models.CharField(max_length=50, unique=True, verbose_name="اسم الخطة")
    description = models.TextField(blank=True, verbose_name="وصف الخطة")
    is_active = models.BooleanField(default=True, verbose_name="نشطة")
    
    def clean(self):
        super().clean()
        if self.code:
            self.code = self.code.strip().upper()
            plan_code_validator(self.code)

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self): 
        return f"{self.code} - {self.name}" if self.code else self.name
    
    class Meta:
        verbose_name = "خطة دراسية"
        verbose_name_plural = "الخطط الدراسية"



  

class Job(models.Model):
    title = models.CharField(max_length=200, verbose_name="عنوان الوظيفة")
    description = models.TextField(verbose_name="وصف الوظيفة")
    requirements = models.TextField(verbose_name="المتطلبات")
    posted_date = models.DateField(auto_now_add=True, verbose_name="تاريخ النشر")
    is_active = models.BooleanField(default=True, verbose_name="فعالة")

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-posted_date', 'title']
        verbose_name = "وظيفة"
        verbose_name_plural = "الوظائف"


class Semester(models.Model):
    SEMESTER_TYPES = [
        ('fall', 'خريف'),
        ('spring', 'ربيع'),
       
    ]
    
    year = models.IntegerField(verbose_name="السنة")
    type = models.CharField(max_length=10, choices=SEMESTER_TYPES, verbose_name="نوع الفصل")
    is_active = models.BooleanField(default=False, verbose_name="فعال")
    
    def __str__(self):
        return f"{self.year} - {self.get_type_display()}"
    
    def save(self, *args, **kwargs):
        if self.is_active:
            # إلغاء تفعيل جميع الفصول الأخرى لمنع تضارب البيانات (فقط فصل واحد نشط)
            Semester.objects.filter(is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)
    
    class Meta:
        unique_together = ['year', 'type']
        verbose_name = "فصل دراسي"
        verbose_name_plural = "الفصول الدراسية"

class Course(models.Model):
    name = models.CharField(max_length=200, verbose_name="اسم المادة")
    code = models.CharField(max_length=20, verbose_name="رمز المادة")
    credits = models.IntegerField(default=3, verbose_name="عدد الوحدات")
    theoretical_hours = models.IntegerField(default=2, verbose_name="ساعات نظري")
    practical_hours = models.IntegerField(default=0, verbose_name="ساعات عملي")
    
    department = models.ManyToManyField(Department, blank=True, related_name='courses', verbose_name="الأقسام والتخصصات")
    study_plan = models.ForeignKey(StudyPlan, on_delete=models.PROTECT, verbose_name="الخطة الدراسية")
    level = models.ForeignKey(Level, on_delete=models.PROTECT, verbose_name="المستوى")
    
    # 🔥 عدة متطلبات سابقة (ManyToManyField)
    prerequisites = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='prerequisite_for',
        verbose_name="المتطلبات السابقة"
    )
    
    is_active = models.BooleanField(default=True, verbose_name="فعالة")
    is_mandatory = models.BooleanField(default=True, verbose_name="إجبارية")
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
    def get_prerequisites_list(self):
        """ترجع قائمة أسماء المتطلبات السابقة"""
        return [f"{p.name} ({p.code})" for p in self.prerequisites.all()]
    
    def check_prerequisites(self, student):
        """تتحقق إذا كان الطالب قد اجتاز جميع المتطلبات السابقة للمادة بدون استثناء"""
        from apps.grades.models import Grade
        from django.db.models import Q
        
        prereqs = self.prerequisites.all()
        if not prereqs.exists():
            return True, "✅ لا توجد متطلبات سابقة"

        missing = []
        for prereq in prereqs:
            passed = Grade.objects.filter(
                student=student,
                course=prereq
            ).filter(Q(is_passed=True) | Q(total_grade__gte=50)).exists()
            
            if not passed:
                missing.append(f"{prereq.name} ({prereq.code})")

        if missing:
            return False, f"❌ لم يتم اجتياز المتطلبات السابقة التالية: {', '.join(missing)}"
            
        return True, "✅ جميع المتطلبات السابقة مستوفاة"
    
    class Meta:
        ordering = ['level__number', 'code']
        verbose_name = "مادة"
        verbose_name_plural = "المواد"

    
# ============================================
# 2. عمليات القيد والتنزيل
# ============================================

class EnrollmentRenewal(models.Model):
    STATUS_CHOICES = [
        ('RENEWED', 'مجدد'),
        ('active', 'منتظم'),
        ('suspended', 'موقوف'),
        ('dropped_out', 'منقطع'),
        ('withdrawn', 'سحب ملف'),
        ('cleared', 'إخلاء طرف'),
        ('graduated', 'متخرج'),
    ]
    
    SPECIAL_TYPE_CHOICES = [
        ('REGULAR', 'عادي'),
        ('STOPPED', 'موقوف قيده'),
        ('STOPPED_ENROLLMENT', 'موقوف قيده'),
        ('NEW_STUDENT', 'طالب جديد'),
        ('OTHER', 'حالة خاصة أخرى'),
    ]
    
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    semester = models.ForeignKey(Semester, on_delete=models.PROTECT, verbose_name="الفصل الدراسي")
    level = models.ForeignKey(Level, on_delete=models.PROTECT, verbose_name="المستوى")  # 🔥 جديد
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RENEWED', verbose_name="حالة القيد")
    special_type = models.CharField(max_length=50, choices=SPECIAL_TYPE_CHOICES, default='REGULAR', verbose_name="نوع التجديد الخاص")
    renewed_by = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name="تم التجديد بواسطة")
    renewal_date = models.DateField(default=timezone.now, verbose_name="تاريخ التجديد")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    
    class Meta:
        unique_together = ['student', 'semester']
        verbose_name = "تجديد قيد"
        verbose_name_plural = "تجديدات القيد"
    
    def __str__(self):
        return f"{self.student.name} - {self.semester} - {self.level} - {self.status}"
        
    def save(self, *args, **kwargs):
        from django.conf import settings
        from .utils import get_system_date
        if not self.renewal_date or not self.pk:
            self.renewal_date = get_system_date()
        super().save(*args, **kwargs)
        
    def clean(self):
        from django.core.exceptions import ValidationError
        
        # 1. التأكد من أن التجديد يتم للفصل الدراسي الفعّال حالياً فقط
        if not self.semester.is_active:
            raise ValidationError("❌ لا يمكن تجديد القيد إلا في الفصل الدراسي الفعّال حالياً")
            
        # 2. التأكد من عدم تجديد القيد للطالب لنفس نوع الفصل (خريف أو ربيع) في نفس السنة الدراسية
        existing_renewals = EnrollmentRenewal.objects.filter(
            student=self.student,
            semester__year=self.semester.year
        ).exclude(pk=self.pk)
        
        # التأكد من عدم تجاوز التجديد لمرتين في السنة
        if existing_renewals.count() >= 2:
            raise ValidationError("❌ الطالب تجاوز الحد الأقصى لتجديد القيد في هذه السنة الدراسية (مرتين فقط)")
            
        # التأكد من عدم التكرار لنفس النوع (خريف أو ربيع) في نفس السنة الدراسية
        if existing_renewals.filter(semester__type=self.semester.type).exists():
            raise ValidationError(f"❌ الطالب قام بالفعل بتجديد قيده لفصل {self.semester.get_type_display()} في هذه السنة")
            
    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class CourseRegistration(models.Model):
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    course = models.ForeignKey(Course, on_delete=models.PROTECT, verbose_name="المادة")
    semester = models.ForeignKey(Semester, on_delete=models.PROTECT, verbose_name="الفصل الدراسي")
    attempt_number = models.IntegerField(default=1, verbose_name="عدد المحاولة")
    registered_by = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name="تم التنزيل بواسطة")
    registration_date = models.DateField(auto_now_add=True, verbose_name="تاريخ التنزيل")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    
    class Meta:
        unique_together = ['student', 'course', 'semester']
        verbose_name = "تنزيل مادة"
        verbose_name_plural = "تنزيل المواد"
    
    def clean(self):
        # 0. التحقق من حالة الطالب (خط الدفاع الأخير في الموديل)
        BLOCKED_STATUSES = ["موقف قيده", "موقوف قيده", "سحب ملف", "إخلاء طرف", "نشط"]
        if self.student and self.student.student_status and (self.student.student_status.name in BLOCKED_STATUSES or self.student.student_status.name != "منتظم"):
            raise ValidationError(f"❌ لا يمكن تنزيل مواد لطالب بحالة ({self.student.student_status.name}). مسموح فقط للطالب المنتظم.")
        
        # 1. التأكد من أن التنزيل يتم للفصل الدراسي الفعّال حالياً فقط
        if not self.semester.is_active:
            raise ValidationError("❌ لا يمكن تنزيل المواد إلا في الفصل الدراسي الفعّال حالياً")
            
        # 2. التحقق من القيد النشط
        enrollment = EnrollmentRenewal.objects.filter(
            student=self.student,
            semester=self.semester,
            status__in=['active', 'RENEWED']
        ).first()
        
        if not enrollment:
            from apps.grades.models import Grade
            has_prev_renewals = EnrollmentRenewal.objects.filter(student=self.student).exists()
            has_grades = Grade.objects.filter(student=self.student).exists()
            is_brand_new = (not has_prev_renewals and not has_grades and (not self.student.level or self.student.level.number == 1))
            if is_brand_new:
                enrollment = EnrollmentRenewal.objects.create(
                    student=self.student,
                    semester=self.semester,
                    level=self.student.level or Level.objects.filter(number=1).first(),
                    status='active',
                    notes='تجديد قيد آلي عند تنزيل مواد المستجدين'
                )
            else:
                raise ValidationError("❌ لا يمكن إتمام العملية: قيد الطالب غير نشط لهذا الفصل الدراسي. يجب تجديد قيد الطالب أولاً قبل إجراء معادلة المواد أو تغيير المسار.")
        
        # 3. التحقق من عدم التسجيل المسبق في نفس الفصل
        if CourseRegistration.objects.filter(
            student=self.student,
            course=self.course,
            semester=self.semester
        ).exclude(pk=self.pk).exists():
            raise ValidationError("❌ الطالب مسجل بالفعل في هذه المادة لهذا الفصل")
        
        # 4. التحقق من المتطلبات السابقة
        can_register, message = self.course.check_prerequisites(self.student)
        if not can_register:
            raise ValidationError(message)
    
    def save(self, *args, **kwargs):
        if not self.pk:
            # 🎯 احتساب تلقائي لعدد المحاولات بناءً على التسجيلات التاريخية السابقة للطالب لهذه المادة
            prev_attempts = CourseRegistration.objects.filter(
                student=self.student,
                course=self.course
            ).exclude(pk=self.pk).count()
            self.attempt_number = prev_attempts + 1
        self.clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student.name} - {self.course.name} - {self.semester}"
    
# apps/renewal/models.py (إضافة هذا الموديل)
class Specialization(models.Model):
    """جدول التخصصات"""
    name = models.CharField(max_length=100, unique=True, verbose_name="اسم التخصص")
    code = models.CharField(max_length=20, unique=True, verbose_name="رمز التخصص")
    department = models.ForeignKey('Department', on_delete=models.PROTECT, verbose_name="القسم")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "تخصص"
        verbose_name_plural = "التخصصات"

# apps/renewal/models.py

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

class SystemJob(models.Model):
    """
    نموذج الوظائف والخدمات الإدارية في الكلية
    مثل: تجديد القيد، تسجيل المواد، طلب شهادة، الخ.
    """
    name = models.CharField(max_length=200, verbose_name="اسم الوظيفة")
    code = models.SlugField(
        max_length=50,
        unique=True,
        verbose_name="الرمز البرمجي",
        help_text="رمز فريد للوظيفة لربطها في الكود (مثل: renewal, registration)"
    )
    start_date = models.DateField(verbose_name="تاريخ الفتح")
    duration_days = models.PositiveIntegerField(
        default=7,
        verbose_name="المدة بالأيام",
        help_text="عدد الأيام المتاحة لإنجاز الوظيفة"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="مفعلة",
        help_text="تفعيل أو إيقاف الوظيفة يدوياً"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")

    class Meta:
        ordering = ['-start_date', 'name']
        verbose_name = "وظيفة/خدمة"
        verbose_name_plural = "الوظائف والخدمات"

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def is_currently_open(self):
        """
        تحسب تلقائياً ما إذا كانت الوظيفة مفتوحة حالياً.
        الشروط:
        1. is_active == True
        2. اليوم الحالي يقع بين start_date و (start_date + duration_days)
        """
        if not self.is_active:
            return False

        today = timezone.now().date()
        end_date = self.start_date + timezone.timedelta(days=self.duration_days)

        return self.start_date <= today <= end_date

    @property
    def end_date(self):
        """تاريخ انتهاء الوظيفة"""
        return self.start_date + timezone.timedelta(days=self.duration_days)

    @property
    def days_remaining(self):
        """عدد الأيام المتبقية حتى انتهاء الوظيفة"""
        if not self.is_currently_open:
            return 0
        today = timezone.now().date()
        end_date = self.start_date + timezone.timedelta(days=self.duration_days)
        remaining = (end_date - today).days
        return max(0, remaining)

    @property
    def status_display(self):
        """حالة الوظيفة كنص مقروء"""
        if not self.is_active:
            return "غير مفعلة"
        if self.is_currently_open:
            return f"مفتوحة (متبقي {self.days_remaining} يوم)"
        if self.start_date > timezone.now().date():
            return "لم تفتح بعد"
        return "منتهية"

    def clean(self):
        """التحقق من صحة البيانات"""
        if self.duration_days <= 0:
            raise ValidationError({'duration_days': 'المدة يجب أن تكون أكبر من صفر'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class CourseEquivalence(models.Model):
    """موديل قواعد معادلة المواد الدراسية مع ربط تخصص المصدر وتخصص الوجهة"""
    source_department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='source_course_equivalences',
        verbose_name="تخصص المادة الأصلية (المحول منه)"
    )
    source_course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='source_equivalences',
        verbose_name="المادة الأصلية / المصدر"
    )
    target_department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='target_course_equivalences',
        verbose_name="تخصص المادة البديلة (المحول إليه)"
    )
    target_course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='target_equivalences',
        verbose_name="المادة البديلة / المكافئة"
    )
    notes = models.TextField(blank=True, verbose_name="ملاحظات المعادلة")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "قاعدة معادلة مادة"
        verbose_name_plural = "قواعد معادلة المواد"
        unique_together = ['source_department', 'source_course', 'target_department', 'target_course']
        ordering = ['-created_at']

    def __str__(self):
        src_dept = f"[{self.source_department.name}] " if self.source_department else ""
        tgt_dept = f"[{self.target_department.name}] " if self.target_department else ""
        return f"{src_dept}{self.source_course.code} ⬅️ {tgt_dept}{self.target_course.code}"



class GraduationClearance(models.Model):
    """سجل وتوثيق إخلاء طرف الخريج وتجميد العمليات الإدارية"""
    student = models.OneToOneField('student.Student', on_delete=models.CASCADE, related_name='graduation_clearance', verbose_name="الطالب")
    clearance_date = models.DateField(default=timezone.now, verbose_name="تاريخ إخلاء الطرف")
    processed_by = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name="تم التوثيق بواسطة")
    semester = models.ForeignKey(Semester, on_delete=models.PROTECT, verbose_name="فصل التخرج")
    graduation_project_grade = models.FloatField(default=0.0, verbose_name="درجة مشروع التخرج")
    certificate_number = models.CharField(max_length=50, blank=True, null=True, unique=True, verbose_name="رقم إفادة التخرج")
    is_certificate_issued = models.BooleanField(default=False, verbose_name="تم إصدار الإفادة")
    certificate_issued_at = models.DateTimeField(blank=True, null=True, verbose_name="تاريخ إصدار الإفادة")
    notes = models.TextField(blank=True, verbose_name="ملاحظات وتفاصيل إخلاء الطرف")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "إخلاء طرف خريج"
        verbose_name_plural = "إخلاءات طرف الخريجين"

    def __str__(self):
        return f"إخلاء طرف: {self.student.name} - ({self.clearance_date})"


class StudentWithdrawal(models.Model):
    """سجل علائقي منظم لتوثيق وأرشفة عمليات سحب ملفات الطلاب"""
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, related_name='withdrawals', verbose_name="الطالب")
    academic_term = models.ForeignKey(Semester, on_delete=models.SET_NULL, null=True, blank=True, related_name='withdrawals', verbose_name="الفصل الدراسي")
    withdrawal_date = models.DateField(default=timezone.now, verbose_name="تاريخ السحب")
    reason = models.TextField(verbose_name="سبب سحب الملف")
    notes = models.TextField(blank=True, verbose_name="ملاحظات إضافية")
    processed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_withdrawals', verbose_name="الموظف المسؤول")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التوثيق")

    class Meta:
        verbose_name = "سجل سحب ملف"
        verbose_name_plural = "أرشيف سحب الملفات"
        ordering = ['-withdrawal_date', '-created_at']

    def __str__(self):
        return f"سحب ملف: {self.student.name} - ({self.withdrawal_date})"