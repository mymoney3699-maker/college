# apps/renewal/admin.py
from django.contrib import admin
from django.contrib import messages
from .models import (
    Department, Group, StudyPlan, Level, Semester, 
    Course, EnrollmentRenewal, CourseRegistration
)
from apps.student.models import Student
from apps.users.utils import log_create, log_update, log_delete


class BaseAdminWithLogging(admin.ModelAdmin):
    """Base class for all admin models with automatic logging"""
    
    def save_model(self, request, obj, form, change):
        try:
            if change:
                # تعديل
                old_obj = self.model.objects.get(pk=obj.pk)
                old_data = {}
                new_data = {}
                
                for field in obj._meta.fields:
                    field_name = field.name
                    try:
                        old_val = getattr(old_obj, field_name)
                        new_val = getattr(obj, field_name)
                        
                        if old_val != new_val:
                            old_data[field_name] = str(old_val) if old_val else ''
                            new_data[field_name] = str(new_val) if new_val else ''
                    except:
                        pass
                
                if old_data:
                    log_update(request.user, obj, old_data, new_data, request)
            else:
                # إضافة جديدة
                pass
            
            super().save_model(request, obj, form, change)
            
            if not change:
                log_create(request.user, obj, request)
                
        except Exception as e:
            super().save_model(request, obj, form, change)
    
    def delete_model(self, request, obj):
        try:
            log_delete(request.user, obj, request)
        except:
            pass
        super().delete_model(request, obj)


# تسجيل جميع النماذج
admin.site.register(Department, BaseAdminWithLogging)
admin.site.register(Group, BaseAdminWithLogging)
admin.site.register(StudyPlan, BaseAdminWithLogging)

@admin.register(Level)
class LevelAdmin(BaseAdminWithLogging):
    list_display = ('number', 'name')
    list_filter = ('number',)
    
    def save_model(self, request, obj, form, change):
        # منع إضافة مستويات أكثر من 8
        if not change and obj.number > 8:
            messages.error(request, '❌ لا يمكن إضافة مستويات أكثر من 8')
            return
        super().save_model(request, obj, form, change)


@admin.register(Semester)
class SemesterAdmin(BaseAdminWithLogging):
    list_display = ('year', 'type', 'is_active')
    list_filter = ('is_active', 'type')


@admin.register(Course)
class CourseAdmin(BaseAdminWithLogging):
    list_display = ('code', 'name', 'get_departments', 'level', 'credits')
    search_fields = ('code', 'name')
    list_filter = ('department', 'level', 'is_active')
    filter_horizontal = ('department', 'prerequisites')

    def get_departments(self, obj):
        return " ، ".join([d.name for d in obj.department.all()]) or "-"
    get_departments.short_description = "الأقسام"


