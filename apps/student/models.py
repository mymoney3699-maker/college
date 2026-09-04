# apps/student/models.py
from django.db import models
from apps.users.models import User
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
from django.core.files import File
from django.urls import reverse
from django.conf import settings
import socket
import json
import hmac
import hashlib


def get_default_network_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

# 🎯 الثابت العام الموحد لعنوان الخادم عبر كامل تطبيق الطلاب
_local_ip = get_default_network_ip()
SERVER_BASE_URL = getattr(settings, 'SITE_DOMAIN', None) or f'http://{_local_ip}:8000'




# ============================================
# 1. الجداول المساعدة (المفاتيح الأجنبية)
# ============================================

class MaritalStatus(models.Model):
    MARITAL_CHOICES = [
        ('أعزب/ـة', 'أعزب/ـة'),
        ('متزوج/ـة', 'متزوج/ـة'),
    ]
    name = models.CharField(max_length=50, unique=True, choices=MARITAL_CHOICES, verbose_name="الحالة الاجتماعية")
    def __str__(self): return self.name
    class Meta:
        verbose_name = "حالة اجتماعية"
        verbose_name_plural = "الحالات الاجتماعية"


class Nationality(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="الجنسية")
    is_active = models.BooleanField(default=True, verbose_name="مفعل")
    def __str__(self): return self.name
    class Meta:
        verbose_name = "جنسية"
        verbose_name_plural = "الجنسيات"


class PlaceOfBirth(models.Model):
    city = models.CharField(max_length=100, verbose_name="المدينة")
    country = models.CharField(max_length=100, default="ليبيا", verbose_name="الدولة")
    is_active = models.BooleanField(default=True, verbose_name="مفعل")
    def __str__(self): return f"{self.city} - {self.country}"
    class Meta:
        verbose_name = "مكان ميلاد"
        verbose_name_plural = "أماكن الميلاد"


class Address(models.Model):
    street = models.CharField(max_length=200, blank=True, verbose_name="الشارع")
    city = models.CharField(max_length=100, verbose_name="المدينة")
    postal_code = models.CharField(max_length=20, blank=True, verbose_name="الرمز البريدي")
    country = models.CharField(max_length=100, default="ليبيا", verbose_name="الدولة")
    def __str__(self): return f"{self.city}, {self.country}"
    class Meta:
        verbose_name = "عنوان"
        verbose_name_plural = "العناوين"


class StudentType(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="نوع الطالب")
    def __str__(self): return self.name
    class Meta:
        verbose_name = "نوع طالب"
        verbose_name_plural = "أنواع الطلاب"


class StudentStatus(models.Model):
    name = models.CharField(max_length=50, unique=True, verbose_name="حالة الطالب")
    def __str__(self): return self.name
    class Meta:
        verbose_name = "حالة طالب"
        verbose_name_plural = "حالات الطلاب"


class Gender(models.Model):
    GENDER_CHOICES = [
        ('ذكر', 'ذكر'),
        ('أنثى', 'أنثى'),
    ]
    name = models.CharField(max_length=20, unique=True, choices=GENDER_CHOICES, verbose_name="الجنس")
    def __str__(self): return self.name
    class Meta:
        verbose_name = "جنس"
        verbose_name_plural = "الأجناس"


class Qualification(models.Model):
    """جدول المؤهلات العلمية - فقط الاسم"""
    name = models.CharField(max_length=200, unique=True, verbose_name="اسم المؤهل")
    is_active = models.BooleanField(default=True, verbose_name="مفعل")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "مؤهل علمي"
        verbose_name_plural = "المؤهلات العلمية"


class Guardian(models.Model):
    name = models.CharField(max_length=150, verbose_name="اسم ولي الأمر")
    phone = models.CharField(max_length=20, verbose_name="رقم هاتف ولي الأمر")
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "ولي أمر"
        verbose_name_plural = "أولياء الأمور"


from django.core.exceptions import PermissionDenied


class StudentQuerySet(models.QuerySet):
    def delete(self):
        raise PermissionDenied("❌ لا يمكن حذف سجلات الطلاب من النظام لأن الحذف ممنوع أكاديمياً. يرجى تعديل حالة الطالب بدلاً من الحذف.")


class StudentManager(models.Manager):
    def get_queryset(self):
        return StudentQuerySet(self.model, using=self._db)


