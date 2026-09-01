from django import forms
from django.core.exceptions import ValidationError
from .models import Course, Department, Level, StudyPlan, plan_code_validator

class CourseForm(forms.ModelForm):
    # تعريف حقول إضافية أو مخصصة غير موجودة مباشرة في الموديل الأساسي إذا لزم الأمر
    plan1Checkbox = forms.BooleanField(required=False, initial=False)
    plan2Checkbox = forms.BooleanField(required=False, initial=False)
    prerequisite = forms.CharField(required=False, max_length=50)

    class Meta:
        model = Course
        fields = [
            'name', 
            'code', 
            'credits', 
            'department_id', 
            'level_id', 
            'is_active', 
            'is_mandatory'
        ]

    def clean_code(self):
        """
        تأمين وتنظيف رمز المادة وتحويله دائماً إلى حروف كبيرة (Uppercase) 
        لحمايته وتوحيد شكله في قاعدة البيانات.
        """
        code = self.cleaned_data.get('code')
        if code:
            return code.strip().upper()
        return code

    def clean(self):
        """
        التحقق من صحة البيانات المتقاطعة (Cross-field validation)
        """
        cleaned_data = super().clean()
        credits = cleaned_data.get('credits')

        # مثال للتحقق: التأكد من أن عدد الساعات منطقي وليس سالباً
        if credits and credits <= 0:
            self.add_error('credits', 'عدد الساعات المعتمدة يجب أن يكون أكبر من صفر.')

        return cleaned_data


class StudyPlanForm(forms.ModelForm):
    class Meta:
        model = StudyPlan
        fields = ['code', 'name', 'description', 'is_active']
        labels = {
            'code': 'رمز الخطة',
            'name': 'اسم الخطة',
            'description': 'وصف الخطة',
            'is_active': 'حالة التفعيل',
        }

    def clean_code(self):
        code = self.cleaned_data.get('code')
        if code:
            code = code.strip().upper()
            plan_code_validator(code)
            return code
        return code