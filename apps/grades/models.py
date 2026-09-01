# apps/grades/models.py
from django.db import models
from django.core.exceptions import ValidationError


class GradeConfiguration(models.Model):
    """إعدادات نظام الدرجات"""
    min_final_to_combine = models.FloatField(default=30, verbose_name="الحد الأدنى للنهائي (من 60)")
    passing_score = models.FloatField(default=50, verbose_name="درجة النجاح (من 100)")
    final_weight = models.FloatField(default=60, verbose_name="وزن الامتحان النهائي")
    midterm_weight = models.FloatField(default=40, verbose_name="وزن الامتحان النصفي")
    practical_weight = models.FloatField(default=0, verbose_name="وزن الأعمال العملية")
    is_active = models.BooleanField(default=True, verbose_name="الإعدادات فعالة")
    
    class Meta:
        verbose_name = "إعدادات الدرجات"
        verbose_name_plural = "إعدادات الدرجات"
    
    def __str__(self):
        return f"النجاح: {self.passing_score} - الحد الأدنى للنهائي: {self.min_final_to_combine}"
    
    def save(self, *args, **kwargs):
        if not self.pk and GradeConfiguration.objects.filter(is_active=True).exists():
            if self.is_active:
                GradeConfiguration.objects.filter(is_active=True).update(is_active=False)
        super().save(*args, **kwargs)


