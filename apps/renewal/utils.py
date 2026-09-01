import datetime
from django.conf import settings
from django.utils import timezone


def get_system_date(request=None):
    """
    دالة زمنية مركزية لإرجاع تاريخ النظام الحالي بناءً على وضع المحاكاة (Simulation Mode).
    
    1. إذا كان settings.ENABLE_SIMULATION_MODE يساوي True:
       - فحص التاريخ المحدد في جلسة المستخدم (request.session['simulated_date']) إن وُجد.
       - البحث عن الفصل الدراسي النشط حالياً في قاعدة البيانات (Semester.objects.filter(is_active=True).first()).
       - إذا وُجد فصل نشط، يتم إرجاع التاريخ المعتمد أو بدء هذا الفصل.
    2. إذا كان ENABLE_SIMULATION_MODE يساوي False أو تعذر الوصول لتاريخ محاكاة:
       - إرجاع التاريخ الفعلي الحقيقي الحالي (timezone.now().date()).
    """
    enable_sim = getattr(settings, 'ENABLE_SIMULATION_MODE', False)

    if enable_sim:
        # 1. فحص وجود تاريخ محاكاة مخصص في Session
        if request and hasattr(request, 'session'):
            sim_date = request.session.get('simulated_date')
            if sim_date:
                if isinstance(sim_date, datetime.date):
                    return sim_date
                if isinstance(sim_date, datetime.datetime):
                    return sim_date.date()
                try:
                    return datetime.date.fromisoformat(str(sim_date))
                except (ValueError, TypeError):
                    pass

        # 2. البحث عن الفصل الدراسي النشط حالياً
        try:
            from apps.renewal.models import Semester
            active_semester = Semester.objects.filter(is_active=True).first()
            if active_semester:
                if hasattr(active_semester, 'start_date') and active_semester.start_date:
                    return active_semester.start_date
                elif hasattr(active_semester, 'year') and active_semester.year:
                    # تقدير التاريخ بناءً على سنة ونوع الفصل النشط
                    month = 9 if getattr(active_semester, 'type', 'fall') == 'fall' else 2
                    return datetime.date(active_semester.year, month, 1)
        except Exception as e:
            pass

    # 3. إرجاع التاريخ الفعلي الحالي كخيار افتراضي
    return timezone.now().date()