class Student(models.Model):
    objects = StudentManager()

    def delete(self, *args, **kwargs):
        raise PermissionDenied("❌ لا يمكن حذف سجل الطالب من النظام نهائياً لأن الحذف ممنوع أكاديمياً. يرجى تعديل حالة الطالب بدلاً من الحذف.")

    user = models.OneToOneField('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='student', verbose_name="المستخدم")
    student_id = models.CharField(max_length=50, unique=True, blank=True, verbose_name="رقم القيد")
    name = models.CharField(max_length=100, verbose_name="اسم الطالب")
    father_name = models.CharField(max_length=100, verbose_name="اسم الأب")
    grandfather_name = models.CharField(max_length=100, verbose_name="اسم الجد")
    last_name = models.CharField(max_length=100, verbose_name="اللقب")
    
    # ============================================================
    # 🔥 وثائق الهوية - معدلة لدعم الليبيين وغير الليبيين
    # ============================================================
    national_id = models.CharField(
        max_length=20, 
        unique=True, 
        null=True,      # 🔥 يسمح بالقيمة الفارغة
        blank=True,     # 🔥 يسمح بالقيمة الفارغة في النماذج
        verbose_name="الرقم الوطني"
    )
    passport_number = models.CharField(
        max_length=20, 
        unique=True, 
        null=True,      # 🔥 يسمح بالقيمة الفارغة
        blank=True,     # 🔥 يسمح بالقيمة الفارغة في النماذج
        verbose_name="رقم الجواز"
    )
    
    phone = models.CharField(max_length=20, verbose_name="رقم الهاتف")
    email = models.EmailField(blank=True, verbose_name="البريد الإلكتروني")
    
    birth_date = models.DateField(verbose_name="تاريخ الميلاد")
    birth_place = models.ForeignKey(PlaceOfBirth, on_delete=models.PROTECT, verbose_name="مكان الميلاد")
    GENDER_CHOICES = [
        ('M', 'ذكر'),
        ('F', 'أنثى'),
    ]
    gender = models.CharField(
        max_length=1,
        choices=GENDER_CHOICES,
        default='M',
        verbose_name="الجنس"
    )
    
    BLOOD_TYPE_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ]
    blood_type = models.CharField(max_length=5, choices=BLOOD_TYPE_CHOICES, null=True, blank=True, verbose_name="فصيلة الدم")
    nationality = models.ForeignKey(Nationality, on_delete=models.PROTECT, verbose_name="الجنسية")
    
    current_address = models.ForeignKey(Address, on_delete=models.PROTECT, verbose_name="العنوان الحالي")
    
    enrollment_date = models.DateField(verbose_name="تاريخ الالتحاق")

    enrollment_semester = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="فصل الالتحاق",
        default='ربيع'
    )
    department = models.ForeignKey('renewal.Department', on_delete=models.PROTECT, verbose_name="القسم")
    group = models.ForeignKey('renewal.Group', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="المجموعة")
    study_plan = models.ForeignKey('renewal.StudyPlan', on_delete=models.PROTECT, verbose_name="الخطة الدراسية")
    student_status = models.ForeignKey(StudentStatus, on_delete=models.PROTECT, verbose_name="حالة الطالب")
    
    MARITAL_STATUS_CHOICES = [
        ('أعزب/ـة', 'أعزب/ـة'),
        ('متزوج/ـة', 'متزوج/ـة'),
    ]
    marital_status = models.ForeignKey(MaritalStatus, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الحالة الاجتماعية")
    
    level = models.ForeignKey('renewal.Level', on_delete=models.PROTECT, verbose_name="المستوى الحالي")
    
    qualification = models.ForeignKey(Qualification, on_delete=models.PROTECT, verbose_name="المؤهل العلمي")
    qualification_major = models.CharField(max_length=100, blank=True, verbose_name="تخصص المؤهل")
    qualification_percentage = models.FloatField(null=True, blank=True, verbose_name="نسبة المؤهل")
    qualification_grade = models.CharField(max_length=50, blank=True, verbose_name="تقدير المؤهل")
    qualification_place = models.CharField(max_length=200, blank=True, verbose_name="مكان الحصول على المؤهل")
    qualification_date = models.DateField(null=True, blank=True, verbose_name="تاريخ الحصول على المؤهل")
    
    graduation_year = models.IntegerField(null=True, blank=True, verbose_name="سنة التخرج")
    graduation_semester = models.CharField(max_length=20, null=True, blank=True, verbose_name="فصل التخرج")
    graduation_mark = models.FloatField(null=True, blank=True, verbose_name="علامة التخرج")
    
    photo = models.ImageField(upload_to='student_photos/', null=True, blank=True, verbose_name="الصورة")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    current_semester = models.CharField(
        max_length=50, 
        blank=True, 
        null=True, 
        verbose_name="الفصل الدراسي الحالي"
    )
    qr_key = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        verbose_name="مفتاح QR الفريد"
    )
    qr_code = models.ImageField(
        upload_to='student_qr_codes/',
        blank=True,
        null=True,
        verbose_name="رمز QR"
    )
    qr_code_data = models.TextField(
        blank=True,
        verbose_name="بيانات رمز QR"
    )
    has_changed_major = models.BooleanField(default=False, verbose_name="تم تغيير المسار سابقاً")
    major_change_count = models.IntegerField(default=0, verbose_name="عدد مرات تغيير المسار")
    
    # 🎓 حقول رصد الخريجين والجاهزية لإخلاء الطرف المؤتمتة
    is_ready_for_clearance = models.BooleanField(
        default=False, 
        db_index=True, 
        verbose_name="جاهز لإخلاء الطرف تلقائياً"
    )
    clearance_ready_date = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name="تاريخ اكتمال متطلبات التخرج"
    )
    
    created_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='students_created', verbose_name="تم التسجيل بواسطة")
    updated_by = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='students_updated', null=True, blank=True, verbose_name="آخر تعديل بواسطة")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التسجيل")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")
    
    guardian = models.ForeignKey(Guardian, on_delete=models.PROTECT, verbose_name="ولي الأمر")
    
    def __str__(self):
        return f"{self.student_id} - {self.name} {self.father_name}"
    
    def get_full_name(self):
        return f"{self.name} {self.father_name} {self.grandfather_name} {self.last_name}"
    
    @property
    def full_name(self):
        return self.get_full_name()

    @property
    def gender_display(self):
        return self.get_gender_display()

    @property
    def is_graduated(self):
        """فحص ما إذا كان الطالب متخرجاً"""
        if self.graduation_year is not None:
            return True
        if self.student_status and self.student_status.name in ['متخرج', 'خريج', 'Graduated']:
            return True
        return False

    @classmethod
    def generate_unique_qr_key(cls):
        """توليد كود فريد ومفتاح عشوائي غير مكرر للطالب"""
        import secrets
        while True:
            key = secrets.token_hex(16)
            if not cls.objects.filter(qr_key=key).exists():
                return key
    
    def generate_secure_token(self):
        secret_key = settings.SECRET_KEY.encode('utf-8')
        message = f"{self.student_id}-{self.id}".encode('utf-8')
        return hmac.new(secret_key, message, hashlib.sha256).hexdigest()

    def generate_qr_code(self, request=None, force_regenerate=False):
        """توليد صورة الـ QR وتخزينها - يدعم التحديث الإجباري أو التوليد إذا لم تكن موجودة أو تغير الرابط/الآيبي"""
        from .utils import generate_qr_for_student, get_student_verification_qr_url
        
        # التأكد من وجود المفتاح
        if not self.qr_key:
            self.qr_key = Student.generate_unique_qr_key()

        expected_url = get_student_verification_qr_url(self, request=request)
        current_payload = getattr(self, 'qr_code_data', '') or ''

        # إذا كانت صورة الـ QR موجودة ومطابقة للرابط المتوقع الحالي، ولم يُطلب التحديث الإجباري نتجاوز
        if self.qr_code and not force_regenerate and current_payload == expected_url:
            return False

        content_file, image_name, qr_payload = generate_qr_for_student(self, request=request)
        if content_file and image_name:
            self.qr_code.save(image_name, content_file, save=False)
            self.qr_code_data = qr_payload or ''
            Student.objects.filter(pk=self.pk).update(
                qr_key=self.qr_key,
                qr_code=self.qr_code,
                qr_code_data=self.qr_code_data
            )
            return True
        return False

    
    def get_qr_data(self):
        try:
            if self.qr_code_data:
                return json.loads(self.qr_code_data)
            return None
        except:
            return None
    
    def get_qr_url(self):
        if self.qr_code:
            return self.qr_code.url
        return None
    
    def get_verification_url(self, request=None):
        try:
            from .utils import get_student_verification_qr_url
            return get_student_verification_qr_url(self, request=request)
        except Exception:
            return None


    
    def verify_signature(self, token):
        expected_token = self.generate_secure_token()
        return hmac.compare_digest(token, expected_token)
    
    # ============================================================
    # 🔥 دالة clean() للتحقق من وثائق الهوية حسب الجنسية
    # ============================================================
    def clean(self):
        """
        التحقق من صحة البيانات - خاصة وثائق الهوية
        """
        from django.core.exceptions import ValidationError
        
        # التحقق من الجنسية
        if self.nationality:
            nationality_name = self.nationality.name
            
            # فحص مرن للجنسية الليبية بكل أشكالها
            LIBYAN_KEYWORDS = ['ليبي', 'ليبيا', 'ليبيه', 'الليبيون', 'libyan']
            is_libyan = any(kw in nationality_name.lower() for kw in LIBYAN_KEYWORDS)

            if is_libyan:
                if not self.national_id:
                    raise ValidationError({
                        'national_id': '⚠️ الطالب ليبي الجنسية: الرقم الوطني مطلوب.'
                    })
                # التحقق من صحة الرقم الوطني (12 رقماً بالضبط)
                if self.national_id and len(self.national_id) != 12:
                    raise ValidationError({
                        'national_id': '⚠️ الرقم الوطني يجب أن يتكون من 12 رقماً بالضبط.'
                    })
                # التحقق من أن الرقم الوطني يحتوي على أرقام فقط
                if self.national_id and not self.national_id.isdigit():
                    raise ValidationError({
                        'national_id': '⚠️ الرقم الوطني يجب أن يحتوي على أرقام فقط بدون حروف أو رموز.'
                    })
            
            # إذا كان الطالب غير ليبي
            else:
                if not self.passport_number:
                    raise ValidationError({
                        'passport_number': '⚠️ رقم الجواز مطلوب للطلاب غير الليبيين.'
                    })

        
        # التأكد من عدم وجود تعارض بين الرقم الوطني ورقم الجواز
        if self.national_id and self.passport_number:
            if self.national_id == self.passport_number:
                raise ValidationError({
                    'passport_number': '⚠️ لا يمكن أن يكون الرقم الوطني ورقم الجواز متطابقين.'
                })
        
        # التحقق من عدم تكرار الرقم الوطني (للتأكد من عدم وجود طالب آخر بنفس الرقم)
        if self.national_id:
            existing = Student.objects.filter(national_id=self.national_id).exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError({
                    'national_id': '⚠️ هذا الرقم الوطني مسجل لطالب آخر.'
                })
        
        # التحقق من عدم تكرار رقم الجواز
        if self.passport_number:
            existing = Student.objects.filter(passport_number=self.passport_number).exclude(pk=self.pk)
            if existing.exists():
                raise ValidationError({
                    'passport_number': '⚠️ رقم الجواز هذا مسجل لطالب آخر.'
                })
    
    # ============================================================
    # 🔥 دالة save() المعدلة مع استدعاء clean()
    # ============================================================
    def save(self, *args, **kwargs):
        # التحقق من البيانات قبل الحفظ
        self.clean()
        
        if not self.student_id:
            # 1. اشتقاق سنة التسجيل وفصل التسجيل مباشرة
            year = getattr(self, 'semester_year', None)
            semester_type = getattr(self, 'semester_type', None)
            
            if not year and self.enrollment_semester:
                # محاولة استخراج السنة والفصل من الحقل النصي
                parts = self.enrollment_semester.split()
                if len(parts) >= 2:
                    try:
                        # إزالة أي حروف غير رقمية من السنة
                        year_digits = ''.join(c for c in parts[0] if c.isdigit())
                        if year_digits:
                            year = int(year_digits)
                        semester_type = parts[1]
                    except ValueError:
                        pass
                elif len(parts) == 1:
                    # إذا كان الحقل يحتوي على فصل فقط (مثل "خريف")، سنحاول استخراجه
                    semester_type = parts[0]
            
            if year is None:
                # استخدام تاريخ الالتحاق كاحتياطي ثانٍ
                if self.enrollment_date:
                    year = self.enrollment_date.year
                else:
                    from datetime import datetime
                    year = datetime.now().year
            
            try:
                year = int(year)
            except (TypeError, ValueError):
                from datetime import datetime
                year = datetime.now().year
                
            # تحويل السنة لرقمين (مثال: 2025 -> 25)
            year_code = year % 100
            
            # تحديد كود الفصل (1 لربيع، 2 لخريف)
            if semester_type and ('خريف' in semester_type or 'fall' in semester_type.lower()):
                semester_code = '2'
            else:
                semester_code = '1'
            
            last_student = Student.objects.all().order_by('-id').first()
            last_serial = 1
            if last_student:
                last_serial = last_student.id + 1
                
            self.student_id = f"{year_code}{semester_code}{last_serial:03d}"
        
        if not self.pk:
            if not self.level_id:
                from apps.renewal.models import Level
                first_level = Level.objects.filter(number=1).first()
                if first_level:
                    self.level = first_level
                else:
                    self.level = Level.objects.first()

        # Automated Status Logic:
        status_regular, _ = StudentStatus.objects.get_or_create(name="منتظم")
        if not self.student_status_id or (self.student_status and self.student_status.name in ['جديد', 'NEW', '']):
            self.student_status = status_regular
        elif not self.student_status_id:
            self.student_status = status_regular

        if not self.qr_key:
            self.qr_key = Student.generate_unique_qr_key()

        super().save(*args, **kwargs)

        # توليد الـ QR والتوقيع الإلكتروني تلقائياً عند إنشاء أي طالب جديد أو إذا كان مفقوداً/قديماً
        if not self.qr_code or not self.qr_code_data:
            self.generate_qr_code()
            Student.objects.filter(pk=self.pk).update(
                qr_key=self.qr_key,
                qr_code=self.qr_code,
                qr_code_data=self.qr_code_data
            )

    
    class Meta:
        verbose_name = "طالب"
        verbose_name_plural = "الطلاب"
        ordering = ['student_id']