class Grade(models.Model):
    """جدول الدرجات الرئيسي"""
    # العلاقات الأساسية
    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    course = models.ForeignKey('renewal.Course', on_delete=models.PROTECT, verbose_name="المادة")
    semester = models.ForeignKey('renewal.Semester', on_delete=models.PROTECT, verbose_name="الفصل الدراسي")
    attempt_number = models.IntegerField(default=1, verbose_name="عدد المحاولات")
    
    # العلاقات الجديدة للتصفية الديناميكية
    professor = models.ForeignKey(
        'faculty.Professor', 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True, 
        verbose_name="الأستاذ"
    )
    student_group = models.ForeignKey(
        'renewal.Group', 
        on_delete=models.PROTECT, 
        null=True, 
        blank=True, 
        verbose_name="المجموعة"
    )
    
    # الدرجات المنفصلة
    final_grade = models.FloatField(default=0, verbose_name="درجة الامتحان النهائي (60)")
    midterm_grade = models.FloatField(default=0, verbose_name="درجة الامتحان النصفي (40)")
    practical_grade = models.FloatField(default=0, verbose_name="درجة الأعمال العملية")
    
    # الدرجة المحسوبة
    total_grade = models.FloatField(default=0, verbose_name="الدرجة النهائية المحسوبة")
    is_passed = models.BooleanField(default=False, verbose_name="ناجح/راسب")
    
    # حالة القفل والإدخال والحجب والنشر
    is_final_entered = models.BooleanField(default=False, verbose_name="تم إدخال النهائي")
    is_midterm_locked = models.BooleanField(default=False, verbose_name="درجة النصفي مقفلة")
    is_final_locked = models.BooleanField(default=False, verbose_name="درجة النهائي مقفلة")
    is_blocked = models.BooleanField(default=False, verbose_name="حجب النتيجة")
    block_reason = models.CharField(max_length=255, blank=True, null=True, default="تجاوز نسبة الغياب الورقي", verbose_name="سبب الحجب")
    is_published = models.BooleanField(default=False, verbose_name="منشورة للطالب")
    is_midterm_published = models.BooleanField(default=False, verbose_name="تم نشر نتيجة النصفي")
    is_final_published = models.BooleanField(default=False, verbose_name="تم نشر نتيجة النهائي")
    
    # معلومات إضافية
    registered_by = models.ForeignKey('users.User', on_delete=models.PROTECT, null=True, blank=True, verbose_name="تم التسجيل بواسطة")
    registered_at = models.DateTimeField(auto_now_add=True, null=True, blank=True, verbose_name="تاريخ التسجيل")
    updated_by = models.ForeignKey('users.User', on_delete=models.PROTECT, null=True, blank=True, related_name='grades_updated', verbose_name="آخر تحديث بواسطة")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    
    class Meta:
        unique_together = ['student', 'course', 'semester']
        verbose_name = "درجة"
        verbose_name_plural = "الدرجات"
        ordering = ['-semester__year', '-semester__type', 'course__code']
    
    def get_config(self):
        """جلب إعدادات الدرجات النشطة"""
        config = GradeConfiguration.objects.filter(is_active=True).first()
        if not config:
            config = GradeConfiguration.objects.create(
                min_final_to_combine=30,
                passing_score=50,
                final_weight=60,
                midterm_weight=40,
                practical_weight=0,
                is_active=True
            )
        return config
    
    def calculate_total_grade(self):
        """حساب الدرجة الكلية"""
        # إذا تم إدخال درجة النهائي فعلياً أو كانت مقفلة، نُفعل حقل is_final_entered
        if self.final_grade > 0 or self.is_final_locked:
            self.is_final_entered = True

        # يمنع حساب المجموع أو تحديد حالة النجاح/الرسوب إطلاقاً إذا لم تُدخل درجة النهائي
        if not self.is_final_entered or self.final_grade <= 0:
            self.total_grade = 0.0
            self.is_passed = False
            return self.total_grade

        config = self.get_config()
        
        if self.final_grade >= config.min_final_to_combine:
            self.total_grade = self.final_grade + self.midterm_grade + self.practical_grade
        else:
            self.total_grade = self.final_grade
        
        self.is_passed = self.total_grade >= config.passing_score
        return self.total_grade
    
    def clean(self):
        if self.final_grade < 0 or self.final_grade > 60:
            raise ValidationError({'final_grade': 'درجة النهائي يجب أن تكون بين 0 و 60'})
        
        if self.midterm_grade < 0 or self.midterm_grade > 40:
            raise ValidationError({'midterm_grade': 'درجة النصفي يجب أن تكون بين 0 و 40'})
        
        if Grade.objects.filter(
            student=self.student,
            course=self.course,
            semester=self.semester
        ).exclude(pk=self.pk).exists():
            raise ValidationError("يوجد بالفعل درجة مسجلة لهذا الطالب في هذه المادة لهذا الفصل")
    
    def get_grade_letter(self):
        """إرجاع التقدير الأبجدي للدرجة"""
        if self.is_blocked:
            return '⚠️ محجوب'
        if not self.is_final_entered or self.final_grade <= 0:
            return '⏳ رصد نصفي'
        total = self.total_grade or 0
        if total >= 90:
            return 'A+'
        elif total >= 85:
            return 'A'
        elif total >= 80:
            return 'A-'
        elif total >= 75:
            return 'B+'
        elif total >= 70:
            return 'B'
        elif total >= 65:
            return 'B-'
        elif total >= 60:
            return 'C+'
        elif total >= 55:
            return 'C'
        elif total >= 50:
            return 'C-'
        elif total >= 45:
            return 'D+'
        elif total >= 40:
            return 'D'
        else:
            return 'F'

    @staticmethod
    def format_repetition_text(count):
        """
        إرجاع النص العربي الدقيق لحالة تكرار الرسوب:
        - 1: أول مرة
        - 2: معاود مرتين
        - 3 - 10: معاود X مرات
        - 11+: معاود X مرة
        """
        c = int(count or 1)
        if c <= 1:
            return 'أول مرة'
        elif c == 2:
            return 'معاود مرتين'
        elif 3 <= c <= 10:
            return f'معاود {c} مرات'
        else:
            return f'معاود {c} مرة'

    def get_failure_count(self):
        """
        حساب عدد مرات رسوب الطالب في هذه المادة تاريخياً عبر كافة الفصول المسجلة
        """
        if not self.student_id or not self.course_id:
            return max(self.attempt_number or 1, 1)

        fail_count = Grade.objects.filter(
            student_id=self.student_id,
            course_id=self.course_id,
            is_passed=False
        ).count()
        return max(fail_count, self.attempt_number or 1, 1)

    @property
    def repetition_status(self):
        """حالة تكرار الرسوب نصياً بناءً على عدد مرات الرسوب الفعلي"""
        return self.format_repetition_text(self.get_failure_count())

    def save(self, *args, **kwargs):
        skip_clean = kwargs.pop('skip_clean', False)
        self.calculate_total_grade()
        if not self.pk or self.attempt_number == 1:
            from apps.renewal.models import CourseRegistration
            reg = CourseRegistration.objects.filter(
                student=self.student,
                course=self.course,
                semester=self.semester
            ).first()
            if reg and reg.attempt_number:
                self.attempt_number = reg.attempt_number
            else:
                prev_grades_count = Grade.objects.filter(
                    student=self.student,
                    course=self.course
                ).exclude(pk=self.pk).count()
                prev_reg_count = CourseRegistration.objects.filter(
                    student=self.student,
                    course=self.course
                ).count()
                self.attempt_number = max(1, prev_grades_count + 1, prev_reg_count)
        if not skip_clean:
            self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        status = "ناجح" if self.is_passed else "راسب"
        return f"{self.student.name} - {self.course.name} - {self.total_grade} ({status})"



class GradeHistory(models.Model):
    """سجل تعديلات الدرجات"""
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, verbose_name="الدرجة")
    old_final_grade = models.FloatField(verbose_name="النهائي القديم")
    old_midterm_grade = models.FloatField(verbose_name="النصفي القديم")
    old_practical_grade = models.FloatField(verbose_name="الأعمال القديم")
    new_final_grade = models.FloatField(verbose_name="النهائي الجديد")
    new_midterm_grade = models.FloatField(verbose_name="النصفي الجديد")
    new_practical_grade = models.FloatField(verbose_name="الأعمال الجديد")
    changed_by = models.ForeignKey('users.User', on_delete=models.PROTECT, verbose_name="تم التعديل بواسطة")
    changed_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ التعديل")
    reason = models.TextField(blank=True, verbose_name="سبب التعديل")
    
    class Meta:
        verbose_name = "تاريخ تعديل درجة"
        verbose_name_plural = "تاريخ تعديل الدرجات"
        ordering = ['-changed_at']
    
    def __str__(self):
        return f"تعديل درجة {self.grade} في {self.changed_at}"


