import os
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.student.models import Student
from apps.student.utils import generate_qr_for_student


class Command(BaseCommand):
    help = 'Force recreate and overwrite ALL student QR code images and signatures using current active host'

    def handle(self, *args, **options):
        students = Student.objects.all()
        updated_count = 0
        total_students = students.count()
        base_url = getattr(settings, 'SITE_DOMAIN', 'http://127.0.0.1:8000')
        
        self.stdout.write(f'[*] Starting complete batch QR overwrite for {total_students} students with base URL: {base_url}...')
        
        for student in students:
            # 1. حذف ملف الصورة القديم من القرص إن وُجد لتفادي تراكم الملفات العشوائية
            if student.qr_code and hasattr(student.qr_code, 'path') and os.path.exists(student.qr_code.path):
                try:
                    os.remove(student.qr_code.path)
                except Exception:
                    pass

            # 2. التأكد من وجود مفتاح الـ QR
            if not student.qr_key:
                student.qr_key = Student.generate_unique_qr_key()

            # 3. توليد ملف الـ QR الجديد
            content_file, image_name, qr_payload = generate_qr_for_student(student)
            
            if content_file and image_name:
                # حفظ الصورة الجديدة المحدثة
                student.qr_code.save(image_name, content_file, save=False)
                student.qr_code_data = qr_payload or ''
                
                Student.objects.filter(pk=student.pk).update(
                    qr_key=student.qr_key,
                    qr_code=student.qr_code.name,
                    qr_code_data=student.qr_code_data
                )
                updated_count += 1
                self.stdout.write(f"  [OVERWRITTEN] Student ID: {student.student_id} -> {student.qr_code_data}")

        self.stdout.write(
            self.style.SUCCESS(f'[DONE] Successfully recreated and overwritten QR codes for all {updated_count} students with {base_url}!')
        )



