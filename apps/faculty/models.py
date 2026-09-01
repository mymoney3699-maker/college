# apps/faculty/models.py
from django.db import models
from django.core.exceptions import ValidationError


class Professor(models.Model):
    """موديل الأستاذ"""
    # الرقم الوظيفي (تلقائي)
    professor_id = models.CharField(max_length=20, unique=True, blank=True, verbose_name="الرقم الوظيفي")
    full_name = models.CharField(max_length=255, verbose_name="الاسم الكامل")
    email = models.EmailField(unique=True, verbose_name="البريد الإلكتروني")
    phone = models.CharField(max_length=20, blank=True, verbose_name="رقم الهاتف")
    specialization = models.ForeignKey(
    'renewal.Specialization', 
    on_delete=models.SET_NULL, # أو models.CASCADE حسب رغبتك
    null=True,                 # يسمح لقاعدة البيانات بقبول قيمة فارغة
    blank=True,                # يسمح للواجهات والفورم بقبول قيمة فارغة
    verbose_name="التخصص"
)
    department = models.ForeignKey('renewal.Department', on_delete=models.PROTECT, verbose_name="القسم")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    hire_date = models.DateField(null=True, blank=True, verbose_name="تاريخ التعيين")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")
    
    class Meta:
        verbose_name = "أستاذ"
        verbose_name_plural = "الأساتذة"
        ordering = ['full_name']
    
    def __str__(self):
        return f"{self.professor_id} - {self.full_name}"
    
    def save(self, *args, **kwargs):
        # توليد الرقم الوظيفي إذا لم يكن موجوداً
        if not self.professor_id:
            from datetime import datetime
            year = datetime.now().year % 100
            last_prof = Professor.objects.all().order_by('-id').first()
            last_serial = 1
            if last_prof:
                last_serial = last_prof.id + 1
            self.professor_id = f"P{year}{last_serial:04d}"
        super().save(*args, **kwargs)


class DepartmentStaff(models.Model):
    """موديل موظفي الأقسام الأكاديمية"""
    staff_id = models.CharField(max_length=20, unique=True, blank=True, verbose_name="الرقم الوظيفي")
    full_name = models.CharField(max_length=255, verbose_name="الاسم الكامل")
    email = models.EmailField(verbose_name="البريد الإلكتروني", blank=True, null=True)
    role = models.CharField(max_length=150, verbose_name="المسمى الوظيفي / الدور")
    department = models.ForeignKey('renewal.Department', on_delete=models.CASCADE, verbose_name="القسم")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "موظف قسم"
        verbose_name_plural = "موظفو الأقسام"
        ordering = ['full_name']

    def __str__(self):
        return f"{self.full_name} - {self.role} ({self.department.name})"

    def save(self, *args, **kwargs):
        if not self.staff_id:
            from datetime import datetime
            year = datetime.now().year % 100
            last_staff = DepartmentStaff.objects.all().order_by('-id').first()
            last_serial = (last_staff.id + 1) if last_staff else 1
            self.staff_id = f"S{year}{last_serial:04d}"
        super().save(*args, **kwargs)


class CourseAssignment(models.Model):
    """موديل إسناد المواد للأساتذة"""
    professor = models.ForeignKey(Professor, on_delete=models.CASCADE, verbose_name="الأستاذ")
    course = models.ForeignKey('renewal.Course', on_delete=models.CASCADE, verbose_name="المادة")
    department = models.ForeignKey('renewal.Department', on_delete=models.CASCADE, verbose_name="القسم")
    level = models.ForeignKey('renewal.Level', on_delete=models.CASCADE, verbose_name="المستوى")
    student_group = models.ForeignKey('renewal.Group', on_delete=models.CASCADE, verbose_name="المجموعة")
    semester = models.ForeignKey('renewal.Semester', on_delete=models.CASCADE, verbose_name="الفصل الدراسي")
    is_active = models.BooleanField(default=True, verbose_name="نشط")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")
    
    class Meta:
        verbose_name = "إسناد مادة لأستاذ"
        verbose_name_plural = "إسنادات المواد للأساتذة"
        unique_together = ['professor', 'course', 'student_group', 'semester']
        ordering = ['semester', 'course__code']
    
    def __str__(self):
        return f"{self.professor.full_name} - {self.course.name} ({self.student_group.name})"
    
    def clean(self):
        # التحقق من عدم وجود إسناد مكرر
        if CourseAssignment.objects.filter(
            professor=self.professor,
            course=self.course,
            student_group=self.student_group,
            semester=self.semester
        ).exclude(pk=self.pk).exists():
            raise ValidationError("هذا الإسناد موجود مسبقاً")


class AttendanceRecord(models.Model):
    """موديل سجل الحضور والغياب للطلاب"""
    STATUS_CHOICES = [
        ('present', 'حاضر'),
        ('absent', 'غائب'),
        ('excused', 'بعذر'),
    ]
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    course = models.ForeignKey('renewal.Course', on_delete=models.CASCADE, null=True, blank=True, verbose_name="المادة")
    group = models.ForeignKey('renewal.Group', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="المجموعة")
    department = models.ForeignKey('renewal.Department', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="القسم")
    semester = models.ForeignKey('renewal.Semester', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الفصل الدراسي")
    date = models.DateField(auto_now_add=True, verbose_name="تاريخ الحضور")
    day_number = models.IntegerField(default=1, verbose_name="رقم اليوم/المحاضرة")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present', verbose_name="حالة الحضور")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "سجل حضور وغياب"
        verbose_name_plural = "سجلات الحضور والغياب"
        ordering = ['-date', 'student__name']

    def __str__(self):
        return f"{self.student.name} - {self.date} ({self.get_status_display()})"