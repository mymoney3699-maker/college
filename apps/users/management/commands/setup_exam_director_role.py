# apps/users/management/commands/setup_exam_director_role.py
from django.core.management.base import BaseCommand
from apps.users.utils import setup_exam_director_role_and_permissions


class Command(BaseCommand):
    help = "تهيئة وتسجيل مجموعة وصلاحيات دور 'مدير الدراسة والامتحانات' في قاعدة البيانات"

    def handle(self, *args, **options):
        self.stdout.write(">> جاري تهيئة وتسجيل مجموعة وصلاحيات 'مدير الدراسة والامتحانات'...")
        result = setup_exam_director_role_and_permissions()
        group = result['group']
        count = result['permissions_count']
        
        self.stdout.write(self.style.SUCCESS(
            f"[SUCCESS] تم تسجيل المجموعة '{group.name}' بنجاح!\n"
            f"- عدد الصلاحيات الممنوحة: {count}\n"
            f"- الصلاحيات تشمل: السجلات الأكاديمية، كشوف الدرجات، الأقسام والتخصصات، وأعضاء هيئة التدريس."
        ))
