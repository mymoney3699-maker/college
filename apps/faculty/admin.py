# apps/faculty/admin.py
from django.contrib import admin
from .models import Professor, CourseAssignment, DepartmentStaff


@admin.register(Professor)
class ProfessorAdmin(admin.ModelAdmin):
    list_display = ('professor_id', 'full_name', 'email', 'department', 'specialization', 'is_active')
    list_filter = ('is_active', 'department', 'specialization')
    search_fields = ('professor_id', 'full_name', 'email')
    readonly_fields = ('professor_id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('معلومات الأستاذ', {
            'fields': ('professor_id', 'full_name', 'email', 'phone')
        }),
        ('المعلومات الأكاديمية', {
            'fields': ('specialization', 'department')
        }),
        ('معلومات إضافية', {
            'fields': ('is_active', 'hire_date')
        }),
        ('معلومات النظام', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'professor',
        'course',
        'department',
        'level',
        'student_group',
        'semester',
        'is_active'
    )
    list_filter = ('is_active', 'department', 'level', 'semester')
    search_fields = ('professor__full_name', 'course__name', 'course__code')


@admin.register(DepartmentStaff)
class DepartmentStaffAdmin(admin.ModelAdmin):
    list_display = ('staff_id', 'full_name', 'role', 'department', 'email', 'is_active')
    list_filter = ('is_active', 'department')
    search_fields = ('staff_id', 'full_name', 'role', 'email')