# ============================================
# باقي النماذج
# ============================================

class StudentEditLog(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, verbose_name="الطالب")
    edited_by = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name="تم التعديل بواسطة")
    edited_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التعديل")
    changes = models.TextField(verbose_name="التغييرات")
    
    def __str__(self):
        return f"تعديل {self.student} بواسطة {self.edited_by}"
    
    class Meta:
        verbose_name = "سجل تعديل طالب"
        verbose_name_plural = "سجلات تعديل الطلاب"





class StudentEditHistory(models.Model):
    """جدول لحفظ تاريخ تعديلات الطلاب (نسخة قبل التعديل)"""
    original_student = models.ForeignKey('Student', on_delete=models.CASCADE, verbose_name="الطالب الأصلي")
    
    student_id = models.CharField(max_length=50, verbose_name="رقم القيد")
    name = models.CharField(max_length=100, verbose_name="اسم الطالب")
    father_name = models.CharField(max_length=100, verbose_name="اسم الأب")
    grandfather_name = models.CharField(max_length=100, verbose_name="اسم الجد")
    last_name = models.CharField(max_length=100, verbose_name="اللقب")
    national_id = models.CharField(max_length=20, verbose_name="الرقم الوطني")
    phone = models.CharField(max_length=20, verbose_name="رقم الهاتف")
    email = models.EmailField(blank=True, verbose_name="البريد الإلكتروني")
    birth_date = models.DateField(verbose_name="تاريخ الميلاد")
    birth_place = models.CharField(max_length=200, verbose_name="مكان الميلاد")
    gender = models.CharField(max_length=20, verbose_name="الجنس")
    blood_type = models.CharField(max_length=10, blank=True, verbose_name="فصيلة الدم")
    nationality = models.CharField(max_length=100, verbose_name="الجنسية")
    current_address = models.CharField(max_length=500, verbose_name="العنوان")
    enrollment_date = models.DateField(verbose_name="تاريخ الالتحاق")
    enrollment_semester = models.CharField(max_length=50, verbose_name="فصل الالتحاق")
    department = models.CharField(max_length=100, verbose_name="القسم")
    group = models.CharField(max_length=50, blank=True, verbose_name="المجموعة")
    study_plan = models.CharField(max_length=50, verbose_name="الخطة الدراسية")
    student_status = models.CharField(max_length=50, verbose_name="حالة الطالب")
    level = models.CharField(max_length=10, blank=True, verbose_name="المستوى")
    graduation_year = models.IntegerField(null=True, blank=True, verbose_name="سنة التخرج")
    graduation_semester = models.CharField(max_length=20, null=True, blank=True, verbose_name="فصل التخرج")
    graduation_mark = models.FloatField(null=True, blank=True, verbose_name="علامة التخرج")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    qualification = models.CharField(max_length=200, blank=True, verbose_name="المؤهل العلمي")
    qualification_major = models.CharField(max_length=100, blank=True, verbose_name="تخصص المؤهل")
    qualification_percentage = models.FloatField(null=True, blank=True, verbose_name="نسبة المؤهل")
    qualification_grade = models.CharField(max_length=50, blank=True, verbose_name="تقدير المؤهل")
    qualification_place = models.CharField(max_length=200, blank=True, verbose_name="مكان الحصول على المؤهل")
    qualification_date = models.DateField(null=True, blank=True, verbose_name="تاريخ الحصول على المؤهل")
    guardian = models.CharField(max_length=200, blank=True, verbose_name="ولي الأمر")
    
    edited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, verbose_name="تم التعديل بواسطة")
    edited_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التعديل")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="عنوان IP")
    changes_summary = models.TextField(blank=True, verbose_name="ملخص التغييرات")
    
    class Meta:
        verbose_name = "تاريخ تعديل طالب"
        verbose_name_plural = "تاريخ تعديلات الطلاب"
        ordering = ['-edited_at']
    
    def __str__(self):
        return f"{self.student_id} - {self.name} (عدل في {self.edited_at})"


