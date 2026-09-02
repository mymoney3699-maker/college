def notification_context(request):
    """توفير عدد الإشعارات غير المقروءة في جميع القوالب حسب دور المستخدم بدقة"""
    if getattr(request, 'user', None) and request.user.is_authenticated:
        try:
            from apps.renewal.views import get_scoped_notifications_queryset
            count = get_scoped_notifications_queryset(request.user).filter(is_read=False).count()
            return {'unread_notifications_count': count}
        except Exception:
            return {'unread_notifications_count': 0}
    return {'unread_notifications_count': 0}