@admin.register(EnrollmentRenewal)
class EnrollmentRenewalAdmin(BaseAdminWithLogging):
    list_display = ('student', 'semester', 'level', 'status', 'renewal_date')
    list_filter = ('status', 'semester', 'level')
    search_fields = ('student__name', 'student__student_id')
    raw_id_fields = ('student',)
    
    actions = ['bulk_download_materials']
    
    def bulk_download_materials(self, request, queryset):
        from django.shortcuts import HttpResponseRedirect
        from django.urls import reverse
        return HttpResponseRedirect(reverse('admin:enrollmentrenewal_bulk_download'))
    bulk_download_materials.short_description = "تنزيل مواد لطلاب مستوى محدد"
    
    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('bulk-download/', self.admin_site.admin_view(self.bulk_download_view), name='enrollmentrenewal_bulk_download'),
        ]
        return custom_urls + urls
    
    def bulk_download_view(self, request):
        from django.shortcuts import render, redirect
        from .models import Level, Semester, Course, CourseRegistration
        
        if request.method == 'POST':
            level_id = request.POST.get('level')
            semester_id = request.POST.get('semester')
            
            if not level_id or not semester_id:
                messages.error(request, '❌ الرجاء اختيار المستوى والفصل الدراسي')
                return redirect('admin:renewal_enrollmentrenewal_changelist')
            
            level = Level.objects.get(id=level_id)
            semester = Semester.objects.get(id=semester_id)
            
            enrollments = EnrollmentRenewal.objects.filter(
                level=level,
                semester=semester,
                status='active'
            ).select_related('student')
            
            if not enrollments.exists():
                messages.warning(request, f'⚠️ لا يوجد طلاب مجدد قيدهم في المستوى {level} لهذا الفصل')
                return redirect('admin:renewal_enrollmentrenewal_changelist')
            
            courses = Course.objects.filter(level=level, is_active=True)
            
            if not courses.exists():
                messages.warning(request, f'⚠️ لا توجد مواد مسجلة للمستوى {level}')
                return redirect('admin:renewal_enrollmentrenewal_changelist')
            
            total = 0
            for enrollment in enrollments:
                student = enrollment.student
                for course in courses:
                    can_register, _ = course.check_prerequisites(student)
                    if can_register:
                        obj, created = CourseRegistration.objects.get_or_create(
                            student=student,
                            course=course,
                            semester=semester,
                            defaults={'registered_by': request.user}
                        )
                        if created:
                            total += 1
            
            messages.success(request, f'✅ تم تنزيل {total} مادة لطلاب المستوى {level}')
            return redirect('admin:renewal_enrollmentrenewal_changelist')
        
        levels = Level.objects.all()
        semesters = Semester.objects.filter(is_active=True)
        context = {
            'levels': levels,
            'semesters': semesters,
            'opts': self.model._meta,
            'title': 'تنزيل المواد حسب المستوى',
        }
        return render(request, 'admin/renewal/enrollmentrenewal/bulk_download.html', context)


@admin.register(CourseRegistration)
class CourseRegistrationAdmin(BaseAdminWithLogging):
    list_display = ('student', 'course', 'semester', 'attempt_number', 'registration_date')
    list_filter = ('semester',)
    search_fields = ('student__name', 'student__student_id', 'course__name', 'course__code')
    raw_id_fields = ('student',) 


from .models import GraduationClearance, StudentWithdrawal

@admin.register(GraduationClearance)
class GraduationClearanceAdmin(BaseAdminWithLogging):
    list_display = ('student', 'clearance_date', 'semester', 'graduation_project_grade', 'processed_by')
    list_filter = ('semester', 'clearance_date')
    search_fields = ('student__name', 'student__student_id')
    readonly_fields = ('student', 'clearance_date', 'semester', 'graduation_project_grade', 'processed_by', 'created_at')


@admin.register(StudentWithdrawal)
class StudentWithdrawalAdmin(BaseAdminWithLogging):
    list_display = ('student', 'withdrawal_date', 'academic_term', 'reason', 'processed_by')
    list_filter = ('academic_term', 'withdrawal_date')
    search_fields = ('student__name', 'student__student_id', 'reason', 'notes')
    raw_id_fields = ('student',)


from django.contrib import admin
from .models import Job, SystemJob # قم بإضافة النماذج التي تريد إدارتها

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('title', 'posted_date', 'is_active') # الحقول التي ستظهر كأعمدة في القائمة
    list_filter = ('is_active', 'posted_date')           # فلاتر جانبية لتصفية البيانات بسرعة
    search_fields = ('title', 'description')             # شريط بحث للبحث في العنوان أو الوصف
    list_editable = ('is_active',)                       # إمكانية تعديل حالة التفعيل مباشرة من الجدول
    ordering = ('-posted_date',)                         # الترتيب الافتراضي (من الأحدث للأقدم)


@admin.register(SystemJob)
class SystemJobAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'start_date', 'duration_days', 'is_active')
    list_filter = ('is_active', 'start_date')
    search_fields = ('name', 'code')
    list_editable = ('is_active',)