# ============================================
# 🔥 السجلات الأكاديمية (أضفها هنا)
# ============================================

class SemesterRecord(models.Model):
    """السجل الفصلي للطالب"""
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    semester = models.ForeignKey('renewal.Semester', on_delete=models.PROTECT, verbose_name="الفصل الدراسي")
    
    registration_number = models.CharField(max_length=20, blank=True, verbose_name="رقم القيد")
    registered_credits = models.FloatField(default=0, verbose_name="الساعات المسجلة في الفصل")
    completed_credits = models.FloatField(default=0, verbose_name="الساعات المنجزة الناجحة في الفصل")
    semester_points = models.FloatField(default=0, verbose_name="مجموع النقاط الفصلية")
    semester_gpa = models.FloatField(default=0, verbose_name="المعدل الفصلي GPA")
    passed_courses = models.IntegerField(default=0, verbose_name="عدد المواد الناجحة")
    failed_courses = models.IntegerField(default=0, verbose_name="عدد المواد الراسبة")
    
    last_updated = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")
    
    class Meta:
        verbose_name = "سجل فصلي"
        verbose_name_plural = "السجلات الفصلية"
        unique_together = ['student', 'semester']
        ordering = ['-semester__year', '-semester__type']
    
    def calculate_semester_record(self):
        from apps.grades.models import Grade, GradeNotification
        from apps.student.models import AcademicRecord, SemesterRecord
        semester_grades = Grade.objects.filter(
            student=self.student,
            semester=self.semester
        )
        
        total_credits = 0
        completed_credits = 0
        total_points = 0
        passed_count = 0
        failed_count = 0
        
        for grade in semester_grades:
            credits = grade.course.credits
            total_credits += credits
            
            if grade.is_passed:
                total_points += grade.total_grade * credits
                completed_credits += credits
                passed_count += 1
            else:
                failed_count += 1
        
        self.registered_credits = total_credits
        self.completed_credits = completed_credits
        self.semester_points = total_points
        self.semester_gpa = total_points / total_credits if total_credits > 0 else 0
        self.passed_courses = passed_count
        self.failed_courses = failed_count
        
        return self.semester_gpa
    
    def save(self, *args, **kwargs):
        if not self.registration_number:
            from datetime import datetime
            year = datetime.now().year
            semester_code = self.semester.type[:1].upper()
            last_record = SemesterRecord.objects.filter(
                semester=self.semester
            ).order_by('-id').first()
            last_serial = 1
            if last_record:
                last_serial = last_record.id + 1
            self.registration_number = f"{year}{semester_code}{last_serial:04d}"
        
        self.calculate_semester_record()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student.name} - {self.semester} - GPA: {self.semester_gpa:.2f}"


