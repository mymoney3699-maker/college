# apps/users/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, AuditLog, ActivityLog, Official

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        ('معلومات إضافية', {'fields': ('role', 'phone', 'department')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('معلومات إضافية', {'fields': ('role', 'phone', 'department')}),
    )
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone')
    list_per_page = 25


@admin.register(Official)
class OfficialAdmin(admin.ModelAdmin):
    """تسجيل موديل المسؤولين المعتمدين في لوحة التحكم"""
    
    # الحقول المعروضة في قائمة العناصر
    list_display = (
        'official_name', 
        'position_name', 
        'get_position_key_display', 
        'is_active',
        'start_date',
        'created_at'
    )
    
    # الفلاتر الجانبية
    list_filter = (
        'is_active',
        'position_key',
        'created_at',
        'start_date',
    )
    
    # حقول البحث
    search_fields = (
        'official_name',
        'position_name',
        'notes',
        'title',
    )
    
    # ترتيب العناصر في القائمة
    ordering = ('-is_active', 'position_name', 'official_name')
    
    # عدد العناصر في الصفحة
    list_per_page = 20
    
    # إظهار حقول التاريخ والوقت مع تنسيق مناسب
    date_hierarchy = 'created_at'
    
    # الحقول التي يمكن تعديلها مباشرة من القائمة
    list_editable = ('is_active',)
    
    # تخصيص عرض الحقول
    fieldsets = (
        ('معلومات المنصب', {
            'fields': (
                'position_key',
                'position_name',
                'title',
                'official_name',
            )
        }),
        ('حالة المسؤول', {
            'fields': (
                'is_active',
                'start_date',
                'notes',
            )
        }),
        ('معلومات النظام', {
            'fields': (
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',),  # تجميع هذه المعلومات في قسم قابل للطي
        }),
    )
    
    # جعل حقول التاريخ والوقت للقراءة فقط عند التعديل
    readonly_fields = ('created_at', 'updated_at')
    
    # تخصيص تسميات الحقول
    def get_position_key_display(self, obj):
        return obj.get_position_key_display()
    get_position_key_display.short_description = 'المنصب'
    get_position_key_display.admin_order_field = 'position_key'
    
    # تخصيص عرض حالة النشاط
    def is_active_display(self, obj):
        return "✓ نعم" if obj.is_active else "✗ لا"
    is_active_display.short_description = 'نشط'
    is_active_display.boolean = True
    
    # إضافة زر لحفظ التغييرات من القائمة
    actions = ['make_active', 'make_inactive']
    
    def make_active(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f'تم تفعيل {queryset.count()} مسؤول/مسؤولين بنجاح')
    make_active.short_description = 'تفعيل المسؤولين المختارين'
    
    def make_inactive(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f'تم إلغاء تفعيل {queryset.count()} مسؤول/مسؤولين بنجاح')
    make_inactive.short_description = 'إلغاء تفعيل المسؤولين المختارين'
    
    # تخصيص نموذج الإضافة والتعديل
    class Media:
        css = {
            'all': ('admin/css/custom_admin.css',)  # اختياري: إضافة ملف CSS مخصص
        }
    
    # حفظ معلومات المستخدم الذي قام بالتعديل (اختياري)
    def save_model(self, request, obj, form, change):
        if not change:  # إذا كان إضافة جديدة
            pass  # يمكن إضافة منطق خاص عند الإضافة
        super().save_model(request, obj, form, change)


# تسجيل سجلات التدقيق والأحداث (اختياري ولكن مفيد)
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'model_name', 'object_repr', 'created_at')
    list_filter = ('action', 'model_name', 'created_at')
    search_fields = ('user__username', 'object_repr', 'model_name')
    readonly_fields = ('user', 'action', 'model_name', 'object_id', 'object_repr', 
                      'changed_fields', 'deleted_data', 'ip_address', 'created_at', 'created_data')
    date_hierarchy = 'created_at'
    list_per_page = 20
    
    def has_add_permission(self, request):
        return False  # منع إضافة سجلات يدوياً
    
    def has_change_permission(self, request, obj=None):
        return False  # منع تعديل السجلات


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'model_name', 'object_name', 'created_at')
    list_filter = ('action', 'model_name', 'created_at')
    search_fields = ('user__username', 'object_name', 'details')
    readonly_fields = ('user', 'action', 'model_name', 'object_name', 'details', 
                      'ip_address', 'created_at')
    date_hierarchy = 'created_at'
    list_per_page = 20
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False