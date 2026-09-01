def notification_context(request):
    """توفير عدد الإشعارات غير المقروءة في جميع القوالب حسب دور المستخدم"""
    if getattr(request, 'user', None) and request.user.is_authenticated:
        try:
            from apps.student.models import Notification
            from apps.student.views import get_student_for_user
            from django.db.models import Q
            student = get_student_for_user(request)
            if student:
                count = Notification.objects.filter(
                    Q(student=student) | Q(target_role__in=['all', 'student']),
                    is_read=False
                ).count()
            else:
                count = Notification.objects.filter(
                    Q(target_role__in=['all', 'registrar', 'admin']) | Q(student__isnull=True),
                    is_read=False
                ).count()
            return {'unread_notifications_count': count}
        except Exception:
            return {'unread_notifications_count': 0}
    return {'unread_notifications_count': 0}