class AcademicRecord(models.Model):
    """السجل الأكاديمي التراكمي للطالب"""
    student = models.OneToOneField('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    
    total_registered_credits = models.FloatField(default=0, verbose_name="إجمالي الساعات المسجلة")
    total_completed_credits = models.FloatField(default=0, verbose_name="إجمالي الساعات المنجزة")
    total_points = models.FloatField(default=0, verbose_name="مجموع النقاط التراكمية")
    cumulative_gpa = models.FloatField(default=0, verbose_name="المعدل التراكمي cGPA")
    
    passed_courses_count = models.IntegerField(default=0, verbose_name="إجمالي المواد الناجحة")
    failed_courses_count = models.IntegerField(default=0, verbose_name="إجمالي المواد الراسبة")
    
    last_updated = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")
    
    class Meta:
        verbose_name = "سجل أكاديمي"
        verbose_name_plural = "السجلات الأكاديمية"
    
    def calculate_cumulative_record(self):
        from apps.grades.models import Grade
        all_grades = Grade.objects.filter(student=self.student).select_related('course', 'course__level', 'semester').prefetch_related('course__department')
        
        # تصفية المواد لتقتصر فقط على خطة تخصص الطالب الحالي (تستبعد المواد غير المعادلة في التخصص السابق)
        if self.student and self.student.department:
            all_grades = all_grades.filter(course__department=self.student.department)
        
        # تجميع الفصول للتحقق من اعتماد ونشر نتائج الفصل بالكامل
        sem_groups = {}
        for grade in all_grades:
            if not grade.course or not grade.semester:
                continue
            s_id = grade.semester.id
            if s_id not in sem_groups:
                sem_groups[s_id] = {'grades': [], 'is_approved': True}
            
            is_blk = getattr(grade, 'is_blocked', False)
            is_pub = getattr(grade, 'is_published', False) or getattr(grade, 'is_final_published', False)
            if is_blk or not is_pub or grade.total_grade is None:
                sem_groups[s_id]['is_approved'] = False
            sem_groups[s_id]['grades'].append(grade)
        
        total_credits = 0
        completed_credits = 0
        total_points = 0
        passed_count = 0
        failed_count = 0
        
        for s_id, s_data in sem_groups.items():
            if s_data['is_approved']:
                for grade in s_data['grades']:
                    credits = grade.course.credits or 0
                    total_credits += credits
                    grade_val = grade.total_grade or 0
                    total_points += grade_val * credits
                    
                    if grade.is_passed or grade_val >= 50:
                        completed_credits += credits
                        passed_count += 1
                    else:
                        failed_count += 1
        self.total_registered_credits = total_credits
        self.total_completed_credits = completed_credits
        self.total_points = total_points
        self.cumulative_gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0.00
        self.passed_courses_count = passed_count
        self.failed_courses_count = failed_count
        
        return self.cumulative_gpa
    
    def save(self, *args, **kwargs):
        self.calculate_cumulative_record()
        super().save(*args, **kwargs)
    
    @property
    def gpa(self):
        return getattr(self, 'cumulative_gpa', 0.0) or 0.0

    @property
    def cgpa(self):
        return getattr(self, 'cumulative_gpa', 0.0) or 0.0

    @property
    def student_id(self):
        return self.student.student_id if (hasattr(self, 'stud8ent') and self.student and hasattr(self.student, 'student_id')) else ''

    def __str__(self):
        return f"السجل الأكاديمي لـ {self.student.name} - cGPA: {self.cumulative_gpa:.2f}"


# ============================================
# Signals: ضمان التوليد الآلي لـ QR لأي طالب مستقبلي
# ============================================
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=Student)
def auto_generate_student_qr_on_save(sender, instance, created, **kwargs):
    """
    إشارة تضمن توليد الـ QR والتوقيع الإلكتروني الكامل فوراً لأي طالب جديد
    يتم إنشاؤه عبر لوحة الإدارة (Django Admin) أو النماذج (Forms) أو الـ APIs
    """
    if not instance.qr_code or not instance.qr_code_data or not instance.qr_key:
        if not instance.qr_key:
            instance.qr_key = Student.generate_unique_qr_key()
        instance.generate_qr_code()
        Student.objects.filter(pk=instance.pk).update(
            qr_key=instance.qr_key,
            qr_code=instance.qr_code.name if instance.qr_code else None,
            qr_code_data=instance.qr_code_data
        )