class GradeNotification(models.Model):
    """إشعارات رصد الدرجات"""
    title = models.CharField(max_length=255, verbose_name="العنوان")
    message = models.TextField(verbose_name="الرسالة")
    professor = models.ForeignKey('faculty.Professor', on_delete=models.PROTECT, verbose_name="الأستاذ")
    course = models.ForeignKey('renewal.Course', on_delete=models.PROTECT, verbose_name="المادة")
    semester = models.ForeignKey('renewal.Semester', on_delete=models.PROTECT, verbose_name="الفصل الدراسي")
    period = models.CharField(max_length=50, verbose_name="فترة الرصد")
    is_read = models.BooleanField(default=False, verbose_name="مقروء")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")

    class Meta:
        verbose_name = "إشعار درجات"
        verbose_name_plural = "إشعارات الدرجات"
        ordering = ['-created_at']

    @property
    def content(self):
        return getattr(self, 'message', '') or ''

    def __str__(self):
        return f"{self.title} - {self.professor.full_name if self.professor else ''}"



class GradeAppeal(models.Model):
    """إدارة طعون النتائج وتعديل الدرجات"""
    STATUS_CHOICES = [
        ('pending', 'قيد الانتظار'),
        ('under_review', 'جاري المراجعة والتعديل'),
        ('completed', 'تم تعديل ورصد'),
        ('rejected', 'مرفوض'),
    ]

    APPEAL_TYPE_CHOICES = [
        ('midterm', 'امتحان نصفي'),
        ('final', 'امتحان نهائي'),
        ('total', 'إجمالي الدرجة'),
    ]

    student = models.ForeignKey('student.Student', on_delete=models.CASCADE, verbose_name="الطالب")
    course = models.ForeignKey('renewal.Course', on_delete=models.CASCADE, verbose_name="المادة")
    semester = models.ForeignKey('renewal.Semester', on_delete=models.CASCADE, verbose_name="الفصل الدراسي")
    grade = models.ForeignKey(Grade, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="سجل الدرجة")
    
    appeal_type = models.CharField(max_length=20, choices=APPEAL_TYPE_CHOICES, default='midterm', verbose_name="نوع الطعن")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="حالة الطعن")
    
    old_midterm_grade = models.FloatField(null=True, blank=True, verbose_name="درجة النصفي السابقة")
    new_midterm_grade = models.FloatField(null=True, blank=True, verbose_name="درجة النصفي الجديدة")
    
    old_final_grade = models.FloatField(null=True, blank=True, verbose_name="درجة النهائي السابقة")
    new_final_grade = models.FloatField(null=True, blank=True, verbose_name="درجة النهائي الجديدة")
    
    notes = models.TextField(blank=True, null=True, verbose_name="سبب / ملاحظات الطعن")
    reviewed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="تمت المراجعة بواسطة")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ تقديم الطعن")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاريخ آخر تحديث")

    class Meta:
        verbose_name = "طعن نتيجة"
        verbose_name_plural = "طعونات النتائج"
        ordering = ['-created_at']

    def get_status_badge_info(self):
        """إرجاع بيانات الشارة البصرية والنص العربي لحالة الطعن في بوابة الطالب والكنترول"""
        status_map = {
            'pending': {
                'text': '📝 قيد الانتظار والمراجعة',
                'badge_class': 'badge-pending',
                'bg_color': '#fef3c7',
                'text_color': '#b45309',
                'border_color': '#fcd34d',
                'icon': 'hourglass_empty',
            },
            'under_review': {
                'text': '⏳ تم القبول وجاري المراجعة والتعديل',
                'badge_class': 'badge-under-review',
                'bg_color': '#e0f2fe',
                'text_color': '#0369a1',
                'border_color': '#7dd3fc',
                'icon': 'published_with_changes',
            },
            'completed': {
                'text': '✅ تم قبول الطعن وتعديل الدرجة',
                'badge_class': 'badge-completed',
                'bg_color': '#dcfce7',
                'text_color': '#15803d',
                'border_color': '#86efac',
                'icon': 'check_circle',
            },
            'rejected': {
                'text': '❌ تم رفض الطعن',
                'badge_class': 'badge-rejected',
                'bg_color': '#fee2e2',
                'text_color': '#b91c1c',
                'border_color': '#fca5a5',
                'icon': 'cancel',
            },
        }
        return status_map.get(self.status, {
            'text': self.get_status_display() or self.status,
            'badge_class': 'badge-default',
            'bg_color': '#f1f5f9',
            'text_color': '#475569',
            'border_color': '#cbd5e1',
            'icon': 'info',
        })

    def __str__(self):
        return f"طعن {self.student.name} - {self.course.name} ({self.get_status_display()})"