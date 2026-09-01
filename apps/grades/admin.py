# apps/grades/admin.py
from django.contrib import admin
from .models import Grade, GradeConfiguration, GradeHistory, GradeNotification


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'course',
        'semester',
        'total_grade',
        'is_passed',
        'professor',
        'student_group'
    )
    list_filter = ('is_passed', 'semester', 'professor', 'student_group')
    search_fields = ('student__name', 'student__student_id', 'course__name', 'course__code')
    readonly_fields = ('total_grade', 'is_passed', 'registered_at', 'updated_at')  # 🔥 أضف registered_at هنا
    
    fieldsets = (
        ('الطالب والمادة', {
            'fields': ('student', 'course', 'semester', 'attempt_number')
        }),
        ('الأستاذ والمجموعة', {
            'fields': ('professor', 'student_group')
        }),
        ('الدرجات', {
            'fields': ('final_grade', 'midterm_grade', 'practical_grade', 'total_grade', 'is_passed')
        }),
        ('حالة القفل', {
            'fields': ('is_final_entered', 'is_midterm_locked', 'is_final_locked')
        }),
        ('معلومات النظام', {
            'fields': ('registered_by', 'updated_by', 'notes', 'registered_at', 'updated_at')  # 🔥 registered_at هنا
        }),
    )


@admin.register(GradeConfiguration)
class GradeConfigurationAdmin(admin.ModelAdmin):
    list_display = ('passing_score', 'min_final_to_combine', 'is_active')
    list_filter = ('is_active',)


@admin.register(GradeHistory)
class GradeHistoryAdmin(admin.ModelAdmin):
    list_display = ('grade', 'changed_by', 'changed_at')
    list_filter = ('changed_at',)
    search_fields = ('grade__student__name',)


@admin.register(GradeNotification)
class GradeNotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'professor', 'course', 'semester', 'is_read', 'created_at')
    list_filter = ('is_read', 'semester')
    search_fields = ('title', 'professor__full_name', 'course__name')