class Notification(models.Model):
    """سجل إشعارات الطالب والمسجل العام وإدارة المنظومة الشامل"""
    NOTIFICATION_TYPES = [
        ('new_student', 'إضافة طالب جديد'),
        ('renewal', 'تجديد القيد'),
        ('registration', 'تنزيل المواد'),
        ('course_assignment', 'تعيين وتكليف مادة لأستاذ'),
        ('grade_recording', 'رصد واعتماد الدرجات'),
        ('grade_approval', 'اعتماد درجات ونتائج'),
        ('midterm_grade', 'رصد درجات النصفي'),
        ('final_grade', 'رصد درجات النهائي'),
        ('department_change', 'تغيير المسار'),
        ('hold', 'إيقاف القيد'),
        ('clearance', 'إخلاء الطرف'),
        ('graduation', 'التخرج'),
        ('failed_three_times', 'إنذار رسوب 3 مرات'),
        ('grade_appeal', 'طعون ومراجعة الدرجات'),
        ('professor_grade_reply', 'رد الأستاذ على كشف الدرجات'),
        ('grade_submission', 'إرسال واستيراد كشف درجات'),
        ('general', 'إشعار عام'),
    ]

    TARGET_ROLES = [
        ('all', 'كافة المستخدمين'),
        ('student', 'الطلاب'),
        ('registrar', 'المسجل العام والإدارة'),
        ('graduates', 'قسم الخريجين'),
        ('graduate_officer', 'موظف قسم الخريجين'),
        ('exam_director', 'مدير الدراسة والامتحانات'),
        ('exams', 'قسم الدراسة والامتحانات'),
        ('admin', 'مدير النظام'),
    ]

    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, related_name='student_notifications', null=True, blank=True, verbose_name="الطالب")
    target_role = models.CharField(max_length=50, choices=TARGET_ROLES, default='all', verbose_name="الفئة المستهدفة")
    title = models.CharField(max_length=255, default="إشعار جديد", verbose_name="العنوان")
    message = models.TextField(verbose_name="نص الإشعار")
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, default='general', verbose_name="نوع الإشعار")
    icon = models.CharField(max_length=50, default='notifications', verbose_name="الأيقونة")
    link = models.CharField(max_length=255, blank=True, null=True, verbose_name="رابط التوجيه")
    is_read = models.BooleanField(default=False, verbose_name="مقروء")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"
        ordering = ['-created_at']

    def __str__(self):
        target = self.student if self.student else f"[{self.get_target_role_display()}]"
        return f"{target} - {self.title}"

    @property
    def student_safe_link(self):
        """إرجاع رابط آمن يوجه الطالب حصراً إلى صفحات بوابة الطالب وتفادي الروابط الإدارية نهائياً"""
        if self.link and self.link.startswith('/student/'):
            return self.link

        n_type = self.notification_type or 'general'
        title = self.title or ''
        msg = self.message or ''
        combined_text = f"{title} {msg}"

        if n_type in ['final_grade', 'midterm_grade', 'grade_appeal', 'grade_recording', 'grade_approval'] or any(w in combined_text for w in ['نتيجة', 'نتائج', 'درجة', 'درجات', 'رصد', 'طعن', 'إعلان']):
            return '/student/term-result/'
        elif n_type in ['registration', 'course_assignment'] or any(w in combined_text for w in ['مواد', 'مادة', 'تنزيل', 'مقرر']):
            return '/student/my-courses/'
        elif n_type in ['graduation'] or any(w in combined_text for w in ['تخرج', 'خريج', 'إفادة']):
            return '/student/my-grades/'
        elif n_type in ['department_change', 'hold', 'clearance'] or any(w in combined_text for w in ['مسار', 'تخصص', 'إيقاف', 'إخلاء', 'سحب', 'ملف']):
            return '/student/my-profile/'
        elif n_type == 'renewal' or 'تجديد' in combined_text:
            return '/student/dashboard/'

        return '/student/dashboard/'

    @classmethod
    def create_notification(cls, student=None, title="إشعار جديد", message="", notification_type='general', icon=None, link=None, target_role=None):
        """إنشاء إشعار تلقائي ذكي للطلاب أو المسجل العام مع منع التكرار اللحظي وضمان أمان الروابط"""
        # تحديد الفئة المستهدفة تلقائياً إذا لم تحدد
        if not target_role:
            target_role = 'student' if student else 'registrar'

        default_icons = {
            'new_student': 'person_add',
            'renewal': 'how_to_reg',
            'registration': 'menu_book',
            'course_assignment': 'assignment_ind',
            'grade_recording': 'edit_note',
            'grade_approval': 'fact_check',
            'midterm_grade': 'edit_note',
            'final_grade': 'workspace_premium',
            'grade_appeal': 'fact_check',
            'department_change': 'alt_route',
            'hold': 'pause_circle',
            'clearance': 'assignment_turned_in',
            'graduation': 'school',
            'failed_three_times': 'warning',
            'professor_grade_reply': 'mark_email_read',
            'grade_submission': 'assignment_turned_in',
            'general': 'notifications',
        }
        chosen_icon = icon or default_icons.get(notification_type, 'notifications')

        # 🔒 حماية وتصحيح روابط الطلاب: منع توجيه أي إشعار موجه للطالب إلى مسار إداري
        final_link = link
        if target_role == 'student':
            if not final_link or not final_link.startswith('/student/'):
                combined_text = f"{title} {message}"
                if notification_type in ['final_grade', 'midterm_grade', 'grade_appeal', 'grade_recording', 'grade_approval'] or any(w in combined_text for w in ['نتيجة', 'نتائج', 'درجة', 'درجات', 'رصد', 'طعن', 'إعلان']):
                    final_link = '/student/term-result/'
                elif notification_type in ['registration', 'course_assignment'] or any(w in combined_text for w in ['مواد', 'مادة', 'تنزيل', 'مقرر']):
                    final_link = '/student/my-courses/'
                elif notification_type in ['graduation'] or any(w in combined_text for w in ['تخرج', 'خريج', 'إفادة']):
                    final_link = '/student/my-grades/'
                elif notification_type in ['department_change', 'hold', 'clearance'] or any(w in combined_text for w in ['مسار', 'تخصص', 'إيقاف', 'إخلاء', 'سحب', 'ملف']):
                    final_link = '/student/my-profile/'
                elif notification_type == 'renewal' or 'تجديد' in combined_text:
                    final_link = '/student/dashboard/'
                else:
                    final_link = '/student/dashboard/'
        
        # منع التكرار اللحظي لنفس الإشعار خلال 10 دقائق
        from django.utils import timezone
        from datetime import timedelta
        recent_threshold = timezone.now() - timedelta(minutes=10)
        
        query = cls.objects.filter(
            title=title,
            notification_type=notification_type,
            created_at__gte=recent_threshold
        )
        if student:
            query = query.filter(student=student)
        else:
            query = query.filter(target_role=target_role)

        if not query.exists():
            return cls.objects.create(
                student=student,
                target_role=target_role,
                title=title,
                message=message,
                notification_type=notification_type,
                icon=chosen_icon,
                link=final_link,
                is_read=False
            )
        return None

