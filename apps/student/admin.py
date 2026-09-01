# apps/student/admin.py
from django.contrib import admin
from .models import (
    PlaceOfBirth, Gender, Nationality, Address,
    StudentType, StudentStatus, MaritalStatus, Qualification, Guardian,
    Student, StudentEditHistory, StudentEditLog,
    AcademicRecord, SemesterRecord  # 🔥 الموديلات الجديدة
)


# ============================================
# تسجيل الموديلات العادية
# ============================================

admin.site.register(PlaceOfBirth)
admin.site.register(Gender)
admin.site.register(Nationality)
admin.site.register(Address)
admin.site.register(StudentType)
admin.site.register(StudentStatus)
admin.site.register(MaritalStatus)
admin.site.register(Qualification)
admin.site.register(Guardian)
admin.site.register(StudentEditLog)
admin.site.register(StudentEditHistory)


# ============================================
# 🔥 AcademicRecord (السجل الأكاديمي التراكمي)
# ============================================

@admin.register(AcademicRecord)
class AcademicRecordAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'cumulative_gpa',
        'total_registered_credits',
        'total_completed_credits',
        'passed_courses_count',
        'failed_courses_count',
        'last_updated'
    )
    list_filter = ('last_updated',)
    search_fields = ('student__name', 'student__student_id')
    readonly_fields = ('last_updated',)
    
    fieldsets = (
        ('الطالب', {
            'fields': ('student',)
        }),
        ('الإحصائيات التراكمية', {
            'fields': (
                'total_registered_credits',
                'total_completed_credits',
                'total_points',
                'cumulative_gpa',
                'passed_courses_count',
                'failed_courses_count'
            )
        }),
        ('معلومات إضافية', {
            'fields': ('last_updated',)
        }),
    )


# ============================================
# 🔥 SemesterRecord (السجل الفصلي)
# ============================================

@admin.register(SemesterRecord)
class SemesterRecordAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'semester',
        'semester_gpa',
        'registered_credits',
        'completed_credits',
        'passed_courses',
        'failed_courses'
    )
    list_filter = ('semester',)
    search_fields = ('student__name', 'student__student_id', 'registration_number')
    
    fieldsets = (
        ('الطالب والفصل', {
            'fields': ('student', 'semester', 'registration_number')
        }),
        ('الإحصائيات الفصلية', {
            'fields': (
                'registered_credits',
                'completed_credits',
                'semester_points',
                'semester_gpa',
                'passed_courses',
                'failed_courses'
            )
        }),
        ('معلومات إضافية', {
            'fields': ('last_updated',)
        }),
    )


# ============================================
# 🔥 Student (مع إضافة عمود المعدل التراكمي)
# ============================================

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        'student_id',
        'name',
        'father_name',
        'department',
        'level',
        'show_cgpa',
        'show_passed',
        'student_status'
    )
    list_filter = ('department', 'level', 'student_status')
    def has_delete_permission(self, request, obj=None):
        return False

    def get_actions(self, request):
        actions = super().get_actions(request)
        if 'delete_selected' in actions:
            del actions['delete_selected']
        return actions

    fieldsets = (
        ('معلومات الطالب', {
            'fields': (
                'student_id',
                'name',
                'father_name',
                'grandfather_name',
                'last_name',
                'user'
            )
        }),
        ('معلومات الاتصال', {
            'fields': ('national_id', 'phone', 'email')
        }),
        ('معلومات الميلاد', {
            'fields': ('birth_date', 'birth_place', 'gender', 'blood_type', 'nationality')
        }),
        ('العنوان', {
            'fields': ('current_address',)
        }),
        ('المعلومات الدراسية', {
            'fields': (
                'enrollment_date',
                'enrollment_semester',
                'department',
                'group',
                'level',
                'study_plan',
                'student_status',
                'marital_status'
            )
        }),
        ('المؤهل العلمي', {
            'fields': (
                'qualification',
                'qualification_major',
                'qualification_percentage',
                'qualification_grade',
                'qualification_place',
                'qualification_date'
            )
        }),
        ('معلومات التخرج', {
            'fields': ('graduation_year', 'graduation_semester', 'graduation_mark')
        }),
        ('ولي الأمر', {
            'fields': ('guardian',)
        }),
        ('صور وملاحظات', {
            'fields': ('photo', 'notes')
        }),
        ('معلومات النظام', {
            'fields': ('created_by', 'updated_by', 'created_at', 'updated_at')
        }),
    )
    
    def show_cgpa(self, obj):
        """عرض المعدل التراكمي"""
        try:
            record = AcademicRecord.objects.get(student=obj)
            color = 'green' if record.cumulative_gpa >= 2.0 else 'red'
            return f'<span style="color:{color};font-weight:bold;">{record.cumulative_gpa:.2f}</span>'
        except AcademicRecord.DoesNotExist:
            return '-'
    show_cgpa.short_description = 'المعدل التراكمي'
    show_cgpa.allow_tags = True
    
    def show_passed(self, obj):
        """عرض عدد المواد الناجحة"""
        try:
            record = AcademicRecord.objects.get(student=obj)
            return record.passed_courses_count
        except AcademicRecord.DoesNotExist:
            return 0
    show_passed.short_description = 'مواد ناجحة'