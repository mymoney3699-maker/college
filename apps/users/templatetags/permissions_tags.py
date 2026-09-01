from django import template
from apps.users.permissions import has_execution_perm

register = template.Library()

@register.filter(name='has_exec_perm')
def has_exec_perm_filter(user, perm_name):
    """
    فلتر للتحقق من صلاحية التنفيذ في الـ Templates
    الاستخدام: {% if request.user|has_exec_perm:'renewal.add_course' %}
    أو: {% if request.user|has_exec_perm:'add_course' %}
    """
    return has_execution_perm(user, perm_name)


@register.simple_tag(name='can_exec')
def can_exec_tag(user, *perm_names):
    """
    تاغ للتحقق من واحدة أو أكثر من صلاحيات التنفيذ
    الاستخدام: {% can_exec request.user 'renewal.add_course' 'renewal.change_course' as can_modify %}
    """
    return has_execution_perm(user, *perm_names)
