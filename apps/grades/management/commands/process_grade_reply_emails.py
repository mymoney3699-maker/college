# apps/grades/management/commands/process_grade_reply_emails.py
from django.core.management.base import BaseCommand
from apps.grades.email_bridge import check_imap_inbox_for_grade_replies, simulate_incoming_grade_reply


class Command(BaseCommand):
    help = 'فحص ومعالجة رسائل ردود كشوف درجات الأساتذة الواردة عبر البريد الإلكتروني أو محاكاتها'

    def add_arguments(self, parser):
        parser.add_argument(
            '--simulate',
            action='store_true',
            help='محاكاة استقبال رد أستاذ محلياً وإنشاء إشعار تجريبي في المنظومة'
        )
        parser.add_argument(
            '--professor-id',
            type=int,
            help='معرف الأستاذ للمحاكاة'
        )
        parser.add_argument(
            '--professor-name',
            type=str,
            help='اسم الأستاذ للمحاكاة'
        )
        parser.add_argument(
            '--course-id',
            type=int,
            help='معرف المادة للمحاكاة'
        )
        parser.add_argument(
            '--course-name',
            type=str,
            help='اسم المادة للمحاكاة'
        )
        parser.add_argument(
            '--students-count',
            type=int,
            default=25,
            help='عدد الطلاب في الكشف'
        )
        parser.add_argument(
            '--attachment-name',
            type=str,
            default='grades_sheet.xlsx',
            help='اسم ملف الإكسل المرفق'
        )

    def handle(self, *args, **options):
        is_simulate = options.get('simulate')

        if is_simulate:
            self.stdout.write(">> بدء محاكاة استقبال رد أستاذ عبر البريد الإلكتروني...")
            result = simulate_incoming_grade_reply(
                professor_id=options.get('professor_id'),
                course_id=options.get('course_id'),
                students_count=options.get('students_count', 25),
                attachment_name=options.get('attachment_name', 'grades_sheet.xlsx'),
                custom_prof_name=options.get('professor_name'),
                custom_course_name=options.get('course_name')
            )
            self.stdout.write(self.style.SUCCESS(
                f"[SUCCESS] تم إنشاء الإشعار بنجاح! #{result['notification_id']}\n"
                f"- العنوان: {result['title']}\n"
                f"- النص: {result['message']}\n"
                f"- الأستاذ: {result['professor']}\n"
                f"- المادة: {result['course']}\n"
                f"- المرفق: {result['attachment']}"
            ))
        else:
            self.stdout.write(">> جاري فحص صندوق البريد الإلكتروني الرسمي عبر IMAP...")
            result = check_imap_inbox_for_grade_replies()
            if result.get('success'):
                self.stdout.write(self.style.SUCCESS(f"{result['message']}"))
                for n in result.get('notifications', []):
                    self.stdout.write(self.style.SUCCESS(f"  - [#{n['id']}] {n['title']} ({n['attachment']})"))
            else:
                self.stdout.write(self.style.ERROR(f"{result['message']}"))
